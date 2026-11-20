# Phase 4 — Software-only vending simulator

**Scope:** Local development and PayMongo sandbox only. No ESP32 or physical hardware required. The simulator uses the existing authenticated device API to advance a **single already Authorized** job, with explicit operator confirmation. It never creates a payment, fakes PayMongo verification, reads card credentials, or operates motors.

## Prerequisites

1. Use a **separate disposable test database**, not the database containing real student or transaction records. Back up any data before testing.
2. Configure the normal local backend as described in [SETUP.md](SETUP.md). Use only PayMongo `sk_test_` credentials.
3. Run the backend (`npm run server`) and frontend (`npm run dev`).
4. On the admin dashboard, configure a slot with test stock. Open `/kiosk` and create a sandbox QR checkout. Complete the provider sandbox payment and wait until the kiosk says **Payment verified. Waiting for the vending machine to start**.
5. Copy the order UUID displayed on the kiosk (not the provider session ID). The same UUID is the device job identifier.

## Run the simulator

In a **new PowerShell terminal** in the project directory:

```powershell
$env:SMARTVEND_DEVICE_URL = 'http://127.0.0.1:3001/api/device-vending'
node --env-file=.env.server scripts/simulate-vend.js 'PASTE-ORDER-UUID-HERE' success --confirm-simulated
```

The script first checks status, requires `Authorized`, sends one `start`, then sends one `finish` with a reason explicitly identifying the simulation. The kiosk's normal polling should eventually show `Completed`.

For a **different** Authorized sandbox order, test a confirmed failure:

```powershell
node --env-file=.env.server scripts/simulate-vend.js 'ANOTHER-ORDER-UUID-HERE' failure --confirm-simulated
```

For a QR order, a simulated non-dispense enters `RefundPending`; it **does not automatically refund** PayMongo. Use the documented administrator recovery workflow and provider-verified refund reference. The next purchase stays blocked until the unresolved job is handled.

## Acceptance checklist

- [ ] Sandbox payment reaches `Authorized` before simulation.
- [ ] Simulated success transitions `Authorized → Dispensing → Completed`.
- [ ] Stock decreases once, and kiosk displays completed.
- [ ] Re-running the same UUID refuses to dispense again.
- [ ] Invalid UUID or unpaid checkout cannot start.
- [ ] Simulated confirmed non-dispense leads to `RefundPending` for QR.
- [ ] Admin resolves the pending refund only with a verified provider refund.
- [ ] A second checkout is blocked while the first job is unresolved.
- [ ] Simulated notes are visible in transaction/audit history.
- [ ] After backend restart, the same UUID is not actuated again.

## Limitations and recovery

This is a **manual simulator**. It deliberately does not poll and discover QR jobs automatically; the operator copies the order UUID from the kiosk. Automated discovery will need a separately designed, authenticated device-job assignment mechanism before hardware integration.

A network timeout after `start` leaves the physical outcome uncertain. Do not rerun the simulator or mark it successful automatically; inspect job state and reconcile with an operator. `Completed` from this script means **simulated success only**, not verified item passage.

The script is restricted to a loopback URL and requires the device credential plus an explicit `--confirm-simulated` flag. Keep credentials private; do not deploy this script on a public machine.
