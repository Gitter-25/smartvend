-- Apply after 004. Version every slot change, including purchases.
begin;
alter table public.products add column version bigint not null default 0;
create function public.bump_slot_version() returns trigger
language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
create trigger slot_version before update on public.products for each row execute function public.bump_slot_version();
revoke update(name, price, stock) on public.products from authenticated;
-- Reject stale edits rather than replacing stock already reduced by a sale.
create function public.save_slot(slot integer, expected_version bigint, product_name text, product_price numeric, stock_count integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if product_price is null or product_price::text in ('NaN','Infinity','-Infinity') or product_price <= 0
    or product_price <> round(product_price, 2) then raise exception 'Enter a positive price with at most two decimals'; end if;
  update public.products set name = trim(product_name), price = product_price, stock = stock_count
    where id = slot and version = expected_version;
  if not found then raise exception 'Slot changed. Reload its latest values before saving.'; end if;
end;
$$;
revoke all on function public.save_slot(integer,bigint,text,numeric,integer) from public, anon;
grant execute on function public.save_slot(integer,bigint,text,numeric,integer) to authenticated;
commit;
