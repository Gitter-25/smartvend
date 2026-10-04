# Acceptance checklist

Use test students, test cards and test credit. Record results before classroom demonstration.

## Software upgrade
- Apply 005 and 006 once after 001–004; confirm npm test and npm run build pass.
- Open a slot in two browsers. Save a change in one; saving the old version in the other must reject it. Reload and edit again.
- Load a product editor, complete a simulated purchase elsewhere, then save its old stock. The stale save must fail.
- Interrupt a top-up response, reload, and retry the same student/amount. Check exactly one receipt and one credit. Use Check saved request receipt to recover a committed success.
- Repeat for simulated purchases using the same student, slot and card. Do not clear browser storage while an operation is unresolved. Storage failures must prevent sending a new payment.
- Verify transaction pages beyond 100 records using test data; test type, student, slot and local-date filters.

## Device backend
- Wrong token and human admin JWT are rejected; correct token updates last contact.
- Unknown/disabled card, no stock and insufficient balance deny authorization.
- Repeating authorization with the same ID charges once; changing its slot/card is rejected.
- One pending job blocks a second purchase and edits to its reserved slot.
- Only the first start returns permission to dispense; retry returns false.
- Confirmed completion keeps one charge/stock decrement. Confirmed no-dispense refunds/restores once.
- Repeating settlement is harmless; contradictory settlement is rejected.
- Non-admins cannot read machine jobs or reconcile them; browsers cannot call device-only RPCs.

## Physical hardware (pending)
- Confirm the exact ESP32-S3 board, reader/card compatibility, motors/drivers, power supply, mechanism and sensors before assigning pins.
- Exercise each slot with several products, including jams and empty channels.
- Test Wi-Fi loss before authorization, after charging, during start and after physical dispensing.
- Test device reboot in every phase. Never actuate the same request twice.
- Stop the device, inspect and resolve an uncertain outcome; clear the resolved local job before restarting.
- Confirm price/product changes match the physical products loaded in each slot.

## QR sandbox API acceptance

After migration 008 and provider configuration, follow [QR_PAYMENTS.md](QR_PAYMENTS.md). Verify unpaid/failed tests never dispense; successful sandbox API payment authorizes only one start; repeated status/webhooks preserve stock and wallets; expiry restores stock once; late payment cannot auto-dispense; QR failure restores stock without wallet credit; and only a matching full provider refund becomes Refunded. Complete provider tests with no real money and repeat physical sensing checks after hardware integration.
