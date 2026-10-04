-- Run after 001_initial.sql. Keep Slot 1 and all existing student/card data.
begin;
alter table public.products drop constraint if exists products_id_check;
alter table public.products add constraint products_id_check check (id in (1, 2));
insert into public.products(id, name, price, stock)
values (2, 'Biscuits', 15, 0) on conflict (id) do nothing;
-- Existing admin-only read/update policies and column grants still apply.
commit;
