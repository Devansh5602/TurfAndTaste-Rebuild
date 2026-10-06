# Multi-Device Environment Workflow (dotenvx)

This document explains how to set up and use the dotenvx-based environment configuration for Turf & Taste Rebuild across multiple development machines.

## Overview

- **Tool**: [dotenvx](https://dotenvx.com/) (v2.32.4)
- **Purpose**: Encrypt sensitive environment variables, commit encrypted files to Git, share across machines securely
- **Scope**: API secrets, web/mobile public variables
- **Security**: Private decryption keys NEVER committed to Git

---

## Environment File Architecture

### Encrypted Files (Committed to Git)

| App | Encrypted File | Public Key File | Private Key File (NOT committed) |
|-----|----------------|-----------------|-----------------------------------|
| API | `apps/api/.env` | `apps/api/.env` (embedded) | `apps/api/.env.keys` |
| Web | `apps/web/.env.local` | `apps/web/.env.local` (embedded) | `apps/web/.env.keys` |
| Mobile | `apps/mobile/.env` | `apps/mobile/.env` (embedded) | `apps/mobile/.env.keys` |

Each encrypted file contains:
- `DOTENV_PUBLIC_KEY` - Used for encryption (can be public)
- Encrypted key-value pairs (e.g., `SUPABASE_URL="encrypted:..."`)
- Private keys are stored separately in `.env.keys` files

### Template Files (Committed to Git)

| File | Purpose |
|------|---------|
| `.env.example` | Root template |
| `apps/api/.env.example` | API template (server-only vars) |
| `apps/web/.env.example` | Web template (public vars only) |
| `apps/mobile/.env.example` | Mobile template (public vars only) |

### Gitignored Files (Never Committed)

- `.env` - Root local env (if created)
- `apps/api/.env.keys` - API private decryption keys
- `apps/web/.env.keys` - Web private decryption keys
- `apps/mobile/.env.keys` - Mobile private decryption keys
- Any `.env` or `.env.*` files without `.example` suffix

---

## Variable Classification

### API Only (Server Secrets - NEVER exposed to clients)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/test/production) |
| `PORT` | API server port (default 4000) |
| `LOG_LEVEL` | Pino log level |
| `WEB_ORIGIN` | Allowed CORS origin for web |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `RAZORPAY_KEY_ID` | Razorpay test key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay test secret key |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signing secret (dashboard) |

### Web Public (Safe for Browser Bundle)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |

### Mobile Public (Safe for App Bundle)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | API base URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |

---

## First Setup (Machine A)

### 1. Clone and Install

```bash
git clone <repo-url>
cd TurfAndTaste-Rebuild
pnpm install
```

### 2. Generate Keypairs (One-time)

```bash
# API
cd apps/api
pnpm dlx @dotenvx/dotenvx keypair --no-native --file .env

# Web
cd ../web
pnpm dlx @dotenvx/dotenvx keypair --no-native --file .env.local

# Mobile
cd ../mobile
pnpm dlx @dotenvx/dotenvx keypair --no-native --file .env
```

This generates:
- Public key embedded in each `.env*` file
- Private key in corresponding `.env.keys` file (gitignored)

### 3. Encrypt Secrets

```bash
# API - encrypt all server secrets
cd apps/api
pnpm dlx @dotenvx/dotenvx set --file .env --no-native NODE_ENV development
pnpm dlx @dotenvx/dotenvx set --file .env --no-native PORT 4000
pnpm dlx @dotenvx/dotenvx set --file .env --no-native LOG_LEVEL info
pnpm dlx @dotenvx/dotenvx set --file .env --no-native WEB_ORIGIN "http://localhost:3000"
pnpm dlx @dotenvx/dotenvx set --file .env --no-native SUPABASE_URL "https://your-project.supabase.co"
pnpm dlx @dotenvx/dotenvx set --file .env --no-native SUPABASE_SERVICE_ROLE_KEY "sb_secret_..."
pnpm dlx @dotenvx/dotenvx set --file .env --no-native RAZORPAY_KEY_ID "rzp_test_..."
pnpm dlx @dotenvx/dotenvx set --file .env --no-native RAZORPAY_KEY_SECRET "..."
pnpm dlx @dotenvx/dotenvx set --file .env --no-native RAZORPAY_WEBHOOK_SECRET "..."

# Web - encrypt public variables
cd ../web
pnpm dlx @dotenvx/dotenvx set --file .env.local --no-native NEXT_PUBLIC_API_URL "http://localhost:4000"
pnpm dlx @dotenvx/dotenvx set --file .env.local --no-native NEXT_PUBLIC_SUPABASE_URL "https://your-project.supabase.co"
pnpm dlx @dotenvx/dotenvx set --file .env.local --no-native NEXT_PUBLIC_SUPABASE_ANON_KEY "sb_publishable_..."

# Mobile - encrypt public variables
cd ../mobile
pnpm dlx @dotenvx/dotenvx set --file .env --no-native EXPO_PUBLIC_API_URL "http://localhost:4000"
pnpm dlx @dotenvx/dotenvx set --file .env --no-native EXPO_PUBLIC_SUPABASE_URL "https://your-project.supabase.co"
pnpm dlx @dotenvx/dotenvx set --file .env --no-native EXPO_PUBLIC_SUPABASE_ANON_KEY "sb_publishable_..."
```

### 4. Transfer Private Keys to Machine B (Secure Channel)

Copy these files via secure channel (encrypted USB, password manager, SSH):
- `apps/api/.env.keys`
- `apps/web/.env.keys`
- `apps/mobile/.env.keys`

**Never commit these to Git.**

### 5. Verify Setup

```bash
# Test API
pnpm --filter @turf-and-taste/api test

# Test API dev server
pnpm --filter @turf-and-taste/api dev

# Test Web build
pnpm --filter @turf-and-taste/web build

# Test all
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## Setup on Machine B (and Subsequent Machines)

### 1. Clone and Install

```bash
git clone <repo-url>
cd TurfAndTaste-Rebuild
pnpm install
```

### 2. Place Private Keys

Copy the private key files from Machine A:
- `apps/api/.env.keys`
- `apps/web/.env.keys`
- `apps/mobile/.env.keys`

### 3. Verify Decryption Works

```bash
# Test each environment loads correctly
pnpm env:api echo "API: SUPABASE_URL=$SUPABASE_URL"
pnpm env:web echo "Web: NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
pnpm env:mobile echo "Mobile: EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL"
```

### 4. Run Development Commands

```bash
# API development
pnpm --filter @turf-and-taste/api dev

# Web development (separate terminal)
pnpm --filter @turf-and-taste/web dev

# Mobile development (separate terminal)
pnpm --filter @turf-and-taste/mobile dev

# Run tests
pnpm test

# Full validation
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## Daily Development Workflow

### Start API Server

```bash
# Development (with hot reload)
pnpm --filter @turf-and-taste/api dev

# Or use the env wrapper for one-off commands
pnpm env:api node -e "console.log(process.env.SUPABASE_URL)"
```

### Start Web App

```bash
# Development (Next.js dev server)
pnpm --filter @turf-and-taste/web dev
```

### Start Mobile App

```bash
# Expo dev client
pnpm --filter @turf-and-taste/mobile dev
```

### Run Tests

```bash
# All tests
pnpm test

# API tests only
pnpm --filter @turf-and-taste/api test
```

---

## CI/CD Integration

### GitHub Actions

Add the private decryption key as a repository secret:

1. Go to Settings → Secrets and variables → Actions → New repository secret
2. Name: `DOTENV_PRIVATE_KEY_API`
3. Value: Contents of `apps/api/.env.keys` (the private key line)

```yaml
# .github/workflows/ci.yml
- name: Setup dotenvx
  run: |
    echo "${{ secrets.DOTENV_PRIVATE_KEY_API }}" > apps/api/.env.keys
    # Repeat for web and mobile if needed
```

Then use `dotenvx run` in CI steps:

```yaml
- name: Run API tests
  run: pnpm env:api pnpm --filter @turf-and-taste/api test
```

### Vercel (Web)

Add as Environment Variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### EAS (Mobile)

Add as Environment Variables in EAS project:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### API Server (Production)

Set these as environment variables in your hosting platform:
- `NODE_ENV=production`
- `PORT`
- `LOG_LEVEL`
- `WEB_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

---

## Rotating Credentials

### To Rotate a Secret

```bash
# API example - rotate Supabase service role key
cd apps/api
pnpm dlx @dotenvx/dotenvx set --file .env --no-native SUPABASE_SERVICE_ROLE_KEY "new_sb_secret_..."

# Verify
pnpm env:api echo "SUPABASE_URL=$SUPABASE_URL"
pnpm --filter @turf-and-taste/api test
```

### To Rotate dotenvx Keypair

```bash
# Generate new keypair
cd apps/api
pnpm dlx @dotenvx/dotenvx keypair --no-native --file .env

# Re-encrypt all variables with new key
pnpm dlx @dotenvx/dotenvx encrypt --file .env --no-native --force

# Distribute new .env.keys to all machines
```

---

## Recovering a New Development Machine

### Quick Recovery (if you have private keys backed up)

```bash
git clone <repo-url>
cd TurfAndTaste-Rebuild
pnpm install
# Place .env.keys files from backup
# Run verification
pnpm env:api echo "OK"
pnpm test
```

### Full Recovery (no backup of private keys)

1. Generate new keypairs on new machine
2. Re-encrypt all secrets using credentials from Supabase/Razorpay dashboards
3. Update CI/CD secrets with new private keys

---

## Troubleshooting

### "dotenvx: command not found"

```bash
pnpm install  # Installs @dotenvx/dotenvx as devDependency
```

### "Failed to decrypt" / "Invalid private key"

- Ensure `.env.keys` file exists and matches the public key in `.env`
- Check that you're using the correct `.env.keys` for each app
- Regenerate keypair and re-encrypt if keys are mismatched

### "WebSocket not found" (Node.js 20)

The API includes a WebSocket polyfill for development. Ensure:
- `ws` package is installed (`pnpm --filter @turf-and-taste/api add ws`)
- `NODE_ENV !== 'production'` in development

### Tests fail with "Supabase server credentials not configured"

The test environment uses a mock Supabase URL. Check `apps/api/src/app.test.ts` - it provides test credentials inline.

---

## Security Checklist

- [ ] All `.env.keys` files are gitignored
- [ ] No plaintext secrets in Git history (check `git log --all --oneline --source --remotes -- apps/api/.env`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` only in API `.env`
- [ ] No `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variables contain secrets
- [ ] CI/CD secrets configured with private keys
- [ ] Production secrets set in hosting platform, not in repo
- [ ] Private keys transferred via secure channel only

---

## Quick Reference Commands

```bash
# View decrypted env (for debugging)
pnpm env:api printenv | grep SUPABASE

# Encrypt a new variable
pnpm dlx @dotenvx/dotenvx set --file apps/api/.env --no-native NEW_VAR "value"

# List all encrypted variables
pnpm dlx @dotenvx/dotenvx run --env-file=apps/api/.env -- printenv

# Decrypt to stdout (requires private key)
pnpm dlx @dotenvx/dotenvx decrypt --file=apps/api/.env

# Generate new keypair
pnpm dlx @dotenvx/dotenvx keypair --no-native --file apps/api/.env
```