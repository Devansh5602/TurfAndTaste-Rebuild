import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Server-only credentials. Neither identifier may appear anywhere a web or
// mobile build can reach, because bundlers inline referenced constants.
const PRIVILEGED_SERVER_SECRETS = [
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const CLIENT_PACKAGES = [
  'apps/mobile',
  'apps/web',
  'packages/api-client',
  'packages/design-tokens',
  'packages/schemas',
  'packages/types',
  'packages/ui-native',
  'packages/ui-web',
  'packages/config',
];

const CLIENT_ENV_FILES = [
  'apps/mobile/.env',
  'apps/mobile/.env.example',
  'apps/web/.env.local',
  'apps/web/.env.example',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.expo',
  '.git',
]);

function findRepositoryRoot(start: string): string {
  let current = resolve(start);
  while (!existsSync(join(current, 'pnpm-workspace.yaml'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not locate the repository root.');
    }
    current = parent;
  }
  return current;
}

const repositoryRoot = findRepositoryRoot(process.cwd());

function collectClientSourceFiles(): string[] {
  const files: string[] = [];
  for (const packageName of CLIENT_PACKAGES) {
    const packageRoot = join(repositoryRoot, packageName);
    if (!existsSync(packageRoot)) continue;
    const pending = [packageRoot];
    while (pending.length > 0) {
      const directory = pending.pop();
      if (!directory) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (IGNORED_DIRECTORIES.has(entry.name)) continue;
          pending.push(path);
        } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
          files.push(path);
        }
      }
    }
  }
  return files;
}

describe('client-side credential boundary', () => {
  it('keeps privileged Razorpay and Supabase credentials out of client source', () => {
    const offenders = collectClientSourceFiles()
      .filter((file) =>
        PRIVILEGED_SERVER_SECRETS.some((secret) => readFileSync(file, 'utf8').includes(secret)),
      )
      .map((file) => relative(repositoryRoot, file));

    expect(offenders).toEqual([]);
  });

  it('exposes only public-prefixed values to the web and mobile environments', () => {
    const offenders: string[] = [];

    for (const file of CLIENT_ENV_FILES) {
      const contents = readFileSync(join(repositoryRoot, file), 'utf8');
      for (const line of contents.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 0) continue;
        const name = trimmed.slice(0, separator);
        if (name === 'DOTENV_PUBLIC_KEY' || name === 'DOTENV_PUBLIC_KEY_LOCAL') continue;
        if (!/^(EXPO_PUBLIC_|NEXT_PUBLIC_)/.test(name)) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('documents every server credential with an empty placeholder in the API example', () => {
    const contents = readFileSync(join(repositoryRoot, 'apps/api/.env.example'), 'utf8');
    const lines = contents.split('\n');

    for (const secret of PRIVILEGED_SERVER_SECRETS) {
      const line = lines.find((candidate) => candidate.startsWith(`${secret}=`));
      expect(line, `${secret} must stay documented in apps/api/.env.example`).toBeDefined();
      expect(line?.slice(secret.length + 1).trim()).toBe('');
    }
  });
});
