import { randomUUID } from 'node:crypto';
import { sessionUser } from './auth.js';

// Keep the existing tested handlers while translating their fixed storage calls to SQLite.
// This adapter is server-only: it is NOT a generic query/RPC endpoint for browsers.
export function handlerStore(store) {
  return {
    auth: { getUser: async (token) => ({ data: { user: sessionUser(store, token) } }) },
    async rpc(name, args) {
      try { return { data: store.operation(name, args) }; }
      catch (error) { return { error: { message: error.status ? error.message : 'Database operation failed' } }; }
    },
    from(table) {
      let field, value, insert, update;
      const query = {
        select() { return this; },
        eq(key, val) { field = key; value = val; return this; },
        insert(row) { insert = row; return this; },
        update(row) { update = row; return this; },
        single() { return execute(); },
        maybeSingle() { return execute(); },
      };
      // Only explicitly known handler queries can touch storage.
      async function execute() {
        try {
          if (table === 'admins' && field === 'user_id') return { data: store.get('SELECT id AS user_id FROM admins WHERE id=?', value) ?? null };
          if (table === 'cards') {
            if (insert) {
              const id = randomUUID();
              store.run('INSERT INTO cards(id,student_id,identifier_ciphertext,identifier_lookup) VALUES(?,?,?,?)', id, insert.student_id, insert.identifier_ciphertext, insert.identifier_lookup);
              return { data: { id } };
            }
            if (field === 'identifier_lookup') {
              const card = store.get('SELECT * FROM cards WHERE identifier_lookup=?', value);
              return { data: card ? { ...card, active: !!card.active } : null };
            }
          }
          if (table === 'machine' && update && field === 'id' && value === 1) { store.run('UPDATE machine SET last_seen=? WHERE id=1', update.last_seen); return { data: { id: 1 } }; }
          if (table === 'vend_jobs' && field === 'id') return { data: store.get('SELECT id,state FROM vend_jobs WHERE id=?', value) ?? null };
          if (table === 'qr_orders' && field === 'id') return { data: store.qrOrder(value) };
          if (table === 'qr_orders' && field === 'session_id') return { data: store.get('SELECT id FROM qr_orders WHERE session_id=?', value) ?? null };
          throw new Error('Unsupported server query');
        } catch (error) {
          const code = error.message.includes('UNIQUE constraint') ? '23505' : error.message.includes('FOREIGN KEY constraint') ? '23503' : 'SQLITE';
          return { error: { code, message: 'Database operation failed' } };
        }
      }
      return query;
    },
  };
}
