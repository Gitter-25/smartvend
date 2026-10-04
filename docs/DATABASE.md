# SQLite database design

One Express process owns the SQLite file on the local computer. The React frontend and ESP32 call purpose-specific APIs; neither receives SQL access. Tables are created automatically when a new file is opened. `PRAGMA user_version=1` records the schema version; a newer unknown version is rejected.

| Table | Purpose |
| --- | --- |
| admins | Local admin identity and salted password hash |
| sessions | Hashed opaque session tokens and expiry |
| students | Student details and wallet balance in integer centavos |
| cards | Encrypted UID, HMAC lookup, active flag, student link |
| products | Two fixed slots, integer-centavo prices, stock, edit version |
| transactions | Immutable purchase/top-up identity and amount snapshot; settlement status/note |
| vend_jobs | Physical vending state and inspection notes |
| qr_orders | Provider session/payment/refund references associated with a job |
| machine | Last contact of the single ESP32-S3 |

Student balances are stored with students instead of a separate wallets table. We retain separate receipts, device jobs, and QR provider references because they track different outcomes: payment approval does not prove that an item physically dispensed.

Wallet credits, purchases, reservations, and settlement use synchronous `BEGIN IMMEDIATE` / `COMMIT` transactions. Exceptions roll back the entire change. Foreign keys are enabled, money uses integer centavos, and WAL mode supports reads during writes. Writes are serialized; this is intended for one small machine and one local backend host.

An operation UUID identifies each top-up or purchase. Retrying it returns the saved outcome, while reuse with different inputs is rejected. A slot edit checks its version. Active reservations prevent replacement of their product. Only the first start response grants `shouldDispense=true`.

Express supplies authorization checks for admin routes, independent machine authentication for device requests, and signed webhook verification for provider callbacks. SQLite does not replace these application checks with Supabase RLS. The server's narrow handler adapter is internal and is not exposed as a generic SQL or RPC endpoint.

The database contains private student/payment records. UID fields are encrypted, but the entire database file is not encrypted by this application; protect the computer account, disk, and backups. Session tokens are hashed; passwords are salted scrypt hashes. Original backend encryption keys are needed to decrypt card records.

Supabase-to-SQLite record import is not automatic. Existing identifiers, monetary precision, encryption keys, and pending payments must be reconciled before a future data transfer. This release changes the application runtime without altering the old cloud database.
