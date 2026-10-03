-- Run after 002_two_slots.sql. Wallet changes and receipts commit together.
begin;
alter table public.transactions add column if not exists created_by uuid references auth.users(id);

-- Credit a wallet only for an admin, with a unique request ID for safe retries.
create or replace function public.admin_topup(student uuid, amount numeric, request_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare receipt public.transactions%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if student is null or request_id is null or amount is null or amount::text in ('NaN', 'Infinity', '-Infinity')
    or amount < 1 or amount > 10000 or amount <> round(amount, 2) then
    raise exception 'Enter an amount from 1 to 10000 with at most two decimal places';
  end if;
  perform 1 from public.wallets where student_id = student for update;
  if not found then raise exception 'Student wallet not found'; end if;
  select * into receipt from public.transactions where id = request_id;
  if found then
    if receipt.student_id = student and receipt.amount = amount and receipt.type = 'Top-up'
      and receipt.status = 'Completed' and receipt.created_by = auth.uid() then return request_id; end if;
    raise exception 'Request ID already used';
  end if;
  update public.wallets set balance = balance + amount where student_id = student;
  insert into public.transactions(id, student_id, type, amount, status, note, created_by)
    values (request_id, student, 'Top-up', amount, 'Completed', 'Manual admin credit', auth.uid());
  return request_id;
end;
$$;
revoke all on function public.admin_topup(uuid, numeric, uuid) from public, anon;
grant execute on function public.admin_topup(uuid, numeric, uuid) to authenticated;
commit;
