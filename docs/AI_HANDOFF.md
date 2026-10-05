# AI handoff

## Current state

- Branch: `feature/core-platform-foundation`
- Phase: 1.1, hosted database setup + device handoff checkpoint complete
- Base: `develop` (commit `88c04d4` at branch creation)
- Do not merge to `main` unless explicitly asked

## Commits on this branch

- `7f33294` chore(repo): establish monorepo and tooling
- `d4fe982` feat(theme): establish canonical design token system
- `a97ef31` feat(ui): establish shared ui foundations
- `5bff85c` chore(api): bootstrap express service architecture
- `413e890` chore(web): bootstrap nextjs application
- `1ec1c07` chore(mobile): bootstrap react native application
- `655f8a1` docs(architecture): add engineering and agent documentation
- `54a0399` ci: add foundation verification workflow
- `6a3b20d` feat(phase1): implement core platform foundation
- `68025fe` fix(api): disable realtime in test environment without type error
- `21229fd` chore(env): add secure multi-device dotenvx workflow
- `HEAD` chore(checkpoint): complete hosted database setup and device handoff

Read `git log --oneline origin/develop..HEAD` if this list is behind the branch tip.

## Completed

### Phase 0 - Foundation
- pnpm workspace, Turborepo, Node 22 pin, strict TypeScript, ESLint, Prettier
- Design tokens for Clubhouse Ivory and Midnight Ivory
- Web theme persistence through `next-themes` and storage key `turf-and-taste-theme`
- Mobile theme persistence through AsyncStorage and the same key
- Web and native UI primitive foundations
- Express health route and error envelope
- Expo SDK 57 dev client shell, not Expo Go
- Supabase folder layout and an unapplied domain draft
- Product, architecture, security, package, test, and phase docs

### Phase 1 - Core Platform Foundation
- **Database schema**: 22 tables covering profiles, staff/RBAC, facilities/add-ons, schedules/overrides, pricing, bookings/items, payments/orders, reviews, events/notices, dining, inquiries, audit logs
- **RLS policies**: 56 policies enforcing customer/staff domain separation
- **Seed data**: Deterministic development seed for single Patan property with 4 authorized facilities + Shooting Machine add-on
- **API services**: Facilities, Schedules, Pricing, Availability, Booking (Quote + CRUD), Payment (Razorpay TEST), Profile
- **API routes**: `/api/v1/facilities`, `/api/v1/bookings`, `/api/v1/payments`, `/api/v1/profile`
- **Auth middleware**: JWT verification, customer/staff domain separation, permission-based RBAC
- **Supabase integration**: Server-side admin client, user-scoped client for auth
- **Razorpay TEST**: Order creation, signature verification, webhook handling

### Phase 1.1 - Hosted Database Setup + Device Handoff
- **Supabase project linked**: `TurfAndTaste-Rebuild` (ref: `rlmuxztkwpwutyepttfe`)
- **Migrations applied**: 3 migrations deployed to hosted database
  - `20250101000000_initial_schema.sql` - Core schema with 22 tables
  - `20250101000001_rls_policies.sql` - 56 RLS policies
  - `20250101000002_seed_data.sql` - Development seed data
- **Credentials rotated**: New Supabase and Razorpay TEST credentials in encrypted env
- **dotenvx workflow**: Encrypted env files committed, private keys local-only

## Architecture

See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

Web is Next.js 16 on Tailwind 4. Mobile is Expo SDK 57 with NativeWind 4. API is Express 5. Shared rules live in `@turf-and-taste/schemas`. Supabase is the system of record with migrations applied.

## Package choices

See `docs/PACKAGE_POLICY.md`. TypeScript is pinned to 5.9.3 because typescript-eslint does not accept TypeScript 7 yet.

## Verification already run

- `pnpm lint` ✅
- `pnpm typecheck` ✅ (8 packages)
- `pnpm test` ✅ (20 tests)
- `pnpm build` ✅ (API + Web)
- Supabase connectivity ✅
- Razorpay TEST connectivity ✅
- Migration deployment ✅ (3/3 applied)
- RLS enabled on all 22 tables ✅
- 56 RLS policies active ✅
- Seed data verified (4 facilities, 1 add-on, pricing, roles, dining, events) ✅
- Product truth validated (only authorized sports) ✅

## Hosted Supabase Status

- **Project**: `TurfAndTaste-Rebuild` (ref: `rlmuxztkwpwutyepttfe`)
- **Region**: Asia/Kolkata (implied by timezone)
- **Migrations applied**: 3/3
- **Tables created**: 22
- **RLS enabled**: 22/22 tables
- **Policies created**: 56
- **Seed data**: Facilities (4), Add-ons (1), Pricing (10 tiers), Roles (4), Permissions (24), Dining (2 outlets, 8 items), Events (2), Notices (2)
- **No unauthorized sports seeded**: ✅

## Razorpay TEST Status

- **Mode**: Test only
- **Key ID**: `rzp_test_TkEADTPfIIx77H` (rotated)
- **Secret**: Rotated, server-only
- **API connectivity**: Verified via payment service initialization

## dotenvx Multi-Device Workflow

### Encrypted files (committed)
- `apps/api/.env` - 8 server secrets
- `apps/web/.env.local` - 3 public vars
- `apps/mobile/.env` - 3 public vars

### Private keys (gitignored, never committed)
- `apps/api/.env.keys`
- `apps/web/.env.keys`
- `apps/mobile/.env.keys`

### Required on fresh device
1. Clone repo
2. `pnpm install`
3. Securely transfer three `.env.keys` files from current machine
4. Place each beside its encrypted env file
5. Run `pnpm env:api echo "OK"` to verify decryption

## Next task

Phase 2: Customer app navigation and authentication (mobile-first). The API can now identify customer/staff principals, RLS is enforced, and the database schema is ready for facilities discovery, booking, and payment flows.

## Read first

1. `docs/PRODUCT_TRUTH.md`
2. `docs/ARCHITECTURE.md`
3. `docs/UI_KIT.md`
4. `docs/DECISIONS.md`
5. `AGENTS.md`
6. `docs/ENVIRONMENT_WORKFLOW.md` (new - multi-device dotenvx workflow)