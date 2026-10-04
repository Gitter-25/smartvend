# SmartVend hardware and Shopee sourcing

Research date: 4 October 2026. Scope: one ESP32-S3, two product slots, one shared RFID reader, and an admin-managed student wallet.

## Selection status

The ESP32-S3 is confirmed by the project owner. The parts below are the proposed hardware shortlist; they have not been purchased or physically validated. Product dimensions, weight, packaging, cabinet design, and budget are still needed to finalize the dispensing mechanism.

Shopee Philippines listings were found for the listed parts. Search indexing and accessible pages do not guarantee live stock, delivery dates, seller authenticity, or the selected variant. Confirm these in Shopee before ordering. Prices are omitted because vouchers and variants change them.

## Core electronics

| Component | Quantity | Purpose and selection requirement | Shopee source |
|---|---:|---|---|
| ESP32-S3 development board | 1 | Wi-Fi controller. Suggested N16R8 USB-C development board with headers; buy a complete board, not a bare module. Match firmware and wiring to its exact board revision. | [ESP32-S3 N16R8 board](https://shopee.ph/ESP32-S3-N16R8-Development-Board-WiFi-Bluetooth-5.0-USB-TYPE-C-ESP32-i.1696185724.50456447278) |
| PN532 NFC/RFID reader module | 1 | Shared card reader for both slots. Select the complete module with antenna and supported SPI/I2C interface. Confirm ESP32-compatible logic levels on the actual breakout. | [Circuitrocks PN532](https://shopee.ph/Circuitrocks-PN532-NFC-RFID-Module-V3-Reader-Writer-13.56MHz-Arduino-ESP32-Raspberry-Pi-DIY-i.20469516.1375475009) |
| ISO14443A S50 13.56 MHz cards | 10 | Backup project cards if university IDs are incompatible. Choose ordinary fixed-UID cards and verify the pack quantity. | [10-card S50 listing](https://shopee.ph/10Pcs-IC-Card-13.56MHz-ISO14443A-S50-MF-MFS50-Proximity-Smart-Universal-RFID-Access-Control-Card-for-Fingerprint-Lock-etc-i.890274958.25973840688) |
| Normally-open momentary pushbuttons | 2 | One selection button for each slot. Choose non-illuminated buttons for simple wiring. | [12 mm pushbutton](https://shopee.ph/FANSIN-Momentary-Push-Button-Switch-12mm-Black-Shell-Stainless-Steel-with-pre-Wiring-1-Normally-Open-i.1120565516.25435705248) |
| SSD1306 0.96-inch I2C OLED | 1 | Show card prompt, selected slot, progress, and result. Confirm the SSD1306 I2C variant and 3.3 V compatibility. | [OLED listing](https://shopee.ph/0.96-OLED-I2C-IIC-Module-LCD-Display-Screen-SSD1306-Chip-i.1788423392.48061727947) |
| USB data cable | 1 | Programming and initial board power. Match the computer and board connectors. | [UGREEN USB-to-Type-C data cable](https://shopee.ph/UGREEN-Type-C-3A-USB-Cable-to-Type-C-Fast-Charge-Data-Cable-i.64922227.1163586850) |
| Breadboard | 1 | Low-current logic prototyping only. Verify that the wide development board leaves usable connection rows. | [Breadboard and wire kit](https://shopee.ph/Breadboard-Jumper-Wire-Kit-with-400-Point-Breadboard%E3%80%8165pcs-Multiple-Sizes-BreadBoard-Wire%E3%80%81140Pcs-2-125mm-U-Shap-Jumper-Wire-Kit-i.414027162.49561458596) |
| Dupont jumper wires | Assorted | Male-to-male, male-to-female, and female-to-female as required by board headers. | [CreateLabz jumper sets](https://shopee.ph/Dupont-Jumper-Wires-Female-to-Female-Male-to-Male-Female-to-Male-set-of-10pcs-i.66722864.7537323040) |

## Student ID compatibility

The PN532 supports 13.56 MHz ISO14443A/MIFARE, with additional protocols described in the [NXP datasheet](https://www.nxp.com/docs/en/nxp/data-sheets/PN532_C1.pdf). The proposed S50 cards match the intended ISO14443A reader mode. Actual supplied cards must still be tested.

A university ID is not automatically compatible: it might use 125 kHz, another protocol, or an identifier that is unsuitable for this implementation. Scan a sample several times and after power cycling; confirm a stable identifier and consistent formatting before enrollment. The planned firmware initially targets ISO14443A UID reads.

If the student ID fails this test, assign a separate SmartVend card to the student's account. Do not copy or rewrite the university ID. Wallet credit stays in Supabase; no wallet value needs to be written onto the card. UID-based identification is suitable for this classroom prototype but is not clone-resistant payment authentication; backend encryption does not change that property.

## Dispensing parts: provisional servo option

This option is for a small gravity-fed mechanism handling uniform, lightweight, rigid packaged items. A designed escapement must release exactly one item while retaining the remaining stack. A simple flap is not sufficient. Prototype one loaded slot before committing to two.

| Component | Quantity for two slots | Requirement | Shopee source |
|---|---:|---|---|
| MG996R positional servo | 2 | Select the 180-degree positional variant, not 360-degree continuous rotation. Validate torque, travel, current, and linkage under a full product load. | [MakerLab servo listing](https://shopee.ph/Tower-Pro-Digital-Robot-Servo-Motor-%28180-Rotation%29-%E2%80%93-MG996R-MG996-i.18252381.190150250) |
| IR break-beam emitter/receiver pair | 2 pairs | One pair per slot's drop path. Confirm range, pair quantity, and safe output voltage. Use beam interruption sensors, not reflective obstacle sensors. | [Break-beam pair listing](https://shopee.ph/%E3%80%90LLMA%E3%80%91IR-Break-Beam-Sensor-Infrared-Interruption-Detection-Split-Beam-For-Arduinoready-stock-i.375947758.54955152031) |
| Lever microswitch | 2 | One home-position switch per mechanism. Wire dry contacts to logic inputs. | [KW11 switch listing](https://shopee.ph/Limit-Switch-3Pin-N-O-N-C-5A-250V-AC-Micro-KW11-3Z-Switch-for-3D-Printer-i.182022209.23445864603) |
| Enclosed regulated 5 V supply | 1 | A 5 A model is a starting candidate, not a verified final rating. Check servo specifications and worst-case current, including holding/jams; confirm output connector before ordering. | [CreateLabz 5 V 5 A adapter](https://shopee.ph/Power-Supply-5V-5A-AC-DC-Power-Adapter-for-CrowPi-2-and-Raspberry-Pi-i.66722864.43868495874) |
| Acrylic sheet for chute/panels | To drawing | Example material only; sheet thickness and reinforcement depend on the cabinet load and dimensions. | [3 mm acrylic](https://shopee.ph/Clear-Acrylic-Sheet-3mm-Thick-Clear-i.272021788.29352662652) |
| Power connector | As needed | Match the actual supply plug size, polarity, and current rating; this listing is a candidate, not an assumed fit. | [DC screw-terminal connector](https://shopee.ph/DC-Power-Male-Female-Connector-Terminal-Block-5.5%2A2.1mm-Screw-Terminal-DC-Plug-Jack-Adapter-for-CCTV-LED-Strip-i.510011991.46613813702) |
| 74AHCT125 signal buffer | If required | Optional servo signal translation when the servo does not reliably accept 3.3 V logic. This is an IC, requiring appropriate mounting and decoupling. | [Circuitrocks level shifter](https://shopee.ph/Quad-Level-Shifter-3v-To-5v-74ahct125-i.20469516.827004591) |

Mounts, retainers, fasteners, appropriately rated power wiring, protection, and permanent interconnects remain to be sized and sourced with the mechanical drawing. This is a shortlist, not a complete fabrication kit.

For snack packets or a spiral design, evaluate a [dedicated vending gear motor](https://shopee.ph/AZJ-1Pcs-of-Vending-Machine-Motors-24-12V-2-3Pins-DC-Gear-Motor-Box-For-Snack-Drinking-Combo-For-Spiral-Spring-And-Vending-Machine-i.415907063.24970461311) instead. Its voltage variant, matching spring/coupler, home feedback, driver, and supply require a separate finalized BOM. Do not order the servo and spiral options as though both are required.

## Electrical and assembly requirements

- Keep ESP32 signals at 3.3 V logic. Confirm breakout schematics and pull-up voltages before connecting reader, display, or sensors.
- Power servos through a separately wired, rated supply branch, never an ESP32 GPIO, 3.3 V output, or breadboard power path. Join logic and actuator grounds appropriately.
- During initial USB-powered development, avoid connecting a second supply to the board's power input unless the exact board documentation permits it.
- Verify sensor output type. For an open-collector receiver, use a pull-up to 3.3 V; do not assume every Shopee sensor matches the [Adafruit break-beam example](https://learn.adafruit.com/ir-breakbeam-sensors/arduino).
- Keep the reader antenna away from metal and test it behind the actual front panel. Secure wiring away from moving parts.
- GPIO assignments will be documented after selecting the exact board, interfaces, and mechanism; generic ESP32 pin diagrams are not sufficient.

## Integration and validation

Follow [DEVICE.md](DEVICE.md) for the existing endpoint contract. Firmware and physical integration are still pending.

The controller will read a card, accept a slot selection, authorize a purchase, and actuate only when the backend grants permission to start. Persist the job identifier before requests and a consumed-actuation marker before driving the mechanism, so retries or a reboot cannot dispense twice.

Use drop feedback and mechanism position to assess the outcome. A missed beam or timeout alone does not prove that no item dispensed: leave ambiguous outcomes pending for stopped-machine inspection and admin resolution. Use the existing Refunded outcome only when non-dispensing has been established.

Only the dedicated device credential belongs on the controller. Card encryption keys and the Supabase service-role key stay on the backend. Validate HTTPS certificates.

Before demonstrating: test repeated taps, insufficient balance, empty slots, one-item release under full load, jams, missed sensor events, power loss during movement, and network loss before/after authorization. Confirm wallet, stock, and transaction outcomes against [ACCEPTANCE.md](ACCEPTANCE.md).

Next decision: specify the two products, their dimensions/weight, desired capacity per slot, and available hardware budget. Then finalize the mechanism, power budget, wiring diagram, and firmware.
