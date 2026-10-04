-- Apply after 005. One authenticated machine, two slots, no automatic redispatch.
begin;
create table public.machine (
 id integer primary key check (id = 1), last_seen timestamptz
);
insert into public.machine values (1, null);
create table public.vend_jobs (
 id uuid primary key references public.transactions(id),
 card_id uuid not null references public.cards(id),
 state text not null check (state in ('Authorized','Dispensing','Completed','Reversed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolution_note text not null default ''
);
alter table public.machine enable row level security;
alter table public.vend_jobs enable row level security;
revoke all on public.machine, public.vend_jobs from anon, authenticated;
grant select on public.machine, public.vend_jobs to authenticated;
grant all on public.machine, public.vend_jobs to service_role;
create policy admin_machine_read on public.machine for select to authenticated using ((select public.is_admin()));
create policy admin_jobs_read on public.vend_jobs for select to authenticated using ((select public.is_admin()));
-- Block product replacement and stock edits while physical stock is reserved.
create function public.guard_reserved_slot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if exists (select 1 from public.vend_jobs j join public.transactions t on t.id=j.id
   where t.slot_id=old.id and j.state in ('Authorized','Dispensing')) then
   raise exception 'Resolve the pending dispense before editing this slot';
 end if;
 return new;
end;
$$;
create trigger reserved_slot before update on public.products for each row execute function public.guard_reserved_slot();
-- Authorize once, charging and reserving stock together under a machine lock.
create function public.authorize_vend(card uuid, slot integer, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare holder public.cards%rowtype; item public.products%rowtype; receipt public.transactions%rowtype; job public.vend_jobs%rowtype; funds numeric;
begin
 perform 1 from public.machine where id=1 for update;
 select * into job from public.vend_jobs where id=request_id;
 if found then
   select * into receipt from public.transactions where id=request_id;
   if job.card_id is distinct from card or receipt.slot_id is distinct from slot then raise exception 'Request ID already used'; end if;
   return jsonb_build_object('transactionId',job.id,'state',job.state,'amount',receipt.amount);
 end if;
 if request_id is null or slot is null or slot not in (1,2) then raise exception 'Invalid vending request'; end if;
 if exists (select 1 from public.vend_jobs where state in ('Authorized','Dispensing')) then raise exception 'Machine has an unresolved dispense'; end if;
 select * into holder from public.cards where id=card for update;
 if not found or not holder.active then raise exception 'Card unavailable'; end if;
 select balance into funds from public.wallets where student_id=holder.student_id for update;
 if not found then raise exception 'Wallet unavailable'; end if;
 select * into item from public.products where id=slot for update;
 if not found or item.stock<1 then raise exception 'Slot is out of stock'; end if;
 if funds<item.price then raise exception 'Insufficient wallet balance'; end if;
 update public.wallets set balance=balance-item.price where student_id=holder.student_id;
 update public.products set stock=stock-1 where id=slot;
 insert into public.transactions(id,student_id,type,amount,status,note,slot_id,product_name)
 values(request_id,holder.student_id,'Purchase',item.price,'Pending','Physical dispense reserved',slot,item.name);
 insert into public.vend_jobs(id,card_id,state) values(request_id,card,'Authorized');
 return jsonb_build_object('transactionId',request_id,'state','Authorized','amount',item.price);
end;
$$;
-- Only the first acknowledged start grants permission to actuate.
create function public.start_vend(request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.vend_jobs%rowtype; chosen integer;
begin
 perform 1 from public.machine where id=1 for update;
 select * into job from public.vend_jobs where id=request_id for update;
 if not found then raise exception 'Unknown dispense'; end if;
 if job.state <> 'Authorized' then return jsonb_build_object('state',job.state,'shouldDispense',false); end if;
 update public.vend_jobs set state='Dispensing',updated_at=now() where id=request_id;
 select slot_id into chosen from public.transactions where id=request_id;
 return jsonb_build_object('state','Dispensing','shouldDispense',true,'slot',chosen);
end;
$$;
-- Resolve a confirmed outcome exactly once; false means confirmed NO item dispensed.
create function public.finish_vend(request_id uuid, dispensed boolean, reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.vend_jobs%rowtype; receipt public.transactions%rowtype; target text;
begin
 if dispensed is null or reason is null or length(trim(reason)) not between 3 and 300 then raise exception 'Provide a confirmed outcome and reason'; end if;
 target := case when dispensed then 'Completed' else 'Reversed' end;
 perform 1 from public.machine where id=1 for update;
 select * into job from public.vend_jobs where id=request_id for update;
 if not found then raise exception 'Unknown dispense'; end if;
 if job.state in ('Completed','Reversed') then
   if job.state <> target then raise exception 'Outcome already resolved differently'; end if;
   return jsonb_build_object('state',job.state);
 end if;
 if dispensed and job.state <> 'Dispensing' then raise exception 'Dispense was not started'; end if;
 select * into receipt from public.transactions where id=request_id for update;
 -- Mark resolved before stock restoration so the reserved-slot guard permits it.
 update public.vend_jobs set state=target,updated_at=now(),resolution_note=trim(reason) where id=request_id;
 if not dispensed then
   update public.wallets set balance=balance+receipt.amount where student_id=receipt.student_id;
   update public.products set stock=stock+1 where id=receipt.slot_id;
 end if;
 update public.transactions set status=target,note=trim(reason) where id=request_id;
 return jsonb_build_object('state',target);
end;
$$;
-- Admins can reconcile a machine failure after physically checking its result.
create function public.resolve_vend(request_id uuid, dispensed boolean, reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if reason is null or length(trim(reason)) not between 3 and 200 then raise exception 'Provide an inspection note'; end if;
 return public.finish_vend(request_id,dispensed,'Admin ' || auth.uid()::text || ': ' || reason);
end;
$$;
revoke all on function public.authorize_vend(uuid,integer,uuid), public.start_vend(uuid), public.finish_vend(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.authorize_vend(uuid,integer,uuid), public.start_vend(uuid), public.finish_vend(uuid,boolean,text) to service_role;
revoke all on function public.resolve_vend(uuid,boolean,text) from public,anon;
grant execute on function public.resolve_vend(uuid,boolean,text) to authenticated;
commit;
