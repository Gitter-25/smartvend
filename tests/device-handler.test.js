import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceHandler } from '../server/shared/device-handler.js';
import { encryptCard } from '../server/shared/card-crypto.js';
const deviceToken = '33'.repeat(32);
const encryptionKey = '11'.repeat(32);
const lookupKey = '22'.repeat(32);
const requestId = '00000000-0000-0000-0000-000000000001';

// Test the real endpoint and encryption with only the database replaced.
test('device endpoint authenticates separately and never trusts supplied price or student', async () => {
  const calls = [];
  const studentId = 'test-student';
  const ciphertext = await encryptCard('04AABBCC', studentId, encryptionKey);
  const db = {
    from(table) {
      return {
        update() { return this; }, eq() { return this; }, select() { return this; },
        async single() { return { data: { id: 1 } }; },
        async maybeSingle() { return { data: table === 'cards' ? { id: 'verified-card', student_id: studentId, identifier_ciphertext: ciphertext } : { id: requestId, state: 'Dispensing' } }; },
      };
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: { state: 'Authorized' } }; },
  };
  const handle = createDeviceHandler({ db, deviceToken, encryptionKey, lookupKey });
  const request = (body, token = deviceToken) => new Request('https://example.com/device', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  assert.equal((await handle(request({ action: 'heartbeat' }, 'admin-jwt'))).status, 401);
  assert.equal((await handle(request({ action: 'heartbeat' }, '44'.repeat(32)))).status, 401);
  assert.equal((await handle(request({ action: 'heartbeat' }))).status, 200);
  assert.equal((await handle(request({ action: 'authorize', requestId, slot: 3, uid: '04AABBCC' }))).status, 400);
  assert.equal(calls.length, 0);
  const response = await handle(request({ action: 'authorize', requestId, slot: 2, uid: '04:AABBCC', amount: 1, studentId: 'forged' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], { name: 'authorize_vend', args: { card: 'verified-card', slot: 2, request_id: requestId } });
  assert.equal((await handle(request({ action: 'finish', requestId, dispensed: 'false', reason: 'Unknown' }))).status, 400);
  await handle(request({ action: 'start', requestId }));
  assert.deepEqual(calls[1], { name: 'start_vend', args: { request_id: requestId } });
  await handle(request({ action: 'finish', requestId, dispensed: false, reason: 'Confirmed no item' }));
  assert.equal(calls[2].args.dispensed, false);
  assert.equal((await handle(request({ action: 'status', requestId }))).status, 200);
});
