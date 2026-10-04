import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const actor = '00000000-0000-0000-0000-000000000001';
const card = '00000000-0000-0000-0000-000000000002';
const student = '00000000-0000-0000-0000-000000000003';
const reference = '00000000-0000-0000-0000-000000000004';

// Run the real migrations in PostgreSQL with a minimal Supabase Auth boundary.
test('database migrations enforce stock versions, privileges and once-only vending settlement', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await readdir('supabase/migrations')).filter((file) => file !== '007_refunded_status.sql').sort()) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(`insert into auth.users values ('${actor}'); insert into public.admins values ('${actor}');
      select set_config('request.jwt.claim.sub','${actor}',false);
      insert into students(id,name,number) values('${student}','Test student','TEST-1');
      insert into wallets values('${student}',100);
      insert into cards(id,student_id,identifier_ciphertext,identifier_lookup) values('${card}','${student}','synthetic','synthetic');`);
    // Exercise the existing SQL suites too; each suite rolls its data changes back.
    for (const file of ['admin_topup.sql', 'simulated_purchase.sql']) await db.exec(await readFile(`supabase/tests/${file}`, 'utf8'));
    const value = async (sql) => (await db.query(sql)).rows[0];
    assert.equal((await value("select has_column_privilege('authenticated','products','stock','update') as allowed")).allowed, false);
    for (const signature of ['authorize_vend(uuid,integer,uuid)', 'start_vend(uuid)', 'finish_vend(uuid,boolean,text)']) {
      assert.equal((await value(`select has_function_privilege('authenticated','${signature}','execute') as allowed`)).allowed, false);
    }
    await db.exec(`select save_slot(1,0,'Water',25,4);`);
    await assert.rejects(db.exec(`select save_slot(1,0,'Stale',25,99);`), /Slot changed/);
    await db.exec(`select authorize_vend('${card}',1,'${reference}'); select authorize_vend('${card}',1,'${reference}');`);
    assert.equal((await value('select balance from wallets')).balance, '75.00');
    assert.equal((await value('select stock from products where id=1')).stock, 3);
    await assert.rejects(db.exec(`select authorize_vend('${card}',2,gen_random_uuid());`), /unresolved/);
    await assert.rejects(db.exec(`select save_slot(1,2,'Changed',30,10);`), /pending dispense/);
    assert.equal((await value(`select start_vend('${reference}') as result`)).result.shouldDispense, true);
    assert.equal((await value(`select start_vend('${reference}') as result`)).result.shouldDispense, false);
    await db.exec(`select finish_vend('${reference}',false,'Confirmed no item'); select finish_vend('${reference}',false,'Retry no item');`);
    // Upgrade an already refunded legacy record, then verify retry does not refund twice.
    await db.exec(await readFile('supabase/migrations/007_refunded_status.sql', 'utf8'));
    assert.equal((await value(`select status from transactions where id='${reference}'`)).status, 'Refunded');
    assert.equal((await value(`select finish_vend('${reference}',false,'Repeat refund') as result`)).result.state, 'Refunded');
    assert.equal((await value('select balance from wallets')).balance, '100.00');
    assert.equal((await value('select stock from products where id=1')).stock, 4);
    await assert.rejects(db.exec(`select finish_vend('${reference}',true,'Contradictory result');`), /differently/);
    const next = '00000000-0000-0000-0000-000000000005';
    await db.exec(`select authorize_vend('${card}',1,'${next}');`);
    await assert.rejects(db.exec(`select finish_vend('${next}',true,'Unstarted item');`), /not started/);
    await db.exec(`select start_vend('${next}'); select finish_vend('${next}',true,'Sensor confirmed drop'); select finish_vend('${next}',true,'Repeated confirmation');`);
    assert.equal((await value('select balance from wallets')).balance, '75.00');
    assert.equal((await value('select stock from products where id=1')).stock, 3);
    assert.equal((await value(`select status from transactions where id='${next}'`)).status, 'Completed');
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','',false);`);
    await assert.rejects(db.exec(`select resolve_vend('${next}',true,'Unauthorized actor');`), /Admin access/);
    await assert.rejects(db.exec(`select save_slot(1,4,'Unauthorized',25,100);`), /Admin access/);
    assert.equal((await db.query('select * from vend_jobs')).rows.length, 0);
    await assert.rejects(db.exec(`select start_vend('${next}');`), /permission denied/);
  } finally { await db.close(); }
});
