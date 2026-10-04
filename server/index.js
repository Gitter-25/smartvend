import { openStore } from './store.js';
import { createApp } from './app.js';
const env = process.env;
const keys = [env.CARD_ENCRYPTION_KEY, env.CARD_LOOKUP_KEY, env.DEVICE_TOKEN];
if (keys.some((key) => !/^[0-9a-f]{64}$/i.test(key ?? '')) || new Set(keys.map((key) => key.toLowerCase())).size !== 3) throw new Error('Run npm run setup first. Three independent backend keys are required.');
const store = openStore(env.DB_PATH ?? 'data/smartvend.sqlite');
if (!store.get('SELECT id FROM admins LIMIT 1')) { store.close(); throw new Error('Run npm run setup to create an administrator.'); }
const app = createApp({ store, config: { encryptionKey: keys[0], lookupKey: keys[1], deviceToken: keys[2], paymongoSecret: env.PAYMONGO_TEST_SECRET_KEY, webhookSecret: env.PAYMONGO_TEST_WEBHOOK_SECRET, secureCookies: env.COOKIE_SECURE === 'true', origins: env.APP_ORIGINS?.split(',').map((s) => s.trim()) } });
const server = app.listen(Number(env.PORT ?? 3001), env.HOST ?? '127.0.0.1', () => console.log('SmartVend API ready on port ' + (env.PORT ?? 3001)));
// Close the database only after in-flight requests have finished.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
