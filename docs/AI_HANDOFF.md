# AI handoff

## Current checkpoint

- Branch: `feature/customer-mobile-booking`
- Starting `develop` HEAD: `d418f7b45ad67885c691ede9eb52d85044b0e442`
- Latest local HEAD: record with `git rev-parse HEAD` after the final Phase 3 checkpoint commit
- Runtime: Node.js 22 (`.node-version` is `22`; package engine is `>=22.13.0`)
- Target PR branch: `develop`; do not merge to `main`

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

- Phase 3 creates `pending` bookings only.
- The mobile label is `Awaiting payment`.
- No Razorpay UI, payment capture, payment-success flag, confirmation, refund, cancellation, pass, or QR was added.
- Future payment work must consume the existing pending booking and confirm only after server-side payment verification.

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

## Known gaps

- The Phase 3 migration is committed but not automatically applied by application startup; it must be applied through the linked Supabase migration workflow.
- Native device interaction and concurrent two-customer smoke tests remain manual checkpoint tasks.
- Availability currently uses one-hour start increments because the domain durations are one and two hours; finer increments require an explicit product decision.
- Open (`closed = false`) schedule overrides are not treated as expanded operating hours; closure overrides are authoritative and supported.
- No pagination UI is needed yet; the API bounds My Bookings to 100 records.
- Email verification/recovery deep-link completion remains a prior auth handoff gap and is not broadened here.

## Exact next phase

Phase 4 is payment integration for an existing pending booking: create a Razorpay test order on the server, launch checkout in the Expo development build, verify signatures/webhooks server-side, and transition the booking to `confirmed` only after verified payment. Do not trust a client payment-success flag and do not expose Razorpay secrets to mobile.

## Multi-device recovery

```bash
git clone <repository-url>
cd TurfAndTaste-Rebuild
git switch feature/customer-mobile-booking
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
