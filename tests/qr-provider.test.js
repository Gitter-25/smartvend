import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createQrProvider, verifyCheckout, verifyQrSignature, checkoutUrl } from '../supabase/functions/_shared/qr-provider.js';
import { createQrHandler } from '../supabase/functions/_shared/qr-handler.js';
const id = '00000000-0000-0000-0000-000000000001';

// Model the provider's documented checkout resource, with no real credentials or PII.
function checkout(paid = false) {
  return { id: 'cs_test', attributes: { livemode: false, reference_number: id,
    checkout_url: 'https://checkout.paymongo.com/cs_test#test', status: 'active',
    line_items: [{ amount: 2500, quantity: 1, currency: 'PHP' }], payment_method_types: ['gcash'],
    payment_intent: { attributes: { status: paid ? 'succeeded' : 'awaiting_payment_method', amount: 2500, currency: 'PHP', livemode: false } },
    payments: paid ? [{ id: 'pay_test', attributes: { amount: 2500, currency: 'PHP', status: 'paid', livemode: false } }] : [] } };
}

test('checkout verification rejects live, wrong amount/reference/currency and forged checkout destinations', () => {
  assert.equal(verifyCheckout(checkout(true), { id, amount: 25 }).paymentId, 'pay_test');
  assert.equal(verifyCheckout(checkout(), { id, amount: 25 }).paymentId, null);
  for (const change of [
    (a) => { a.livemode = true; }, (a) => { delete a.livemode; },
    (a) => { a.reference_number = 'other'; }, (a) => { a.line_items[0].amount = 2400; },
    (a) => { a.payments[0].attributes.currency = 'USD'; }, (a) => { a.payments[0].attributes.livemode = true; },
    (a) => { a.payment_intent.attributes.status = 'processing'; }, (a) => { a.checkout_url = 'https://paymongo.com.attacker.test/'; },
    (a) => { a.payment_method_types = ['qrph']; },
    (a) => { a.payments[0].attributes.refunds = [{ attributes: { status: 'succeeded' } }]; },
  ]) { const response = checkout(true); change(response.attributes); assert.throws(() => verifyCheckout(response, { id, amount: 25 })); }
  assert.throws(() => checkoutUrl('javascript:alert(1)'));
  const expired = checkout(); expired.attributes.status = 'expired';
  assert.equal(verifyCheckout(expired, { id, amount: 25 }).expired, true);
  expired.attributes.payment_intent.attributes.status = 'processing';
  assert.equal(verifyCheckout(expired, { id, amount: 25 }).expired, false);
});

test('provider rejects live keys and creates checkout using exact server price with only sandbox GCash', async () => {
  assert.throws(() => createQrProvider({ secret: 'sk_live_fake' }));
  let request;
  const provider = createQrProvider({ secret: 'sk_test_fake', fetchImpl: async (url, options) => {
    request = { url, ...options }; return Response.json({ data: checkout() });
  } });
  await provider.create({ id, amount: 25.50, product: 'Test' });
  assert.equal(request.url, 'https://api.paymongo.com/v1/checkout_sessions');
  assert.equal(request.redirect, 'error');
  const attributes = JSON.parse(request.body).data.attributes;
  assert.deepEqual(attributes.payment_method_types, ['gcash']);
  assert.equal(attributes.line_items[0].amount, 2550);
  assert.equal(attributes.reference_number, id);
});

test('webhook requires test HMAC over raw body and rejects tampering, live-only signatures and stale timestamps', async () => {
  const raw = '{"test":true}', secret = 'test-webhook-secret', t = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  assert.equal(await verifyQrSignature(raw, `t=${t},te=${sig},li=`, secret), true);
  assert.equal(await verifyQrSignature(raw + ' ', `t=${t},te=${sig}`, secret), false);
  assert.equal(await verifyQrSignature(raw, `t=${t},li=${sig}`, secret), false);
  assert.equal(await verifyQrSignature(raw, `t=${t},te=${sig}`, secret, Date.now() + 600000), false);
});

// Record boundary calls while exercising real handler authentication and provider validation.
function fixture({ createAllowed = false, session = checkout(), tokenValid = true, admin = true, bound = true, providerStatus = 200, timeout = false } = {}) {
  const calls = [];
  const order = { id, session_id: bound ? 'cs_test' : null, checkout_url: bound ? session.attributes.checkout_url : null, payment_id: null, refund_id: null,
    vend_jobs: { state: 'AwaitingPayment', transactions: { amount: 25, product_name: 'Water', slot_id: 1 } } };
  const db = {
    auth: { getUser: async () => ({ data: { user: tokenValid ? { id } : null } }) },
    from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      return { data: table === 'admins' ? (admin ? { user_id: id } : null) : order };
    } }; },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'bind_qr') { order.session_id = args.provider_session; order.checkout_url = args.provider_url; }
      if (name === 'settle_qr') order.vend_jobs.state = args.outcome === 'paid' ? 'Authorized' : 'Cancelled';
      return { data: name === 'reserve_qr' ? { createAllowed, amount: 25, product: 'Water' } : {} };
    },
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (timeout) throw new Error('Simulated network timeout');
    return Response.json({ data: session }, { status: providerStatus });
  };
  return { calls, handler: createQrHandler({ db, secret: 'sk_test_fake', deviceToken: 'a'.repeat(64), fetchImpl }) };
}
const request = (body, token = 'admin') => new Request('https://example.test/qr-payments', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

test('QR endpoint enforces authentication and never accepts a claimed paid status from the client', async () => {
  for (const options of [{ tokenValid: false }, { admin: false }]) {
    const f = fixture(options); const r = await f.handler(request({ action: 'status', requestId: id }));
    assert.ok([401, 403].includes(r.status)); assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  const response = await f.handler(request({ action: 'status', requestId: id, paid: true, amount: 1 }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'AwaitingPayment');
  assert.equal(f.calls.filter((c) => c.name === 'settle_qr').length, 0);
  const device = await f.handler(request({ action: 'recover', requestId: id, sessionId: 'cs_test' }, 'a'.repeat(64)));
  assert.equal(device.status, 403);
});

test('retry reuses checkout, verified API payment authorizes once through RPC, and unknown creation is retained', async () => {
  const f = fixture({ session: checkout(true) });
  const response = await f.handler(request({ action: 'create', requestId: id, slot: 1, amount: 1 }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'Authorized');
  assert.equal(f.calls.filter((c) => c.options?.method === 'POST').length, 0);
  assert.deepEqual(f.calls.find((c) => c.name === 'settle_qr').args, { request_id: id, provider_session: 'cs_test', outcome: 'paid', provider_payment: 'pay_test' });
  const unknown = fixture({ bound: false });
  const result = await unknown.handler(request({ action: 'create', requestId: id, slot: 1 }));
  assert.equal((await result.json()).recoveryRequired, true);
  assert.equal(unknown.calls.filter((c) => c.url).length, 0);
});

test('first creation binds one checkout; explicit rejection releases stock but timeout never releases or retries', async () => {
  const first = fixture({ createAllowed: true, bound: false });
  const result = await first.handler(request({ action: 'create', requestId: id, slot: 1, amount: 1 }));
  assert.equal(result.status, 200);
  assert.equal(first.calls.filter((c) => c.options?.method === 'POST').length, 1);
  assert.equal(first.calls.filter((c) => c.name === 'bind_qr').length, 1);
  assert.equal(JSON.parse(first.calls.find((c) => c.options?.method === 'POST').options.body).data.attributes.line_items[0].amount, 2500);
  for (const [options, releases] of [[{ providerStatus: 400 }, 1], [{ timeout: true }, 0], [{ providerStatus: 500 }, 0]]) {
    const f = fixture({ createAllowed: true, bound: false, ...options });
    const response = await f.handler(request({ action: 'create', requestId: id, slot: 1 }));
    assert.equal(response.status, 503);
    assert.equal(f.calls.filter((c) => c.options?.method === 'POST').length, 1);
    assert.equal(f.calls.filter((c) => c.name === 'settle_qr').length, releases);
  }
});
