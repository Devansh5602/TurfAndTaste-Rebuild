# AI handoff

## Current state

- Branch: `chore/foundation-bootstrap`
- Phase: 0, foundation complete on this branch
- Base: `develop` (same commit as `main` at branch creation: `85d9e1f`)
- Do not merge to `main` unless explicitly asked

## Commits on this branch

- `7f33294` chore(repo): establish monorepo and tooling
- `d4fe982` feat(theme): establish canonical design token system
- `a97ef31` feat(ui): establish shared ui foundations
- `5bff85c` chore(api): bootstrap express service architecture
- `413e890` chore(web): bootstrap nextjs application
- `1ec1c07` chore(mobile): bootstrap react native application

Documentation and CI commits follow these. Read `git log --oneline origin/develop..HEAD` for the full list.

## Completed

- pnpm workspace, Turborepo, Node 22 pin, strict TypeScript, ESLint, Prettier
- Design tokens for Clubhouse Ivory and Midnight Ivory
- Web theme persistence through `next-themes` and storage key `turf-and-taste-theme`
- Mobile theme persistence through AsyncStorage and the same key
- Web and native UI primitive foundations
- Express health route and error envelope
- Expo SDK 57 dev client shell, not Expo Go
- Supabase folder layout and an unapplied domain draft
- Product, architecture, security, package, test, and phase docs

## Architecture

See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

Web is Next.js 16 on Tailwind 4. Mobile is Expo SDK 57 with NativeWind 4. API is Express 5. Shared rules live in `@turf-and-taste/schemas`. Supabase is the system of record and has not been migrated.

## Package choices

See `docs/PACKAGE_POLICY.md`. TypeScript is pinned to 5.9.3 because typescript-eslint does not accept TypeScript 7 yet.

## Verification already run

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (19 tests)
- `pnpm --filter @turf-and-taste/web build`
- `pnpm --filter @turf-and-taste/api build`
- `pnpm --filter @turf-and-taste/mobile exec expo config --type public`
- Browser check: switching themes updates `data-theme`, `localStorage`, and the body background for both Clubhouse Ivory (`rgb(247, 243, 235)`) and Midnight Ivory (`rgb(18, 20, 16)`), and the choice survives reload

An Android device build was not run. Android Studio was not required for typecheck or Expo config validation.

## Known blockers

- The hosted Supabase project is not linked and the domain draft is not applied. That is intentional.
- Razorpay is not installed. Test-mode checkout belongs to Phase 5.
- No production deploy.

## Next task

Phase 1: link the existing Supabase project and add the first reviewed migration for profiles, staff, roles, facilities, and RLS. Do not copy an older schema. Start from `supabase/drafts/domain-model.sql` and `docs/DATABASE.md`.

## Read first

1. `docs/PRODUCT_TRUTH.md`
2. `docs/ARCHITECTURE.md`
3. `docs/UI_KIT.md`
4. `docs/DECISIONS.md`
5. `AGENTS.md`
