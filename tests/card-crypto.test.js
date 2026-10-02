import test from 'node:test';
import assert from 'node:assert/strict';
import { cardLookup, decryptCard, encryptCard, normalizeCard } from '../supabase/functions/_shared/card-crypto.js';
const encryptionKey = '11'.repeat(32);
const lookupKey = '22'.repeat(32);
const uid = '04A1B2C3D4E5F6';
const studentId = '00000000-0000-0000-0000-000000000001';

// Formatting must not create distinct identities for the same physical UID.
test('normalizes reader formatting and rejects malformed identifiers', () => {
  assert.equal(normalizeCard('04:a1:b2:c3:d4:e5:f6'), uid);
  assert.throws(() => normalizeCard('test-card'));
  assert.throws(() => normalizeCard('04A1B2C3D4E5F'));
});

// Random IVs protect repeated encryption while preserving correct decryption.
test('round-trip succeeds and repeated encryption produces different ciphertext', async () => {
  const first = await encryptCard(uid, studentId, encryptionKey);
  const second = await encryptCard(uid, studentId, encryptionKey);
  assert.notEqual(first, second);
  assert.equal(await decryptCard(first, studentId, encryptionKey), uid);
  assert(!first.includes(uid));
});

// GCM must reject edits, the wrong key, and copies to another student record.
test('rejects tampering, wrong keys, and swapped student records', async () => {
  const value = await encryptCard(uid, studentId, encryptionKey);
  const modified = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0');
  await assert.rejects(decryptCard(modified, studentId, encryptionKey));
  await assert.rejects(decryptCard(value, studentId, lookupKey));
  await assert.rejects(decryptCard(value, 'another-student', encryptionKey));
  await assert.rejects(encryptCard(uid, studentId, 'short-key'));
});

// HMAC permits lookup without storing plaintext or an unkeyed UID hash.
test('lookup is consistent across formatting and depends on its secret key', async () => {
  assert.equal(await cardLookup(uid, lookupKey), await cardLookup('04:A1:B2:C3:D4:E5:F6', lookupKey));
  assert.notEqual(await cardLookup(uid, lookupKey), await cardLookup(uid, encryptionKey));
});
