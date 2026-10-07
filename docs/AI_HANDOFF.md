# AI handoff

## Current checkpoint

- Branch: `feature/customer-mobile-payments`
- Starting `develop` HEAD: `0f5332d7ba287e57fae2bec131eff97ff57708c8`
- HEAD when this checkpoint opened: `150fd0eaa3f494cfef6fd83d7de7075ca24f4920`
- Commits added by this checkpoint, oldest first:

```text
e844c68 test(mobile): add jest-expo component test runner
4e08515 fix(mobile): let the server booking state gate the payment screen
16ccbb4 test(mobile): cover Pay visibility on Booking Detail
20c757d test(api): close payment auth, idempotency and secret-boundary gaps
cbe044c docs(phase4): record the mobile test runner and the SDK drift found with it
```

- Latest local HEAD: this file is updated in the final commit of the checkpoint. Run `git rev-parse HEAD` after pushing; it must equal `git rev-parse origin/feature/customer-mobile-payments`.
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
- The Payment screen mirrors the server booking state instead of trusting its own view of it: only `pending` renders a pay action, `confirmed` renders the paid card, and every other state says the booking is no longer open for payment with a way back. The guard is applied both when rendering and inside the checkout handler.

### Mobile component test runner

- `apps/mobile` now has a `test` script: `jest`. Jest and `jest-expo` were chosen over Vitest because React Native and `babel-preset-expo` have to execute in the test environment. See ADR 013 in `docs/DECISIONS.md`.
- `apps/mobile/jest.config.js` uses the `jest-expo/android` preset, limits `testMatch` to `src/**`, allows a 20s budget for cold transforms, and defaults `EXPO_PUBLIC_API_URL` when nothing else provides it.
- `@gorhom/bottom-sheet` is mapped to `apps/mobile/test-support/bottom-sheet-stub.js`; the real module pulls `react-native-gesture-handler` into a renderer shim that React Native 0.86 no longer ships.
- `@react-native/jest-preset` is deliberately **not** a direct dependency of `apps/mobile`. It is still installed as `jest-expo`'s peer. Making it a direct dependency split `react-native` into two store instances and broke `packages/ui-native` typechecking, because NativeWind's `className` augmentation only reaches the instance it was resolved against.
- TanStack Query test clients use `gcTime: 0` and `staleTime: 0` so cache timers do not keep Jest alive.

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
- Payment service tests cover server-side amount derivation, ownership refusal, non-pending refusal, provider-failure mapping, invalid signatures, captured-and-amount-matched confirmation, repeated verification idempotency, raw-body webhook signatures, webhook fail-closed configuration, unknown-order acknowledgement, paid-order downgrade protection, order/payment id mismatch, a payment that is not captured, a failed webhook event, a duplicate captured webhook, and a webhook arriving after the callback without a downgrade or a second payment row.
- API route tests cover payment-order auth requirements, verify and key-route auth requirements, and the webhook staying outside customer authentication.
- `apps/api/src/security.test.ts` scans every web and mobile source file for `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`, requires the client env files to expose only `EXPO_PUBLIC_`/`NEXT_PUBLIC_` values, and requires each privileged name to stay an empty placeholder in `apps/api/.env.example`.
- Mobile component tests cover the boundaries that only the screen can show:
  - Booking Detail offers **Pay Now** on a `pending` booking and hides it once the booking is `confirmed`.
  - Payment shows the server total, sends only the booking id to create an order, and posts the raw checkout result to verification rather than confirming itself.
  - A cancelled checkout calls neither verification nor navigation, leaves the booking alone, and offers the outstanding order again.
  - A failed payment-status read shows the unavailable state and recovers through **Retry**.
  - A booking the server already confirmed offers no pay action and creates no order.
- Run final gates on Node 22:

```bash
pnpm lint
pnpm --filter @turf-and-taste/mobile typecheck
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

All six pass on this checkpoint. `pnpm test` runs Vitest for the packages and the API (38 API tests) and Jest for `apps/mobile` (6 component tests across 2 suites).

`pnpm format:check` still fails on 35 files, and it failed the same way before this checkpoint: the repository was never formatted. Every file it flags other than the three touched here was already failing at the starting HEAD, and every file added in this checkpoint is Prettier-clean. Do not run a repository-wide reformat as part of this branch; treat it as its own change.

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
- Refund webhook events are not applied to orders that are already `paid`. Changing that is a product decision about whether a refund downgrades a booking, not a defect to fix silently. Record it in `docs/DECISIONS.md` before Phase 5 touches it.
- Two native blockers stop `expo export` / Metro from producing a bundle today. Neither was fixed on this branch because both are install and dependency-realignment work, not payment work:
  - `.npmrc` declares `node-linker=hoisted`, but the working install is isolated, so `node_modules/.pnpm/node_modules` holds the hoisted copies and Metro's `nodeModulesPaths` does not look there. Resolve the linker mismatch deliberately; it changes every `node_modules` layout in the repo.
  - `react-native-gesture-handler@~2.28.0` imports `react-native/Libraries/Renderer/shims/ReactNative`, which `react-native@0.86.0` removed.
- `expo/bundledNativeModules.json` for SDK 57.0.26 disagrees with several pinned native ranges (`react-native-gesture-handler` wants `~2.32.0`, plus `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `react-native-safe-area-context`, and `react-native-svg`). Realign with `expo install` in one change with a device smoke test before the first development build.
- `react-native-razorpay` is a native module, so Razorpay checkout does not run under Expo Go. `npx expo prebuild` plus a development build is required, and iOS also needs `LSApplicationQueriesSchemes` for UPI. The component tests mock checkout and assert only the behaviour around it.
- `pnpm peers check` reports three items: `react-native-reanimated@4.1.7` wanting React Native 0.78–0.82 and `expo-modules-core` wanting a newer `react-native-worklets` (both pre-existing), plus `@react-native/jest-preset` 0.86.3 against `react-native@0.86.0`'s exact optional peer `0.86.0`, which is unavoidable while `jest-expo` wants `^0.86.3` and React Native wants `0.86.0`.
- `apps/api/openapi/openapi.yaml` still stops at the booking endpoints. Profile endpoints from an earlier phase and all four payment endpoints are missing. The contract needs a dedicated pass; it was not extended here.

## Exact next phase

Phase 5 is booking fulfillment beyond payment: enforce capture settings deliberately (decide auto-capture vs manual capture as a recorded decision), then build the customer pass/QR for confirmed bookings. Payment refunds, cancellation policy, and staff-facing payment views require explicit product decisions first. Do not merge into `main` without an explicit request.

Before any of that can be verified on a device, the two native blockers listed under known gaps have to be cleared: settle the pnpm linker mismatch, then realign the Expo SDK native ranges with `expo install`. That is build work, not product work, and it should land as its own change so a regression is attributable. Do not claim Expo Go support; this app needs a development build.

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
