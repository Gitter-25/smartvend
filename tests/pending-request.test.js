import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingStore, cardFingerprint } from '../src/lib/pending-request.js';

// Recreating the store models a reload and must retain the original request ID.
test('pending request survives reload, is account scoped and clears on completion', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const pending = { student: 'test', amount: 100, request_id: crypto.randomUUID() };
  pendingStore('admin-a:topup', storage).save(pending);
  assert.deepEqual(pendingStore('admin-a:topup', storage).read(), pending);
  assert.equal(pendingStore('admin-b:topup', storage).read(), null);
  pendingStore('admin-a:topup', storage).clear();
  assert.equal(pendingStore('admin-a:topup', storage).read(), null);
});

// Reader formatting changes must not accidentally create a second charge.
test('card retry fingerprints normalize formatting and distinguish cards', async () => {
  assert.equal(await cardFingerprint('04:aa:bb:cc'), await cardFingerprint('04AABBCC'));
  assert.notEqual(await cardFingerprint('04AABBCC'), await cardFingerprint('04AABBDD'));
});
