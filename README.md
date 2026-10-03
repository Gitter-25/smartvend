# SmartVend

A small subject project: two fixed product slots, one machine, manual admin wallet top-ups, NFC wallet purchases, and encryption. Finish the software before connecting ESP32-S3 hardware.

## Start
Use Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To connect your project, follow [Phase 3 setup](docs/SETUP.md). `.env.local` belongs beside `package.json`; `.env.example` is a blank template. Keep secrets out of Git.

## Current features
- Admin email/password login and protected routes.
- Student registration with a zero-balance wallet.
- Separate product, price, and stock settings for Slot 1 and Slot 2.
- Transaction history and filtering.
- Admin wallet credits with an atomic transaction receipt and safe request retries.
- Backend encrypted card enrollment, verification, and enable/disable.

Live card enrollment requires the deployment steps in [Phase 4 encryption](docs/ENCRYPTION.md). Simulated purchase authorization is implemented; physical hardware is still pending. The React app cannot credit balances or create financial transactions directly.

For a sample-data preview, explicitly set `VITE_DEMO_MODE=true`. It never connects to Supabase and resets edits on refresh. Encryption is available only in connected mode.

## Check
```sh
npm test
npm run build
```

GitHub Actions runs these checks on pushes and pull requests. Named functions have short explanatory comments. Shared components keep repeated UI code small.

## Roadmap
1. React project setup — done
2. Admin screens — done
3. Supabase authentication and data — implemented, confirmed working by user
4. Backend card encryption — implemented, confirmed working by user; two-slot update added
5. Manual admin top-ups — implemented; run migration 003
6. Simulated wallet purchases — implemented; run migration 004 and redeploy card-management
7. ESP32-S3 integration — pending
8. Final testing and presentation — pending

## Routes
`/login`, `/dashboard`, `/students`, `/product`, `/transactions`, `/purchase`.

For production hosting, configure app routes to serve `index.html`.

## Two-slot update
After pulling this update, run [002_two_slots.sql](supabase/migrations/002_two_slots.sql) in Supabase SQL Editor. Do not rerun 001_initial.sql. Slot 1 keeps its current settings; Slot 2 starts with zero stock. Both slots share one ESP32-S3 and one NFC reader. No Edge Function redeployment or key changes are needed.

## Phase 5
Follow [admin top-up setup](docs/TOPUPS.md). External Maya payments are omitted to keep the subject project small.

## Phase 6
Follow [simulated purchase setup](docs/PURCHASES.md). This admin-only test uses enrolled encrypted cards and updates wallet credit, slot stock, and receipts atomically. It does not physically dispense items.
