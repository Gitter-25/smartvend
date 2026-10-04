-- Run after migration 004. Requires an admin and enrolled card; rolls back changes.
begin;
do $$
declare
  actor_id uuid := (select user_id from public.admins limit 1);
  enrolled public.cards%rowtype;
  reference uuid := gen_random_uuid();
  funds numeric;
  remaining integer;
begin
  select * into enrolled from public.cards limit 1;
  if actor_id is null or enrolled.id is null then raise exception 'Create an admin and enroll a card first'; end if;
  if has_function_privilege('authenticated', 'public.simulate_purchase(uuid,integer,uuid,uuid)', 'execute') then
    raise exception 'TEST FAILED: browser can call payment function';
  end if;
  update public.cards set active = true where id = enrolled.id;
  update public.wallets set balance = 100 where student_id = enrolled.student_id;
  update public.products set price = 25, stock = 2 where id = 1;
  perform public.simulate_purchase(enrolled.id, 1, reference, actor_id);
  perform public.simulate_purchase(enrolled.id, 1, reference, actor_id);
  select balance into funds from public.wallets where student_id = enrolled.student_id;
  select stock into remaining from public.products where id = 1;
  if funds <> 75 or remaining <> 1 then raise exception 'TEST FAILED: charge, stock, or retry'; end if;
  if (select count(*) from public.transactions where id = reference and slot_id = 1 and type = 'Purchase') <> 1 then
    raise exception 'TEST FAILED: receipt';
  end if;
  update public.cards set active = false where id = enrolled.id;
  begin
    perform public.simulate_purchase(enrolled.id, 1, gen_random_uuid(), actor_id);
    raise exception 'TEST FAILED: disabled card accepted';
  exception when raise_exception then if sqlerrm <> 'Card is disabled' then raise; end if;
  end;
  update public.cards set active = true where id = enrolled.id;
  update public.products set stock = 0 where id = 1;
  begin
    perform public.simulate_purchase(enrolled.id, 1, gen_random_uuid(), actor_id);
    raise exception 'TEST FAILED: empty slot accepted';
  exception when raise_exception then if sqlerrm <> 'Slot is out of stock' then raise; end if;
  end;
  update public.products set stock = 1 where id = 1;
  update public.wallets set balance = 0 where student_id = enrolled.student_id;
  begin
    perform public.simulate_purchase(enrolled.id, 1, gen_random_uuid(), actor_id);
    raise exception 'TEST FAILED: insufficient funds accepted';
  exception when raise_exception then if sqlerrm <> 'Insufficient wallet balance' then raise; end if;
  end;
  select stock into remaining from public.products where id = 1;
  if remaining <> 1 then raise exception 'TEST FAILED: rejected purchase changed stock'; end if;
  raise notice 'PASS: permissions, charge, receipt, retry, disabled card, stock, and funds';
end;
$$;
rollback;
