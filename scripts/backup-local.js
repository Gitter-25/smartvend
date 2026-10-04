import { backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { openStore } from '../server/store.js';
const filename = process.env.DB_PATH ?? 'data/smartvend.sqlite';
if (!existsSync(filename)) throw new Error('Database not found; run setup or check DB_PATH');
const store = openStore(filename);
try {
  mkdirSync('backups', { recursive: true, mode: 0o700 });
  const destination = `backups/smartvend-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  await backup(store.db, destination);
  console.log(`Database backup saved: ${destination}. Keep a separate private backup of .env.server.`);
} finally { store.close(); }
