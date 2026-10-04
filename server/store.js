import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const unresolved = ['AwaitingPayment', 'Authorized', 'Dispensing', 'RefundPending'];
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const now = () => new Date().toISOString();

// Report validation conflicts without exposing SQL or filesystem details.
export function check(condition, message, status = 409) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
// Store currency as integer centavos, rejecting extra decimal places.
export function cents(value, min = 1, max = 99999999999) {
  check((typeof value === 'number' || typeof value === 'string') && /^\d+(\.\d{1,2})?$/.test(String(value)), 'Use a positive amount with at most two decimal places', 400);
  const result = Math.round(Number(value) * 100);
  check(Number.isSafeInteger(result) && result >= min && result <= max, 'Amount is outside the allowed range', 400);
  return result;
}
// Validate saved operation identifiers before database work.
function requestId(value) { check(typeof value === 'string' && uuid.test(value), 'Valid request ID required', 400); }
// Validate short user-entered names and notes.
function text(value, max, min = 1) {
  check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, `Enter ${min}–${max} characters`, 400);
  return value.trim();
}

// Open the private database and install the versioned SQLite schema once.
export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  check(version <= 1, 'Database is newer than this server', 500);
  if (version === 0) db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE admins(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),expires_at INTEGER NOT NULL);
    CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,number TEXT NOT NULL UNIQUE,balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents BETWEEN 0 AND 99999999999),created_at TEXT NOT NULL);
    CREATE TABLE cards(id TEXT PRIMARY KEY,student_id TEXT NOT NULL UNIQUE REFERENCES students(id),identifier_ciphertext TEXT NOT NULL,identifier_lookup TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE products(id INTEGER PRIMARY KEY CHECK(id IN (1,2)),name TEXT NOT NULL,price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 1 AND 99999999999),stock INTEGER NOT NULL CHECK(stock>=0),version INTEGER NOT NULL DEFAULT 0);
    INSERT INTO products VALUES(1,'Slot 1 product',2500,0,0),(2,'Slot 2 product',1500,0,0);
    CREATE TABLE transactions(id TEXT PRIMARY KEY,student_id TEXT REFERENCES students(id),card_id TEXT REFERENCES cards(id),type TEXT NOT NULL CHECK(type IN ('Top-up','Purchase')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),status TEXT NOT NULL CHECK(status IN ('Pending','Completed','Failed','Refunded','RefundPending')),note TEXT NOT NULL DEFAULT '',slot_id INTEGER REFERENCES products(id),product_name TEXT,created_by TEXT REFERENCES admins(id),payment_method TEXT NOT NULL DEFAULT 'Card wallet' CHECK(payment_method IN ('Card wallet','QR test')),created_at TEXT NOT NULL,CHECK(payment_method='QR test' OR student_id IS NOT NULL));
    CREATE TABLE vend_jobs(id TEXT PRIMARY KEY REFERENCES transactions(id),card_id TEXT REFERENCES cards(id),state TEXT NOT NULL CHECK(state IN ('AwaitingPayment','Authorized','Dispensing','Completed','Refunded','Cancelled','RefundPending')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,resolution_note TEXT NOT NULL DEFAULT '');
    CREATE TABLE qr_orders(id TEXT PRIMARY KEY REFERENCES vend_jobs(id),session_id TEXT UNIQUE,checkout_url TEXT,payment_id TEXT UNIQUE,refund_id TEXT UNIQUE,created_at TEXT NOT NULL);
    CREATE TABLE machine(id INTEGER PRIMARY KEY CHECK(id=1),last_seen TEXT);
    INSERT INTO machine VALUES(1,NULL);
    CREATE INDEX transaction_history ON transactions(created_at DESC,id DESC);
    CREATE INDEX session_expiry ON sessions(expires_at);
    PRAGMA user_version=1; COMMIT;`);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);

  // Every balance, stock and receipt change commits as one synchronous write transaction.
  function atomic(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  // Serialize card and QR vending on the one physical machine.
  function available() { check(!get("SELECT id FROM vend_jobs WHERE state IN ('AwaitingPayment','Authorized','Dispensing','RefundPending')"), 'Machine has an unresolved dispense'); }
  // Preserve the product snapshot while a physical unit is reserved.
  function editable(slot) { check(!get("SELECT j.id FROM vend_jobs j JOIN transactions t ON t.id=j.id WHERE t.slot_id=? AND j.state IN ('AwaitingPayment','Authorized','Dispensing')", slot), 'Resolve the pending dispense before editing this slot'); }
  // Resolve a configured fixed slot and require available physical inventory.
  function item(slot) { check([1, 2].includes(slot), 'Select Slot 1 or Slot 2', 400); const row = get('SELECT * FROM products WHERE id=?', slot); check(row && row.stock > 0, 'Slot is out of stock'); return row; }
  // Create a price-snapshot receipt, preserving the request UUID for retries.
  function receipt(id, student, card, type, amount, status, note, product, actor = null, method = 'Card wallet') {
    run('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, student, card, type, amount, status, note, product?.id ?? null, product?.name ?? null, actor, method, now());
  }
  // Change stock and its edit version together.
  function stock(slot, delta) { run('UPDATE products SET stock=stock+?,version=version+1 WHERE id=?', delta, slot); }
  // Create the physical job with a timestamp for operator recovery.
  function job(id, card, state) { const at = now(); run('INSERT INTO vend_jobs(id,card_id,state,created_at,updated_at) VALUES(?,?,?,?,?)', id, card, state, at, at); }
  // Return the existing provider order in the shape used by the tested payment handler.
  function qrOrder(id) {
    const row = get('SELECT q.*,j.state,t.amount_cents,t.product_name,t.slot_id FROM qr_orders q JOIN vend_jobs j ON j.id=q.id JOIN transactions t ON t.id=q.id WHERE q.id=?', id);
    if (!row) return null;
    return { ...row, vend_jobs: { state: row.state, transactions: { amount: row.amount_cents / 100, product_name: row.product_name, slot_id: row.slot_id } } };
  }
  // Apply trusted server operations; these names are never exposed as an arbitrary HTTP RPC.
  function operation(name, a, actor = null) {
    return atomic(() => {
      if (name === 'register_student') {
        const id = randomUUID(); run('INSERT INTO students(id,name,number,created_at) VALUES(?,?,?,?)', id, text(a.student_name, 80), text(a.student_number, 40).toUpperCase(), now()); return id;
      }
      if (name === 'save_slot') {
        check([1, 2].includes(a.slot) && Number.isSafeInteger(a.expected_version), 'Invalid slot version', 400);
        check(Number.isSafeInteger(a.stock_count) && a.stock_count >= 0 && a.stock_count <= 1000000, 'Invalid stock count', 400);
        const price = cents(a.product_price); const label = text(a.product_name, 80);
        check(get('SELECT version FROM products WHERE id=?', a.slot)?.version === a.expected_version, 'Slot changed; refresh before editing'); editable(a.slot);
        run('UPDATE products SET name=?,price_cents=?,stock=?,version=version+1 WHERE id=?', label, price, a.stock_count, a.slot); return null;
      }
      requestId(a.request_id);
      const previous = get('SELECT * FROM transactions WHERE id=?', a.request_id);
      if (name === 'admin_topup') {
        const amount = cents(a.amount, 100, 1000000);
        check(get('SELECT id FROM admins WHERE id=?', actor), 'Admin access required', 403);
        if (previous) { check(previous.student_id === a.student && previous.amount_cents === amount && previous.type === 'Top-up' && previous.created_by === actor, 'Request ID already used'); return a.request_id; }
        check(get('SELECT id FROM students WHERE id=?', a.student), 'Student wallet not found');
        run('UPDATE students SET balance_cents=balance_cents+? WHERE id=?', amount, a.student);
        receipt(a.request_id, a.student, null, 'Top-up', amount, 'Completed', 'Manual admin credit', null, actor); return a.request_id;
      }
      if (name === 'authorize_vend' || name === 'simulate_purchase') {
        const physical = name === 'authorize_vend';
        if (!physical) check(get('SELECT id FROM admins WHERE id=?', a.actor), 'Admin access required', 403);
        if (previous) {
          const existing = get('SELECT * FROM vend_jobs WHERE id=?', a.request_id);
          check(previous.card_id === a.card && previous.slot_id === a.slot && previous.type === 'Purchase' && previous.payment_method === 'Card wallet' && (physical ? !!existing : !existing && previous.created_by === a.actor), 'Request ID already used');
          return { transactionId: previous.id, amount: previous.amount_cents / 100, state: existing?.state, status: previous.status };
        }
        available();
        const card = get('SELECT c.*,s.balance_cents FROM cards c JOIN students s ON s.id=c.student_id WHERE c.id=?', a.card);
        check(card && card.active === 1, physical ? 'Card unavailable' : 'Card is disabled'); const product = item(a.slot);
        check(card.balance_cents >= product.price_cents, 'Insufficient wallet balance');
        run('UPDATE students SET balance_cents=balance_cents-? WHERE id=?', product.price_cents, card.student_id); stock(a.slot, -1);
        receipt(a.request_id, card.student_id, a.card, 'Purchase', product.price_cents, physical ? 'Pending' : 'Completed', physical ? 'Physical dispense reserved' : 'Software simulation; no physical dispense', product, physical ? null : a.actor);
        if (physical) job(a.request_id, a.card, 'Authorized');
        return { transactionId: a.request_id, amount: product.price_cents / 100, state: physical ? 'Authorized' : undefined, status: physical ? 'Pending' : 'Completed' };
      }
      if (name === 'reserve_qr') {
        if (previous) { check(previous.payment_method === 'QR test' && previous.slot_id === a.slot, 'Request ID already used'); return { createAllowed: false, amount: previous.amount_cents / 100, product: previous.product_name }; }
        available(); const product = item(a.slot); check(product.price_cents >= 100 && product.price_cents <= 999999999, 'QR test price must be between PHP 1 and PHP 9999999.99');
        stock(a.slot, -1); receipt(a.request_id, null, null, 'Purchase', product.price_cents, 'Pending', 'Sandbox checkout: no real money', product, null, 'QR test');
        job(a.request_id, null, 'AwaitingPayment'); run('INSERT INTO qr_orders(id,created_at) VALUES(?,?)', a.request_id, now());
        return { createAllowed: true, amount: product.price_cents / 100, product: product.name };
      }
      const current = get('SELECT * FROM vend_jobs WHERE id=?', a.request_id); check(current && previous, 'Unknown dispense');
      if (name === 'start_vend') {
        if (current.state !== 'Authorized') return { state: current.state, shouldDispense: false };
        run("UPDATE vend_jobs SET state='Dispensing',updated_at=? WHERE id=?", now(), a.request_id);
        return { state: 'Dispensing', shouldDispense: true, slot: previous.slot_id };
      }
      if (name === 'finish_vend') {
        check(typeof a.dispensed === 'boolean', 'Confirmed outcome required', 400); const note = text(a.reason, 300, 3);
        check(!['AwaitingPayment', 'Cancelled'].includes(current.state), 'Payment has not been verified');
        const target = a.dispensed ? 'Completed' : previous.payment_method === 'QR test' ? 'RefundPending' : 'Refunded';
        if (['Completed', 'Refunded', 'RefundPending'].includes(current.state)) { check(current.state === target || (current.state === 'Refunded' && target === 'RefundPending'), 'Outcome already resolved differently'); return { state: current.state }; }
        check(!a.dispensed || current.state === 'Dispensing', 'Dispense was not started');
        run('UPDATE vend_jobs SET state=?,updated_at=?,resolution_note=? WHERE id=?', target, now(), note, a.request_id);
        if (!a.dispensed) { stock(previous.slot_id, 1); if (previous.payment_method === 'Card wallet') run('UPDATE students SET balance_cents=balance_cents+? WHERE id=?', previous.amount_cents, previous.student_id); }
        run('UPDATE transactions SET status=?,note=? WHERE id=?', target, note, a.request_id); return { state: target };
      }
      const saved = get('SELECT * FROM qr_orders WHERE id=?', a.request_id); check(saved, 'Unknown QR order');
      if (name === 'bind_qr') {
        check(!saved.session_id || saved.session_id === a.provider_session, 'Checkout already bound');
        run('UPDATE qr_orders SET session_id=?,checkout_url=? WHERE id=?', a.provider_session, a.provider_url, a.request_id); return null;
      }
      if (name === 'settle_qr') {
        check(saved.session_id === a.provider_session, 'Checkout mismatch');
        if (a.outcome === 'paid') {
          check(a.provider_payment && (!saved.payment_id || saved.payment_id === a.provider_payment), 'Payment mismatch');
          run('UPDATE qr_orders SET payment_id=? WHERE id=?', a.provider_payment, a.request_id);
          if (current.state === 'AwaitingPayment') run("UPDATE vend_jobs SET state='Authorized',updated_at=? WHERE id=?", now(), a.request_id);
          if (current.state === 'Cancelled') { run("UPDATE vend_jobs SET state='RefundPending',updated_at=? WHERE id=?", now(), a.request_id); run("UPDATE transactions SET status='RefundPending',note='Late sandbox payment; refund required' WHERE id=?", a.request_id); }
        } else {
          check(a.outcome === 'expired', 'Invalid provider outcome');
          if (current.state === 'AwaitingPayment') { run("UPDATE vend_jobs SET state='Cancelled',updated_at=? WHERE id=?", now(), a.request_id); stock(previous.slot_id, 1); run("UPDATE transactions SET status='Failed',note='Sandbox checkout expired or rejected' WHERE id=?", a.request_id); }
        }
        return { state: get('SELECT state FROM vend_jobs WHERE id=?', a.request_id).state };
      }
      if (name === 'confirm_qr_refund') {
        check(['RefundPending', 'Refunded'].includes(current.state) && saved.payment_id, 'Refund is not pending');
        check(!saved.refund_id || saved.refund_id === a.provider_refund, 'Refund mismatch');
        run('UPDATE qr_orders SET refund_id=? WHERE id=?', a.provider_refund, a.request_id);
        run("UPDATE vend_jobs SET state='Refunded',updated_at=? WHERE id=?", now(), a.request_id);
        run("UPDATE transactions SET status='Refunded',note='Sandbox provider refund verified; no wallet credit' WHERE id=?", a.request_id); return null;
      }
      throw new Error('Unknown server operation');
    });
  }
  // Return public receipt fields, leaving ciphertext and authentication data private.
  function transactions(filters = {}) {
    const where = [], args = [];
    for (const [key, column] of [['type', 't.type'], ['student', 't.student_id'], ['slot', 't.slot_id'], ['id', 't.id']]) if (filters[key]) { where.push(`${column}=?`); args.push(filters[key]); }
    if (filters.start) { where.push('t.created_at>=?'); args.push(filters.start); }
    if (filters.end) { where.push('t.created_at<?'); args.push(filters.end); }
    const limit = Math.min(101, Math.max(1, Number(filters.limit) || 26)), offset = Math.max(0, Number(filters.offset) || 0);
    check(Number.isSafeInteger(limit) && Number.isSafeInteger(offset), 'Invalid page', 400);
    return all(`SELECT t.*,s.name AS student FROM transactions t LEFT JOIN students s ON s.id=t.student_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.created_at DESC,t.id DESC LIMIT ? OFFSET ?`, ...args, limit, offset)
      .map(({ amount_cents, ...row }) => ({ ...row, amount: amount_cents / 100, date: row.created_at, student: row.student ?? 'QR customer (test)' }));
  }
  // Build the small admin dashboard response without making the browser understand joins.
  function data() {
    return {
      students: all('SELECT s.id,s.name,s.number,s.created_at,s.balance_cents,c.id AS cardId,c.active FROM students s LEFT JOIN cards c ON c.student_id=s.id ORDER BY s.created_at').map(({ balance_cents, ...s }) => ({ ...s, balance: balance_cents / 100, active: !!s.active })),
      products: all('SELECT * FROM products ORDER BY id').map(({ price_cents, ...p }) => ({ ...p, price: price_cents / 100 })),
      transactions: transactions({ limit: 100 }),
    };
  }
  return { db, get, all, run, atomic, operation, qrOrder, transactions, data, close: () => db.close() };
}
