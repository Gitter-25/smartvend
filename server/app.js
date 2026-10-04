import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { check } from './store.js';
import { sessionUser, tokenHash, verifyPassword } from './auth.js';
import { handlerStore } from './handler-store.js';
import { createCardHandler } from './shared/card-handler.js';
import { createDeviceHandler } from './shared/device-handler.js';
import { createQrHandler } from './shared/qr-handler.js';

// Parse only our opaque session cookie, without logging any credential.
function cookie(req) { return req.headers.cookie?.split(';').map((p) => p.trim()).find((p) => p.startsWith('smartvend_session='))?.slice(18); }

// Build the HTTP server independently of its listening port for integration tests.
export function createApp({ store, config, fetchImpl }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: config.secureCookies ? undefined : false }));
  const origins = new Set(config.origins ?? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001']);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin && !origins.has(req.headers.origin)) return res.status(403).json({ error: 'Origin not allowed' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Use application/json' });
    next();
  });
  app.use(express.json({ limit: '64kb', verify: (req, _res, buffer) => { req.rawBody = buffer.toString('utf8'); } }));
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: !!config.secureCookies, path: '/api', maxAge: 8 * 60 * 60 * 1000 };

  // Require a cookie session for every admin data endpoint.
  function admin(req, res, next) {
    req.admin = sessionUser(store, cookie(req));
    if (!req.admin) return res.status(401).json({ error: 'Sign in to continue' });
    next();
  }
  app.post('/api/login', loginLimit, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const user = store.get('SELECT * FROM admins WHERE email=?', email);
    const valid = await verifyPassword(req.body?.password, user?.password_hash);
    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = randomBytes(32).toString('hex');
    store.atomic(() => { store.run('DELETE FROM sessions WHERE expires_at<=?', Date.now()); store.run('INSERT INTO sessions VALUES(?,?,?)', tokenHash(token), user.id, Date.now() + cookieOptions.maxAge); });
    res.cookie('smartvend_session', token, cookieOptions).json({ user: { id: user.id, email: user.email } });
  });
  app.get('/api/session', (req, res) => { const user = sessionUser(store, cookie(req)); res.json({ session: user ? { user } : null }); });
  app.post('/api/logout', (req, res) => { const token = cookie(req); if (token) store.run('DELETE FROM sessions WHERE token_hash=?', tokenHash(token)); res.clearCookie('smartvend_session', { path: '/api', httpOnly: true, sameSite: 'strict', secure: !!config.secureCookies }).json({ ok: true }); });
  app.get('/api/data', admin, (_req, res) => res.json(store.data()));
  app.get('/api/transactions', admin, (req, res) => res.json(store.transactions(req.query)));
  app.get('/api/receipts/:id', admin, (req, res) => res.json(store.transactions({ id: req.params.id, limit: 1 })[0] ?? null));
  app.post('/api/students', admin, (req, res) => res.json({ id: store.operation('register_student', { student_name: req.body.name, student_number: req.body.number }) }));
  app.post('/api/cards/:id', admin, (req, res) => {
    check(typeof req.body.active === 'boolean', 'Select an active state', 400);
    check(store.run('UPDATE cards SET active=? WHERE id=?', Number(req.body.active), req.params.id).changes === 1, 'Card not found', 404);
    res.json({ ok: true });
  });
  app.post('/api/products/:id', admin, (req, res) => { const b = req.body; store.operation('save_slot', { slot: Number(req.params.id), expected_version: b.version, product_name: b.name, product_price: b.price, stock_count: b.stock }); res.json({ ok: true }); });
  app.post('/api/topups', admin, (req, res) => res.json({ id: store.operation('admin_topup', req.body, req.admin.id) }));
  app.get('/api/machine', admin, (_req, res) => {
    const jobs = store.all("SELECT j.*,t.slot_id,t.product_name,t.amount_cents,t.payment_method FROM vend_jobs j JOIN transactions t ON t.id=j.id WHERE j.state IN ('AwaitingPayment','Authorized','Dispensing','RefundPending') ORDER BY j.created_at");
    res.json({ last_seen: store.get('SELECT last_seen FROM machine WHERE id=1').last_seen, jobs: jobs.map((j) => ({ id: j.id, state: j.state, created_at: j.created_at, transactions: { slot_id: j.slot_id, product_name: j.product_name, amount: j.amount_cents / 100, payment_method: j.payment_method } })) });
  });
  app.post('/api/resolve', admin, (req, res) => { check(typeof req.body.reason === 'string' && req.body.reason.trim().length >= 3 && req.body.reason.length <= 200, 'Provide an inspection note', 400); res.json(store.operation('finish_vend', { ...req.body, reason: `Admin ${req.admin.id}: ${req.body.reason}` })); });
  app.get('/api/qr-orders', admin, (_req, res) => res.json(store.all('SELECT q.id,q.created_at,j.state FROM qr_orders q JOIN vend_jobs j ON j.id=q.id ORDER BY q.created_at DESC LIMIT 20').map(({ state, ...row }) => ({ ...row, vend_jobs: { state } }))));
  app.get('/api/qr-orders/:id', admin, (req, res) => res.json(store.get('SELECT id FROM qr_orders WHERE id=?', req.params.id) ?? null));
  const db = handlerStore(store);
  const shared = { db, deviceToken: config.deviceToken, encryptionKey: config.encryptionKey, lookupKey: config.lookupKey };
  // Bridge the tested Web Request handlers to Express while retaining the original webhook body.
  function bridge(handler, cookies = false) {
    return async (req, res) => {
      const headers = { 'Content-Type': 'application/json' };
      const token = cookies ? cookie(req) : null;
      if (token) headers.Authorization = `Bearer ${token}`;
      else if (req.headers.authorization) headers.Authorization = req.headers.authorization;
      if (req.headers['paymongo-signature']) headers['Paymongo-Signature'] = req.headers['paymongo-signature'];
      const response = await handler(new Request(`http://localhost${req.originalUrl}`, { method: req.method, headers, body: req.rawBody ?? '{}' }));
      res.status(response.status).type('json').send(await response.text());
    };
  }
  app.post('/api/card-management', admin, bridge(createCardHandler(shared), true));
  app.post('/api/device-vending', bridge(createDeviceHandler(shared)));
  const qr = createQrHandler({ ...shared, secret: config.paymongoSecret, webhookSecret: config.webhookSecret, fetchImpl });
  app.post('/api/qr-payments', bridge(qr, true));
  app.post('/api/qr-payments/webhook', bridge(qr));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  // Keep SQLite errors and provider credentials out of browser responses.
  app.use((error, _req, res, _next) => {
    const constraint = String(error.message).includes('constraint failed');
    const status = error.status ?? (constraint ? 409 : 500);
    res.status(status).json({ error: constraint ? 'Duplicate record or invalid database value' : status < 500 ? error.message : 'Server could not complete the request; keep its request ID' });
  });
  return app;
}
