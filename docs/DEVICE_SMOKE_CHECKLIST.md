# Real-device smoke checklist

Manual checks that only a physical Android development build can answer. Run this after
`feature/customer-mobile-payments` passes the automated gates. Everything here is a **manual**
check: the automated suite covers the same boundaries at the API and component level, not on a
device.

Nothing in this checklist is production work. No production signing, no live Razorpay keys, no
`main` merge.

## Prerequisites

1. **Development build, not Expo Go.** `react-native-razorpay` is a native module, so Expo Go
   cannot load it. Install a dev build produced by `npx expo prebuild` + `npx expo run:android`.
2. **Environment.** A device/emulator that can reach `EXPO_PUBLIC_API_URL`, and the local
   `.env.keys` files present (never committed, never printed).
3. **Supabase.** All four migrations applied to the linked non-production project. See the
   migration truth section in `docs/AI_HANDOFF.md`.
4. **Razorpay TEST mode only.** Key id starts with `rzp_test_`. No live credential is ever placed
   in the app, the repo, or this document.
5. **Webhook reachability.** To exercise real webhook delivery, expose the API over HTTPS with a
   tunnel (ngrok, cloudflared, or equivalent). Without a tunnel, use the signed-curl method in the
   Webhook section.

### Razorpay test instruments (fixtures, not real money)

These are Razorpay's published TEST-mode fixtures, used only to drive test checkout:

- Test card `4111 1111 1111 1111`, any future expiry, any CVV.
- Test UPI `success@razorpay` for an approved payment.
- Test UPI `failure@razorpay` for a declined payment.

Confirm the current values against Razorpay's test-mode documentation before running; they are
provider fixtures and can change.

---

## AUTH

| #   | Check                                       | Pass condition                                                                                                                 |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Create account                              | `CreateAccount` registers a real Supabase auth user and lands in the customer stack. A `customer_profiles` row is provisioned. |
| A2  | Sign in                                     | `SignIn` with an existing customer reaches `Home`.                                                                             |
| A3  | Sign in — wrong password                    | Friendly error; no session created; no stack trace shown.                                                                      |
| A4  | Session restore                             | Kill the app fully and relaunch. The authenticated customer lands on `Home`, not `Welcome`.                                    |
| A5  | Session restore after restart of the device | Cold start after device reboot restores the session.                                                                           |
| A6  | Forgot password                             | `ForgotPassword` accepts the email and reports sent/invalid without leaking whether the account exists.                        |
| A7  | Sign out                                    | `Profile` → sign out returns to `Welcome`, and a relaunch does not restore the session.                                        |
| A8  | Sign out clears queries                     | After sign out, no previous customer's bookings are visible if a different customer signs in on the same device.               |

## DISCOVERY

| #   | Check             | Pass condition                                                                                            |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| D1  | Home              | `Home` loads real facilities from the API with loading, empty, error, and retry states.                   |
| D2  | Facilities        | `Facilities` lists only the four authorized facilities. No sport outside `docs/PRODUCT_TRUTH.md` appears. |
| D3  | Facility Detail   | `FacilityDetail` shows real schedule/pricing copy and offers **Start booking**.                           |
| D4  | Fixture labelling | Any demo/placeholder content on these screens is visually distinguishable from server data.               |

## BOOKING

| #   | Check                          | Pass condition                                                                                                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Valid future slot              | Pick a future Asia/Kolkata date and an offered duration; real available slots load.                                                                     |
| B2  | Past/closed slot excluded      | Past times, closed days, and schedule-override closures never appear as choosable.                                                                      |
| B3  | Unauthorized facility rejected | Requesting a facility outside the authorized set is rejected by the API, not by the client.                                                             |
| B4  | Unsupported duration rejected  | A duration the backend does not price is rejected by the API.                                                                                           |
| B5  | Quote creation                 | Review shows a **server** total, currency, and expiry countdown.                                                                                        |
| B6  | Quote expiry                   | Wait past 15 minutes; creating the booking is rejected and the screen offers a fresh quote.                                                             |
| B7  | Quote clears on change         | Changing date, time, duration, or add-on clears the displayed quote.                                                                                    |
| B8  | Booking creation               | A valid quote creates a booking whose status is **Awaiting payment**.                                                                                   |
| B9  | Client amount ignored          | A tampered client total is not honored — the stored booking amount equals the quote.                                                                    |
| B10 | Collision attempt              | Start the same slot twice (two devices or a second session). Exactly one succeeds; the loser gets the friendly conflict response and no orphan booking. |
| B11 | My Bookings                    | The new booking appears, opens its detail, and shows the server total plus "no payment has been collected".                                             |

## PAYMENT

| #   | Check                     | Pass condition                                                                                                                                                |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Pay Now visibility        | **Pay Now** shows on a `pending` booking only. It is absent on `confirmed` and on any non-payable state.                                                      |
| P2  | Payment screen truth      | The Payment screen shows the server total, reference, and the test-mode notice.                                                                               |
| P3  | Order reuse               | Backing out and returning reuses the outstanding `created` order; no duplicate `payment_orders` row is created.                                               |
| P4  | Checkout opens            | **Pay Now** opens native Razorpay TEST checkout with the **server** order id, amount, and currency.                                                           |
| P5  | Successful TEST payment   | Complete with a test instrument. The booking becomes `confirmed` only after the server verification response, and Booking Detail reflects it.                 |
| P6  | Failed TEST payment       | Complete with the failure instrument. The booking stays `pending`; no payment row reports success.                                                            |
| P7  | Cancelled checkout        | Cancel the checkout sheet. Neither verification nor navigation runs; booking stays `pending`; the outstanding order is offered again.                         |
| P8  | Invalid verification      | POST `/api/v1/payments/verify` with a forged or mismatched signature. The API returns 400 and the booking stays `pending`.                                    |
| P9  | Amount tampering          | A verify call with a wrong amount for a captured payment is rejected — the server cross-checks against the stored order.                                      |
| P10 | App restart after payment | Kill and relaunch. The booking reloads as `confirmed` and the Payment screen shows the paid state.                                                            |
| P11 | Payment status refresh    | Pull to refresh (or navigate away and back) reloads payment and booking state from the server.                                                                |
| P12 | Server-only confirmation  | At no point does the client mark payment successful or the booking confirmed on its own — force a verification failure and confirm the UI follows the server. |
| P13 | Duplicate verification    | Retry verification after a network interruption. Idempotent success, no duplicate-payment error, one payment row.                                             |
| P14 | Cross-customer payment    | In a second customer session, requesting payment for the first customer's booking resolves as not found.                                                      |

## WEBHOOK

The endpoint is `POST /api/v1/payments/webhook/razorpay` mounted at `/api/v1`, outside customer
authentication. Authenticity is an HMAC-SHA256 signature over the exact raw body with
`RAZORPAY_WEBHOOK_SECRET`.

### Dashboard configuration (required once the API is reachable over HTTPS)

- **URL:** `https://<your-api-host>/api/v1/payments/webhook/razorpay` — a real host only, never
  invented here and never committed.
- **Secret:** the same value as the API's `RAZORPAY_WEBHOOK_SECRET`.
- **Events:** `payment.captured`, `payment.failed`, `payment.refunded`.
- **Mode:** test mode, matching the key id used to create the order.
- The value must not appear in the repo, logs, or this document.

### Signed-curl method (works without a tunnel)

```bash
# Run from apps/api's environment; never print the secret itself.
BODY='{"payload":{"payment":{"entity":{"id":"pay_TEST123","order_id":"order_TEST123","status":"captured"}}}}'
SIG=$(node -e 'const c=require("crypto");process.stdout.write(c.createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(process.argv[1]).digest("hex"))' "$BODY")
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST "$API_URL/api/v1/payments/webhook/razorpay" \
  -H 'content-type: application/json' \
  -H "x-razorpay-signature: $SIG" \
  --data-raw "$BODY"
```

Replace `order_TEST123` with a real `provider_order_id` from `payment_orders` when you want the
event to be applied; an unknown order must be acknowledged with no writes.

| #   | Check                   | Pass condition                                                                                                                                 |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Valid webhook           | Correct signature over the raw body. Event applied through the shared persistence path; a captured event moves the order and booking forward.  |
| W2  | Duplicate webhook       | Send the same captured event twice. Second send writes no second payment row and never downgrades a paid order.                                |
| W3  | Invalid signature       | Flip one character of `SIG`. 400 `INVALID_WEBHOOK_SIGNATURE`, nothing written.                                                                 |
| W4  | Missing signature       | Omit the header. 400 `MISSING_SIGNATURE`.                                                                                                      |
| W5  | Altered body            | Sign one body, send another. Signature no longer matches; 400 and nothing written.                                                             |
| W6  | No auth required        | Call the endpoint with no customer session. It is not rejected for missing auth — only for a bad signature.                                    |
| W7  | Callback before webhook | Complete a real TEST payment; verification confirms the booking first, then the webhook arrives. No downgrade, no second payment row.          |
| W8  | Webhook before callback | Deliver a signed captured webhook first, then POST verify. Verify returns the recorded payment idempotently and the booking stays `confirmed`. |
| W9  | Failure event           | A `payment.failed` event does not confirm the booking.                                                                                         |
| W10 | Unknown order           | An event for an order we never created is acknowledged with 200 and no writes.                                                                 |
| W11 | Unconfigured secret     | Remove `RAZORPAY_WEBHOOK_SECRET` locally. The webhook fails closed (503 `PAYMENT_NOT_CONFIGURED`), it does not accept unsigned bodies.         |

## SECURITY

| #   | Check                                             | Pass condition                                                                                                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | No privileged keys in the bundle                  | The built JS bundle contains no `RAZORPAY_KEY_SECRET`, no `RAZORPAY_WEBHOOK_SECRET`, no `SUPABASE_SERVICE_ROLE_KEY`. Only `rzp_test_*` key id and `EXPO_PUBLIC_*` values are present. |
| S2  | Client cannot set the amount                      | The create-order request body contains only `bookingId`. Amount and currency come from the server.                                                                                    |
| S3  | Client cannot confirm payment                     | The checkout result is sent to the server; no client flag can flip a booking to `confirmed`.                                                                                          |
| S4  | Cross-customer booking read                       | A second customer cannot open the first customer's Booking Detail or My Bookings entry.                                                                                               |
| S5  | Cross-customer payment read                       | `GET /payments/orders/booking/:bookingId` for someone else's booking resolves as 404.                                                                                                 |
| S6  | Unauthenticated payment calls                     | Order creation, verify, and key retrieval all reject requests without a customer session.                                                                                             |
| S7  | Webhook is the only unauthenticated payment route | Every other `/payments/*` route requires customer auth.                                                                                                                               |
| S8  | Encrypted env at rest                             | Tracked env files remain dotenvx `encrypted:` blobs; `.env.keys` stays untracked.                                                                                                     |

---

## Recording a run

Copy this file's ID list into the checkpoint note with pass/fail per row and the build hash of the
development build. Any failure is a defect to fix on this branch, not a reason to move to Phase 5.
