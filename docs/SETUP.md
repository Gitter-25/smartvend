# Local Express + SQLite setup

## Update the existing Windows checkout

Keep private files and any local changes backed up. Pull the latest main branch. If Git reports an overlapping local edit, preserve it in a stash before pulling; do not discard it blindly.

```powershell
git pull origin main
node --version
npm ci
npm run setup
```

Use Node.js **24.x**. This version uses Node's built-in SQLite module, so there is no separate SQLite service, database driver build tool, or XAMPP installation. If Node prints an experimental SQLite warning, it is a runtime notice; failures will still be reported separately.

Setup creates `.env.server` with random keys and a new `data/smartvend.sqlite` file. Enter a valid email and a password of 12–128 characters at the prompts. The password is hidden during entry and stored as a salted scrypt hash. Running setup again preserves the existing admin/database. Setup refuses to replace a missing key file when it detects an existing database.

**Your Supabase login is not your new local login.** Cloud data is not imported automatically. Do not delete your cloud project or original key backups. The local database starts with zero stock and no students/transactions. Existing Deno settings and `.env.local` Supabase variables are unused; set `VITE_DEMO_MODE=false` or remove that setting to use actual local data.

## Start both development processes

Terminal 1:

```powershell
npm run server
```

Terminal 2:

```powershell
npm run dev
```

Open http://localhost:5173 (or Vite's displayed URL). Vite proxies `/api` to Express at http://127.0.0.1:3001, so browser cookies and API requests stay on one origin. If Vite selects a different port, add that exact origin to `APP_ORIGINS` in `.env.server` and restart Express.

For a built version with one server:

```powershell
npm run build
npm start
```

Open http://localhost:3001. Stop any previous Express instance first to avoid a port conflict.

## Configure and test

1. Sign in with the local admin.
2. Set product names, prices, and starting stock for the two slots.
3. Register a fictional student, enroll a test hexadecimal card UID, and add wallet credit.
4. Use Purchase to test card-wallet deductions without a motor.
5. Configure [QR sandbox payments](QR_PAYMENTS.md) when ready.
6. Follow [DEVICE.md](DEVICE.md) before connecting the ESP32.

The schema initializes automatically using SQLite's `user_version`. No Supabase migration or Edge Function deployment commands apply to this version.

## Server configuration

Edit `.env.server`, then restart Express:

| Setting | Purpose |
| --- | --- |
| DB_PATH | Private SQLite file; default `data/smartvend.sqlite` |
| HOST / PORT | Express listening interface/port; default `127.0.0.1:3001` |
| APP_ORIGINS | Comma-separated exact browser origins permitted to call the API |
| COOKIE_SECURE | `false` for HTTP loopback development; `true` behind HTTPS |
| CARD_ENCRYPTION_KEY | Independent 32-byte hexadecimal AES-GCM key |
| CARD_LOOKUP_KEY | Independent 32-byte hexadecimal HMAC key |
| DEVICE_TOKEN | Independent 32-byte hexadecimal machine credential |
| PAYMONGO_TEST_SECRET_KEY | Optional sandbox secret beginning `sk_test_` |
| PAYMONGO_TEST_WEBHOOK_SECRET | Optional test webhook signing secret |

Never place backend keys in React `VITE_` variables. Do not regenerate card keys after enrollment. Setup generates local keys rather than reusing or overwriting your existing Supabase key files. Sessions expire after eight hours; logout revokes the saved session.

## Network access and deployment

The default server binds only to this computer. `localhost` on an ESP32 refers to the ESP32, not your laptop. For device access, use an HTTPS reverse proxy/tunnel to the running Express server, validate its certificate on the ESP32, and point the device at that hostname. For an HTTPS admin origin, add it to `APP_ORIGINS` and set `COOKIE_SECURE=true`. Do not expose Vite's development server publicly.

A private LAN deployment may bind Express to a selected LAN address with `HOST`; provide TLS before transmitting credentials outside loopback. Keep the database on the local disk of one backend host, not on a shared network drive or in a publicly served directory. Keep the computer awake and the server running during the demo.

QR checkout opens PayMongo's page directly on the phone. Status polling works without a public webhook endpoint, but the server still needs internet access to contact PayMongo. For webhook delivery while the admin page is closed, configure a public HTTPS tunnel/proxy to `/api/qr-payments/webhook`.

## Backup and restoration

Run `npm run backup` to create a consistent SQLite backup under `backups/`, including committed WAL content. Store that backup and `.env.server` privately. For restoration, stop the server, preserve the current data directory, replace the database with the backup at `DB_PATH`, remove stale WAL/SHM companions from the old database, restore its matching key file, and start the server. All sessions in an old backup may be restored too; revoke them with administrator assistance if needed.

## Troubleshooting

- **Local API unavailable:** run Express and check port 3001; restart Vite if needed.
- **Invalid email or password:** use the local admin created during setup, not Supabase credentials.
- **Origin not allowed:** add the exact browser origin (scheme, hostname, port) to `APP_ORIGINS`.
- **Slot changed:** refresh the product form before saving again.
- **Unresolved dispense:** inspect Machine/QR and resolve the saved job; do not delete database rows.
- **Provider not configured:** add only test PayMongo credentials to `.env.server` and restart Express.
