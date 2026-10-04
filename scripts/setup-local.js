import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { openStore } from '../server/store.js';
import { hashPassword } from '../server/auth.js';

// Create private local configuration once, then prompt for an administrator.
async function setup() {
  if (!existsSync('.env.server')) {
    if (existsSync(process.env.DB_PATH ?? 'data/smartvend.sqlite')) throw new Error('An existing database was found without .env.server. Restore its original keys before setup.');
    writeFileSync('.env.server', `DB_PATH=data/smartvend.sqlite\nHOST=127.0.0.1\nPORT=3001\nCOOKIE_SECURE=false\nAPP_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001\nCARD_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nCARD_LOOKUP_KEY=${randomBytes(32).toString('hex')}\nDEVICE_TOKEN=${randomBytes(32).toString('hex')}\nPAYMONGO_TEST_SECRET_KEY=\nPAYMONGO_TEST_WEBHOOK_SECRET=\n`, { flag: 'wx', mode: 0o600 });
  }
  process.loadEnvFile('.env.server');
  const store = openStore(process.env.DB_PATH ?? 'data/smartvend.sqlite');
  if (store.get('SELECT id FROM admins LIMIT 1')) { store.close(); console.log('Local administrator already exists. Configuration and database were preserved.'); return; }
  let hidden = false;
  const output = new Writable({ write(chunk, _encoding, done) { if (!hidden) process.stdout.write(chunk); done(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY });
  try {
    const email = (await prompt.question('Admin email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address');
    process.stdout.write('Admin password (12–128 characters; hidden): '); hidden = true;
    const password = await prompt.question(''); hidden = false; process.stdout.write('\nConfirm password (hidden): '); hidden = true;
    const confirm = await prompt.question(''); hidden = false; process.stdout.write('\n');
    if (password !== confirm) throw new Error('Passwords do not match');
    const hash = await hashPassword(password);
    store.run('INSERT INTO admins VALUES(?,?,?)', randomUUID(), email, hash);
    console.log('Local administrator created. Run npm run server, then npm run dev in another terminal.');
    console.log('Back up data/ and .env.server privately. Your previous Supabase data was not modified or imported.');
  } finally { hidden = false; prompt.close(); store.close(); }
}
setup().catch((error) => { console.error(error.message); process.exitCode = 1; });
