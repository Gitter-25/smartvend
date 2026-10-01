# SmartVend — Phase 2

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

Phase 2 includes student registration with duplicate checks, card enable/disable, shared wallet previews, a disabled Maya top-up form, product price/stock editing, dashboard summaries, transaction filters and details. Data is fictional and kept only in memory; navigation preserves edits, refreshing resets them. Use test card identifiers only.

Login is a disabled preview: routes are not authenticated yet. There is no database, payment integration, encryption implementation, or hardware connection yet.

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
