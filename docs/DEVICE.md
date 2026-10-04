# Phase 7 backend — one machine, two slots

The device API and admin recovery page are implemented. Reader/motor firmware, wiring, sensing and physical tests are still pending. Do not connect the previous simulation endpoint to a motor.

## Upgrade the existing Supabase project

1. Pull the latest main branch and run `npm ci`.
2. In Supabase SQL Editor run **005_safe_stock.sql**, then **006_device_vending.sql**, then **007_refunded_status.sql**, once each. Existing migrations 001–004 must already be installed. Do not rerun 001. Stop vending during the upgrade; refresh open admin tabs afterward.
3. Redeploy `card-management` using `npx supabase functions deploy card-management` if your deployed version differs from the repository. Its existing keys stay unchanged.
4. Run `node scripts/generate-device-key.js`. It creates `.device.env` and refuses to overwrite it. This file is ignored by Git; back it up privately.
5. Run `npx supabase secrets set --env-file .device.env` and `npx supabase functions deploy device-vending` in your linked project.
6. Run `npm run dev`. Product edits now require migration 005; Machine status requires migration 006. Rebuild/redeploy your hosted frontend separately.

The device token is independent from card encryption keys. Give the ESP32 only its device token, Wi-Fi settings and HTTPS endpoint. Never put the Supabase service-role key or card encryption keys on the ESP32 or in React. Replacing DEVICE_TOKEN revokes the previous device credential. The machine must validate the HTTPS server certificate.

## Endpoint contract

POST `https://PROJECT-REF.supabase.co/functions/v1/device-vending`

Headers: `Authorization: Bearer DEVICE_TOKEN` and `Content-Type: application/json`.

| Action | Request fields besides action | Result |
| --- | --- | --- |
| heartbeat | none | Updates last contact |
| authorize | requestId (UUID), slot (1 or 2), uid | Reserves stock, deducts balance, creates Pending receipt; repeat ID returns original job |
| start | requestId | First transition returns shouldDispense=true and slot; repeats return false |
| status | requestId | Returns current job state; missing job returns 404 |
| finish | requestId, dispensed (boolean), reason | Confirms completion, or refunds/restores stock once for confirmed no item |

Device authorization finds the student from the enrolled encrypted UID. Device-supplied price, balance and student identity are ignored. One unresolved job blocks the next authorization. The card and stock are rechecked in the database. Changing a reserved product is blocked until settlement.

## Required firmware behavior

1. Wait for card removal before accepting another purchase from the same presentation.
2. Persist a fresh UUID to nonvolatile storage **before** requesting authorization. Keep it through restarts and timeouts. Retry authorization only with that same UUID/card/slot.
3. On authorization, persist the job and call start. Actuate only on the first successfully received shouldDispense=true response for that request. Persist a local consumed/start marker **before** driving a motor; never actuate the same job again after a reboot.
4. A lost start response is uncertain: query status and leave it unresolved. Receiving shouldDispense=false never permits motor actuation. Do not blindly repeat motor commands.
5. Use the chosen drop/position sensor design to establish the result. Persist a confirmed result before sending finish, and retry that same result until acknowledged. A timeout or power failure alone does not prove that no item was dispensed.
6. Unknown outcomes stay pending for admin inspection. Do not automatically refund on timeout or dispense again. Stop the device before admin reconciliation so a delayed response cannot trigger a motor. After reconciliation, query status, clear the terminal local job and only then resume service.
7. Send heartbeat while idle and connected (for example every 30 seconds). Last contact is informational, not proof that the mechanism works.

This protocol deliberately favors an unresolved job over double dispensing. HTTP alone cannot guarantee exactly-once physical motion; durable firmware state and physical outcome checks are required.

## Admin recovery

Open Machine → Refresh status. Stop the machine and inspect its output. Select “Item dispensed” to keep the charge, or “No item dispensed” to refund and restore one unit. Enter an inspection note and confirm the check. Repeating the same settlement does nothing; a contradictory settlement is rejected. Never classify an unknown result as no item.

## Software-only API checks

Use a fictional student with an enrolled test card and admin-funded wallet. Test requests change that wallet and stock, so do not use real transactions.

PowerShell:

```powershell
$env:SMARTVEND_DEVICE_URL = 'https://PROJECT-REF.supabase.co/functions/v1/device-vending'
node --env-file=.device.env scripts/device-request.js '{"action":"heartbeat"}'
```

The script sends one explicit JSON request. For authorize/start/status/finish use the fields in the table and keep the same UUID throughout. For a no-motor test, finish with dispensed=false and a note confirming this was a software test; this restores the reservation. Never send dispensed=true unless you are deliberately testing a completed sale using test credit.

## Verification and limits

`npm test` runs encryption/handler tests, persistent request tests, and the real SQL migrations in embedded PostgreSQL (PGlite). SQL checks cover restricted roles, stale slot edits, once-only charging, stock reservations, repeated starts, completion, refund and contradictory outcomes. Existing SQL top-up and simulated-purchase suites also run automatically.

These tests do not verify live Supabase deployment, simultaneous independent PostgreSQL connections, physical sensing, firmware persistence or real dispensing. Run the live acceptance checklist after deployment and hardware assembly. Stored UID encryption does not make UID-only cards clone resistant.

## Refund status wording

If migrations 001–006 are already installed, run only `007_refunded_status.sql`. It changes existing `Reversed` labels to `Refunded` and updates future refund responses. It does not change wallet balances or stock. No Edge Function redeployment or key changes are needed. Refresh the frontend after pulling this update.
