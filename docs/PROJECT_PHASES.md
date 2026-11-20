# SmartVend development phases

Status date: 20 November 2026. This is the proposed implementation and defense plan. "Implemented" does not mean hardware or live-provider validated.

| Phase | Scope | Current status | Exit criteria |
| --- | --- | --- | --- |
| 1. Repository and environment | Git hygiene, React/Vite, Express, SQLite, Node 24, CI | Implemented | Clean main, reproducible setup and passing checks |
| 2. Admin portal | Login, students, card enrollment, wallet top-up, product stock, machine and transaction views | Implemented; review pending | Admin acceptance tests and access-control review |
| 3. Customer kiosk and QR | Public touchscreen, two products, PayMongo test checkout, verified order status | Implemented; end-to-end validation pending | Sandbox checkout and recovery pass without admin access |
| 4. Software-only vending simulator | Explicit simulated ESP32 heartbeat/start/finish, failure injection, repeat protection | Next | Repeatable successful/failed/uncertain vending test scenarios without motors |
| 5. UX and reliability | Touch sizing, kiosk recovery, accessible states, error handling, security review | Planned | Usability walkthrough and resilience checklist pass |
| 6. Hardware selection and assembly | Confirm products, enclosure, electronics, power and mechanics | Planned, no parts purchased | Approved BOM, wiring diagram, safe bench tests |
| 7. ESP32 firmware integration | RFID, buttons, display/interface, HTTPS API, nonvolatile job state, servo/sensors | Planned | Real device tests with one-item release and verified sensor outcomes |
| 8. Final acceptance and defense | Integrated scenarios, logs, backup, report and demo | Planned | All acceptance criteria documented and signed off |

## Order of work

1. Finish sandbox payment and admin acceptance tests.
2. Build a **clearly labelled software simulator** for ESP32 device requests. A simulated finish is not proof that an item was dispensed.
3. Exercise success, failed/uncertain dispensing, retry, restart, duplicate request, stock and refund paths. Use fictional students and sandbox payment records.
4. The kiosk is fixed as a **laptop or website browser** using the existing React interface. No touchscreen, LCD/TFT or separate ESP32 display UI is required.
5. Record the actual two products, dimensions, mass, package rigidity, desired stock capacity, enclosure dimensions, screen choice and budget.
6. Finalize the mechanical and electrical design before buying parts.
7. Integrate firmware one peripheral at a time, then test real physical dispense outcomes.
8. Conduct final security and presentation review. Do not use live PayMongo credentials in this classroom prototype.

## Phase 4 simulation acceptance checklist

- [ ] Device heartbeat updates last-seen status.
- [ ] An Authorized QR order starts once using its original UUID.
- [ ] A successful **simulated** dispense reaches Completed and is labelled simulated in the test record.
- [ ] A confirmed simulated non-dispense follows the documented RefundPending workflow; do not claim automatic refund.
- [ ] An uncertain result stays unresolved until inspected and reconciled.
- [ ] Duplicate start/finish calls never authorize another physical actuation.
- [ ] Restart and lost response preserve the UUID and do not silently retry a motor action.
- [ ] A second order is blocked while a first order is unresolved.
- [ ] A cancelled/unpaid order never authorizes vending.
- [ ] The admin portal remains protected from the public kiosk.

## Related guides

- [Hardware shortlist](HARDWARE.md)
- [Step-by-step hardware assembly](HARDWARE_ASSEMBLY_GUIDE.md)
- [ESP32 device API](DEVICE.md)
- [QR payments](QR_PAYMENTS.md)
- [Acceptance tests](ACCEPTANCE.md)
- [Local setup](SETUP.md)
