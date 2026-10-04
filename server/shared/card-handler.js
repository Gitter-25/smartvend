import { cardLookup, decryptCard, encryptCard, normalizeCard } from './card-crypto.js';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Send JSON with CORS headers; never cache card verification responses.
function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Create an authenticated admin-only enrollment and verification endpoint.
export function createCardHandler({ db, encryptionKey, lookupKey }) {
  // Validate the caller before reading or changing encrypted card records.
  return async function handleCard(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Sign in before managing cards.' });
    try {
      const { data, error: authError } = await db.auth.getUser(token);
      if (authError || !data.user) return reply(401, { error: 'Your session is invalid. Sign in again.' });
      const membership = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return reply(403, { error: 'Admin access required.' });
      const text = await request.text();
      if (text.length > 2048) return reply(413, { error: 'Request is too large.' });
      let input;
      try { input = JSON.parse(text); } catch { return reply(400, { error: 'Invalid JSON.' }); }
      if (!input || !['enroll', 'verify', 'purchase'].includes(input.action) || typeof input.studentId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.studentId)) return reply(400, { error: 'Select a student and an enrollment or verification action.' });
      if (input.action === 'purchase' && (![1, 2].includes(input.slot) || typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.requestId))) return reply(400, { error: 'Select a slot and provide a purchase request ID.' });
      let uid;
      try { uid = normalizeCard(input.uid); } catch (error) { return reply(400, { error: error.message }); }
      if (!encryptionKey || !lookupKey || encryptionKey.toLowerCase() === lookupKey.toLowerCase()) throw new Error('Missing or reused encryption keys.');
      const lookup = await cardLookup(uid, lookupKey);
      if (input.action === 'enroll') {
        const ciphertext = await encryptCard(uid, input.studentId, encryptionKey);
        const result = await db.from('cards').insert({ student_id: input.studentId, identifier_ciphertext: ciphertext, identifier_lookup: lookup }).select('id').single();
        if (result.error?.code === '23505') return reply(409, { error: 'This student or card is already enrolled.' });
        if (result.error?.code === '23503') return reply(404, { error: 'Student not found.' });
        if (result.error) throw result.error;
        return reply(201, { cardId: result.data.id, enrolled: true });
      }
      const result = await db.from('cards').select('id,student_id,active,identifier_ciphertext').eq('identifier_lookup', lookup).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data || result.data.student_id !== input.studentId) return reply(404, { error: 'This card does not match the selected student.' });
      const plaintext = await decryptCard(result.data.identifier_ciphertext, result.data.student_id, encryptionKey);
      if (plaintext !== uid) throw new Error('Card integrity check failed.');
      if (input.action === 'purchase') {
        const purchase = await db.rpc('simulate_purchase', { card: result.data.id, slot: input.slot, request_id: input.requestId, actor: data.user.id });
        if (purchase.error) {
          const expected = ['Card is disabled', 'Slot is out of stock', 'Insufficient wallet balance', 'Request ID already used', 'Slot not found', 'Student wallet not found'];
          return reply(409, { error: expected.includes(purchase.error.message) ? purchase.error.message : 'Purchase failed. Check the local backend configuration.' });
        }
        return reply(200, purchase.data);
      }
      return reply(200, { matches: true, active: result.data.active });
    } catch {
      return reply(500, { error: 'Card service failed. Check backend secrets and function configuration.' });
    }
  };
}
