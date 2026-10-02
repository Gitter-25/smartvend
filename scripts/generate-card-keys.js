import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Generate independent backend keys once and refuse to overwrite an existing file.
function generateKeys() {
  const content = `CARD_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nCARD_LOOKUP_KEY=${randomBytes(32).toString('hex')}\n`;
  try {
    writeFileSync('.secrets.env', content, { flag: 'wx', mode: 0o600 });
    console.log('Keys saved to .secrets.env. Upload them to Supabase secrets and keep a private backup.');
  } catch (error) {
    console.error(error.code === 'EEXIST' ? '.secrets.env already exists. Keep the original keys; do not regenerate enrolled card keys.' : 'Could not create the secrets file.');
    process.exitCode = 1;
  }
}
generateKeys();
