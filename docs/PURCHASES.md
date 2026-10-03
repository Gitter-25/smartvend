# Phase 6 — Simulated NFC purchases

This is an admin-only software test. It changes real project wallet credit and stock but does not move a motor or confirm physical dispensing.

## Setup
1. Pull main: `git pull --ff-only origin main`.
2. Run `supabase/migrations/004_simulated_purchases.sql` in Supabase SQL Editor. Earlier migrations must already be applied; do not rerun 001.
3. Redeploy the updated card function: `npx supabase functions deploy card-management`.
4. Start React: `npm run dev`.

Keep the existing encryption keys. No new secrets or dependencies are required.

## Test
1. Give an enrolled student sufficient wallet credit and set a slot's stock above zero.
2. Open Purchase, select that student and slot, and enter the same UID used for enrollment.
3. Choose Simulate purchase. Confirm the wallet drops by the slot price, stock drops by one, and Transactions contains a Completed purchase.
4. Refresh to confirm persistence. Click the transaction reference to see the slot and product snapshot in its note.
5. Try a wrong UID, disabled card, empty slot, and insufficient balance. These must reject the purchase without a charge or stock change.
6. Repeat with Slot 2.

For database verification, run `supabase/tests/simulated_purchase.sql` in SQL Editor. It needs an existing admin and enrolled card and rolls back its changes. It checks function permissions, charging, stock, receipts, retry, and rejection cases.

## Explain the flow
The Edge Function authenticates the admin, normalizes the UID, finds its HMAC lookup, and decrypts the stored identifier to verify integrity and the selected student. It then calls a service-role-only SQL function. React cannot call that payment function directly or supply the price. The database locks the card, wallet, and selected slot, checks status, balance and stock, then commits one debit, one stock reduction, and a receipt together. The receipt snapshots the name, slot, and price so changing products later does not rewrite history.

The form reuses its request ID when retrying the same card/student/slot after an interrupted response. Stay on the page for that retry. If you refreshed or left the page, check Transactions before submitting again because the in-memory retry ID is gone.

Completed means the software simulation completed. Physical vending will need a separate dispense acknowledgement and recovery flow in Phase 7.

## Validation
The build and automated crypto/handler tests passed locally, including purchase routing, identity checks, and ignored client price/actor inputs. Database verification and live deployment require your Supabase project and were not run here.
