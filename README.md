# SmartVend

A small subject project: one product, one machine, admin-created Maya wallet top-ups, NFC wallet purchases, and encryption. Finish the software before connecting ESP32-S3 hardware.

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
- One product's price and stock settings.
- Transaction history and filtering.
- Backend encrypted card enrollment, verification, and enable/disable.

Live card enrollment requires the deployment steps in [Phase 4 encryption](docs/ENCRYPTION.md). Maya payments, purchase authorization, and hardware are still pending. The React app cannot credit balances or create financial transactions directly.

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
4. Backend card encryption — implemented; deploy to your Supabase project
5. Maya sandbox top-ups — next
6. Simulated wallet purchases — pending
7. ESP32-S3 integration — pending
8. Final testing and presentation — pending

## Routes
`/login`, `/dashboard`, `/students`, `/product`, `/transactions`.

For production hosting, configure app routes to serve `index.html`.
