# SmartVend — Phase 3

Small subject project: one product, one machine, admin-created Maya top-ups, NFC wallet purchases, and encryption. Software is completed before hardware integration.

## Run
Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

```sh
npm run build
npm run preview
```

## Routes
`/login`, `/dashboard`, `/students`, `/product`, `/transactions`.

Phase 3 adds Supabase email/password login, protected admin routes, database-backed student/wallet records, product editing, card status updates for enrolled cards, and transaction reads. Follow [docs/SETUP.md](docs/SETUP.md) to run the migration, create your admin, and configure `.env.local`. Without configuration, the app displays setup instructions.

For a sample-data preview, explicitly set `VITE_DEMO_MODE=true`. It never connects to Supabase and resets on refresh. Live Maya payments and encrypted card enrollment are still pending. Wallet balances and transaction writes are blocked from the browser.

Every named function has a short explanatory comment. Arrow callbacks are small inline rendering expressions.

## Roadmap
1. Setup
2. Admin interface
3. Supabase data and authentication
4. Backend card encryption
5. Maya sandbox top-ups
6. Simulated purchases
7. ESP32-S3 integration
8. Testing and presentation

## GitHub
Private repository: https://github.com/Gitter-25/smartvend. Never commit backend secrets.

For production hosting, configure all app routes to serve index.html.
