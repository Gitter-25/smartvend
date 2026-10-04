import { createQrProvider, verifyCheckout, verifyQrSignature } from './qr-provider.js';
import { sameToken } from './device-handler.js';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sessionId = /^cs_[A-Za-z0-9]{1,100}$/;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

// Keep test payment responses private and compatible with the admin client.
function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Wrap backend RPC errors without disclosing provider secrets or customer billing details.
async function rpc(db, name, input) {
  const result = await db.rpc(name, input);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Read one saved order with the price and current physical state determined by the database.
async function readOrder(db, id) {
  const result = await db.from('qr_orders').select('id,session_id,checkout_url,payment_id,refund_id,vend_jobs(state,transactions(amount,product_name,slot_id))').eq('id', id).maybeSingle();
  if (result.error) throw new Error('QR storage unavailable; apply migration 008');
  if (!result.data) throw new Error('Unknown QR order');
  const row = result.data;
  return { ...row, state: row.vend_jobs.state, amount: row.vend_jobs.transactions.amount, product: row.vend_jobs.transactions.product_name, slot: row.vend_jobs.transactions.slot_id };
}

// Check the provider, then apply an idempotent local transition; never start a motor here.
async function synchronize(db, provider, order, session) {
  if (['Completed', 'Refunded', 'RefundPending'].includes(order.state)) return order;
  const verified = verifyCheckout(session, order);
  if (session.id !== order.session_id) throw new Error('Checkout mismatch');
  if (verified.paymentId || verified.expired) await rpc(db, 'settle_qr', {
    request_id: order.id, provider_session: session.id,
    outcome: verified.paymentId ? 'paid' : 'expired', provider_payment: verified.paymentId,
  });
  return readOrder(db, order.id);
}

// Expose only checkout data needed by the machine/admin, never a provider credential.
function publicOrder(order) {
  return { requestId: order.id, state: order.state, amount: Number(order.amount), slot: order.slot, product: order.product,
    checkoutUrl: order.state === 'AwaitingPayment' ? order.checkout_url : null,
    sessionId: order.session_id, paymentId: order.payment_id, testMode: true, recoveryRequired: !order.session_id && order.state === 'AwaitingPayment' };
}

// Accept admin sessions or the existing device credential; recovery/refunds are admin-only.
export function createQrHandler({ db, secret, deviceToken, webhookSecret, fetchImpl }) {
  return async function handleQr(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST' });
    try {
      const provider = createQrProvider({ secret, fetchImpl });
      const raw = await request.text();
      const webhook = new URL(request.url).pathname.endsWith('/webhook');
      if (raw.length > (webhook ? 65536 : 2048)) return reply(413, { error: 'Request too large' });
      if (webhook) {
        if (!await verifyQrSignature(raw, request.headers.get('Paymongo-Signature'), webhookSecret)) return reply(401, { error: 'Invalid webhook signature' });
        const payload = JSON.parse(raw);
        const event = payload.data?.attributes ?? payload.data;
        if (event?.livemode !== false || event.type !== 'checkout_session.payment.paid') return reply(200, { ignored: true });
        const id = event.data?.id;
        if (!sessionId.test(id ?? '')) return reply(400, { error: 'Invalid session reference' });
        const saved = await db.from('qr_orders').select('id').eq('session_id', id).maybeSingle();
        if (saved.error) throw new Error('QR storage unavailable');
        // A webhook may beat local binding; a retry or status polling can recover it.
        if (!saved.data) return reply(503, { error: 'Checkout not bound yet' });
        const order = await readOrder(db, saved.data.id);
        await synchronize(db, provider, order, await provider.retrieve(id));
        return reply(200, { received: true });
      }
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) return reply(401, { error: 'Authentication required' });
      const isDevice = /^[0-9a-f]{64}$/i.test(deviceToken ?? '') && await sameToken(token, deviceToken);
      if (!isDevice) {
        const auth = await db.auth.getUser(token);
        if (auth.error || !auth.data.user) return reply(401, { error: 'Sign in again' });
        const admin = await db.from('admins').select('user_id').eq('user_id', auth.data.user.id).maybeSingle();
        if (admin.error || !admin.data) return reply(403, { error: 'Admin access required' });
      }
      let input;
      try { input = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON' }); }
      if (!input || !['create', 'status', 'cancel', 'recover', 'refund'].includes(input.action) || !uuid.test(input.requestId ?? '')) return reply(400, { error: 'Valid action and request ID required' });
      if (isDevice && ['recover', 'refund'].includes(input.action)) return reply(403, { error: 'Admin recovery required' });
      if (input.action === 'create') {
        if (![1, 2].includes(input.slot)) return reply(400, { error: 'Select Slot 1 or Slot 2' });
        const reservation = await rpc(db, 'reserve_qr', { slot: input.slot, request_id: input.requestId });
        if (reservation.createAllowed) {
          let session;
          try { session = await provider.create({ id: input.requestId, ...reservation }); }
          catch (error) {
            if (error.rejected) await rpc(db, 'settle_qr', { request_id: input.requestId, provider_session: null, outcome: 'expired', provider_payment: null });
            throw error;
          }
          const checked = verifyCheckout(session, { id: input.requestId, amount: reservation.amount });
          await rpc(db, 'bind_qr', { request_id: input.requestId, provider_session: session.id, provider_url: checked.url });
        }
      }
      let order = await readOrder(db, input.requestId);
      if (input.action === 'recover') {
        if (!sessionId.test(input.sessionId ?? '')) return reply(400, { error: 'Provide the cs_ reference from PayMongo test mode' });
        const session = await provider.retrieve(input.sessionId);
        const checked = verifyCheckout(session, order);
        await rpc(db, 'bind_qr', { request_id: order.id, provider_session: session.id, provider_url: checked.url });
        order = await readOrder(db, order.id);
      }
      if (input.action === 'refund') {
        if (!/^ref_[A-Za-z0-9]{1,100}$/.test(input.refundId ?? '') || !order.payment_id || !['RefundPending', 'Refunded'].includes(order.state)) return reply(400, { error: 'Provide the completed full sandbox refund reference' });
        const refund = await provider.refund(input.refundId);
        const a = refund?.attributes;
        if (refund?.id !== input.refundId || a?.livemode !== false || a.status !== 'succeeded' || a.payment_id !== order.payment_id || a.currency !== 'PHP' || a.amount !== Math.round(Number(order.amount) * 100)) throw new Error('Full sandbox refund is not verified');
        await rpc(db, 'confirm_qr_refund', { request_id: order.id, provider_refund: refund.id });
        order = await readOrder(db, order.id);
      } else if (order.session_id) {
        if (input.action === 'cancel' && order.state === 'AwaitingPayment') {
          // Payment can win the race. Always retrieve again even if expiration is rejected.
          try { await provider.expire(order.session_id); } catch { /* Recheck authoritative state below. */ }
        }
        order = await synchronize(db, provider, order, await provider.retrieve(order.session_id));
      }
      return reply(200, publicOrder(order));
    } catch (error) {
      const expected = ['Unknown QR order', 'Machine has an unresolved dispense', 'Slot is out of stock', 'Request ID already used', 'QR test price must be between PHP 1 and PHP 9999999.99'];
      return reply(expected.includes(error.message) ? 409 : 503, { error: expected.includes(error.message) ? error.message : 'QR service could not finish. Retain the reference and check status; verify migration 008 and test provider settings.' });
    }
  };
}
