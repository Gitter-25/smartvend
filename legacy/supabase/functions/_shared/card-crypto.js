const encoder = new TextEncoder();

// Convert a hexadecimal string into bytes for Web Crypto.
export function fromHex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error('Invalid hexadecimal value.');
  return Uint8Array.from(value.match(/../g), (byte) => parseInt(byte, 16));
}

// Convert bytes into a hexadecimal string for database storage.
export function toHex(value) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Normalize a reader UID without allowing arbitrary text or missing bytes.
export function normalizeCard(value) {
  if (typeof value !== 'string' || value.length > 80) throw new Error('Enter a hexadecimal card UID.');
  const uid = value.replace(/[\s:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(uid) || ![8, 14, 16, 20].includes(uid.length)) throw new Error('Use a 4, 7, 8, or 10-byte hexadecimal card UID.');
  return uid;
}

// Require an independent 32-byte backend key before importing it.
function keyBytes(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{64}$/i.test(key)) throw new Error('A 32-byte backend key is required.');
  return fromHex(key);
}

// Encrypt a card UID with a fresh IV and bind it to its student record.
export async function encryptCard(uid, studentId, secret) {
  const key = await crypto.subtle.importKey('raw', keyBytes(secret), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(studentId), tagLength: 128 }, key, encoder.encode(normalizeCard(uid)));
  return `v1:${toHex(iv)}:${toHex(ciphertext)}`;
}

// Authenticate and decrypt a stored identifier only inside the backend.
export async function decryptCard(value, studentId, secret) {
  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Invalid encrypted card record.');
  const iv = fromHex(parts[1]);
  if (iv.length !== 12) throw new Error('Invalid card IV.');
  const key = await crypto.subtle.importKey('raw', keyBytes(secret), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(studentId), tagLength: 128 }, key, fromHex(parts[2]));
  return new TextDecoder().decode(plaintext);
}

// Create a deterministic HMAC lookup value without storing the raw UID.
export async function cardLookup(uid, secret) {
  const key = await crypto.subtle.importKey('raw', keyBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`smartvend-card:${normalizeCard(uid)}`)));
}
