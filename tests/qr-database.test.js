import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

// Exercise the real migrations, stock reservation, API-only grants, and mixed payment flows.
test('QR SQL preserves wallets, serializes vending, and settles retries/refunds/late payments once', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await readdir('supabase/migrations')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(`insert into auth.users values('${id(1)}'); insert into admins values('${id(1)}');
      select set_config('request.jwt.claim.sub','${id(1)}',false);
      insert into students(id,name,number) values('${id(2)}','Test','TEST');
      insert into wallets values('${id(2)}',100);
      insert into cards(id,student_id,identifier_ciphertext,identifier_lookup) values('${id(3)}','${id(2)}','test','test');`);
    const value = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
    const stock = () => value('select stock from products where id=1');
    assert.equal((await value(`select reserve_qr(1,'${id(4)}')`)).createAllowed, true);
    assert.equal((await value(`select reserve_qr(1,'${id(4)}')`)).createAllowed, false);
    assert.equal(await stock(), 11);
    assert.equal(await value('select balance from wallets'), '100.00');
    assert.equal((await value(`select start_vend('${id(4)}')`)).shouldDispense, false);
    await assert.rejects(db.exec(`select finish_vend('${id(4)}',false,'Not yet paid')`), /not been verified/);
    await assert.rejects(db.exec(`select reserve_qr(2,'${id(5)}')`), /unresolved/);
    await assert.rejects(db.exec(`select authorize_vend('${id(3)}',1,'${id(5)}')`), /unresolved/);
    await assert.rejects(db.exec(`select reserve_qr(2,'${id(4)}')`), /already used/);
    await assert.rejects(db.exec(`select save_slot(1,1,'New item',10,99)`), /pending dispense/);
    await db.exec(`select bind_qr('${id(4)}','cs_first','https://checkout.paymongo.com/test')`);
    await assert.rejects(db.exec(`select bind_qr('${id(4)}','cs_other','https://checkout.paymongo.com/test')`), /already bound/);
    await assert.rejects(db.exec(`select settle_qr('${id(4)}','cs_other','paid','pay_first')`), /mismatch/);
    await db.exec(`select settle_qr('${id(4)}','cs_first','paid','pay_first'); select settle_qr('${id(4)}','cs_first','paid','pay_first')`);
    assert.equal((await value(`select start_vend('${id(4)}')`)).shouldDispense, true);
    assert.equal((await value(`select start_vend('${id(4)}')`)).shouldDispense, false);
    await db.exec(`select finish_vend('${id(4)}',false,'No item after inspection'); select finish_vend('${id(4)}',false,'Retry outcome')`);
    assert.equal(await stock(), 12);
    assert.equal(await value('select balance from wallets'), '100.00');
    assert.equal(await value(`select state from vend_jobs where id='${id(4)}'`), 'RefundPending');
    await assert.rejects(db.exec(`select reserve_qr(1,'${id(5)}')`), /unresolved/);
    await db.exec(`select confirm_qr_refund('${id(4)}','ref_first'); select confirm_qr_refund('${id(4)}','ref_first'); select finish_vend('${id(4)}',false,'Retry after refund')`);
    assert.equal(await stock(), 12);
    assert.equal(await value(`select status from transactions where id='${id(4)}'`), 'Refunded');
    await db.exec(`select reserve_qr(1,'${id(5)}'); select bind_qr('${id(5)}','cs_second','https://checkout.paymongo.com/test');
      select settle_qr('${id(5)}','cs_second','expired'); select settle_qr('${id(5)}','cs_second','expired')`);
    assert.equal(await stock(), 12);
    await db.exec(`select settle_qr('${id(5)}','cs_second','paid','pay_second')`);
    assert.equal((await value(`select start_vend('${id(5)}')`)).shouldDispense, false);
    assert.equal(await value(`select state from vend_jobs where id='${id(5)}'`), 'RefundPending');
    await db.exec(`select confirm_qr_refund('${id(5)}','ref_second')`);
    await db.exec(`select reserve_qr(1,'${id(6)}'); select bind_qr('${id(6)}','cs_third','https://checkout.paymongo.com/test');
      select settle_qr('${id(6)}','cs_third','paid','pay_third'); select start_vend('${id(6)}');
      select finish_vend('${id(6)}',true,'Sensor confirmed'); select finish_vend('${id(6)}',true,'Repeated outcome')`);
    assert.equal(await stock(), 11);
    assert.equal(await value('select balance from wallets'), '100.00');
    await db.exec(`select authorize_vend('${id(3)}',1,'${id(7)}'); select finish_vend('${id(7)}',false,'Cancelled card vend')`);
    assert.equal(await value('select balance from wallets'), '100.00');
    assert.equal(await stock(), 11);
    for (const fn of ['reserve_qr(integer,uuid)', 'bind_qr(uuid,text,text)', 'settle_qr(uuid,text,text,text)', 'confirm_qr_refund(uuid,text)']) {
      assert.equal(await value(`select has_function_privilege('authenticated','${fn}','execute')`), false);
    }
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','',false)`);
    assert.equal((await db.query('select * from qr_orders')).rows.length, 0);
    await assert.rejects(db.exec(`select reserve_qr(1,'${id(8)}')`), /permission denied/);
  } finally { await db.close(); }
});
