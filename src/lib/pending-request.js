// Keep only request metadata, never raw card UIDs, across reloads.
export function pendingStore(scope, storage = globalThis.localStorage) {
  const key = `smartvend:pending:v1:${scope}`;
  return {
    read() { const value = storage.getItem(key); return value ? JSON.parse(value) : null; },
    save(value) { storage.setItem(key, JSON.stringify(value)); return value; },
    clear() { storage.removeItem(key); },
  };
}

// Hash the normalized UID so a retry can match without persisting the UID itself.
export async function cardFingerprint(uid) {
  const bytes = new TextEncoder().encode(uid.replace(/[\s:-]/g, '').toUpperCase());
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) => v.toString(16).padStart(2, '0')).join('');
}
