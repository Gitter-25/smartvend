import { randomBytes, createHash, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const tokenHash = (value) => createHash('sha256').update(value).digest('hex');

// Salt and hash each administrator password rather than storing plaintext.
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Use a password with 12–128 characters');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
// Verify a password without variable-time hash comparison.
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hex] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// Resolve only unexpired server-issued sessions; the database stores token hashes.
export function sessionUser(store, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  return store.get('SELECT a.id,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?', tokenHash(token), Date.now()) ?? null;
}
