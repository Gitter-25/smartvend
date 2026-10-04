-- Run after 006. Rename existing statuses without issuing another refund.
begin;
-- Serialize against device settlements while changing the status vocabulary.
lock table public.machine, public.vend_jobs, public.transactions in access exclusive mode;
alter table public.transactions drop constraint transactions_status_check;
alter table public.vend_jobs drop constraint vend_jobs_state_check;
update public.transactions set status='Refunded' where status='Reversed';
update public.vend_jobs set state='Refunded' where state='Reversed';
alter table public.transactions add constraint transactions_status_check
 check (status in ('Pending','Completed','Failed','Refunded'));
alter table public.vend_jobs add constraint vend_jobs_state_check
 check (state in ('Authorized','Dispensing','Completed','Refunded'));
create or replace function public.finish_vend(request_id uuid, dispensed boolean, reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.vend_jobs%rowtype; receipt public.transactions%rowtype; target text;
begin
 if dispensed is null or reason is null or length(trim(reason)) not between 3 and 300 then raise exception 'Provide a confirmed outcome and reason'; end if;
 target := case when dispensed then 'Completed' else 'Refunded' end;
 perform 1 from public.machine where id=1 for update;
 select * into job from public.vend_jobs where id=request_id for update;
 if not found then raise exception 'Unknown dispense'; end if;
 if job.state in ('Completed','Refunded') then
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

-- CREATE OR REPLACE preserves the existing backend-only grants.
commit;
