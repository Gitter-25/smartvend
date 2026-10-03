-- Run after 003_admin_topups.sql. Purchase authorization is backend-only.
begin;
alter table public.transactions add column if not exists slot_id integer references public.products(id);
alter table public.transactions add column if not exists product_name text;

-- Charge once using the current database price and preserve the product snapshot.
create or replace function public.simulate_purchase(card uuid, slot integer, request_id uuid, actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  holder public.cards%rowtype;
  item public.products%rowtype;
  receipt public.transactions%rowtype;
  funds numeric;
begin
  if actor is null or not exists (select 1 from public.admins where user_id = actor) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if request_id is null or slot is null or slot not in (1, 2) then raise exception 'Select Slot 1 or Slot 2'; end if;
  select * into holder from public.cards where id = card for update;
  if not found then raise exception 'Card not enrolled'; end if;
  select balance into funds from public.wallets where student_id = holder.student_id for update;
  if not found then raise exception 'Student wallet not found'; end if;
  select * into receipt from public.transactions where id = request_id;
  if found then
    if receipt.student_id <> holder.student_id or receipt.slot_id is distinct from slot
      or receipt.type <> 'Purchase' or receipt.created_by is distinct from actor then raise exception 'Request ID already used'; end if;
    return jsonb_build_object('transactionId', receipt.id, 'amount', receipt.amount, 'status', receipt.status);
  end if;
  if not holder.active then raise exception 'Card is disabled'; end if;
  select * into item from public.products where id = slot for update;
  if not found then raise exception 'Slot not found'; end if;
  if item.stock < 1 then raise exception 'Slot is out of stock'; end if;
  if funds < item.price then raise exception 'Insufficient wallet balance'; end if;
  update public.wallets set balance = balance - item.price where student_id = holder.student_id;
  update public.products set stock = stock - 1 where id = slot;
  insert into public.transactions(id, student_id, type, amount, status, note, created_by, slot_id, product_name)
    values (request_id, holder.student_id, 'Purchase', item.price, 'Completed', 'Software simulation; no physical dispense', actor, slot, item.name);
  return jsonb_build_object('transactionId', request_id, 'amount', item.price, 'status', 'Completed');
end;
$$;
revoke all on function public.simulate_purchase(uuid, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.simulate_purchase(uuid, integer, uuid, uuid) to service_role;
commit;
