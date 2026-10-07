# AI handoff

## Current checkpoint

- Branch: `feature/customer-mobile-payments`
- Starting `develop` HEAD: `0f5332d7ba287e57fae2bec131eff97ff57708c8`
- HEAD when this checkpoint opened: `150fd0eaa3f494cfef6fd83d7de7075ca24f4920`
- HEAD when the Phase 4 payment checkpoint opened: `0ae66e43b226128442afb8bfbb6a8e9522e408cd`
- Commits added by the Phase 4 payment checkpoint, oldest first:

```text
e844c68 test(mobile): add jest-expo component test runner
4e08515 fix(mobile): let the server booking state gate the payment screen
16ccbb4 test(mobile): cover Pay visibility on Booking Detail
20c757d test(api): close payment auth, idempotency and secret-boundary gaps
cbe044c docs(phase4): record the mobile test runner and the SDK drift found with it
704d845 docs(phase4): final Phase 4 handoff checkpoint
0ae66e4 docs(phase4): pin the format-check count and the checkpoint commit chain
```

- Commits added by the native/device-readiness checkpoint, oldest first:

```text
914dbb6 chore(mobile): complete Android payment readiness
a22e99c docs: record Android payment readiness and the device smoke checklist
```

- The native/device-readiness checkpoint starts at `0ae66e43b226128442afb8bfbb6a8e9522e408cd`. Run `git log --oneline 0ae66e4..HEAD` for the exact chain, and `git rev-parse HEAD` against `git rev-parse origin/feature/customer-mobile-payments` after pushing; the two must match. The chain block above lists the checkpoint's code and documentation commits by hash; the final `docs:` commit that pins this block records itself by message only, because a file cannot contain its own commit hash. `git rev-parse HEAD` is authoritative for the tip.
- Runtime: Node.js 22 (`.node-version` is `22`; package engine is `>=22.13.0`)
- Target PR branch: `develop`; do not merge to `main`

## Vercel API preview-readiness checkpoint

- Starting HEAD: `bda313bba45969e832471293668a57f886d85fd8` on `feature/customer-mobile-payments`; local and remote were synchronized and the tree was clean after `git fetch origin`.
- This is deployment readiness only. No Vercel project was created, linked, or deployed, and Phase 5 was not started.
- `apps/api/src/index.ts` is the zero-configuration Vercel Express entry. It default-exports `createApp(readEnv())` and never calls `listen`; `apps/api/src/server.ts` retains the local/hosted Node listener. Shared application construction moved to `apps/api/src/application.ts` without middleware or route duplication.
- No `vercel.json` was added. Current Vercel Express support detects `src/index.ts`, preserves the Express route paths, and does not require legacy `builds`/`routes` configuration.
- Root and API package engines now use `^22.13.0`, constraining Vercel to Node 22 instead of allowing the broad `>=22.13.0` range to select a later major. The API build target remains `node22`.
- `ws` moved from API development dependencies to runtime dependencies because the Supabase server client imports it and the tsup build externalizes it.
- Added entry, health, CORS, and raw webhook-body regression coverage. Originless native requests remain allowed, the exact `WEB_ORIGIN` remains allowed, and arbitrary browser origins remain rejected. Razorpay's webhook remains outside customer auth and verifies the signature over the exact raw bytes.
- The separate Preview project is `turf-and-taste-rebuild-api`, connected to `Devansh5602/TurfAndTaste-Rebuild` with Root Directory `apps/api`. Exact dashboard settings, environment names, health verification, mobile URL usage, Razorpay TEST webhook configuration, and the documented pnpm 12 compatibility caveat are in `docs/VERCEL_API_PREVIEW.md`.
- Vercel's current package-manager page lists pnpm 6–10 while this repository deliberately uses pnpm 12.8.1 for native readiness. No downgrade was made and no unsupported workaround was added. The first authorized Preview build must verify automatic/Corepack installation against current Vercel support and stop if pnpm 12 is not honored.

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

`pnpm format:check` still fails on 35 files, and every one of them was already failing at the starting HEAD: the repository was never formatted. Five flagged files were touched on this branch (`apps/api/src/app.test.ts`, `apps/api/src/services/payment.test.ts`, `apps/mobile/src/screens/customer/PaymentScreen.tsx`, `docs/PACKAGE_POLICY.md`, `docs/TESTING_STRATEGY.md`) and all five were flagged before the edits too. Every file added in this checkpoint is Prettier-clean. Do not run a repository-wide reformat as part of this branch; treat it as its own change.

Native Android/iOS builds are covered in **Native and device readiness** below. iOS was not run.

## Native and device readiness

Build work performed on top of the Phase 4 payment checkpoint. This is not Phase 5. Starting HEAD
`0ae66e43b226128442afb8bfbb6a8e9522e408cd`.

### Migration truth

All four migrations are applied to the linked non-production project and local and remote histories
match, confirmed read-only with `npx supabase migration list`. Nothing was pushed, reset, or
rewritten. See **Migration status** above.

### Native dependency and linker status

- Root cause of the Metro failure: pnpm 12.8.1 reads project settings from `pnpm-workspace.yaml`,
  so the `node-linker=hoisted` declared in `.npmrc` had never taken effect and every install was
  isolated. `nodeLinker: hoisted` now lives in `pnpm-workspace.yaml` and is what pnpm reports back
  (`pnpm config get node-linker` → `hoisted`). See ADR 014.
- Under the isolated layout Metro's `nodeModulesPaths` could not reach
  `node_modules/.pnpm/node_modules`, and `expo export --platform android` failed with
  `Unable to resolve module hoist-non-react-statics` out of `react-native-gesture-handler`.
- `react-native-gesture-handler@2.28.0` imported
  `react-native/Libraries/Renderer/shims/ReactNative`, a file React Native 0.86 removed.
  `~2.32.0` no longer does.
- `pnpm install --frozen-lockfile` passes on the final tree. `node-linker` does not change
  `pnpm-lock.yaml`; the lockfile diff is only the version realignment.
- Switching an existing checkout to this layout can leave stale `node_modules/.bin` shims pointing
  at `.pnpm` paths that no longer exist, which surfaces as
  `Cannot find module '.../node_modules/.pnpm/.../bin/tsc'`. Fix with
  `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`. A fresh clone
  does not hit this.

### Expo compatibility status

- `npx expo-doctor`: **21/21 checks passed** (was 16/21 with 5 failures at the starting HEAD).
- `npx expo install --check`: **Dependencies are up to date**.
- Realigned in one change with `expo install --fix`, not by hand: `expo` `57.0.27`,
  `expo-dev-client` `57.0.19`, `expo-font` `57.0.4`, `expo-linking` `57.0.12`,
  `expo-secure-store` `57.0.4`, `expo-status-bar` `57.0.1`, `react-native` `0.86.3`,
  `react-native-gesture-handler` `~2.32.0`, `react-native-reanimated` `4.5.1`,
  `react-native-worklets` `0.10.1`, `react-native-screens` `~4.26.2`,
  `react-native-safe-area-context` `~5.7.0`, `react-native-svg` `15.15.4`.
- Added `expo-splash-screen@57.0.9` and moved the splash into its config plugin. The SDK 57 schema
  rejects the root `splash` key, and prebuild had been silently ignoring it: the generated native
  project shipped Expo's default splash artwork on `#FFFFFF` instead of the app's `./assets/splash.png`
  on `#F7F3EB`. Regenerated resources now use the app's asset and colour. The removed
  `newArchEnabled` key was dropped as well; SDK 57 has no such option.
- Dropped the `resolver.disableHierarchicalLookup = true` override from `metro.config.js`, which
  expo-doctor flagged as a mismatch against `expo/metro-config`.
- `react-native` was **not** moved to Expo's recommended `typescript@~6.0.3`; see ADR 014 for why.

### Prebuild result

- `android/` and `ios/` did not exist before this checkpoint and are gitignored as generated
  output; nothing hand-maintained was destroyed and no committed native tree was overwritten.
- `npx expo prebuild --platform android --no-install` exits **0**, both on the untouched starting
  tree and after the config changes.
- One non-blocking advisory remains: `android: userInterfaceStyle: Install expo-system-ui in your
project to enable this feature.` (pre-existing, `userInterfaceStyle: automatic` is set without
  `expo-system-ui` installed).
- Generated `android/app/build.gradle` calls `autolinkLibrariesWithApp()` and `settings.gradle`
  wires `expoAutolinking.rnConfigCommand` plus `expoAutolinking.useExpoModules()`.
- The `android/` directory is regenerated output and must not be committed.

### Metro / bundling result

`npx expo export --platform android` succeeds: **2014 modules bundled**, 31 assets, and a 5.5 MB
Hermes `.hbc` bytecode file. It previously failed outright. This is the strongest evidence that the
linker and version alignment are correct, independent of Gradle.

### Android build result

- Toolchain: JDK 21 (`JAVA_HOME` exported), Android SDK with platforms `android-35`/`android-36`,
  Gradle `9.3.1` from the wrapper, `ANDROID_HOME`/`ANDROID_SDK_ROOT` exported for the session.
  AGP auto-downloaded `build-tools;36.0.0` and NDK `27.1.12297006` on the first run with the
  SDK licenses already accepted.
- Command: `cd apps/mobile/android && ./gradlew assembleDebug`
- Result: **`BUILD SUCCESSFUL in 16m 25s`**, exit code 0, 728 actionable tasks (295 executed,
  433 up-to-date). No failures, no retries.
- Artifact: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  — 260,547,319 bytes, `variantName: "debug"`, `applicationId: in.turfandtaste.app`,
  `versionName 0.0.0`, `versionCode 1`, `minSdkVersionForDexing 24`.
- Signing is the standard Expo/React Native `debug.keystore` (`androiddebugkey`). **No production
  signing was configured**, no `.jks`/release keystore exists in the repository, and no live
  Razorpay credential was used. The `release` block in the generated `build.gradle` still falls
  back to `debug.keystore` — that is the untouched Expo prebuild template default and must be
  replaced with real release signing before any release artifact is produced, which is not this
  checkpoint's work.
- `android/` remains gitignored and untracked (0 tracked files). Only the APK _result_ is
  recorded here; the artifact itself must not be committed.
- Non-blocking build noise: Kotlin/Java/C++ deprecation warnings from
  `react-native-gesture-handler`, `expo-modules-core`, and React Native itself, a
  "Deprecated Gradle features ... incompatible with Gradle 10" notice, and
  `w: Detected multiple Kotlin daemon sessions`. None failed the build.

### Razorpay native integration status

- `react-native-razorpay@3.0.0` is installed in `apps/mobile` with `@types/react-native-razorpay`.
- Autolinking finds it: it appears in `expo-modules-autolinking react-native-config` output with
  its `react-native-razorpay.podspec`, and Gradle compiles `:react-native-razorpay:compileDebugJavaWithJavac`
  and `:react-native-razorpay:extractDebugAnnotations` during `assembleDebug`. Its Android manifest
  (`com.razorpay.rn`, declaring `com.razorpay.CheckoutActivity`) is picked up.
- Client side uses only the public key id from `GET /api/v1/payments/razorpay/key`. The key id is
  not even hardcoded in the bundle — it is fetched at runtime.
- Checkout is launched with `key`, `currency`, `amount: order.amountPaise`, and
  `order_id: order.providerOrderId`, all of which come from the server-created order, never from
  user input. The `onSuccess` handler only posts `razorpay_payment_id`, `razorpay_order_id`, and
  `razorpay_signature` to `POST /api/v1/payments/verify`; there is no code path that marks payment
  successful or booking confirmed locally.
- Secret scan of the produced Android bundle: **0 matches** for `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `rzp_live`, `sk_test_`, and
  `service_role`. `apps/mobile/.env` contains only `DOTENV_PUBLIC_KEY` and `EXPO_PUBLIC_*` values.
  `apps/api/src/security.test.ts` enforces this as a gate.
- TEST mode only. No live credential was used, added, or printed.
- Checkout is native, so it does not run under Expo Go; a development build is required. iOS also
  needs `LSApplicationQueriesSchemes` for UPI.

### Webhook endpoint and configuration requirement

- Endpoint: `POST /api/v1/payments/webhook/razorpay`, i.e. `/api/v1` + `/payments/webhook` +
  `/razorpay`. Register `https://<api-host>/api/v1/payments/webhook/razorpay` once the API is
  reachable over HTTPS. The real host is not written down anywhere and must not be invented.
- `RAZORPAY_WEBHOOK_SECRET` is accepted by `apps/api/src/config/env.ts` and has an empty
  placeholder at `apps/api/.env.example`. It never leaves the server.
- Raw body: `express.json({ verify })` stores the untouched bytes on `req.rawBody` before any
  parsing; the route HMAC-SHA256s those bytes with `timingSafeEqual`.
- The route is mounted in `v1.ts` before `requireAuth` / `requireDomain('customer')`, so Razorpay
  can call it with no customer session.
- Dashboard events to subscribe to in test mode: `payment.captured`, `payment.failed`,
  `payment.refunded`, with a secret equal to the API's `RAZORPAY_WEBHOOK_SECRET`.
- Without a tunnel, the webhook rows of `docs/DEVICE_SMOKE_CHECKLIST.md` can still be exercised
  with a hand-computed `x-razorpay-signature` over an exact body.

### Capture-setting requirement

The code creates orders **without** `payment_capture`, and the verify path requires
`payment.status === 'captured'`. So the account must be on **automatic capture**. Verify in the
Razorpay dashboard, in **test mode**, under **Settings → Configuration → Auto capture**, and
confirm operationally that one TEST payment reports `captured` rather than `authorized`. This
checkpoint did not change merchant/account behaviour. Whether capture stays automatic is a Phase 5
decision that must be recorded in `docs/DECISIONS.md` first.

### Remaining manual device checks

`docs/DEVICE_SMOKE_CHECKLIST.md` — AUTH A1–A8, DISCOVERY D1–D4, BOOKING B1–B11, PAYMENT P1–P14,
WEBHOOK W1–W11, SECURITY S1–S8. Nothing in it has been executed on a device yet; the automated
suite covers the same boundaries at the API and component level.

## Migration status

**Synchronized. There are no pending migrations.** This section previously said the Phase 3
migration was pending; that was stale and has been corrected by direct remote history inspection
on 2026-10-07.

Read-only check, no `db push` and no writes:

```bash
npx supabase migration list
```

Returns, for the linked project `rlmuxztkwpwutyepttfe`, local and remote copies of all four
migrations with no null on either side:

```text
20250101000000  local == remote
20250101000001  local == remote
20250101000002  local == remote
20261006183000  local == remote   (booking_integrity, applied 2026-10-06 18:30:00)
```

Local `supabase/migrations/` holds exactly those four files. Nothing was pushed, reset, or
rewritten in this checkpoint. Application startup still does not apply migrations; keep using the
linked-project workflow for future migration files.

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

The full checklist lives in `docs/DEVICE_SMOKE_CHECKLIST.md`. It is organised as AUTH (A1–A8),
DISCOVERY (D1–D4), BOOKING (B1–B11), PAYMENT (P1–P14), WEBHOOK (W1–W11), and SECURITY (S1–S8),
with the prerequisites, the exact webhook dashboard configuration, and a signed-curl method for
exercising the webhook without a tunnel.

The shortest path that answers "can this device take a TEST payment" is A1, A4, D1, D3, B1, B5,
B8, P1, P4, P5, P7, P10, P12, and S1. The webhook rows need either a tunnel or the signed-curl
method; they cannot be reached from the app alone.

## Known gaps

- Migrations are applied through the linked Supabase workflow, never by application startup. All four are currently synchronized (see **Migration status** above); a future migration file still has to be pushed manually.
- Native device interaction and concurrent two-customer smoke tests remain manual checkpoint tasks.
- Availability currently uses one-hour start increments because the domain durations are one and two hours; finer increments require an explicit product decision.
- Open (`closed = false`) schedule overrides are not treated as expanded operating hours; closure overrides are authoritative and supported.
- No pagination UI is needed yet; the API bounds My Bookings to 100 records.
- Email verification/recovery deep-link completion remains a prior auth handoff gap and is not broadened here.
- **Capture expectation: automatic capture.** `razorpay.orders.create` is called without a `payment_capture` option, so capture follows the merchant account's dashboard default, and the verify path hard-requires `payment.status === 'captured'` before any booking can become `confirmed`. A payment left `authorized` is rejected with `PAYMENT_NOT_CAPTURED`. Before end-to-end payment tests, open the Razorpay dashboard in **test mode** → **Settings** → **Configuration** → **Auto capture** and confirm it is enabled. Confirm it operationally too: after one TEST payment, `payments.fetch` for that id must report `captured`, not `authorized`. The API does not call `payments.capture`, and nothing in this checkpoint changed merchant/account behaviour. Deciding auto-capture vs manual capture as a deliberate product setting is Phase 5 and must be recorded in `docs/DECISIONS.md` first.
- **Webhook configuration.** The endpoint is `POST /api/v1/payments/webhook/razorpay`, i.e. the public URL is `https://<api-host>/api/v1/payments/webhook/razorpay` once the API is reachable over HTTPS. `env.ts` accepts `RAZORPAY_WEBHOOK_SECRET`, `apps/api/.env.example` carries an empty placeholder for it, `express.json` preserves `req.rawBody`, and the route is mounted in `v1.ts` before `requireAuth`/`requireDomain('customer')`. Register it in the Razorpay dashboard in test mode with that URL, a secret equal to the API's `RAZORPAY_WEBHOOK_SECRET`, and events `payment.captured`, `payment.failed`, `payment.refunded`. Do not commit the URL's real host or the secret. `docs/DEVICE_SMOKE_CHECKLIST.md` gives both a tunnel-based and a tunnel-free signed-curl method.
- `expired` payment-order status is modeled but never set; there is no order-expiry job yet.
- Refunds are out of scope; the `refunded` status only appears if the provider reports it.
- Refund webhook events are not applied to orders that are already `paid`. Changing that is a product decision about whether a refund downgrades a booking, not a defect to fix silently. Record it in `docs/DECISIONS.md` before Phase 5 touches it.
- The two native blockers from the payment checkpoint are cleared. `nodeLinker: hoisted` now lives in `pnpm-workspace.yaml`, because pnpm 12 reads project settings from there and ignores `.npmrc`; and the mobile SDK ranges were realigned in one change with `expo install --fix`. Evidence: `expo export --platform android` bundles 2014 modules and emits Hermes bytecode where it previously failed on `hoist-non-react-statics`. See ADR 014.
- `react-native-razorpay@3.0.0` is installed, appears in `expo-modules-autolinking react-native-config` output, is picked up by Android autolinking (`:react-native-razorpay:compileDebugJavaWithJavac` runs during `assembleDebug`), and reads only the public key id from `GET /api/v1/payments/razorpay/key`. No Razorpay secret exists anywhere in `apps/mobile`, enforced by `apps/api/src/security.test.ts`. It is a native module, so Razorpay checkout does not run under Expo Go; `npx expo prebuild` plus a development build is required, and iOS also needs `LSApplicationQueriesSchemes` for UPI. The component tests mock checkout and assert only the behaviour around it.
- `pnpm peers check` now reports one item instead of three: `@react-native/metro-config` resolves to `0.87.1` while `@react-native/community-cli-plugin@0.86.3` names `0.86.3` as an exact optional peer. `react-native-worklets@0.10.1` declares `@react-native/metro-config: '*'` as a required peer, and `auto-install-peers` satisfies it with the newest match. This is a warning, not a failure — install, Metro export, and the Gradle build all succeed. If it ever matters, pin `@react-native/metro-config@0.86.3` as an `apps/mobile` devDependency. The three earlier items are gone: `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`, and `react-native@0.86.3` each now satisfy the range that used to be violated.
- `npx expo-doctor` passes 21/21 after the app.json schema fixes (removed `newArchEnabled` and the root `splash`, moved splash into the `expo-splash-screen` plugin) and the Metro config fix (dropped the `resolver.disableHierarchicalLookup` override). The only package Expo still disagrees with is `typescript`, excluded on purpose in `apps/mobile/package.json`.
- **Machine-level Android requirement:** `ANDROID_HOME` and `ANDROID_SDK_ROOT` are usually not exported in a shell profile; export both and point them at your local Android SDK root before running any Gradle or `expo run:android` command, otherwise Gradle fails with "SDK location not found". The first build also downloads `build-tools;36.0.0` and NDK `27.1.12297006` through AGP's SDK auto-download, which needs accepted licenses under `<sdk>/licenses`. No SDK path belongs in this repository.
- **No production signing exists.** Only the Expo template's `debug.keystore` is configured, for both debug and release variants. Producing a signed release/AAB is deliberately out of scope here and must be set up with a real keystore before any release artifact is made.
- Prebuild still prints one advisory: `android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.` Non-blocking; `userInterfaceStyle: automatic` is declared without `expo-system-ui` installed. Not fixed here because it is unrelated to payments and adds a native module for no functional gain.
- `apps/api/openapi/openapi.yaml` still stops at the booking endpoints. Profile endpoints from an earlier phase and all four payment endpoints are missing. The contract needs a dedicated pass; it was not extended here.

## Known remaining warnings

Classified so nobody has to rediscover them:

| Warning                                                                  | Class                                 | Notes                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` fails on 35 files                                    | pre-existing                          | Every one already failed at the starting HEAD; the repository was never formatted. Do not mass-format on this branch.                                                                                                  |
| `pnpm peers check` reports `@react-native/metro-config` 0.87.1 vs 0.86.3 | introduced by this task, non-blocking | `react-native-worklets@0.10.1` requires the peer at `*` and `auto-install-peers` takes the newest. Install, export, and Gradle all succeed. Pin `@react-native/metro-config@0.86.3` in `apps/mobile` if it ever bites. |
| `expo-doctor` would flag `typescript` 5.9.3 vs `~6.0.3`                  | deliberate deviation                  | Declared via `expo.install.exclude`; see ADR 014. Doctor reports the exclusion explicitly.                                                                                                                             |
| Gradle deprecation notices + `Detected multiple Kotlin daemon sessions`  | pre-existing, non-blocking            | From RN/gesture-handler/expo-modules-core against Gradle 9.3.1.                                                                                                                                                        |
| `expo-system-ui` advisory during prebuild                                | pre-existing, non-blocking            | See Known gaps.                                                                                                                                                                                                        |
| Kotlin/Java/C++ deprecation warnings during `assembleDebug`              | pre-existing, non-blocking            | 728 tasks completed regardless.                                                                                                                                                                                        |

Blocking: **none**.

## Exact next phase

The gate between here and Phase 5 is **device validation, not more code**. Run
`docs/DEVICE_SMOKE_CHECKLIST.md` on a real Android development build with Razorpay TEST mode and
record pass/fail per row. The shortest path that answers "can this device take a TEST payment" is
listed under **Manual smoke checklist**. Two things must be done on the dashboard first: confirm
auto capture is enabled in test mode, and register the webhook URL with `RAZORPAY_WEBHOOK_SECRET`.

Once device validation passes, Phase 5 is booking fulfillment beyond payment: enforce capture
settings deliberately (decide auto-capture vs manual capture as a recorded decision in
`docs/DECISIONS.md`), then build the customer pass/QR for confirmed bookings. Payment refunds,
cancellation policy, and staff-facing payment views require explicit product decisions first. Do
not merge into `main` without an explicit request, and do not claim Expo Go support — this app
needs a development build.

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
