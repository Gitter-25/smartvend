import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Generate a separate device credential without displaying it or replacing existing keys.
writeFileSync('.device.env', `DEVICE_TOKEN=${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
console.log('Created .device.env. Keep it private and load it into Supabase and the device only.');
