// Restrict checkout links to HTTPS provider pages before exposing them as QR codes.
export function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.paymongo.com') || url.username || url.password || url.port) throw new Error('Unexpected checkout URL');
  return url.href;
}

// Reject mismatched, live, or client-altered payment data before changing local stock.
export function verifyCheckout(session, order) {
  const a = session?.attributes;
  const cents = Math.round(Number(order.amount) * 100);
  const items = a?.line_items;
  if (!/^cs_[A-Za-z0-9]+$/.test(session?.id ?? '') || a?.livemode !== false || a.reference_number !== order.id ||
      !Array.isArray(items) || items.length !== 1 || items[0].amount !== cents || items[0].quantity !== 1 || items[0].currency !== 'PHP' ||
      !Array.isArray(a.payment_method_types) || a.payment_method_types.length !== 1 || a.payment_method_types[0] !== 'gcash') throw new Error('Checkout verification failed');
  const url = checkoutUrl(a.checkout_url);
  const intent = a.payment_intent?.attributes;
  const paid = (a.payments ?? []).filter((payment) => payment.attributes?.status === 'paid');
  if (paid.length > 1) throw new Error('Multiple payments require provider review');
  let paymentId = null;
  if (paid.length === 1) {
    const p = paid[0];
    if (!/^pay_[A-Za-z0-9]+$/.test(p.id ?? '') || p.attributes.livemode !== false || p.attributes.amount !== cents || p.attributes.currency !== 'PHP' ||
        intent?.status !== 'succeeded' || intent.amount !== cents || intent.currency !== 'PHP' || intent.livemode !== false ||
        p.attributes.disputed === true || (p.attributes.refunds ?? []).some((refund) => (refund.attributes ?? refund).status !== 'failed')) throw new Error('Payment verification failed');
    paymentId = p.id;
  }
  // A session expiry alone is not sufficient if its intent is processing/succeeded.
  const expired = !paymentId && a.status === 'expired' && ['awaiting_payment_method', 'cancelled'].includes(intent?.status);
  return { url, paymentId, expired };
}

// Use only the test secret and fixed provider endpoints; do not retry POSTs automatically.
export function createQrProvider({ secret, fetchImpl = fetch }) {
  if (!/^sk_test_[A-Za-z0-9]+$/.test(secret ?? '')) throw new Error('Configure a PayMongo test secret key');
  async function call(path, attributes) {
    const response = await fetchImpl(`https://api.paymongo.com/v1/${path}`, {
      method: attributes === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, 'Content-Type': 'application/json' },
      ...(attributes === undefined ? {} : { body: JSON.stringify({ data: { attributes } }) }),
    });
    if (!response.ok) {
      const error = new Error(`PayMongo request failed (${response.status}); retain the request reference`);
      // Explicit validation/auth rejection cannot have created a checkout. Timeouts stay unknown.
      error.rejected = [400, 401, 403, 422].includes(response.status);
      throw error;
    }
    return (await response.json()).data;
  }
  return {
    create: (order) => call('checkout_sessions', {
      line_items: [{ name: order.product, amount: Math.round(Number(order.amount) * 100), currency: 'PHP', quantity: 1 }],
      payment_method_types: ['gcash'], reference_number: order.id,
      description: 'SmartVend TEST payment — no real money', send_email_receipt: false,
      show_description: true, show_line_items: true,
    }),
    retrieve: (id) => call(`checkout_sessions/${id}`),
    expire: (id) => call(`checkout_sessions/${id}/expire`, {}),
    refund: (id) => call(`refunds/${id}`),
  };
}

// Authenticate test webhooks over the original body with a bounded replay window.
export async function verifyQrSignature(raw, header, secret, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((part) => part.trim().split('=')));
  if (!/^\d+$/.test(parts.t ?? '') || !/^[0-9a-f]{64}$/i.test(parts.te ?? '') || Math.abs(now / 1000 - Number(parts.t)) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${parts.t}.${raw}`)));
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ parts.te.toLowerCase().charCodeAt(i);
  return mismatch === 0;
}
