# Vercel API preview deployment

This runbook prepares the Express API for a **new, separate Vercel project**. It does not authorize a deployment.

## Project identity

- Vercel project name: `turf-and-taste-rebuild-api`
- Git repository: `Devansh5602/TurfAndTaste-Rebuild`
- Initial use: Preview/staging only
- Vercel Root Directory: `apps/api`

Do not connect this repository to an old Track A project. Do not configure live Razorpay credentials.

## Deployment architecture

Vercel's current Express runtime detects `apps/api/src/index.ts`. That file reads the server environment, calls the existing `createApp(readEnv())` factory, and default-exports the Express application without opening a port. No API implementation is duplicated.

Local development and conventional Node hosting continue to use `apps/api/src/server.ts`, which calls the same factory and then `app.listen(env.PORT)`.

Vercel documents zero-configuration Express support, so this project intentionally has no `vercel.json`, legacy `builds`, or legacy `routes` configuration. The Express app remains one Vercel Function and keeps its existing paths, including `/health` and `/api/v1/*`.

## Vercel dashboard settings

Create the project from the repository and use these settings:

- **Project Name:** `turf-and-taste-rebuild-api`
- **Root Directory:** `apps/api`
- **Framework Preset:** Express (automatic detection)
- **Node.js Version:** 22.x
- **Build Command:** leave unset/automatic
- **Output Directory:** leave unset/automatic
- **Install Command:** leave unset/automatic; do not add a bare `pnpm install` override
- **Production deployment:** do not initiate or promote one during preview readiness

The root and API package manifests constrain Node to `^22.13.0`, which keeps Vercel on the Node 22 major while preserving the repository's minimum version. The API's local `tsup` build also targets Node 22.

### pnpm workspace handling

The deployment uses the repository's existing pnpm workspace and lockfile. The API declares `@turf-and-taste/schemas` and `@turf-and-taste/types` as `workspace:*` dependencies; they are not published to npm. Vercel's monorepo support resolves the workspace from the repository root even though the project Root Directory is `apps/api`.

The repository pins pnpm `10.34.6`, the newest stable pnpm 10 release available when this runbook was updated. Vercel's package-manager reference supports pnpm through version 10 and explicitly documents lockfile format 9.0 as compatible with pnpm 10. Set `ENABLE_EXPERIMENTAL_COREPACK=1` in the Vercel project so the exact root `packageManager` pin is used. Leave the Install Command automatic; a bare custom `pnpm install` override can select an older pnpm instead of the pinned release.

## Preview environment variables

Configure these names directly in the **Preview** environment of the new API project:

- `LOG_LEVEL`
- `WEB_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Use the Vercel Secret type for service-role and secret values where available. Use only Razorpay TEST credentials. Do not add these server values to `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables, commit them, print them, or upload dotenvx private keys. `PORT` is not required by the exported serverless app. Vercel supplies the runtime environment; no explicit `NODE_ENV` value is required for this entry point.

`WEB_ORIGIN` must be the exact allowed browser origin, including scheme. Originless requests remain allowed for native mobile clients and non-browser provider callbacks. Arbitrary browser origins remain rejected. For web Preview testing, use a stable Preview alias or update `WEB_ORIGIN` to the exact web Preview origin; do not use `*`.

The repository currently uses an in-memory Express rate-limit store. It remains useful as a best-effort per-instance Preview guard, but it is not a distributed global limit across Vercel Function instances.

## Preview verification

After an authorized Preview deployment, verify:

```text
GET https://<api-preview-host>/health
```

The response must be successful, contain the health envelope, and include an `x-request-id` header.

Set the mobile Preview environment to:

```text
EXPO_PUBLIC_API_URL=https://<api-preview-host>
```

This URL is public configuration. Do not place API secrets in the mobile environment.

For Razorpay TEST mode, register this callback only after the Preview hostname is stable:

```text
POST https://<api-preview-host>/api/v1/payments/webhook/razorpay
```

Use a TEST webhook secret matching the API project's `RAZORPAY_WEBHOOK_SECRET` and the events `payment.captured`, `payment.failed`, and `payment.refunded`. The route intentionally remains outside customer authentication. Express preserves the exact request bytes before JSON parsing, and payment handling verifies the `x-razorpay-signature` with the server-only webhook secret. Never weaken or bypass that verification.

## References

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel Turborepo support](https://vercel.com/docs/monorepos/turborepo)
- [Configuring a Vercel build](https://vercel.com/docs/builds/configure-a-build)
- [Vercel package managers](https://vercel.com/docs/package-managers)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
