# AI handoff

## Current checkpoint

- Branch: `feature/customer-mobile-auth-discovery`
- Base: `develop` at `2566034`
- Phase: customer mobile authentication and database-backed facility discovery checkpoint
- Runtime: Node.js 22 is required (`.node-version` is `22`; `package.json` requires `>=22.13.0`)
- Do not merge to `main`; open a PR to `develop`
- Do not begin booking or payment work without following `docs/DEVELOPMENT_PLAN.md`

## Completed at this checkpoint

### Customer mobile shell

- React Navigation separates signed-out and signed-in customer flows.
- The root app keeps the global query client and global persisted theme provider.
- Clubhouse Ivory and Midnight Ivory continue to use shared semantic design tokens.
- Loading state is shown while the customer session is restored.

### Real Supabase customer authentication

- Mobile uses the configured public Supabase URL and anon key; no customer identity is hardcoded.
- Sign-up submits email, password, and full name to Supabase Auth.
- Sign-in uses Supabase password authentication.
- Sign-out clears the Supabase session and returns to the signed-out flow.
- Password-reset email requests use the `turfandtaste://reset-password` redirect.
- Auth sessions use `expo-secure-store`; theme preference remains in AsyncStorage.
- Auth state is restored at startup and follows Supabase auth state changes and token refreshes.
- React Hook Form fields use `Controller` so React Native `onChangeText` values reach validation and submission.

### Facility discovery

- Home and Facilities screens request active facilities from the real API with the current customer access token.
- Loading, recoverable error, empty, populated, and pull-to-refresh states are present.
- Facility detail navigation uses the stable `FacilityKey`, not a database id cast.
- Facility detail reads the real facility, allowed add-ons, weekly schedule, and server pricing.
- Shooting Machine is represented only as an add-on returned for Cricket Green Net Practice.
- No fixture data is presented as production data and no unauthorized sport was added.
- No booking creation, quote, payment, cart, checkout, or client-side price-authority flow was introduced.

### API client and UI support

- The authenticated API helper adds the bearer token and unwraps the repository API envelope.
- Facility discovery client methods cover list, detail, schedule, and pricing only.
- API envelope success and failure behavior has focused tests.
- Native primitives gained the variants, validation text, and layout hooks required by these screens while continuing to use design tokens.

### TypeScript repair

The mobile TypeScript failure was structural, not parser corruption:

1. `apps/mobile/tsconfig.json` had lost `expo/tsconfig.base` and had been replaced with Node16/CommonJS and classic JSX settings.
2. Temporary local declarations shadowed React Native and TanStack Query types.
3. Mobile had been pinned to TanStack Query 4 while source used the workspace catalog's TanStack Query 5 API.
4. Source then exposed ordinary route, API arity, strict-null, and unused-declaration errors.

The Expo inheritance is restored, temporary declaration shims are gone, and mobile uses `@tanstack/react-query: catalog:`.

## Verification

Checkpoint verification on Node 22:

```text
pnpm install   passed
pnpm lint      passed
pnpm typecheck passed
pnpm test      passed
pnpm build     passed
```

Focused API-client coverage is now 4 tests. Repository tests cover 22 tests in total at this checkpoint. Native Android/iOS builds were not run.

## Security and repository hygiene

- Tracked `.env` files contain dotenvx-encrypted values and public encryption metadata, not plaintext secrets.
- `.env.keys` files remain local and gitignored.
- No service-role key, payment secret, access token, password, or private dotenvx key is committed.
- No generated native projects, `.expo` output, build output, diagnostic declaration shims, or backup files are part of the checkpoint.
- Public mobile Supabase URL/anon configuration is used only for the client-side auth behavior Supabase expects.

## Known gaps

- The app requests sign-up verification and password-recovery emails from the real Supabase project, but inbound email deep-link completion and a reset-password form still require device-level completion before the authentication phase can be considered end-to-end complete under `docs/DEVELOPMENT_PLAN.md`.
- Auth and discovery screens do not yet have a mobile component/integration test harness; API-envelope behavior is unit tested and repository static gates pass.
- Facility discovery requires the API and hosted Supabase data to be reachable from the physical device/emulator.
- Native Android/iOS builds and physical-device interaction checks remain outstanding.
- Profile editing and customer booking history are intentionally deferred; the account screen currently exposes identity and sign-out only.

## Exact next starting point

Before starting a later product phase, complete the remaining Phase 2 device checkpoint: configure and validate the `turfandtaste://` verification/recovery callback on a development build, add the reset-password completion screen, and verify session restoration after an app restart.

Then follow the repository's authoritative phase sequence in `docs/DEVELOPMENT_PLAN.md`. For Phase 3, validate on-device that the database-backed discovery flow renders exactly the four authorized facilities and exposes Shooting Machine only under Cricket Green Net Practice. Do not start the Phase 4 booking flow until that Phase 3 exit criterion is recorded as complete.

## Multi-device recovery

On a fresh machine:

```bash
git clone <repository-url>
cd TurfAndTaste-Rebuild
git switch feature/customer-mobile-auth-discovery

# Use Node 22 (the repository requires >=22.13.0).
nvm install 22
nvm use 22
corepack enable
pnpm install

# Securely transfer these local-only files from the trusted machine:
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

Never paste key contents into source, documentation, logs, issues, chat, or commits. See `docs/ENVIRONMENT_WORKFLOW.md` for rotation and recovery details.
