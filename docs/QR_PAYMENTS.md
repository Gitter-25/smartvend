# QR payments through a sandbox payment API

SmartVend supports card-wallet purchases and PayMongo test checkout purchases. QR purchases do not require a student account or alter any student wallet. There is still no separate customer website: the phone opens PayMongo's hosted checkout.

## What the QR represents

The QR contains a PayMongo **test checkout URL**. Scan it with the phone camera and open the browser, then choose the sandbox GCash flow and authorize or fail the test. This is a URL QR, not a bank-app QR Ph payment code. The integration creates and verifies an actual provider API resource; it is not a local fake payment button.

PayMongo's current testing guide warns that its QR Ph images can initiate real payments even during testing. This implementation therefore excludes `qrph`, permits only `gcash`, rejects live secret keys, and verifies `livemode=false` on provider records. Never enter real bank/card/e-wallet credentials. Use fictional checkout details if requested.

The official v1 checkout resource is used because it exposes the payment intent immediately and has documented retrieve/expire endpoints. A future v2 migration must adapt and retest the verification rules.

## Setup for the existing project

1. Pull the latest `main`, then run `npm ci`.
2. Stop vending. In Supabase SQL Editor, run **008_qr_test_payments.sql** once, after migrations 001–007. Do not rerun old migrations. This adds QR orders and test-payment labels; existing card-wallet balances are unchanged. Refresh open admin tabs after upgrading.
3. Sign up or sign in at [PayMongo Dashboard](https://dashboard.paymongo.com/). In test mode, obtain your secret API key from Developers → API Keys. Confirm that sandbox GCash checkout is available on the account. Account access and payment-method availability have not been verified for this project.
4. Create a private file named `.secrets.paymongo.env` in the project root, containing:

   ```dotenv
   PAYMONGO_TEST_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_TEST_SECRET
   ```

   This filename is already ignored by Git. Do not put this key in React, a `VITE_` variable, firmware, screenshots, or chat. It belongs only in Supabase backend secrets.
5. In your linked Supabase project, run:

   ```sh
   npx supabase secrets set --env-file .secrets.paymongo.env
   npx supabase functions deploy qr-payments
   ```

   The existing `DEVICE_TOKEN` stays unchanged. `device-vending` and `card-management` do not require redeployment for the SQL behavior change. If you deploy the updated device handler anyway, its authentication contract is unchanged.
6. Run `npm run dev`, sign in as an admin, and open **QR** in the navigation. Hosted frontend deployments need a separate rebuild/redeploy. The new frontend requires migration 008.
7. Create a checkout for an in-stock slot. The page displays a QR and an Open test checkout link. Complete sandbox authorization. Status should become **Authorized**, not Completed: the device must still report the dispensing outcome.

Only test API credentials are accepted. No production payment activation is part of this feature.

## Webhook setup

Polling works while the QR page or device is checking status. Configure the webhook before the unattended hardware demonstration so payment changes are detected even with the admin page closed.

In PayMongo test mode, create an endpoint for `checkout_session.payment.paid`:

```text
https://PROJECT-REF.supabase.co/functions/v1/qr-payments/webhook
```

Add its signing secret to `.secrets.paymongo.env` as `PAYMONGO_TEST_WEBHOOK_SECRET`, then rerun the secrets command. The function checks the `te` HMAC signature over the raw request body with a five-minute timestamp window, rejects live events, and retrieves the checkout using the secret API key before changing local state. Browser redirects never prove payment.

Repeated events and status checks use the same saved job. Events arriving before checkout binding return a retryable error; polling also recovers this timing case. If provider delivery remains unsuccessful, inspect its test webhook delivery log and use Check status on the saved order. Do not mark the order paid manually.

## States and stock

| State | Meaning | Stock and wallet behavior |
| --- | --- | --- |
| AwaitingPayment | Checkout reserved; API payment not verified | One stock unit reserved; wallet unchanged |
| Authorized | Matching sandbox payment verified | Same reservation; device may request start |
| Dispensing | First start permission consumed | Never repeat motor actuation |
| Completed | Device confirmed the item dispensed | Reservation becomes the sold item |
| Cancelled | Provider expiry verified without a successful payment | Reservation restored once; receipt is Failed |
| RefundPending | Confirmed no item, or payment arrived after cancellation | Stock restored; provider refund still needed |
| Refunded | Full sandbox refund verified through provider API | No second stock restoration; no wallet credit |

An open checkout or unresolved job blocks a new physical card or QR authorization. Closing a browser, choosing Back on checkout, or losing Wi-Fi does not release inventory. Use Expire checkout and check cancellation; processing payments remain unresolved. A late payment after cancellation is sent to refund recovery and never automatically dispensed.

## Interrupted creation and refunds

The first request reserves stock and receives permission to create one provider checkout. Retry the original UUID. Later calls never create another checkout for that order. An explicit provider validation/auth rejection releases the reservation; a network timeout or malformed response remains uncertain.

If creation was interrupted before the session ID was saved, locate the matching request reference in PayMongo's test records/API request logs and use its `cs_...` ID in Verify and recover checkout. The backend checks mode, reference, amount, currency, and allowed method before binding it. If no session can be located, retain the reservation and investigate the provider logs/support rather than deleting rows or issuing another payment. There is deliberately no blind reset for an uncertain external request.

If the machine definitely dispensed nothing, stop it, inspect it, and record that outcome in Machine. For a QR purchase this restores stock and sets **RefundPending**. Issue a full refund for the displayed payment ID in PayMongo test mode, then enter its `ref_...` ID on the QR page. The backend verifies the refund's succeeded status, original payment, full amount, PHP currency, and test mode. Pending, partial, wrong-payment, and live refunds are rejected. SmartVend does not submit automatic provider refund requests.

Do not issue a provider refund while the machine might still dispense. An uncertain physical result must stay unresolved. Clearing a browser reference never deletes a server order; recent QR orders can be reopened on the QR page.

## ESP32-S3 contract

Use the same dedicated device token as [DEVICE.md](DEVICE.md). POST to `/functions/v1/qr-payments` with JSON and `Authorization: Bearer DEVICE_TOKEN`:

| Action | Fields | Result |
| --- | --- | --- |
| create | requestId UUID, slot 1 or 2 | Saved order, amount, state, checkoutUrl when available |
| status | requestId | Rechecks provider payment and returns current job state |
| cancel | requestId | Requests provider expiry and rechecks outcome |

The admin also has `recover` (sessionId) and `refund` (refundId); the device cannot use them. Poll at most once every five seconds and avoid overlapping requests. Retain the same request ID across resets. The QR handler never starts a motor.

After **Authorized**, send `start` to the existing `device-vending` endpoint using the same UUID. Actuate only on its first `shouldDispense=true`, with a persisted consumed marker. Send `finish` to that endpoint with the confirmed outcome. The same durable-state and sensing rules used for card payments apply. Clear only a safely resolved local job; RefundPending blocks new sales until admin recovery.

For software-only testing with motors disconnected, the existing `scripts/device-request.js` can send explicit `start`, `status`, and `finish` calls to `SMARTVEND_DEVICE_URL`. Use the QR page's UUID. A deliberately simulated `dispensed=true` completes a test sale and consumes one stock unit; label its reason "Software-only QR test, no motor connected". A `dispensed=false` test enters refund recovery. Do not confuse these tests with physical sensor validation.

## Hardware impact

Use the laptop QR page for initial testing. The proposed machine display is now a separate **2.8-inch ILI9341 SPI TFT, 240×320**, replacing the small OLED as the primary display. See [HARDWARE.md](HARDWARE.md) for its Shopee listing. Retain the ESP32-S3. Confirm the module's logic levels and test the full checkout URL QR on the actual display and phone before final assembly. A payment-method selection control is also needed; its button/touch arrangement and GPIO assignment remain part of firmware design.

## Verification and remaining work

Local automated tests cover the real SQL migrations, privileges, reservation/settlement retries, card-wallet regression, expiry and late payments, key restrictions, provider verification, and webhook signature tampering. The frontend production build also runs. Provider fixtures are synthetic, not proof that a configured PayMongo account works.

Before the demonstration, verify actual sandbox creation, GCash success/failure, provider polling and webhook delivery, cancellation, full refund recovery, stock history, and a second purchase. ESP32 firmware, camera readability on the TFT, mechanics, and actual sensing remain pending.

Official references checked 4 October 2026:

- [PayMongo testing](https://docs.paymongo.com/docs/payment-acceptance-testing)
- [Hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [Checkout resource](https://docs.paymongo.com/reference/checkout-session-resource)
- [Create](https://docs.paymongo.com/reference/create-a-checkout), [retrieve](https://docs.paymongo.com/reference/retrieve-a-checkout), and [expire](https://docs.paymongo.com/reference/expire-a-checkout-session)
- [Webhook signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Refund resource](https://docs.paymongo.com/reference/refund-resource)
