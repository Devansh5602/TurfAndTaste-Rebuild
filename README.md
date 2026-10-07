# Turf & Taste — Rebuild

Production rebuild of Turf & Taste, one property in Patan, Gujarat. This repository starts from a new foundation. Product behavior is defined in `docs/PRODUCT_TRUTH.md`.

## Architecture

pnpm workspaces and Turborepo.

| App | Stack | Deploy target |
| --- | --- | --- |
| `apps/web` | Next.js, React, TypeScript, Tailwind CSS | Vercel, not deployed in Phase 0 |
| `apps/mobile` | Expo SDK 57 dev client, React Native, TypeScript, NativeWind | Android APK/AAB later |
| `apps/api` | Express, TypeScript, Supabase, Razorpay later | hosted Node, not deployed in Phase 0 |

Shared packages hold design tokens, types, Zod schemas, the API client, UI primitives, and TypeScript config. Web and native UI are separate implementations of the same tokens.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10.34.6, via Corepack: `corepack enable` then `corepack prepare pnpm@10.34.6 --activate`
- Android Studio when you are ready to run a device build

## Install

```bash
pnpm install
```

Copy the `.env.example` files before running the apps. Do not commit real keys. See `docs/ENVIRONMENTS.md`.

## Commands

```bash
pnpm dev
pnpm --filter @turf-and-taste/web dev
pnpm --filter @turf-and-taste/mobile dev
pnpm --filter @turf-and-taste/api dev
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @turf-and-taste/web build
pnpm --filter @turf-and-taste/api build
```

The mobile dev script starts an Expo development client, not Expo Go:

```bash
pnpm --filter @turf-and-taste/mobile dev
```

Android native projects are generated when needed:

```bash
pnpm --filter @turf-and-taste/mobile prebuild
```

## Workspace

```text
apps/web
apps/mobile
apps/api
packages/design-tokens
packages/types
packages/schemas
packages/api-client
packages/config
packages/ui-web
packages/ui-native
supabase/
docs/
```

## Branching

Work branches come from `develop`. Do not develop on `main`. See `docs/BRANCHING_STRATEGY.md`.

## Docs

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_TRUTH.md`
- `docs/UI_KIT.md`
- `docs/API_CONTRACTS.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/DECISIONS.md`
- `docs/AI_HANDOFF.md`
