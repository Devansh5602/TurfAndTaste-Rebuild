# AI handoff

## Current checkpoint

- Branch: `feature/customer-mobile-payments`
- Starting `develop` HEAD: `0f5332d7ba287e57fae2bec131eff97ff57708c8`
- Latest local HEAD: record with `git rev-parse HEAD` after the final Phase 4 checkpoint commit
- Runtime: Node.js 22 (`.node-version` is `22`; package engine is `>=22.13.0`)
- Target PR branch: `develop`; do not merge to `main`

## Phase 4 modules

### Payment API and verification boundary

- `POST /api/v1/payments/orders` creates a Razorpay order for an existing `pending` booking. The client sends only `bookingId`; the API reads the booking's stored quoted amount and currency, enforces ownership and payable status, and never accepts a client-supplied total.
- `GET /api/v1/payments/orders/booking/:bookingId` returns the latest payment order for the owning customer; a missing order resolves as 404.
- `POST /api/v1/payments/verify` verifies the Razorpay checkout signature (`HMAC-SHA256` of `payment_id|order_id` with the key secret), re-fetches the payment from Razorpay, requires `captured` status, cross-checks the captured amount and currency against the stored order, and confirms the booking only after all checks pass. Ownership is enforced; verification is idempotent so retries return the recorded payment instead of failing on the unique `provider_payment_id` constraint.
- `GET /api/v1/payments/razorpay/key` returns the public key id only. The key secret and webhook secret never leave the server.
- `POST /api/v1/payments/webhook/razorpay` is mounted outside customer authentication because Razorpay calls it directly. It verifies an HMAC-SHA256 signature over the exact raw request body (captured by `express.json`'s `verify` hook) with the server-only `RAZORPAY_WEBHOOK_SECRET`, and processes `captured`/`failed`/`refunded` events idempotently. Unknown orders are acknowledged without writes; a paid order is never downgraded by a late event.
- Verify and webhook processing share one persistence path: payment order status, payment record, and booking confirmation. A failed booking update after verified payment surfaces as a database error so the client can retry safely.
- Provider outages map to `502 PAYMENT_PROVIDER_ERROR`; missing configuration maps to `503 PAYMENT_NOT_CONFIGURED`.
- `payment_orders` and `payments` tables and customer read policies already existed in the initial schema migration; no new migration was added in Phase 4.

### Mobile payment journey

- Booking Detail now shows **Pay Now** for `pending` bookings and reflects `confirmed` after verification.
- The Payment screen loads the server booking total, the Razorpay key id, and any existing payment order; it shows loading, error, retry, and paid states.
- An outstanding `created` payment order is reused instead of creating a duplicate; checkout launches `react-native-razorpay` with the server order id and amount.
- Checkout results are sent to the server for verification; the booking is confirmed only from the server response. Invalidating booking queries updates Booking Detail and My Bookings.
- Payment states use `Badge` variants and existing primitives; the checkout theme color comes from design tokens.

### Payment state boundary

- The client never sends a payable amount or a payment-success flag.
- Razorpay secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) stay in the API environment.
- Development uses Razorpay test mode only. The screen labels the flow as a test payment.
- Refunds, cancellation, passes, and QR remain out of scope.

## Phase 3 modules

### Booking API and database boundary

- Corrected route composition so facility and booking endpoints live at their intended `/api/v1/*` paths.
- Added strict shared schemas for facility, calendar date, local time, duration, quote selection, booking creation, booking status, and UUID inputs.
- Added Asia/Kolkata-safe conversion helpers; server clock determines whether slots are in the past.
- Added a forward-only booking-integrity migration; prior migrations are unchanged and no database reset was performed.
- Added persistent customer-bound `booking_quotes` with server amount, currency, selection, expiry, and one-time consumption.
- Added `facility_id`, `addon_id`, and `quote_id` to bookings for authoritative reservation identity.
- Added a PostgreSQL exclusion constraint for overlapping `pending` or `confirmed` reservations on one facility.
- Added a service-role-only transactional `create_booking_from_quote` function that locks and validates the quote, creates the pending booking and item together, consumes the quote, and maps overlap races to a conflict.
- Removed direct customer insert/update RLS policies for bookings; customers retain own-record reads.
- Added automatic customer-profile provisioning for real Supabase Auth users and backfill for existing auth users.

### Availability and quotes

- Availability is generated from weekly schedules in one-hour starts for backend-supported 1- or 2-hour durations.
- Full slot intervals are checked against server time, schedule boundaries, schedule-override closures, pricing eligibility, and pending/confirmed bookings for the selected facility.
- Availability responses include `serverNow` and `businessTimeZone: Asia/Kolkata`.
- Shooting Machine is validated through the real facility/add-on relationship and only appears for Cricket Green Net Practice.
- Quote pricing is read from server pricing tiers; the client never submits or calculates an authoritative total.
- Quotes expire after 15 minutes and are bound to the authenticated customer.
- Any service/date/time/duration/add-on change clears the mobile quote.

### Mobile booking journey

- Facility Detail now starts the booking flow with a stable `FacilityKey`.
- Booking steps cover date, backend-supported duration, allowed option, real availability, server quote, review, and booking creation.
- Date choices are future Asia/Kolkata dates. Final date/time authority remains on the API.
- Loading, empty, error, retry, refresh, disabled, stale-quote, expired-quote, and slot-conflict states are handled.
- Successful creation navigates to Booking Detail and invalidates My Bookings.
- Booking Detail shows the booking reference, facility, date/time, duration, add-on, server total, and actual status. It explicitly says no payment has been collected.
- My Bookings lists only the authenticated customer's API-filtered records with loading, error, empty, refresh, and detail navigation.

## Booking state and payment boundary

- Phase 3 creates `pending` bookings; Phase 4 payment verification transitions them to `confirmed`.
- The mobile label before payment is `Awaiting payment`.
- Confirmation happens only after server-side signature verification and a provider-confirmed captured payment.
- No refund, cancellation, pass, or QR UI exists yet.

## Security and ownership

- Customer identity always comes from the verified API principal.
- Quote and booking bodies contain no customer id, amount, privileged status, or payment result.
- Quotes are owned by and validated against the authenticated customer.
- Booking list/detail queries include authenticated ownership filters; another customer's booking resolves as not found.
- Direct customer booking writes are removed from RLS. The transaction function is executable only by `service_role`.
- Supabase service-role and payment secrets remain server-only and are not present in mobile code or documentation.

## Tests and verification

- Shared booking tests cover strict dates/times, Asia/Kolkata conversion, authorized facilities, supported durations, and quote-ID requirements.
- Quote-service tests cover real facility/add-on lookup, server pricing, and unavailable-slot rejection.
- Booking-service tests cover database collision mapping and prove the RPC receives authenticated identity and quote id rather than a client total.
- Existing product tests continue to enforce authorized sports, Shooting Machine ownership, durations, stale quote selection, and past-slot rules.
- Payment schema tests cover booking-only order creation (no client amount), complete checkout verification input, and provider state enums.
- Payment service tests cover server-side amount derivation, ownership refusal, non-pending refusal, provider-failure mapping, invalid signatures, captured-and-amount-matched confirmation, repeated verification idempotency, raw-body webhook signatures, webhook fail-closed configuration, unknown-order acknowledgement, and paid-order downgrade protection.
- API route tests cover payment-order auth requirements and the webhook staying outside customer authentication.
- Run final gates on Node 22:

```bash
pnpm lint
pnpm --filter @turf-and-taste/mobile typecheck
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Native Android/iOS builds were not run.

## Migration status

The hosted database already contained the three Phase 1 migrations. The Supabase CLI linked-project dry run identified exactly one pending migration:

```text
20261006183000_booking_integrity.sql
```

This migration must be applied to the linked non-production Supabase project before end-to-end manual booking tests. Do not reset the database. Review the dry run, then use the established linked-project migration workflow.

## Manual testing commands

Use Node 22 and existing local `.env.keys`; never print secret values:

```bash
nvm use 22
pnpm install
pnpm env:api echo "API environment available"
pnpm env:mobile echo "Mobile environment available"

# Terminal 1: API
pnpm env:api pnpm --filter @turf-and-taste/api dev

# Terminal 2: Expo development client / Metro
pnpm env:mobile pnpm --filter @turf-and-taste/mobile dev
```

Use a development build on an emulator/device that can reach `EXPO_PUBLIC_API_URL`. A real Supabase customer account and applied Phase 3 migration are required.

## Manual smoke checklist

1. Sign in with a real customer account.
2. Open one of the four authorized facilities.
3. Tap **Start booking**.
4. Choose a future date.
5. Choose a duration offered by backend pricing.
6. Verify real available slots load; closed/past/conflicting slots do not appear.
7. Verify Shooting Machine appears only for Cricket Green Net Practice.
8. Select a slot and request the server quote.
9. Review the server total and expiry; change an input and verify the quote clears.
10. Create the booking and confirm status is **Awaiting payment**.
11. Open My Bookings and verify the booking appears; open its detail.
12. Refresh and restart the app; verify the authenticated session and booking history reload.
13. In a second customer session, verify the first customer's booking is inaccessible.
14. Attempt the same slot concurrently and verify one request receives the friendly conflict response.
15. On a `pending` booking, tap **Pay Now** and confirm the Payment screen shows the server total, reference, and test-mode notice.
16. Create a payment order; confirm the amount shown equals the booking's server total and no duplicate order is created when returning to the screen.
17. Complete Razorpay test checkout with a test method; confirm the booking flips to **confirmed** only after verification and Booking Detail reflects it.
18. Cancel checkout; confirm a friendly cancel alert and that the booking remains `pending`.
19. Kill and restart the app; confirm the paid booking reloads as confirmed and the Payment screen shows the paid state.
20. Retry verification after a network interruption; confirm no duplicate payment error surfaces.

## Known gaps

- The Phase 3 migration is committed but not automatically applied by application startup; it must be applied through the linked Supabase migration workflow.
- Native device interaction and concurrent two-customer smoke tests remain manual checkpoint tasks.
- Availability currently uses one-hour start increments because the domain durations are one and two hours; finer increments require an explicit product decision.
- Open (`closed = false`) schedule overrides are not treated as expanded operating hours; closure overrides are authoritative and supported.
- No pagination UI is needed yet; the API bounds My Bookings to 100 records.
- Email verification/recovery deep-link completion remains a prior auth handoff gap and is not broadened here.
- Razorpay orders are created without an explicit auto-capture setting, so capture behavior follows the dashboard's account-level default. A payment left `authorized` is not confirmed by the API; the webhook can still record `failed`/`refunded` outcomes. Confirm the test account's capture setting before end-to-end payment tests.
- The webhook endpoint must be registered in the Razorpay dashboard with `RAZORPAY_WEBHOOK_SECRET`; webhook delivery itself cannot be exercised locally without a tunnel.
- `expired` payment-order status is modeled but never set; there is no order-expiry job yet.
- Refunds are out of scope; the `refunded` status only appears if the provider reports it.

## Exact next phase

Phase 5 is booking fulfillment beyond payment: enforce capture settings deliberately (decide auto-capture vs manual capture as a recorded decision), then build the customer pass/QR for confirmed bookings. Payment refunds, cancellation policy, and staff-facing payment views require explicit product decisions first. Do not merge into `main` without an explicit request.

## Multi-device recovery

```bash
git clone <repository-url>
cd TurfAndTaste-Rebuild
git switch feature/customer-mobile-payments
nvm install 22
nvm use 22
corepack enable
pnpm install

# Securely transfer local-only files; never commit or print their contents:
# apps/api/.env.keys
# apps/web/.env.keys
# apps/mobile/.env.keys

pnpm env:api echo "API environment available"
pnpm env:web echo "Web environment available"
pnpm env:mobile echo "Mobile environment available"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
