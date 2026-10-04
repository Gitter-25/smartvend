import { cardLookup, decryptCard, normalizeCard } from './card-crypto.js';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

// Compare fixed-size SHA-256 digests without exposing the device secret.
export async function sameToken(provided, expected) {
  const digest = async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(provided), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

// Return bounded, non-cacheable device responses without browser CORS access.
function reply(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Authenticate the one machine separately from human admin sessions.
export function createDeviceHandler({ db, deviceToken, encryptionKey, lookupKey }) {
  return async function handleDevice(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Use POST' });
    if (!/^[0-9a-f]{64}$/i.test(deviceToken ?? '')) return reply(503, { error: 'Device service is not configured' });
    const token = request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/i)?.[1];
    if (!token || !(await sameToken(token, deviceToken))) return reply(401, { error: 'Invalid device credentials' });
    try {
      const text = await request.text();
      if (text.length > 2048) return reply(413, { error: 'Request too large' });
      let input;
      try { input = JSON.parse(text); } catch { return reply(400, { error: 'Invalid JSON' }); }
      if (!input || !['heartbeat','authorize','start','finish','status'].includes(input.action)) return reply(400, { error: 'Invalid action' });
      if (input.action !== 'heartbeat' && (typeof input.requestId !== 'string' || !uuid.test(input.requestId))) return reply(400, { error: 'Valid request ID required' });
      const seen = await db.from('machine').update({ last_seen: new Date().toISOString() }).eq('id', 1).select('id').single();
      if (seen.error) throw seen.error;
      if (input.action === 'heartbeat') return reply(200, { online: true });
      if (input.action === 'status') {
        const result = await db.from('vend_jobs').select('id,state').eq('id', input.requestId).maybeSingle();
        if (result.error) throw result.error;
        return result.data ? reply(200, result.data) : reply(404, { error: 'Unknown dispense' });
      }
      let result;
      if (input.action === 'authorize') {
        if (![1, 2].includes(input.slot)) return reply(400, { error: 'Select Slot 1 or Slot 2' });
        let uid;
        try { uid = normalizeCard(input.uid); } catch { return reply(400, { error: 'Invalid card UID' }); }
        if (!encryptionKey || !lookupKey || encryptionKey.toLowerCase() === lookupKey.toLowerCase()) throw new Error('Invalid keys');
        const lookup = await cardLookup(uid, lookupKey);
        const card = await db.from('cards').select('id,student_id,identifier_ciphertext').eq('identifier_lookup', lookup).maybeSingle();
        if (card.error) throw card.error;
        if (!card.data) return reply(404, { error: 'Card not enrolled' });
        if (await decryptCard(card.data.identifier_ciphertext, card.data.student_id, encryptionKey) !== uid) throw new Error('Integrity failure');
        result = await db.rpc('authorize_vend', { card: card.data.id, slot: input.slot, request_id: input.requestId });
      } else if (input.action === 'start') {
        result = await db.rpc('start_vend', { request_id: input.requestId });
      } else {
        if (typeof input.dispensed !== 'boolean' || typeof input.reason !== 'string' || input.reason.trim().length < 3 || input.reason.length > 250) return reply(400, { error: 'Confirmed outcome and reason required' });
        result = await db.rpc('finish_vend', { request_id: input.requestId, dispensed: input.dispensed, reason: input.reason });
      }
      if (result.error) {
        const expected = ['Request ID already used','Machine has an unresolved dispense','Card unavailable','Wallet unavailable','Slot is out of stock','Insufficient wallet balance','Unknown dispense','Outcome already resolved differently','Dispense was not started'];
        if (expected.includes(result.error.message)) return reply(409, { error: result.error.message });
        throw result.error;
      }
      return reply(200, result.data);
    } catch { return reply(500, { error: 'Device request failed; retain its request ID and check status' }); }
  };
}
