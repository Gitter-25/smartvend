# ESP32-S3 and the local API

Run the Express server continuously. The machine uses `DEVICE_TOKEN` from the private `.env.server` file, Wi-Fi settings, and an HTTPS API address. Never put the admin password, card encryption keys, or PayMongo secret on the ESP32.

POST to `https://YOUR-SERVER/api/device-vending` with `Authorization: Bearer DEVICE_TOKEN` and `Content-Type: application/json`.

| Action | Fields besides action | Result |
| --- | --- | --- |
| heartbeat | none | Updates last contact |
| authorize | requestId UUID, slot 1 or 2, uid | Verifies enrolled card, reserves stock, deducts wallet once |
| start | requestId | First transition grants shouldDispense=true and slot |
| status | requestId | Current physical job state |
| finish | requestId, dispensed boolean, reason | Records a confirmed physical outcome once |

Use `/api/qr-payments` for QR `create`, `status`, and `cancel`, with the same device token. After API payment reaches Authorized, use the same UUID with device start/finish. RefundPending blocks the next purchase until operator recovery.

## Firmware rules

1. Wait for card removal between purchases.
2. Save the UUID to nonvolatile storage before requesting authorization/checkout. Retain it across retries and resets.
3. Save a consumed-actuation marker before moving a motor. Only the first received shouldDispense=true permits motion. Repeated start responses never permit a second dispense.
4. A lost start response is uncertain. Check status and require inspection rather than redispatching.
5. Use sensors to confirm the outcome. Persist it before reporting finish. Timeouts alone do not establish that no item dispensed.
6. Stop the machine before admin reconciliation. Clear its resolved local job before restarting.
7. Send heartbeat approximately every 30 seconds. Last contact is informational, not proof of working mechanics.
8. Verify HTTPS certificates. Never use localhost as the ESP32's laptop address.

## Software-only requests

With the motor disconnected, PowerShell can call the loopback API:

```powershell
$env:SMARTVEND_DEVICE_URL = 'http://127.0.0.1:3001/api/device-vending'
node --env-file=.env.server scripts/device-request.js '{"action":"heartbeat"}'
```

Use the table's fields for subsequent requests and retain their UUID. A software-only completed purchase consumes test stock; a card non-dispense refund restores its wallet and stock. A QR non-dispense restores stock and enters RefundPending until a provider refund is verified. Mark software simulation notes clearly. Physical firmware and sensors still require their own testing.
