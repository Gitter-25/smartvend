# SmartVend software presentation

## What we can demonstrate now

SmartVend is a classroom prototype for one vending machine with two product slots. The React admin app communicates with Express; Express owns the SQLite database, encrypted card identifiers, wallet transactions, stock reservations, and PayMongo test API calls.

**No physical hardware is installed yet.** Typed test card UIDs stand in for an RFID reader. Card purchases and device start/finish requests simulate dispensing. A `Completed` record in this demonstration means the software recorded a simulated outcome; it does not prove that an item physically dropped.

| Demonstrable feature | What to show |
| --- | --- |
| Administrator access | Sign in and open the overview |
| Inventory | Two slots, price in pesos, and stock counts |
| Student wallet | Register fictional details, enroll a test hexadecimal card UID, and add admin wallet credit |
| Card purchase | Simulate a purchase; compare wallet, stock, and receipt before/after |
| API payment | Create a QR checkout, open it with a phone camera, choose GCash, and authorize in PayMongo test mode |
| Payment verification | Payment becomes Authorized after API verification or a signed webhook |
| Dispense settlement | Run software start/finish with the same order UUID; show Completed |
| Recovery | Explain cancellation, restored stock, and provider refund verification |

QR checkout pays for the selected product directly. It does not top up or deduct a student wallet. All PayMongo payments are sandbox tests; no real money is used. The QR contains a hosted checkout URL and is opened using a phone camera.

## Rehearsal and startup

1. Back up the existing database with `npm run backup` and keep a private copy of `.env.server`. Do this before changing your presentation data.
2. Pull the latest code and run `npm ci`. Existing installations should **not** run setup again.
3. Start `npm run server`, then `npm run dev` in another terminal. Open the Vite address and sign in.
4. Confirm one stocked slot and one fictional student with an enrolled test UID and enough wallet credit. Record starting wallet and stock values.
5. For a simpler presentation with one app terminal, run `npm run build`, then `npm start`, and open `http://localhost:3001`. Stop any existing server on port 3001 before starting it again. Do not run the production app and the development app against the same demonstration at the same time.
6. For signed webhooks, keep `cloudflared tunnel --url http://127.0.0.1:3001` running. A new Quick Tunnel gets a new URL: update the PayMongo test webhook endpoint to `https://YOUR-TUNNEL/api/qr-payments/webhook`. Keep the signing secret private in `.env.server`; restart the API after changing configuration.
7. Keep PayMongo test mode open in a separate browser tab. Verify the webhook is enabled for `checkout_session.payment.paid` and test delivery succeeds.
8. Resolve any unfinished QR order before rehearsing another purchase. Stock is reserved during checkout; opening a new reference is not a way to abandon an existing order.

## Suggested 5–7 minute walkthrough

1. **Overview (30 seconds):** Explain the two payment methods, the single-machine scope, and the software demonstration label.
2. **Students and slots (1 minute):** Show a fictional student, an encrypted card enrollment, wallet credit, and product stock. Do not display backend keys or real student details.
3. **Card test (1 minute):** Select the student and slot, enter their enrolled test UID, and simulate a purchase. Show the updated wallet and stock, then open the transaction details.
4. **QR test (2 minutes):** Create a fresh checkout for the stocked product. Scan with a phone camera, choose GCash, and select **Authorize test payment**. Show the Authorized state, then simulate a successful dispense using the commands below. Show the Completed state and unchanged student wallet.
5. **Recovery (1 minute):** Show previously completed Cancelled and Refunded orders if available. Explain that a paid non-dispense restores stock and requires a verified provider refund; an uncertain physical outcome stays pending.
6. **Next phase (30 seconds):** ESP32-S3, compatible RFID reader/cards, motor drivers, motors, sensors, power supply, and mechanical assembly. See [hardware shortlist](HARDWARE.md). Physical vending reliability is still to be tested.

## PowerShell software dispense

Copy the **SmartVend order reference** from the QR page, not the PayMongo `cs_` or `pay_` reference. Replace `ORDER_UUID` with that exact UUID in both commands. Run these only for a software demonstration with no hardware connected.

```powershell
$env:SMARTVEND_DEVICE_URL = 'http://127.0.0.1:3001/api/device-vending'
node --% --env-file=.env.server scripts/device-request.js "{\"action\":\"start\",\"requestId\":\"ORDER_UUID\"}"
```

Proceed only when the start response grants `shouldDispense: true`. If the response is missing or uncertain, check status instead of repeating a dispense. For a successful **software simulation**:

```powershell
node --% --env-file=.env.server scripts/device-request.js "{\"action\":\"finish\",\"requestId\":\"ORDER_UUID\",\"dispensed\":true,\"reason\":\"Software simulation only; no physical item dispensed\"}"
```

The QR page checks status periodically. Use **Check status** to refresh manually. A successful software simulation consumes test stock, so prepare enough stock for rehearsals and the presentation.

## If the internet or PayMongo is unavailable

Present administrator access, slots, student wallets, card simulation, and saved transaction history on the local server. These do not need an external payment provider. Use screenshots from an earlier sandbox test to explain QR payments and identify them as recorded evidence. Do not imply that a screenshot is a live payment.

If checkout creation is interrupted, retain the saved reference and use the recovery controls. Do not reset the database, discard an unresolved order, or generate duplicate checkouts to make a presentation look successful.

## Talking points

- “The server checks price, stock, and payment status; the browser cannot mark an order paid.”
- “Retries reuse a reference so they do not charge or reserve stock twice.”
- “Card wallet refunds restore project credit. QR refunds are verified with PayMongo and never credit student wallets.”
- “Hardware integration is our next phase. Today we are demonstrating the software and payment API.”
