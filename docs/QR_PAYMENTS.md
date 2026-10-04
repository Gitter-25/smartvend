# QR sandbox payments with Express

The QR encodes a PayMongo test checkout URL. Scan it with a phone camera, open the browser, choose GCash, and use the provider's test authorization. This is not a bank-app QR Ph code. The application calls the payment provider API to create and verify payments; it does not trust a browser's claim that payment succeeded.

## Configure

1. Complete [local setup](SETUP.md).
2. Obtain a test secret from [PayMongo Dashboard](https://dashboard.paymongo.com/), and confirm that the account permits sandbox GCash checkout.
3. Set `PAYMONGO_TEST_SECRET_KEY=sk_test_...` in your private `.env.server`, then restart Express. No Edge Function deployment or SQL Editor step is needed.
4. Open QR in the admin app, select an in-stock product, and create a test checkout.
5. Scan/open its link and complete the provider's sandbox authorization. Use fictional billing details if requested, and no real payment credentials.
6. The page polls every five seconds while active. Verified payment reaches Authorized; the device must still start and report its outcome before Completed.

Only test keys and `livemode=false` provider records are accepted. The checkout permits sandbox GCash only. PayMongo's testing documentation warns against paying its QR Ph images with real payment apps; this project uses the hosted test URL instead.

## Signed webhook

For unattended payment updates, expose the Express server through a public HTTPS reverse proxy/tunnel. Configure PayMongo's test webhook for `checkout_session.payment.paid` at:

```text
https://YOUR-SERVER/api/qr-payments/webhook
```

Put its signing secret in `PAYMONGO_TEST_WEBHOOK_SECRET` in `.env.server` and restart the server. The handler verifies the test HMAC over the original body, checks its timestamp, and retrieves the session from PayMongo before settlement. Polling can verify payments while developing without a public callback, provided the local server has internet access.

If accessing the admin site through the tunnel too, add that origin to `APP_ORIGINS` and enable secure cookies. The provider checkout page itself is hosted by PayMongo, so the phone does not need access to the local admin page just to open checkout.

## State and recovery

| State | Meaning |
| --- | --- |
| AwaitingPayment | One item reserved; provider payment unverified |
| Authorized | Payment verified; device can request its first start |
| Dispensing | Start permission consumed; physical outcome pending |
| Completed | Confirmed successful dispense |
| Cancelled | Provider expiry/rejection verified; stock restored once |
| RefundPending | Confirmed non-dispense, or late payment after cancellation; stock restored |
| Refunded | Matching full test provider refund verified |

QR purchases never debit or credit student wallets. Expire checkout requests provider cancellation and rechecks the actual result. Browser closure, elapsed time, and network failures do not automatically release reservations. A late payment after cancellation cannot trigger vending.

If checkout creation returns an uncertain response, retain its UUID. Retries do not create a second checkout. Locate the matching session in the provider's test records/API logs and recover its `cs_...` reference on the QR page. If no session can be located, investigate provider logs/support before changing the reservation; there is no blind reset.

For confirmed no item, stop and inspect the machine and record that outcome in Machine. Refund its displayed payment ID in PayMongo test mode, then enter the full `ref_...` reference on the QR page. The server checks succeeded status, payment identity, currency, test mode, and full amount. Automatic provider refund submission is not included.

## Device endpoint

POST `/api/qr-payments` with the dedicated device token. Supported actions: `create` with requestId and slot; `status` or `cancel` with requestId. Admin sessions can also `recover` with sessionId and `refund` with refundId. All actions preserve the same operation UUID. After Authorized, use [device start/finish](DEVICE.md).

## Scope and references

Local tests use synthetic provider responses; actual account activation, GCash sandbox availability, webhook delivery, refund processing, and phone scanning remain to be verified after configuration. Firmware and mechanics remain pending. Use the [TFT hardware shortlist](HARDWARE.md) for the future machine display; the laptop QR page works for initial testing.

Provider references checked during implementation:

- [Test mode](https://docs.paymongo.com/docs/payment-acceptance-testing)
- [Hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [Checkout resource](https://docs.paymongo.com/reference/checkout-session-resource)
- [Webhook signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Refund resource](https://docs.paymongo.com/reference/refund-resource)
