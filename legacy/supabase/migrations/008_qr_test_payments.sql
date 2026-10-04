-- Apply once after 007. Stop vending and refresh admin tabs after upgrading.
begin;
lock table public.machine, public.vend_jobs, public.transactions in access exclusive mode;
alter table public.transactions alter column student_id drop not null;
alter table public.transactions add column payment_method text not null default 'Card wallet'
 check (payment_method in ('Card wallet','QR test'));
alter table public.transactions add constraint payment_student_check
 check (payment_method='QR test' or student_id is not null);
alter table public.transactions drop constraint transactions_status_check;
alter table public.transactions add constraint transactions_status_check
 check (status in ('Pending','Completed','Failed','Refunded','RefundPending'));
alter table public.vend_jobs alter column card_id drop not null;
alter table public.vend_jobs drop constraint vend_jobs_state_check;
alter table public.vend_jobs add constraint vend_jobs_state_check
 check (state in ('AwaitingPayment','Authorized','Dispensing','Completed','Refunded','Cancelled','RefundPending'));
create table public.qr_orders (
 id uuid primary key references public.vend_jobs(id),
 session_id text unique,
 checkout_url text,
 payment_id text unique,
 refund_id text unique,
 created_at timestamptz not null default now()
);
alter table public.qr_orders enable row level security;
revoke all on public.qr_orders from public,anon,authenticated;
grant select on public.qr_orders to authenticated;
grant all on public.qr_orders to service_role;
create policy admin_qr_read on public.qr_orders for select to authenticated using ((select public.is_admin()));
-- Reserve stock during checkout too. RefundPending has already restored stock.
create or replace function public.guard_reserved_slot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists (select 1 from public.vend_jobs j join public.transactions t on t.id=j.id
   where t.slot_id=old.id and j.state in ('AwaitingPayment','Authorized','Dispensing')) then
   raise exception 'Resolve the pending dispense before editing this slot';
 end if;
 return new;
end;
$$;
-- Only the first caller may create an external checkout; unknown outcomes need recovery.
create function public.reserve_qr(slot integer, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.products%rowtype; receipt public.transactions%rowtype;
begin
 perform 1 from public.machine where id=1 for update;
 select * into receipt from public.transactions where id=request_id;
 if found then
   if receipt.payment_method<>'QR test' or receipt.slot_id is distinct from slot then raise exception 'Request ID already used'; end if;
   return jsonb_build_object('createAllowed',false,'amount',receipt.amount,'product',receipt.product_name);
 end if;
 if request_id is null or slot is null or slot not in (1,2) then raise exception 'Invalid vending request'; end if;
 if exists(select 1 from public.vend_jobs where state in ('AwaitingPayment','Authorized','Dispensing','RefundPending')) then raise exception 'Machine has an unresolved dispense'; end if;
 select * into item from public.products where id=slot for update;
 if not found or item.stock<1 then raise exception 'Slot is out of stock'; end if;
 if item.price<1 or item.price>9999999.99 then raise exception 'QR test price must be between PHP 1 and PHP 9999999.99'; end if;
 update public.products set stock=stock-1 where id=slot;
 insert into public.transactions(id,type,amount,status,note,slot_id,product_name,payment_method)
 values(request_id,'Purchase',item.price,'Pending','Sandbox checkout: no real money',slot,item.name,'QR test');
 insert into public.vend_jobs(id,state) values(request_id,'AwaitingPayment');
 insert into public.qr_orders(id) values(request_id);
 return jsonb_build_object('createAllowed',true,'amount',item.price,'product',item.name);
end;
$$;
-- Bind one provider session after validating it against the saved order on the server.
create function public.bind_qr(request_id uuid, provider_session text, provider_url text) returns void
language plpgsql security definer set search_path='' as $$
declare saved text;
begin
 perform 1 from public.machine where id=1 for update;
 select session_id into saved from public.qr_orders where id=request_id for update;
 if not found then raise exception 'Unknown QR order'; end if;
 if saved is not null and saved<>provider_session then raise exception 'Checkout already bound'; end if;
 update public.qr_orders set session_id=provider_session,checkout_url=provider_url where id=request_id;
end;
$$;
-- Provider-verified outcomes only. Expiry cannot turn into a later automatic dispense.
create function public.settle_qr(request_id uuid, provider_session text, outcome text, provider_payment text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.vend_jobs%rowtype; receipt public.transactions%rowtype; saved public.qr_orders%rowtype;
begin
 perform 1 from public.machine where id=1 for update;
 select * into saved from public.qr_orders where id=request_id for update;
 if not found or saved.session_id is distinct from provider_session then raise exception 'Checkout mismatch'; end if;
 select * into job from public.vend_jobs where id=request_id for update;
 select * into receipt from public.transactions where id=request_id for update;
 if outcome='paid' then
   if provider_payment is null then raise exception 'Verified payment required'; end if;
   if saved.payment_id is not null and saved.payment_id<>provider_payment then raise exception 'Payment mismatch'; end if;
   update public.qr_orders set payment_id=provider_payment where id=request_id;
   if job.state='AwaitingPayment' then
     update public.vend_jobs set state='Authorized',updated_at=now() where id=request_id;
     update public.transactions set note='Sandbox API payment verified; awaiting dispense' where id=request_id;
   elsif job.state='Cancelled' then
     update public.vend_jobs set state='RefundPending',updated_at=now() where id=request_id;
     update public.transactions set status='RefundPending',note='Late sandbox payment after cancellation; refund required, do not dispense' where id=request_id;
   end if;
 elsif outcome='expired' then
   if job.state='AwaitingPayment' then
     update public.vend_jobs set state='Cancelled',updated_at=now() where id=request_id;
     update public.products set stock=stock+1 where id=receipt.slot_id;
     update public.transactions set status='Failed',note='Sandbox checkout expired without a verified payment' where id=request_id;
   end if;
 else raise exception 'Invalid provider outcome';
 end if;
 return (select jsonb_build_object('state',state) from public.vend_jobs where id=request_id);
end;
$$;
-- A refund is complete only after verification with the payment provider.
create function public.confirm_qr_refund(request_id uuid, provider_refund text) returns void
language plpgsql security definer set search_path='' as $$
declare current_state text;
begin
 perform 1 from public.machine where id=1 for update;
 select state into current_state from public.vend_jobs where id=request_id for update;
 if current_state not in ('RefundPending','Refunded') or current_state is null then raise exception 'Refund is not pending'; end if;
 if not exists(select 1 from public.qr_orders where id=request_id and payment_id is not null) then raise exception 'Unknown QR payment'; end if;
 update public.qr_orders set refund_id=provider_refund where id=request_id;
 update public.vend_jobs set state='Refunded',updated_at=now() where id=request_id;
 update public.transactions set status='Refunded',note='Sandbox provider refund verified; no wallet credit' where id=request_id;
end;
$$;
create or replace function public.authorize_vend(card uuid, slot integer, request_id uuid) returns jsonb
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
 if exists (select 1 from public.vend_jobs where state in ('AwaitingPayment','Authorized','Dispensing','RefundPending')) then raise exception 'Machine has an unresolved dispense'; end if;
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
create or replace function public.finish_vend(request_id uuid, dispensed boolean, reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.vend_jobs%rowtype; receipt public.transactions%rowtype; target text;
begin
 if dispensed is null or reason is null or length(trim(reason)) not between 3 and 300 then raise exception 'Provide a confirmed outcome and reason'; end if;

 perform 1 from public.machine where id=1 for update;
 select * into job from public.vend_jobs where id=request_id for update;
 if not found then raise exception 'Unknown dispense'; end if;
 select * into receipt from public.transactions where id=request_id for update;
 if job.state in ('AwaitingPayment','Cancelled') then raise exception 'Payment has not been verified'; end if;
 target := case when dispensed then 'Completed' when receipt.payment_method='QR test' then 'RefundPending' else 'Refunded' end;
 if job.state in ('Completed','Refunded','RefundPending') then
   if job.state <> target and not (job.state='Refunded' and target='RefundPending') then raise exception 'Outcome already resolved differently'; end if;
   return jsonb_build_object('state',job.state);
 end if;
 if dispensed and job.state <> 'Dispensing' then raise exception 'Dispense was not started'; end if;
 -- Mark resolved before stock restoration so the reserved-slot guard permits it.
 update public.vend_jobs set state=target,updated_at=now(),resolution_note=trim(reason) where id=request_id;
 if not dispensed then
   if receipt.payment_method='Card wallet' then
     update public.wallets set balance=balance+receipt.amount where student_id=receipt.student_id;
   end if;
   update public.products set stock=stock+1 where id=receipt.slot_id;
 end if;
 update public.transactions set status=target,note=trim(reason) where id=request_id;
 return jsonb_build_object('state',target);
end;
$$;

revoke all on function public.reserve_qr(integer,uuid),public.bind_qr(uuid,text,text),public.settle_qr(uuid,text,text,text),public.confirm_qr_refund(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_qr(integer,uuid),public.bind_qr(uuid,text,text),public.settle_qr(uuid,text,text,text),public.confirm_qr_refund(uuid,text) to service_role;
commit;
