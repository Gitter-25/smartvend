# Local acceptance checklist

Use fictional students and test credit. Run `npm test` and `npm run build` first, then test your own configuration.

1. Run setup, start Express and Vite, sign in, reload the page, sign out, and confirm protected data is unavailable after logout.
2. Register a student, enroll a card, verify it, disable it, and confirm purchases are refused. Re-enable it.
3. Top up using centavos. Repeat the same request ID and confirm only one credit. A different amount under that ID must fail.
4. Set each product/price/stock. Submit a stale edit and confirm it cannot overwrite new stock.
5. Simulate a card purchase. Check exact wallet and stock deductions, the receipt, filtering, and recovery after a response is lost.
6. With motors disconnected, authorize a device purchase. Repeat authorize/start and confirm stock/credit change once and only one start grants actuation permission.
7. Confirm a no-item result. Repeat settlement and check a single wallet refund/stock restoration. Contradictory outcomes must fail.
8. Configure PayMongo test mode. Verify QR creation, unpaid start refusal, test success/failure, signed webhook delivery, and API polling. Verify that QR transactions never change student wallets.
9. Test QR cancellation and confirmed non-dispensing. Verify a full sandbox provider refund before the job becomes Refunded. Repeated callbacks must not restore stock twice. Late payment after cancellation must never dispense.
10. Restart Express and confirm database records persist. Run the backup command and verify a disposable restored copy before relying on it.
11. After hardware assembly, test one-item release, jams, missed sensor signals, reset during actuation, Wi-Fi outages, and certificate verification. Leave unknown physical results unresolved until stopped-machine inspection.

Automated integration tests use actual SQLite storage and Express HTTP routes, but synthetic payment-provider responses. They do not validate your PayMongo account, actual ESP32 persistence, motors, sensors, or public HTTPS setup.
