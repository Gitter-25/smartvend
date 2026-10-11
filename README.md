# SmartVend

A small classroom vending project: one ESP32-S3, two slots, an admin React website, encrypted RFID identifiers, admin-funded wallets, and PayMongo sandbox checkout via QR.

The backend is now **Express + SQLite**. The React app and ESP32 call an HTTP API; only the server opens the database file. Supabase accounts, Edge Functions, Deno, and SQL Editor migrations are no longer needed for this version.

## Run locally (Windows or macOS/Linux)

Install **Node.js 24 LTS**. From the repository folder:

```sh
npm ci
npm run setup
npm run server
```

Setup asks for a new local admin email and password, creates two empty product slots and a SQLite database, and generates independent backend keys. In a second terminal:

```sh
npm run dev
```

Open the Vite URL (normally http://localhost:5173) and sign in with the administrator you just created. Keep both terminals running. Configure products and stock, register a fictional student, enroll a test card, and credit their wallet.

For a single-server demonstration, run `npm run build`, then `npm start`, and open http://localhost:3001.

See [local setup](docs/SETUP.md), [database design](docs/DATABASE.md), [QR sandbox payments](docs/QR_PAYMENTS.md), [device protocol](docs/DEVICE.md), [hardware/Shopee shortlist](docs/HARDWARE.md), and [software presentation walkthrough](docs/PRESENTATION.md).

## What is retained

- Administrator login with salted password hashes and server-side cookie sessions.
- Student registration, encrypted card enrollment/verification, and card enable/disable.
- Manual top-ups, card purchases, centavo prices, and transaction filters.
- Version-checked stock edits and one unresolved vending operation at a time.
- Once-only authorization/settlement, explicit physical-outcome recovery, and QR test payment verification.
- Sandbox QR checkout, signed webhooks, cancellation and provider-refund verification. No live-money mode.

## Existing Supabase users

Your cloud project is not deleted or modified. Existing students, balances, cards, receipts, credentials, and in-flight jobs are **not automatically imported**. The local setup starts a new database and creates a new admin; use fictional data for the new test run. Finish or reconcile old vending/payment jobs before changing a physical device's endpoint. Preserve the old project and original encryption keys if you need to transfer its records later.

The old code, SQL migrations, and instructions are preserved under `legacy/` for reference. Do not run them for the new local version. Previous untracked Deno editor files can remain locally; they are unused.

## Private files and backups

Runtime data is stored in `data/smartvend.sqlite`. Backend configuration is in `.env.server`; neither is committed. Back up the database using `npm run backup` and back up `.env.server` privately as well. Do not copy only a live SQLite file without its WAL; use the backup command or stop the server first. Losing encryption keys makes enrolled card identifiers unreadable.

## Checks and limits

```sh
npm test
npm run build
```

Tests include real Express HTTP requests, SQLite persistence/rollback, authentication, encrypted cards, money/stock retries, QR settlement, and signed webhook verification with synthetic provider responses. GitHub Actions runs tests and the production build on Node 24.

Actual PayMongo account configuration, public HTTPS/webhook delivery, ESP32 firmware, mechanical assembly, and sensor testing remain to be completed. The local computer must stay running for vending. RFID can operate on a reachable local backend without external payments; PayMongo testing requires internet access.
