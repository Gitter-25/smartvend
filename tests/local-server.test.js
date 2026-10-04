import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, cents } from '../server/store.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';

// Run a real HTTP server and SQLite file with synthetic provider replies.
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'smartvend-'));
  const filename = join(directory, 'test.sqlite');
  const store = openStore(filename);
  const adminId = randomUUID();
  store.run('INSERT INTO admins VALUES(?,?,?)', adminId, 'admin@example.test', await hashPassword('Classroom-test-123'));
  const config = { encryptionKey: '1'.repeat(64), lookupKey: '2'.repeat(64), deviceToken: '3'.repeat(64), paymongoSecret: 'sk_test_fake', webhookSecret: 'test-signing-secret' };
  let providerSession, providerPaid = false, providerExpired = false, creates = 0;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/checkout_sessions') && options.method === 'POST') {
      creates++;
      const a = JSON.parse(options.body).data.attributes;
      providerSession = { id: 'cs_test', attributes: { ...a, livemode: false, checkout_url: 'https://checkout.paymongo.com/cs_test', status: 'active', payments: [], payment_intent: { attributes: { amount: a.line_items[0].amount, currency: 'PHP', livemode: false, status: 'awaiting_payment_method' } } } };
    }
    if (url.endsWith('/expire')) providerExpired = true;
    if (url.includes('/refunds/')) return Response.json({ data: { id: 'ref_test', attributes: { livemode: false, status: 'succeeded', currency: 'PHP', amount: providerSession.attributes.line_items[0].amount, payment_id: 'pay_test' } } });
    const result = structuredClone(providerSession);
    result.attributes.status = providerExpired ? 'expired' : 'active';
    if (providerPaid) {
      result.attributes.payment_intent.attributes.status = 'succeeded';
      result.attributes.payments = [{ id: 'pay_test', attributes: { amount: result.attributes.line_items[0].amount, currency: 'PHP', status: 'paid', livemode: false } }];
    }
    return Response.json({ data: result });
  };
  const app = createApp({ store, config, fetchImpl });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie;
  async function call(path, body, extra = {}) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  async function login() { const result = await call('/login', { email: 'admin@example.test', password: 'Classroom-test-123' }); assert.equal(result.status, 200); cookie = result.headers.get('set-cookie').split(';')[0]; return result; }
  async function close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); store.close(); rmSync(directory, { recursive: true, force: true }); }
  return { store, filename, call, login, close, config, paid: () => { providerPaid = true; }, creates: () => creates };
}

// Exercise browser authentication and each financial action through the same API React uses.
test('Express + SQLite: login, CSRF boundary, encrypted cards, centavos, retries, inventory, and device recovery', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/data')).status, 401);
    assert.equal((await f.call('/login', { email: 'admin@example.test', password: 'wrong' })).status, 401);
    const login = await f.login();
    assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.match(login.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal((await f.call('/session')).data.session.user.email, 'admin@example.test');
    assert.equal((await f.call('/students', { name: 'X', number: 'X' }, { Origin: 'https://attacker.test' })).status, 403);
    const student = (await f.call('/students', { name: 'Student', number: 'test-1' })).data.id;
    assert.ok(student);
    assert.equal((await f.call('/students', { name: 'Duplicate', number: 'TEST-1' })).status, 409);
    const topup = { student, amount: 100.25, request_id: randomUUID() };
    assert.equal((await f.call('/topups', topup)).status, 200);
    assert.equal((await f.call('/topups', topup)).status, 200);
    assert.equal((await f.call('/topups', { ...topup, amount: 99 })).status, 409);
    assert.equal((await f.call('/data')).data.students[0].balance, 100.25);
    assert.equal((await f.call('/products/1', { name: 'Water', price: 25.10, stock: 4, version: 0 })).status, 200);
    assert.equal((await f.call('/products/1', { name: 'Stale', price: 1, stock: 99, version: 0 })).status, 409);
    const enrolled = await f.call('/card-management', { action: 'enroll', studentId: student, uid: 'AABBCCDD' });
    assert.equal(enrolled.status, 201, JSON.stringify(enrolled.data));
    const card = f.store.get('SELECT * FROM cards'); assert.notEqual(card.identifier_ciphertext, 'AABBCCDD'); assert.match(card.identifier_ciphertext, /^v1:/);
    assert.ok(!JSON.stringify((await f.call('/data')).data).includes('identifier_ciphertext'));
    const request = { action: 'purchase', studentId: student, uid: 'AABBCCDD', slot: 1, requestId: randomUUID() };
    assert.equal((await f.call('/card-management', request)).status, 200);
    assert.equal((await f.call('/card-management', request)).status, 200);
    assert.equal((await f.call('/data')).data.students[0].balance, 75.15);
    assert.equal((await f.call('/data')).data.products[0].stock, 3);
    assert.equal((await f.call('/transactions?type=Purchase&slot=1')).data.length, 1);
    assert.equal((await f.call('/receipts/' + request.requestId)).data.amount, 25.1);
    assert.equal((await f.call('/device-vending', { action: 'heartbeat' })).status, 401);
    const deviceHeaders = { Authorization: `Bearer ${f.config.deviceToken}` };
    assert.equal((await f.call('/device-vending', { action: 'heartbeat' }, deviceHeaders)).status, 200);
    const vend = { action: 'authorize', requestId: randomUUID(), uid: 'AABBCCDD', slot: 1, amount: 0.01 };
    assert.equal((await f.call('/device-vending', vend, deviceHeaders)).status, 200);
    assert.equal((await f.call('/device-vending', vend, deviceHeaders)).status, 200);
    assert.equal((await f.call('/data')).data.students[0].balance, 50.05);
    assert.equal((await f.call('/products/1', { name: 'Reserved', price: 1, stock: 99, version: 3 })).status, 409);
    const start = { action: 'start', requestId: vend.requestId };
    assert.equal((await f.call('/device-vending', start, deviceHeaders)).data.shouldDispense, true);
    assert.equal((await f.call('/device-vending', start, deviceHeaders)).data.shouldDispense, false);
    const finish = { request_id: vend.requestId, dispensed: false, reason: 'Confirmed no item in local test' };
    assert.equal((await f.call('/resolve', finish)).data.state, 'Refunded');
    assert.equal((await f.call('/resolve', finish)).data.state, 'Refunded');
    assert.equal((await f.call('/resolve', { ...finish, dispensed: true })).status, 409);
    assert.equal((await f.call('/data')).data.students[0].balance, 75.15);
    assert.equal((await f.call('/data')).data.products[0].stock, 3);
    const second = openStore(f.filename); assert.equal(second.data().students[0].balance, 75.15); second.close();
    assert.equal((await f.call('/logout', {})).status, 200);
    assert.equal((await f.call('/data')).status, 401);
  } finally { await f.close(); }
});

test('SQLite QR flow reserves once, authenticates webhook, verifies API, prevents unpaid start and never credits wallets', async () => {
  const f = await fixture();
  try {
    await f.login();
    await f.call('/products/1', { name: 'Test snack', price: 20, stock: 2, version: 0 });
    const id = randomUUID();
    const request = { action: 'create', requestId: id, slot: 1 };
    const first = await f.call('/qr-payments', request);
    assert.equal(first.status, 200, JSON.stringify(first.data)); assert.equal(first.data.state, 'AwaitingPayment');
    await f.call('/qr-payments', request); assert.equal(f.creates(), 1);
    const deviceHeaders = { Authorization: `Bearer ${f.config.deviceToken}` };
    assert.equal((await f.call('/device-vending', { action: 'start', requestId: id }, deviceHeaders)).data.shouldDispense, false);
    assert.equal((await f.call('/qr-payments', { ...request, requestId: randomUUID() })).status, 409);
    assert.equal((await f.call('/data')).data.products[0].stock, 1);
    const event = { data: { attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: 'cs_test' } } } };
    assert.equal((await f.call('/qr-payments/webhook', event)).status, 401);
    f.paid();
    const stamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', f.config.webhookSecret).update(`${stamp}.${JSON.stringify(event)}`).digest('hex');
    const headers = { 'Paymongo-Signature': `t=${stamp},te=${signature}` };
    assert.equal((await f.call('/qr-payments/webhook', event, headers)).status, 200);
    assert.equal((await f.call('/qr-payments/webhook', event, headers)).status, 200);
    assert.equal((await f.call('/qr-payments', { action: 'status', requestId: id })).data.state, 'Authorized');
    assert.equal((await f.call('/device-vending', { action: 'start', requestId: id }, deviceHeaders)).data.shouldDispense, true);
    assert.equal((await f.call('/resolve', { request_id: id, dispensed: false, reason: 'No physical item' })).data.state, 'RefundPending');
    assert.equal((await f.call('/data')).data.products[0].stock, 2);
    assert.equal((await f.call('/qr-payments', { action: 'refund', requestId: id, refundId: 'ref_test' })).data.state, 'Refunded');
    assert.equal((await f.call('/qr-payments', { action: 'refund', requestId: id, refundId: 'ref_test' })).data.state, 'Refunded');
    assert.equal((await f.call('/data')).data.products[0].stock, 2);
    assert.equal(f.store.get('SELECT count(*) AS total FROM students').total, 0);
  } finally { await f.close(); }
});

test('SQLite rollback, cancellation, late payments, persisted versions and payment request collisions', () => {
  const store = openStore(':memory:');
  try {
    assert.throws(() => cents(1.001)); assert.throws(() => cents(Infinity)); assert.equal(cents('0.29'), 29);
    const student = store.operation('register_student', { student_name: 'Student', student_number: 'T1' });
    const card = randomUUID(); store.run('INSERT INTO cards VALUES(?,?,?,?,?)', card, student, 'encrypted', 'lookup', 1);
    store.operation('save_slot', { slot: 1, expected_version: 0, product_name: 'Test', product_price: 25, stock_count: 3 });
    assert.throws(() => store.operation('authorize_vend', { card, slot: 1, request_id: randomUUID() }), /Insufficient/);
    assert.equal(store.data().products[0].stock, 3); assert.equal(store.transactions().length, 0);
    const id = randomUUID(); store.operation('reserve_qr', { slot: 1, request_id: id });
    assert.throws(() => store.operation('authorize_vend', { card, slot: 1, request_id: id }), /already used/);
    store.operation('bind_qr', { request_id: id, provider_session: 'cs_test', provider_url: 'https://checkout.paymongo.com/test' });
    store.operation('settle_qr', { request_id: id, provider_session: 'cs_test', outcome: 'expired' });
    store.operation('settle_qr', { request_id: id, provider_session: 'cs_test', outcome: 'expired' });
    assert.equal(store.data().products[0].stock, 3);
    store.operation('settle_qr', { request_id: id, provider_session: 'cs_test', outcome: 'paid', provider_payment: 'pay_test' });
    assert.equal(store.operation('start_vend', { request_id: id }).shouldDispense, false);
    assert.equal(store.qrOrder(id).state, 'RefundPending');
    assert.equal(store.data().products[0].stock, 3);
    assert.throws(() => store.operation('reserve_qr', { slot: 1, request_id: randomUUID() }), /unresolved/);
  } finally { store.close(); }
});
