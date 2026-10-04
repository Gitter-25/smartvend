-- Run after migration 003. Test credits are rolled back at the end.
begin;
do $$
declare
  actor uuid := (select user_id from public.admins limit 1);
  target uuid := (select student_id from public.wallets limit 1);
  reference uuid := gen_random_uuid();
  original numeric;
  updated numeric;
begin
  if actor is null or target is null then raise exception 'Create an admin and student first'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.admin_topup(target, 10, reference);
    raise exception 'TEST FAILED: non-admin accepted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor)::text, true);
  select balance into original from public.wallets where student_id = target;
  perform public.admin_topup(target, 10.25, reference);
  perform public.admin_topup(target, 10.25, reference);
  select balance into updated from public.wallets where student_id = target;
  if updated <> original + 10.25 then raise exception 'TEST FAILED: duplicate credit or wrong balance'; end if;
  if (select count(*) from public.transactions where id = reference and created_by = actor and status = 'Completed') <> 1 then
    raise exception 'TEST FAILED: missing receipt';
  end if;
  begin
    perform public.admin_topup(target, 0, gen_random_uuid());
    raise exception 'TEST FAILED: zero credit accepted';
  exception when raise_exception then
    if sqlerrm <> 'Enter an amount from 1 to 10000 with at most two decimal places' then raise; end if;
  end;
  raise notice 'PASS: admin checks, receipt, safe retry, and invalid amount';
end;
$$;
rollback;
