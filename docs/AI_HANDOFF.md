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
- Runtime: Node.js 22 (`.node-version` is `22`; package engine is `^22.13.0`)
- Target PR branch: `develop`; do not merge to `main`

## Vercel API preview-readiness checkpoint

- Starting HEAD: `bda313bba45969e832471293668a57f886d85fd8` on `feature/customer-mobile-payments`; local and remote were synchronized and the tree was clean after `git fetch origin`.
- This is deployment readiness only. No Vercel project was created, linked, or deployed, and Phase 5 was not started.
- `apps/api/src/index.ts` is the zero-configuration Vercel Express entry. It default-exports `createApp(readEnv())` and never calls `listen`; `apps/api/src/server.ts` retains the local/hosted Node listener. Shared application construction moved to `apps/api/src/application.ts` without middleware or route duplication.
- No `vercel.json` was added. Current Vercel Express support detects `src/index.ts`, preserves the Express route paths, and does not require legacy `builds`/`routes` configuration.
- Root and API package engines now use `^22.13.0`, constraining Vercel to Node 22 instead of allowing the broad `>=22.13.0` range to select a later major. The API build target remains `node22`.
- `ws` moved from API development dependencies to runtime dependencies because the Supabase server client imports it and the tsup build externalizes it.
- Added entry, health, CORS, and raw webhook-body regression coverage. Originless native requests remain allowed, the exact `WEB_ORIGIN` remains allowed, and arbitrary browser origins remain rejected. Razorpay's webhook remains outside customer auth and verifies the signature over the exact raw bytes.
- The separate Preview project is `turf-and-taste-rebuild-api`, connected to `Devansh5602/TurfAndTaste-Rebuild` with Root Directory `apps/api`. Exact dashboard settings, environment names, health verification, mobile URL usage, Razorpay TEST webhook configuration, and pnpm/Corepack requirements are in `docs/VERCEL_API_PREVIEW.md`.
- Vercel's current package-manager page lists pnpm 6–10 and explicitly supports lockfile format 9.0 with pnpm 10. After Preview installation failed because the pnpm 12 wrapper was unavailable, the repository pinned pnpm 10.34.6, the newest stable pnpm 10 release at the checkpoint. The existing lockfile dependency graph was preserved; pnpm 10 removed only pnpm 12's embedded package-manager wrapper preamble. `ENABLE_EXPERIMENTAL_COREPACK=1` remains required in Vercel Preview.
- pnpm 10.34.6 frozen installation, API gates, root gates, and `git diff --check` pass. `vercel deploy --dry --json` reports 131 files / 896,616 bytes and excludes mobile, Android, `dist`, and `.next`. After pulling Preview settings locally (secret values remained unavailable placeholders), `vercel build` confirmed Corepack selected pnpm 10.34.6 and completed install plus the API tsup build, then failed in Vercel's additional per-file TypeScript pass on pre-existing module/type-resolution errors. No remote deployment occurred. Resolve that separate Vercel compiler issue before deploying.

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

## Vercel API Preview deployment checkpoint — 2026-10-08

### Git scope

- Starting HEAD: `216785ba6281efb1a244b7a90ac154f2777ef56c`
- Ending implementation HEAD: `69d56c6857fb661cd623a28426a3ad6838c41160`
- Branch: `feature/customer-mobile-payments`; pushed to the matching `origin` branch.
- Commits: `05c8ba5`, `8a93b9e`, `a4e05ac`, `92d4548`, `69d56c6`.
- Files changed: API import boundaries and tsconfig, schema/type source imports and inferred quote type, ESLint's generated-Vercel ignore, and this handoff. `.gitignore` and `.vercelignore` were reviewed and left unchanged.

### Root causes and fixes

Vercel's Express source compiler uses a different TypeScript/module pass from the normal `tsup` build. It interpreted default imports for `helmet`, `pino-http`, and `express-rate-limit` as module namespaces. The API now uses package-supported named imports where available and a narrowly typed `createRequire` boundary for Helmet's documented callable CommonJS export. No middleware was removed.

Vercel also inferred Zod's `durationHours` output as optional while the handwritten `QuoteSelection` required it. `QuoteSelection` is now inferred from the authoritative Zod schema, which still requires `durationHours`; no cast or client-supplied pricing path was added.

After compilation passed, remote smoke tests exposed extensionless ESM imports in Vercel's emitted JavaScript and then workspace source tracing gaps. API runtime imports now use Node-compatible extensions and direct workspace source paths. Shared workspace source imports use explicit `.ts` specifiers with TypeScript's `allowImportingTsExtensions`/`rewriteRelativeImportExtensions`, causing Vercel to emit `.js` while Next/Expo continue resolving the TypeScript source. This changes module plumbing only, not booking or payment behavior.

### Validation

Passed:

- API typecheck, 44 API tests, and API `tsup` build
- root lint, typecheck, tests, and build
- `git diff --check`
- `npx vercel build`
- Vercel dry run via the supported `npx vercel deploy --dry --json`: 131 files, 897,601 bytes; dependencies, mobile/web apps, build output, caches, and environment/secret files excluded

Preview environment variable names confirmed present (values were not printed): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WEB_ORIGIN`, `LOG_LEVEL`, and `ENABLE_EXPERIMENTAL_COREPACK`.

### Preview deployment and remote checks

- Deployment: `dpl_AAKhD1Bc19DjBqzZdcSJZdB3MUMr`
- Status: `READY`, Preview target only (not Production)
- URL: `https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app`
- Authenticated Vercel-bypass checks:
  - `GET /health`: 200, healthy envelope and `x-request-id`
  - `GET /api/v1/facilities`: 200 and hosted Supabase data; only the four base facilities are returned, with the shooting-machine service represented as the authorized add-on
  - unauthenticated bookings, quotes, payment key, and payment verification: 401
  - invalid Razorpay webhook signature: 400 `INVALID_WEBHOOK_SIGNATURE`
  - disallowed browser origin: rejected with no CORS allowance
- No customer bearer credential was available, so authenticated quote/availability/order/verify success paths were not mutated remotely. Their server-authoritative behavior remains covered by the passing API suite. No real-money request or production mutation occurred.

### Webhook readiness and remaining blocker

Implemented TEST webhook URL:

`https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app/api/v1/payments/webhook/razorpay`

Use Razorpay TEST events `payment.captured`, `payment.failed`, and `payment.refunded`. Raw request bytes are preserved by the JSON parser, HMAC verification uses the server-only webhook secret, invalid signatures are rejected, and webhook/client retries share idempotent persistence. No secret is logged or returned.

The Preview is currently behind Vercel Deployment Protection: ordinary unauthenticated HTTP receives a Vercel 302 authentication challenge. `vercel curl` can validate it with an account-generated bypass, but the customer mobile app and Razorpay cannot call this URL as-is. Disabling Preview protection for this project or configuring a stable protection-bypass mechanism requires Vercel dashboard/account interaction. After that, repeat public health/CORS checks, use a real Preview customer session for quote/order/verify TEST-mode checks, and register the webhook URL in the Razorpay TEST dashboard. Razorpay automatic capture must remain enabled because verification requires provider status `captured`.

A diff-focused credential scan found no embedded Supabase service key, Razorpay secret/webhook secret, Vercel token, or decrypted dotenvx plaintext.

## GitHub Actions CI checkpoint — 2026-10-08

The branch workflow had an obsolete `version: 12.8.1` input on `pnpm/action-setup@v4`, conflicting with the root `packageManager: pnpm@10.34.6`. Commit `9b9332c` removed the workflow override, making `package.json` the single pnpm version source. The resulting run progressed beyond setup and exposed a genuine clean-run test isolation defect: `src/index.test.ts` only stubbed some API variables, so inherited empty CI variables failed `readEnv`. Commit `40c7b47` stubs the complete API environment used by the serverless-entry test; no secret or production value is involved.

Local execution of the exact workflow sequence passed: frozen install, lint, typecheck, tests, web build, API build, and mobile TypeScript check. GitHub Actions run `37739001875` for `40c7b47ae8a4593ec2f76546cef212d6aadb9e05` completed successfully in 1m13s with every workflow step green. The runner emitted only GitHub platform advisories about action Node 20 compatibility and the future `ubuntu-latest` migration; neither is a repository failure.

## Public Preview end-to-end validation checkpoint — 2026-10-08

### Deployment and public reads

Vercel Deployment Protection was disabled for the API Preview project by the user. No bypass header or Vercel-authenticated client is now required. Deployment `dpl_AAKhD1Bc19DjBqzZdcSJZdB3MUMr` remains **Ready** at:

`https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app`

Direct public checks returned 200 for `/health`, `/api/v1/facilities`, the Box Cricket and Cricket Green Net facility details, Box Cricket weekly schedule, and Box Cricket pricing. Responses used the API envelope and request IDs. The facilities, schedule, pricing, and add-on reads came from hosted Supabase, confirming remote database connectivity. The facility list contained exactly the four base facilities; the fifth authorized service remains Cricket Green Net Practice with the Shooting Machine add-on. No unauthorized sport appeared.

### Authentication and booking boundary

Without a bearer token, availability, quote creation, booking creation/list/detail, profile read/update, payment-order creation/read, payment verification, and Razorpay key retrieval all returned 401 `UNAUTHENTICATED` rather than infrastructure errors. No safe Preview customer credential was available, so authenticated remote availability/quote/booking/order/verification success paths were not exercised and no hosted booking or payment row was intentionally created.

The passing schema, booking, and payment suites continue to cover authorized facility/duration validation, unavailable and past slots, quote-selection integrity, server-derived pricing and payment amounts, ownership, provider order/amount/capture checks, signature verification, and retry/idempotency behavior. Vercel module changes introduced no business-logic change.

### CORS and mobile readiness

The configured `WEB_ORIGIN` is an HTTPS public origin (not localhost or private LAN). A request from that exact origin returned 200 with the exact `Access-Control-Allow-Origin`; its quote-route preflight returned 204. Neither response enabled credentialed wildcard CORS. A disallowed origin was rejected with no allow-origin header. Originless HTTPS requests continue to work for native Android and provider callbacks, so Customer Mobile can use the Preview URL as `EXPO_PUBLIC_API_URL`.

### Razorpay TEST readiness

The public webhook route is reachable: requests without a signature return 400 `MISSING_SIGNATURE`, and a forged signature returns 400 `INVALID_WEBHOOK_SIGNATURE`. The exact TEST webhook URL is:

`https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app/api/v1/payments/webhook/razorpay`

The implementation preserves raw bytes, verifies HMAC-SHA256 with the server-only webhook secret, acknowledges unknown provider orders without writes, applies captured/failed/refunded outcomes, shares idempotent persistence with callback verification, and never downgrades a paid order. Automated tests cover valid signed captured and failed events, duplicate captured delivery, callback/webhook replay, forged bytes, ownership, server-side amount derivation, captured-state enforcement, and amount/order matching. Static inspection confirms the refunded switch path uses the same outcome function.

A valid signed event was not sent remotely because Vercel marks the deployed webhook variable Sensitive and does not expose its value through the available CLI; the local encrypted environment value must not be assumed to equal the deployed value. This avoids rotating or disclosing a credential. Complete the remote valid-signature/event delivery check from the Razorpay TEST dashboard after entering the same secret configured in Vercel. Subscribe to `payment.captured`, `payment.failed`, and `payment.refunded`; keep TEST mode and automatic capture enabled. A real TEST checkout still requires a real Preview customer session/device interaction.

### Security and validation

No source change was needed. Root lint, typecheck, tests, and build passed; API typecheck, 44 tests, and build passed; the mobile TypeScript check passed; and `git diff --check` passed. The client build scan found no privileged credential names. Generated Vercel output contains only expected server-side environment references, not committed values. Tracked client environments remain public-prefixed/encrypted, and the API security test passed. Secret values were neither printed nor added to the diff.

GitHub Actions run `37739172260` remains green for implementation HEAD `40e630eee7f0cf30fdc21d5c5fdbbf2c65ecc24a`. This documentation checkpoint is the only repository change from the public validation.

Remaining manual work: configure the URL and three events in the Razorpay TEST dashboard using the same webhook secret as Vercel; confirm TEST automatic capture; obtain a legitimate Preview customer session; then run authenticated availability → quote → booking → TEST order → checkout → verification and repeat/inspect webhook deliveries. Do not use live credentials or real money.

## Customer Mobile remote integration checkpoint — 2026-10-08

### Preview API configuration

The committed encrypted Customer Mobile environment now resolves `EXPO_PUBLIC_API_URL` to:

`https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app`

Commit `9a72f83` changed only the encrypted public API URL value; Production configuration was not changed. A dotenvx-decrypted metadata check confirmed exact URL equality, HTTPS, and a non-local host without printing environment values. A fresh Android Expo export succeeded (2014 modules, Hermes bytecode, 31 assets). Source and generated-client scans found no server credential identifiers or live Razorpay key marker in the client bundle. Localhost references are limited to examples/tests and a foundation fallback that is not used when the configured variable is present; the real Customer screens read `EXPO_PUBLIC_API_URL` and therefore use the remote Preview endpoint.

### Authentication and remote flow boundary

Customer Mobile uses Supabase email/password authentication with the public URL and anonymous/publishable key, persists sessions in Expo SecureStore, refreshes tokens, and sends the access token to the API. The API validates the token through Supabase and requires the `customer` domain. No pre-existing test-customer credentials or supported automated fixture account exist in the repository, and no physical Android device/emulator/ADB is available on this machine. Therefore no account was invented and no RLS/auth bypass was attempted.

Authenticated profile, availability, quote, booking creation, Razorpay TEST order creation, native checkout, and server verification remain blocked on a legitimate customer login plus a physical/development Android build. Public facilities/pricing and unauthenticated guards were already remotely validated in the preceding checkpoint. The mobile booking implementation invalidates a quote and selected slot when date, duration, or add-on changes; uses only future date choices and server-returned slots; displays the server quote; and sends no client total. Payment obtains the public key ID and authoritative booking/order amounts from protected API routes, passes only safe order data to native Razorpay, and confirms only after server verification. Cancelled, failed, loading, retry, session-expiry, paid, and unavailable states are implemented and covered where existing component/API tests apply; no claim is made that the requested physical widths or native interactions were exercised without a device.

### Razorpay and webhook status

Backend TEST order/verification and reconciliation remain covered by the passing API suite. Native Razorpay checkout, an actual provider success signature, and actual signed dashboard webhook delivery were not exercised. The public route still rejects missing and invalid signatures. Configure the Razorpay TEST dashboard with:

`https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app/api/v1/payments/webhook/razorpay`

Subscribe to `payment.captured`, `payment.failed`, and `payment.refunded`, use the same webhook secret as the Vercel Preview variable, and keep TEST automatic capture enabled.

### Validation and next manual gate

Root lint, typecheck, tests, and build passed; API typecheck, 44 tests, and build passed; mobile TypeScript passed; Android Expo export passed; and `git diff --check` passed. No Production deployment was made. The exact next gate is manual: create or sign into a legitimate Preview customer through Customer Mobile, then use an Android development build to run facility → availability → quote → booking → Razorpay TEST checkout → verification and inspect Razorpay TEST webhook deliveries. Use the minimum booking data and no live payment method.

## Customer authentication repair checkpoint — 2026-10-08

- Starting HEAD: `3f73918` on `feature/customer-mobile-payments`.
- Commits added by this checkpoint, oldest first:

```text
44cd134 fix(mobile-auth): validate public Supabase config at startup
3f4338a fix(mobile-auth): repair customer session and post-login routing
```

- The final `docs:` commit that pins this block records itself by message only; `git rev-parse HEAD` is authoritative for the tip.

### Root cause (forensic trace of submit → Supabase → provider → guard → navigation)

1. The Supabase project requires e-mail confirmation (`mailer_autoconfirm: false`, read-only `GET /auth/v1/settings` probe). The password grant itself is healthy: a probe with obviously fake credentials returns `400 invalid_credentials`. Create Account therefore always returns `user != null, session == null`.
2. `CreateAccountScreen` answered `session == null` with a silent `navigation.replace('SignIn')`, dropping the user back on Sign In with no message.
3. `AuthProvider` set its hydration flag `loading` to true inside every sign-in/sign-up/sign-out/reset handler. `RootNavigator` treats `loading` as "hydration still running" and unmounts the navigator for it, so every auth action destroyed the mounted screen and its local error state, then remounted at the initial unauthenticated route. No screen ever read the context `error`, so invalid credentials, `email_not_confirmed`, and network failures were structurally undisplayable — a silent bounce to the auth stack. The `navigation.replace(...)` calls in submit handlers ran against the unmounted navigator (no-op plus dev warning), and a redundant `getSession()` after sign-in could race-overwrite the session the `SIGNED_IN` listener had stored.
4. `src/auth/supabase.ts` still contained a dead second auth layer (module-level `onAuthStateChange` feeding a never-registered listener plus unused `signIn`/`signUp`/`initializeAuth` wrappers) competing with the AuthProvider path.

### Repair

- `AuthContext`: `loading` means only initial session hydration (false exactly once, never touched by actions); failures map through the new `src/auth/authErrors.ts` to safe copy (invalid credentials, verification required, account exists, weak password, rate limit, network, per-action generic fallback — raw GoTrue internals never reach customers); dev-only diagnostics log code/name only; `signUp` returns `{ error, signedIn, verificationRequired }` and detects an existing account via the obfuscated `identities: []` user; added `resendVerificationEmail`; sign-out always clears local state even when server-side revoke fails; `INITIAL_SESSION` is ignored so hydration cannot bounce a restored session.
- `RootNavigator`: guards on hydration only, then swaps whole navigators by session (`CustomerNavigator` initial route Home, `AuthNavigator` initial route Welcome). Deterministic post-login routing, no redirect loops, no dependence on in-flight action state. The combined `RootStack` navigator was removed; `RootStackParamList` types remain for screen typing.
- Screens: no `navigation.replace('Home')` on success (the state transition owns routing); sign-in errors render from the still-mounted screen; Create Account shows an explicit "Account created. Please verify your email to continue." panel with Resend verification email and a user-driven "Continue to Sign In"; duplicate gated error blocks removed from Sign In, Create Account, and Forgot Password.

### Validation

- Root lint, workspace typecheck, and `pnpm test` pass (API 53 tests including `security.test.ts`, mobile 56 tests); every touched file passes `prettier --check`; `git diff --check` clean; format-check failures are limited to 29 pre-existing untouched files.
- Metro restarted with `cd apps/mobile && npx expo start --dev-client --clear --tunnel` (loads `.env.local` plaintext plus `.env`); the Android dev bundle at `http://localhost:8081/apps/mobile/index.bundle` returned HTTP 200 with 12,890,565 bytes on a fresh cache. Bundle scan: the real `*.supabase.co` URL inlined, `sb_publishable_` key only, zero JWTs, zero encrypted dotenv values, no `DOTENV_KEY`; every `sb_secret_`/`service_role` match is a validation-message literal. All new auth strings present; raw `Invalid login credentials` text absent.
- New tests: `authErrors.test.ts` (error mapping incl. no-internal-leak assertions); `AuthContext.test.tsx` (hydration, sign-in success/failure/network, sign-up session/verification/existing-account, logout, session expiry via `SIGNED_OUT`, token refresh, `INITIAL_SESSION` ignore, unsubscribe on unmount, and `loading` never re-entering true after hydration); `RootNavigator.test.tsx` (ten integration cases: guard waits for hydration, restored session opens Home directly, failed sign-in stays on Sign In with a visible safe error and no reset to Welcome, verification panel plus resend, immediate-session sign-up, existing-account rejection, expiry → sign in again without restart, network error stays put); `apps/api/src/middleware/auth.test.ts` (customer session rejected by staff `requireDomain`/`requirePermission` without consulting staff permissions).
- Native dependencies, config, and the generated Android project were unchanged (JS-only fix), so no Android dev-client rebuild was made. Metro was stopped afterwards and the deterministic Expo rewrite of `apps/mobile/tsconfig.json` was restored; the working tree contains only the intended files. No `.env`, `.env.local`, key, token, or password is staged or committed.

### Remaining physical-device gate

An actual Supabase sign-in with real credentials on the physical Android device cannot be replayed from this machine. On device: restart Metro as above, open the dev client, then verify (a) a bad password shows "Invalid email or password" and stays on Sign In; (b) Create Account shows the verification-required panel instead of silently returning; (c) after verifying the e-mail, sign-in reaches Home; (d) killing and relaunching the app restores the session straight to Home; (e) logout returns to Welcome and sign-in works again without a restart.

## Email confirmation deep-link repair checkpoint — 2026-10-08

- Starting HEAD: `cd6f38b` on `feature/customer-mobile-payments` (local == origin at start); working tree restored to clean by reverting the Expo `tsconfig.json` rewrite from the previous QA session.
- Commit added by this checkpoint: `e1176ce fix(auth): complete mobile email confirmation callback`.
- The `docs:` commit that pins this block records itself by message only; `git rev-parse HEAD` is authoritative for the tip.

### Root causes

1. **Why the confirmation e-mail resolved to `http://localhost:3000`:** `supabase.auth.signUp()` and `supabase.auth.resend()` supplied no `options.emailRedirectTo`, so GoTrue fell back to the project Site URL. The observed `localhost:3000/#error=...` redirect proves the dashboard Site URL is still the Supabase CLI default `http://localhost:3000`. The app also had no deep-link handler of any kind (no `Linking`, no callback route, no `setSession`/`exchangeCodeForSession` from a URL — grep across the repo found none).
2. **Why `otp_expired`:** GoTrue answers a verify link whose token it cannot accept with `#error=access_denied&error_code=otp_expired` ("Email link is invalid or has expired") — this covers genuinely expired tokens, tokens superseded by a newer sign-up/resend (the stored confirmation token is single-valued), and already-consumed tokens. The error was produced by GoTrue itself, so the click did reach Supabase; there is no evidence of URL mangling upstream. Which of the three applied in QA cannot be resolved without Supabase logs; the leading hypotheses are (a) a superseding sign-up/resend, (b) consumption by an inbox link scanner/prefetch, (c) expiry past the dashboard-configured e-mail OTP window. The read-only `/auth/v1/settings` probe exposes no OTP-expiry field, so that value is dashboard-only.

### Programmatic verification (read-only)

`GET /auth/v1/settings` (anon key) returns: `mailer_autoconfirm: false` (confirmation required — unchanged, not weakened), `disable_signup: false`, e-mail provider enabled, all OAuth providers disabled. It exposes **no** Site URL, redirect allowlist, or OTP expiry — those are dashboard-only, hence the checklist below.

### Repair (architecture, not a patch)

- New `src/auth/authCallback.ts`: canonical redirect constants (`MOBILE_AUTH_CALLBACK_URL = turfandtaste://auth/callback`, `MOBILE_RESET_REDIRECT_URL`), a side-effect-free parser (implicit `#access_token`/`#refresh_token`, PKCE `?code=`, GoTrue error redirects, malformed/partial-token rejection), and `establishAuthCallbackSession()` which ignores non-callback URLs and callbacks arriving while already signed in, exchanges tokens with `setSession`/`exchangeCodeForSession`, and maps every failure to user-safe copy. Only code/name diagnostics are logged — never tokens or raw error text.
- `AuthProvider` subscribes to `Linking.getInitialURL()` + `Linking.addEventListener('url')` and drives an `emailConfirmation` state machine (`idle → processing → session | invalid → signInEntry`); every edge is an explicit event or user action, so there is no redirect loop. Sign-up and resend both send `emailRedirectTo: MOBILE_AUTH_CALLBACK_URL`; the reset redirect literal was centralized to the same module (value unchanged).
- `RootNavigator` renders `Completing verification...` while processing and a new `AuthCallbackScreen` when invalid (branded `Verification link expired or invalid`, Resend verification email when the pending address is known, Back to Sign In which remounts the auth stack with `initialRouteName="SignIn"`). A session always wins the root choice, so a stale callback can never kick a signed-in customer out.
- The pending verification address is stored in SecureStore on sign-up and cleared on any established session, so Resend works after the OS kills the app and the link is tapped later.
- Sign-in error copy normalized in `authErrors.ts`: `Invalid email or password.` / `Please verify your email before signing in.` / `Your verification link has expired or is invalid. Request a new one.` / `Unable to connect. Check your internet connection and try again.` / `Too many attempts. Please wait and try again.` / per-action generic fallback.
- Decision recorded in `docs/DECISIONS.md` (ADR 017): the provider owns the deep link rather than React Navigation's `linking` prop, because GoTrue's implicit redirect carries tokens in the URL and navigation state must never hold them.

### Supabase Dashboard configuration checklist (manual — cannot be changed from here)

1. **Authentication → URL Configuration → Site URL:** set to the canonical deployed web URL `https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app` (currently `http://localhost:3000`, the CLI default — this is what the QA e-mail fell back to). Do not replace it with localhost again; when a production domain exists, revisit.
2. **Authentication → URL Configuration → Redirect URLs:** add exactly `turfandtaste://auth/callback`. Keep any existing entries; add `http://localhost:3000/**` only if local web testing needs it. Development-only entries are optional and separate from production.
3. **Authentication → Emails → Confirm signup template:** confirm it uses `{{ .ConfirmationURL }}` (the Supabase default). `{{ .ConfirmationURL }}` carries the `emailRedirectTo` supplied at sign-up, which is now the mobile callback. If the template was customized to embed `{{ .SiteURL }}` directly, change it back to `{{ .ConfirmationURL }}` — otherwise `emailRedirectTo` is ignored and links regress to the Site URL. No template change is needed if it is still the default.
4. **Do not** enable "Confirm email" changes that auto-confirm, do not disable e-mail confirmation, and do not touch unrelated OAuth settings.
5. Optional diagnostics: **Authentication → Emails → e-mail OTP expiry** — note the current value before changing anything; expiry shortening masks nothing and is not part of this repair.

### Link-prefetch analysis (recorded, not claimed)

Mailbox link prefetch/scanning can consume a one-time GET verify link before the user clicks (plausible, unproven for this QA run; YOPmail or another intermediary was suspected but cannot be verified from this machine). Supabase-supported production mitigations if this recurs: a manual e-mail OTP/code the customer types (never fetched as a URL), or a custom `{{ .TokenHash }}` verification page whose exchange is a POST that prefetchers do not perform. Neither was adopted — the confirmation architecture is unchanged.

### Validation

- Workspace typecheck (9 turbo tasks), root lint, `pnpm test` (mobile **88** tests / 7 suites, API **53** tests incl. `security.test.ts`) all pass; touched files pass `prettier --check`; `git diff --check` clean.
- Metro restarted with `cd apps/mobile && npx expo start --dev-client --clear --tunnel`; the Android bundle returned HTTP 200 (12,945,303 bytes, 2,189 modules bundled). Bundle scan: `turfandtaste://auth/callback` present, `sb_publishable_` key only, zero JWTs, zero `DOTENV_KEY`, no `localhost:3000`, no raw `Invalid login credentials` text; every `sb_secret_`/`service_role` match is the validator's rejection literal (bare 10-char pattern, no key material). `npx expo config --type public` reports `scheme: 'turfandtaste'`.
- **No dev-client rebuild:** the Expo scheme `turfandtaste` exists since the bootstrap commit `1ec1c07` and was already present at the native readiness build `914dbb6`, so the installed Android dev client already registers the `turfandtaste` intent filter. This repair changed only `.ts`/`.tsx` files — no app.json/manifest change — therefore JS-only, no regeneration.
- Tests added: `authCallback.test.ts` (canonical URI tied to app.json scheme, URL classification, implicit/PKCE/error parsing, session establishment, expired/malformed/network mappings, authenticated-ignore, no-token-logging); `AuthContext.test.tsx` (sign-up and resend carry the same `emailRedirectTo`, deep-link success/expiry/dismiss/ignore paths, warm arrival, pending-address lifecycle); `RootNavigator.test.tsx` (callback exchanges to Home behind the processing state, expired state with resend and loop-free Back to Sign In, no-pending-address variant, signed-in customer untouched by a stale link, warm arrival).

### Physical-device retest procedure (user-owned gate)

1. `cd apps/mobile && npx expo start --dev-client --clear --tunnel`
2. Create Account with a real inbox → panel "Verification required" appears.
3. Open the confirmation e-mail **on the device** → the app must open (not a browser) and land on Home once the session is established.
4. If the link is expired/invalid: the app must show "Verification link expired or invalid" with Resend verification email and Back to Sign In — no crash, no silent navigation.
5. Sign in with a wrong password → "Invalid email or password."; with an unverified account → "Please verify your email before signing in."
6. Kill and relaunch → straight to Home; logout → Welcome → sign in again without restart.
7. Verify the Supabase dashboard checklist above **before** step 3 — without it, the e-mail still targets `localhost:3000`.

## DEVICE HANDOFF CHECKPOINT — CUSTOMER MOBILE — 2026-10-08

Checkpoint purpose: preserve and push the verified customer-mobile state so development can continue from another physical machine. No new feature work, no screen redesign, no booking/payment changes were made in this checkpoint.

### Repository and refs

- Repository path (this machine): `/home/pc/www/POC/TurfAndTaste-Rebuild`
- Remote: `github.com:Devansh5602/TurfAndTaste-Rebuild.git`
- Branch: `feature/customer-mobile-payments`
- Code HEAD at checkpoint open: `242e796` (local == `origin/feature/customer-mobile-payments` after `git fetch`)
- This docs commit records itself by message only; `git rev-parse HEAD` is authoritative for the tip.
- Working tree: clean except intentionally ignored private/generated files (`.env.local`, `.env.keys`, `.expo/`, `apps/mobile/android/`, `node_modules/`, `dist/`, `coverage/`).

### Current architecture summary

- Turborepo workspace: `apps/mobile` (Expo SDK 57 / React Native development build, React Navigation native stack, NativeWind, TanStack Query, `expo-secure-store` session storage), `apps/api` (Express with a serverless Vercel entry `apps/api/src/index.ts`), `apps/web`, and shared `packages/` (`ui-native`, `design-tokens`, `types`, `api-client`).
- Customer auth is provider-owned: `AuthProvider` (`apps/mobile/src/context/AuthContext.tsx`) is the single source of truth — hydration-only `loading`, `onAuthStateChange` subscription, deep-link handling through Expo Linking. `RootNavigator` is a pure route guard: while `loading`, show session restore; then the session alone swaps whole navigators (`CustomerNavigator` initial route Home, `AuthNavigator` initial route Welcome).
- Confirmation deep links are handled by the provider, never by a navigation `linking` prop, so tokens never enter navigation state (ADR 017 in `docs/DECISIONS.md`). Safe error copy is centralized in `apps/mobile/src/auth/authErrors.ts`; redirect constants and the callback parser live in `apps/mobile/src/auth/authCallback.ts`.

### Working auth / deep-link flow (verified on physical device)

Create Account → `supabase.auth.signUp` with `options.emailRedirectTo = turfandtaste://auth/callback` → explicit "Verification required" panel (Resend + Continue to Sign In) → confirmation e-mail opens `turfandtaste://auth/callback` on the device → provider parses (implicit `#access_token` pair or PKCE `?code`, error redirects fail closed) → `setSession`/`exchangeCodeForSession` → session established → route guard swaps to the customer navigator → Home. Expired/invalid/malformed links land on the branded recoverable state (`Verification link expired or invalid` with Resend verification email when the pending address is known, and Back to Sign In) — no crash, no silent navigation, no redirect loop. The pending verification address persists in SecureStore across restarts and clears on any established session.

Supabase dashboard prerequisites for this flow (Site URL, Redirect URL `turfandtaste://auth/callback`, Confirm-signup template using `{{ .ConfirmationURL }}`) are listed in the "Email confirmation deep-link repair checkpoint" section above and must be confirmed on the dashboard; they cannot be changed from code.

### Exact current customer mobile routes

Auth navigator (`AuthStackParamList`): `Welcome`, `SignIn`, `CreateAccount`, `ForgotPassword`.
Customer navigator (`CustomerStackParamList`): `Home`, `Facilities`, `FacilityDetail`, `Booking`, `MyBookings`, `BookingDetail`, `Payment`, `Profile`.

### Current Supabase integration status

- Customer authentication works on the physical device: account creation, verification e-mail delivery, `turfandtaste://auth/callback` confirmation, authenticated session entry, and session/profile recognition of the authenticated customer are all observed working.
- Project settings (read-only probe): `mailer_autoconfirm: false` (e-mail confirmation required — deliberately unchanged), `disable_signup: false`, e-mail provider on, OAuth providers off.
- Client uses only public credentials (publishable/anon key) from `EXPO_PUBLIC_SUPABASE_*` variables; no service-role or secret key exists anywhere in the mobile bundle (scanned).

### Backend / API status

- Express app with shared `createApp(readEnv())`, serverless entry `apps/api/src/index.ts`, hosted Node entry `apps/api/src/server.ts`. Vercel Express Preview deployment exists at `https://turf-and-taste-rebuild-cwfls3e7s-devansh5602.vercel.app` (Preview/test-only, no production deployment authorized).
- Staff auth middleware (customer/admin isolation), health, CORS, booking, payment verification, idempotency, and webhook signature paths are covered by the API test suite (53 tests incl. `security.test.ts`).

### Booking / availability status

Unresolved on device: the Booking screen's availability request currently ends in "Availability unavailable", so the customer cannot complete the booking journey. This is the top next-priority defect (P0 below). No fix has been attempted in this checkpoint.

### Payment status

Server-side Razorpay TEST integration is complete and tested (order creation, signature verification, idempotent capture handling, webhook signature verification over raw bytes; TEST webhook dashboard configuration documented in earlier checkpoints). `PaymentScreen` exists in the customer stack. The end-to-end physical-device payment journey is not certified; no live keys and no production deployment.

### Profile status

`Profile` route exists; the authenticated customer's session/profile is recognized on device. No profile-feature expansion has been done.

### Figma / design status

Current screens are basic engineering UI and do not yet match the approved design. Authoritative design reference for the next device:

- Figma: **Turf & Taste — Mobile App UI/UX Master**
- File: `https://www.figma.com/design/yUBIZk5ptihZqROIobT6S4/Turf---Taste-%E2%80%94-Mobile-App-UI-UX-Master`
- Relevant supplied node: **`63:2`**

Design work in the next phase must audit the actual Figma system before inventing or modifying visual primitives.

### Tests / build status

- `pnpm typecheck` (9 turbo tasks) green; root `pnpm lint` green; `pnpm test` green — mobile 88 tests (7 suites) and API 53 tests, 141 total.
- Android bundle validated at this state: HTTP 200 with the canonical callback present, publishable key only, zero JWTs, zero `DOTENV_KEY`, no raw server error text, no `localhost:3000`.
- `git diff --check` clean. `pnpm format:check` still reports the 29 pre-existing untouched files documented earlier; every touched file passes `prettier --check`.

### Known physical-device issues (observed, NOT fixed here)

1. Facility/Home data may take too long to load.
2. Facility Detail navigation/loading is slow.
3. Booking screen availability request ends in "Availability unavailable".
4. The customer cannot currently complete the full booking journey.
5. Current screens are still basic engineering UI and do not yet match the approved Figma quality.
6. Facility Detail currently displays values such as operating hours/pricing that need backend/product-truth verification.
7. The full physical-device customer journey has NOT yet been certified complete.

### Next development priorities (record only — do NOT implement in this checkpoint)

P0 — Booking runtime unblock

- trace slow facility/detail loading
- trace availability request end-to-end
- verify mobile → API → database path
- determine whether failure is networking, API URL, authentication, endpoint, schema, availability query, timezone/date handling, CORS, or backend process availability
- make real available times load on physical Android device

P1 — Full booking flow verification
Facility → Date → Duration → Available time → Quote → Review → Booking creation → payment test/sandbox flow → confirmation → My Bookings / Pass

P2 — Canonical UI kit / Figma alignment
Before broadly redesigning screens: audit the existing UI kit; compare it against Figma node `63:2` and the relevant Figma components/styles; consolidate design tokens — typography, spacing, radii, colors, shadows, buttons, inputs, cards, chips, navigation, states, skeletons, feedback/error components, safe areas, themes, accessibility/touch targets. Then migrate Customer Mobile screens onto the canonical system.

P3 — Complete Customer Mobile product UI and remaining modules.

### Required environment variable NAMES (values are private — never committed, never printed)

Mobile (required to run the development client), recreate locally in `apps/mobile/.env.local` (plaintext) or keep using the tracked dotenvx-encrypted `apps/mobile/.env` plus the private `apps/mobile/.env.keys`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

Local API development (only if running `apps/api` on the new machine), names as in `apps/api/.env.example`: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `WEB_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Web (only if running `apps/web`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The repo's tracked `.env` files contain dotenvx ciphertext only; the decryption keys live in git-ignored `*.env.keys` files that must be copied securely (or the plaintext `.env.local` recreated) on the new machine. Expo tooling also names `DOTENV_PUBLIC_KEY` / `DOTENV_PUBLIC_KEY_LOCAL` (public key material, not secret).

### Fresh-machine resume sequence

```bash
git clone git@github.com:Devansh5602/TurfAndTaste-Rebuild.git   # or use an existing clone
cd TurfAndTaste-Rebuild
git fetch origin
git checkout feature/customer-mobile-payments
git pull --ff-only origin feature/customer-mobile-payments

# Node 22 (.node-version) and the pinned pnpm (packageManager: pnpm@10.34.6)
corepack enable
pnpm install --frozen-lockfile

# Private environment (choose one):
#  (a) copy the git-ignored apps/mobile/.env.keys next to the tracked encrypted apps/mobile/.env, or
#  (b) create apps/mobile/.env.local with EXPO_PUBLIC_SUPABASE_URL,
#      EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL (values from your password manager)

# The android/ directory is git-ignored, so regenerate the dev client once per machine
# (Android SDK + JDK required) — this installs the build that registers the
# turfandtaste:// scheme used by the confirmation e-mail:
cd apps/mobile && npx expo run:android && cd ../..

# Start Metro for the physical device:
cd apps/mobile && npx expo start --dev-client --clear --tunnel
```

Validation commands on the new machine: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
