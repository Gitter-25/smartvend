-- Run once in a new SmartVend Supabase project.
begin;

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Check admin membership without allowing users to grant themselves access.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  number text not null unique check (length(trim(number)) between 1 and 40 and number = upper(trim(number))),
  created_at timestamptz not null default now()
);
create table public.wallets (
  student_id uuid primary key references public.students(id),
  balance numeric(12,2) not null default 0 check (balance >= 0)
);
-- Phase 4 fills these values through a backend encryption function only.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id),
  identifier_ciphertext text not null,
  identifier_lookup text not null unique,
  active boolean not null default true
);
create table public.products (
  id integer primary key check (id = 1),
  name text not null check (length(trim(name)) between 1 and 80),
  price numeric(12,2) not null check (price > 0),
  stock integer not null check (stock >= 0)
);
insert into public.products values (1, 'Bottled water', 25, 12);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  type text not null check (type in ('Top-up', 'Purchase')),
  amount numeric(12,2) not null check (amount > 0),
  status text not null check (status in ('Pending', 'Completed', 'Failed', 'Reversed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.students enable row level security;
alter table public.wallets enable row level security;
alter table public.cards enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;

-- Remove Supabase's default grants, then grant only the needed operations.
revoke all on public.admins, public.students, public.wallets, public.cards, public.products, public.transactions from anon, authenticated;
grant select on public.admins, public.students, public.wallets, public.products, public.transactions to authenticated;
grant select(id, student_id, active) on public.cards to authenticated;
grant update(active) on public.cards to authenticated;
grant update(name, price, stock) on public.products to authenticated;
grant all on public.admins, public.students, public.wallets, public.cards, public.products, public.transactions to service_role;

create policy own_admin_membership on public.admins for select to authenticated using (user_id = auth.uid());
create policy admin_students_read on public.students for select to authenticated using ((select public.is_admin()));
create policy admin_wallets_read on public.wallets for select to authenticated using ((select public.is_admin()));
create policy admin_cards_read on public.cards for select to authenticated using ((select public.is_admin()));
create policy admin_cards_update on public.cards for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_products_read on public.products for select to authenticated using ((select public.is_admin()));
create policy admin_products_update on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_transactions_read on public.transactions for select to authenticated using ((select public.is_admin()));

-- Create a student and wallet in one transaction after verifying admin access.
create function public.register_student(student_name text, student_number text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  insert into public.students(name, number) values (trim(student_name), upper(trim(student_number))) returning id into new_id;
  insert into public.wallets(student_id) values (new_id);
  return new_id;
end;
$$;
revoke all on function public.register_student(text, text) from public, anon;
grant execute on function public.register_student(text, text) to authenticated;
commit;
