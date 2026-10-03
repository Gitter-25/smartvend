# Phase 5 — Manual admin top-ups

This subject project uses admin-added wallet credit, as requested. Maya integration is omitted. A top-up records manual credit; it does not collect or confirm an external payment.

## Setup
1. Pull main with `git pull --ff-only origin main`.
2. Run `supabase/migrations/003_admin_topups.sql` in Supabase SQL Editor. Do not rerun the initial migration.
3. Start the app with `npm run dev`.
4. Open Students, choose a student, enter 100, and click Add wallet credit.
5. Confirm the wallet increases by ₱100 and Transactions shows a completed Top-up. Refresh and confirm persistence.

No Edge Function redeployment, dependencies, or encryption key changes are required.

## Database check
Run `supabase/tests/admin_topup.sql` in SQL Editor after the migration. It requires an existing admin and student. It checks denied non-admin access, a valid credit, retry without double credit, a receipt, and rejection of zero. It rolls back all test changes. The test impersonates the admin only inside SQL Editor; the browser cannot choose its authenticated identity.

## How it works
The React form calls `admin_topup`. This database function verifies the signed-in admin, locks the wallet row, validates a ₱1–₱10,000 amount, credits the wallet, and creates a receipt in one transaction. The receipt stores the admin user ID. Browser wallet and transaction write permissions remain blocked. If a database operation fails, both changes roll back.

The form reuses its request ID when retrying the same student and amount after an interrupted response. Stay on the page and retry the same entry in that case. A refresh loses the pending request ID, so check Transactions before submitting again after a refresh. Different successful submissions deliberately create separate credits.

Card identifiers still use Phase 4 encryption. Wallet arithmetic uses numeric database values; it does not require decrypting a balance. Supabase requests use HTTPS.

## Validation
The production build and existing encryption tests passed during development. The SQL check and live credit workflow must run in your Supabase project; they were not executed against your database here.
