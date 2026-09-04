// Shared dev-DB guard: refuses any DATABASE_URL/DIRECT_URL/SHADOW_DATABASE_URL that
// doesn't look like the local dev or shadow database. Used by scripts/test/prepare-int-db.ts
// (npm-script gate) and test/assertIntDevDb.setup.ts (vitest.integration.config.ts
// setupFiles gate) so `pnpm vitest run --config vitest.integration.config.ts <file>` can't
// bypass the check by skipping the prepare-int-db script.
export function assertDevDatabaseUrl(value: string, label: string): void {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(`${label} must point at localhost for integration tests`);
  }

  if (!url.pathname.endsWith('/bbvn_dev') && !url.pathname.endsWith('/bbvn_shadow')) {
    throw new Error(`${label} must target the dev or shadow database`);
  }
}
