# SmartVend: step-by-step hardware assembly guide

**Status:** Planning guide for a classroom prototype; no physical hardware has been purchased or validated. This is not a final pin-by-pin wiring diagram. Read [HARDWARE.md](HARDWARE.md), [DEVICE.md](DEVICE.md), and [PROJECT_PHASES.md](PROJECT_PHASES.md) first.

## 0. Fixed customer interface: laptop / website

The customer kiosk is the existing React web page at `/kiosk`, opened in a laptop browser or website. **Do not purchase or wire any touchscreen, TFT, LCD, OLED, or other display for the ESP32-S3.** The ESP32-S3 handles RFID, dispensing motors, sensors, and communication with the Express backend. The laptop/website handles product selection, PayMongo QR checkout, and order status.

The browser kiosk and hardware controller must share the same backend order UUID. Before physical integration, implement a secure mechanism for the ESP32 to discover the authorized order without exposing the device token to the browser.

## 1. Freeze the design and verify the parts

Before purchase, record the **exact** ESP32-S3 development board revision/pinout, PN532 breakout and supported logic voltage, laptop/browser hosting, two product types and packaging, mass, slot capacity, cabinet dimensions, servo/gear-motor choice, power requirements, and total budget.

The existing [hardware shortlist](HARDWARE.md) proposes:

| Part | Planned quantity | Purpose |
| --- | ---: | --- |
| ESP32-S3 development board | 1 | Wi-Fi and machine controller |
| PN532 13.56 MHz NFC reader | 1 | Shared RFID reader |
| Compatible ISO14443A test cards | Several | Test enrollment and purchase |
| Normally-open pushbuttons | 2 | Slot selection (if using physical buttons) |
| MG996R positional servo | 2 | **Provisional** gravity-feed escapement, one per slot |
| IR break-beam emitter/receiver pair | 2 pairs | Detect item passage |
| Lever microswitch | 2 | Mechanism home-position feedback |
| Regulated enclosed 5 V supply | 1, rating to validate | Motor power |
| Breadboard and jumper wires | 1 set | Low-current bench prototyping only |
| Mechanical brackets, fasteners, enclosure, wiring and protection | To design | Safe permanent assembly |
| Existing laptop and browser | Already available | Customer interface at /kiosk; no additional display hardware |

**Do not purchase the servo option for spiral snacks without a mechanism review.** Spiral vending may require a different motor, driver, power rail, coupler and sensor arrangement. The proposed 5 V 5 A supply is only a candidate; calculate peak and stall current first.

## 2. Prepare a safe workbench

1. Use a dry, nonconductive bench with good light, ventilation and an accessible disconnect.
2. Gather a multimeter, USB data cable, small hand tools, insulated wiring, suitable connectors, and a low-voltage current-limited supply if available.
3. Disconnect all power before moving wires. Keep fingers, hair, clothing and cables away from actuators.
4. Use a commercially enclosed, safety-certified low-voltage adapter. **Do not open, modify or wire mains-voltage AC internals.** Ask a qualified adult/technician to handle mains-powered cabinet installation.
5. Do not route motor power through the breadboard, ESP32 GPIO, or 3.3 V regulator.

## 3. Identify and verify the ESP32-S3 board

1. Read the exact board silkscreen and manufacturer pinout.
2. Check which pins are safe GPIO, reserved for USB/flash/PSRAM, strapping, or boot.
3. Install a suitable ESP32 development toolchain and flash a simple LED/serial diagnostic.
4. Connect the board by **USB only** initially. Verify the serial monitor and Wi-Fi operation.
5. Create a wiring table with each selected GPIO and voltage. Do not copy generic pin numbers into the final design.

**Gate:** USB programming, stable power, serial diagnostics and Wi-Fi work.

## 4. Connect and test the PN532 reader (logic only)

1. With power disconnected, set the breakout's interface switches to the selected I2C or SPI mode according to **that module's documentation**.
2. Verify the breakout's power input and signal logic levels; use 3.3 V-safe signals. Do not assume a 5 V supply pin means 5 V-safe ESP32 IO.
3. Connect the reader power, ground and interface lines according to the verified board-specific wiring table.
4. Load a reader test program; scan the same test card repeatedly and after a restart.
5. Record whether identifiers are stable and formatted consistently. Test the actual university ID separately; do not rewrite or clone it.
6. Mount the antenna temporarily away from metal and retest through the proposed front panel.

**Gate:** Reader detects the selected test cards consistently. Wallet balances remain in SQLite, never on the card.

## 5. Test the laptop / website customer kiosk

1. Run Express and the React frontend on the laptop, or deploy the browser interface with appropriate network security.
2. Open `/kiosk`, select a product, and confirm price and available stock.
3. Generate a PayMongo **sandbox** checkout QR code and scan it with a phone.
4. Verify the page displays payment status and remains usable after a refresh.
5. Keep admin login and private credentials separate from the public kiosk.
6. If using physical selection buttons for RFID purchases, wire only the two dry-contact buttons to verified ESP32 GPIOs with 3.3 V pull-ups and debounce. Buttons are not required for QR product selection on the website.

**Gate:** Browser selection and sandbox QR flow work. No display module is attached to the ESP32.

## 6. Prototype ONE dispensing slot without products

1. Build a mechanical mock-up with an escapement that can release **one** item and hold the rest.
2. Mount one positional servo with a bracket and linkage. Check that the mechanism cannot pinch a user or crush wires.
3. Identify the servo's actual supply voltage, signal requirements, peak/stall current and safe angular travel from its documentation.
4. Power the servo from a **separate, appropriately rated low-voltage supply branch**, not from ESP32 GPIO or USB. Join the controller and servo signal grounds correctly; prevent unintended backfeeding.
5. Wire only the servo signal to a selected GPIO. Use a compatible signal buffer if the actual servo cannot reliably accept 3.3 V control.
6. With no product loaded, test limited-angle motion and the return to home. Stop if it stalls, heats, chatters or exceeds its mechanical stops.

**Gate:** Safe, repeatable single-slot motion at the intended travel.

## 7. Install position and drop sensors

1. Mount a lever microswitch so it confirms the mechanism's home position. Use its dry-contact common and chosen NO/NC terminal with a safe pull-up and test both states.
2. Mount the IR break-beam emitter and receiver across the product drop path, protected from mechanical impact.
3. Verify each sensor's voltage and output type. If open collector, use an appropriate pull-up to **3.3 V**; never feed an unverified 5 V output into an ESP32 GPIO.
4. Test sensor readings manually before moving the servo.
5. Test normal passage, a blocked beam, misalignment and sensor disconnection.

**Gate:** Home and item-passage signals are reliable and distinguishable. A missing sensor event alone is **not** proof that no item fell.

## 8. Test one loaded slot, then duplicate for slot two

1. Start with a harmless, uniform, lightweight sample item and a guarded collection tray.
2. Load a small number of items and run one dispense at a time.
3. Observe release count, home return, beam interruption, motor current and jams.
4. Repeat with full intended capacity and the heaviest approved product.
5. Adjust the escapement to prevent double dispensing. Do not infer success from a timer alone.
6. Once slot one passes, replicate the validated mechanism, servo, home switch and drop sensor for slot two.
7. Repeat the tests with both slots connected, including worst-case power draw.

**Gate:** Each slot releases exactly one item in repeated tests, with recorded sensor outcomes and no unsafe stalls.

## 9. Finalize low-voltage wiring and cabinet

1. Prepare a final board-specific pin map and labelled low-voltage wiring diagram from the actual selected modules.
2. Size the power adapter, fusing/protection, connectors and wire gauge for measured worst-case load; use a qualified person for enclosure power design.
3. Separate logic and actuator power branches; keep the required common reference for control signals.
4. Replace loose prototype connections with mechanically secure insulated connectors or a suitable PCB.
5. Add strain relief, accessible low-voltage power disconnect, guarded moving parts and cable routing away from moving components.
6. Mount the ESP32, RFID antenna, buttons, sensors, two mechanisms and collection chute.
7. Verify polarity, continuity, shorts, clearances and supply voltage with motors disconnected before first full power-up.

**Gate:** Inspection passes; no exposed hazardous conductors or moving pinch points accessible to customers.

## 10. Integrate ESP32 firmware with SmartVend

Follow [DEVICE.md](DEVICE.md) as the **authoritative API contract**:

1. Keep the Express + SQLite server running and reachable by HTTPS from the ESP32. `localhost` on the ESP32 is **not** the laptop.
2. Store only the dedicated `DEVICE_TOKEN` on the ESP32, not admin credentials, card encryption keys or PayMongo secrets. Validate HTTPS certificates.
3. Send `heartbeat` approximately every 30 seconds.
4. For RFID purchase, save a UUID before calling `authorize` with the card UID and slot.
5. For kiosk QR purchase, the React kiosk creates the order. When payment reaches `Authorized`, the device uses that **same order UUID** with `start`; firmware must not create a second checkout.
6. Save a consumed-actuation marker to nonvolatile storage **before** moving the motor. Only the first successful `start` granting `shouldDispense=true` permits one physical actuation.
7. Use home/drop sensors to determine the actual outcome. Persist the outcome before sending `finish` with `dispensed` and a reason.
8. If the response or physical result is uncertain, stop and require inspection; **never blindly repeat the motor movement**.

**Integration gap to resolve:** The current React kiosk is a browser, not the ESP32 firmware. Design and test a secure device-side way to discover or receive the currently authorized QR job UUID before expecting automatic QR dispensing. Do not assume the device automatically knows the browser's order ID.

## 11. Acceptance and failure testing

Record date, firmware revision, slot, test case, expected result, observed result, sensor data and transaction ID for each test.

- [ ] Card enrollment and reader stability
- [ ] Browser product selection and QR readability
- [ ] Normal RFID wallet purchase
- [ ] Verified PayMongo **sandbox** QR purchase
- [ ] Exactly one item released per authorization
- [ ] No release for unpaid, cancelled or duplicate orders
- [ ] No release when out of stock
- [ ] Jam, sensor failure and ambiguous outcome remain pending for inspection
- [ ] Network interruption before and after authorization
- [ ] ESP32 reboot before, during and after motor movement
- [ ] Admin inspection and reconciliation of unresolved jobs
- [ ] Stock, wallet and transaction consistency after each scenario
- [ ] Cabinet safety, stable power, secure wiring and accessible emergency disconnect

Do not label a software-simulated dispense as a verified physical dispense. For QR non-dispense, use the existing RefundPending and **provider-verified** refund workflow; there is no automatic real-money refund.

## 12. Defense preparation

Keep a labelled wiring diagram, finalized BOM, cabinet photos, firmware version, software commit, test results, and a recorded backup demo. Demonstrate sandbox payments only. If hardware is not ready, explicitly show the software simulator as a simulation.

## Open decisions before final wiring

- Exact ESP32-S3 board revision and available GPIOs
- Exact products, dimensions, weight and slot capacity
- Servo escapement **versus** spiral vending motor
- Power supply rating, protection and enclosure
- How firmware discovers the Authorized QR order UUID

These choices determine the final pin-by-pin wiring schematic. Do not assign pins or finalize the power wiring until they are resolved.
