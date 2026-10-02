import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardHandler } from '../supabase/functions/_shared/card-handler.js';
const studentId = '00000000-0000-0000-0000-000000000001';
const uid = '04:A1:B2:C3:D4:E5:F6';

// Simulate only the database boundary so real handler and crypto code are exercised.
function fixture({ authorized = true, member = true } = {}) {
  const records = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: authorized ? { id: studentId } : null }, error: null }) },
    // Support the small query chain used by the backend handler.
    from(table) {
      let inserted;
      let filter;
      return {
        select() { return this; },
        eq(_column, value) { filter = value; return this; },
        insert(value) { inserted = value; return this; },
        // Enforce the real schema's unique student/card relationships in the fake boundary.
        async single() {
          if (records.some((row) => row.student_id === inserted.student_id || row.identifier_lookup === inserted.identifier_lookup)) return { error: { code: '23505' } };
          const row = { ...inserted, id: 'card-1', active: true };
          records.push(row); return { data: { id: row.id }, error: null };
        },
        // Return membership or the requested encrypted record.
        async maybeSingle() {
          return { data: table === 'admins' ? (member ? { user_id: studentId } : null) : records.find((row) => row.identifier_lookup === filter) ?? null, error: null };
        },
      };
    },
  };
  const handle = createCardHandler({ db, encryptionKey: '11'.repeat(32), lookupKey: '22'.repeat(32) });
  return { handle, records };
}

// Build a request with a dummy token; the injected Auth boundary decides validity.
function request(action, token = 'Bearer test-session', extra = {}) {
  return new Request('http://localhost/cards', { method: 'POST', headers: token ? { Authorization: token } : {}, body: JSON.stringify({ action, studentId, uid, ...extra }) });
}

// Unauthenticated and ordinary users must never reach enrollment.
test('denies missing sessions, invalid sessions, and non-admin accounts', async () => {
  assert.equal((await fixture().handle(request('enroll', ''))).status, 401);
  assert.equal((await fixture({ authorized: false }).handle(request('enroll'))).status, 401);
  const ordinary = fixture({ member: false });
  assert.equal((await ordinary.handle(request('enroll'))).status, 403);
  assert.equal(ordinary.records.length, 0);
});

// Enrollment must store encrypted values and reject duplicates without overwriting.
test('enrolls, verifies, rejects duplicates, and never returns plaintext', async () => {
  const { handle, records } = fixture();
  const enrollment = await handle(request('enroll'));
  assert.equal(enrollment.status, 201);
  assert(!JSON.stringify(await enrollment.json()).includes('04A1B2C3D4E5F6'));
  assert(records[0].identifier_ciphertext.startsWith('v1:'));
  assert(!records[0].identifier_ciphertext.includes('04A1B2C3D4E5F6'));
  assert.equal((await handle(request('enroll'))).status, 409);
  const verification = await handle(request('verify'));
  assert.deepEqual(await verification.json(), { matches: true, active: true });
  records[0].active = false;
  assert.deepEqual(await (await handle(request('verify'))).json(), { matches: true, active: false });
  assert.equal((await handle(request('verify', 'Bearer test-session', { studentId: '00000000-0000-0000-0000-000000000002' }))).status, 404);
});

// Input validation and ciphertext authentication must fail with bounded responses.
test('rejects malformed input and corrupted ciphertext', async () => {
  const { handle, records } = fixture();
  assert.equal((await handle(request('unknown'))).status, 400);
  assert.equal((await handle(request('enroll', 'Bearer test-session', { uid: 'garbage' }))).status, 400);
  await handle(request('enroll'));
  records[0].identifier_ciphertext += '00';
  const result = await handle(request('verify'));
  assert.equal(result.status, 500);
  assert(!JSON.stringify(await result.json()).includes(records[0].identifier_ciphertext));
});
