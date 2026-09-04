// L7: vitest.integration.config.ts setupFiles guard. `pnpm vitest run --config
// vitest.integration.config.ts <file>` run directly (not via `pnpm test:all`/`pnpm vitest:int`)
// skips scripts/test/prepare-int-db.ts entirely, so nothing stops it from running integration
// tests — real writes/deletes — against whatever DATABASE_URL happens to be set, including a
// prod-looking one. This setup file re-asserts the same dev/shadow-only check prepare-int-db.ts
// already does, so the guard holds no matter how the integration config is invoked.
import { assertDevDatabaseUrl } from './helpers/assertDevDatabaseUrl';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Integration tests must never run in production');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
assertDevDatabaseUrl(databaseUrl, 'DATABASE_URL');

const directUrl = process.env.DIRECT_URL;
if (directUrl) assertDevDatabaseUrl(directUrl, 'DIRECT_URL');

const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
if (shadowDatabaseUrl) assertDevDatabaseUrl(shadowDatabaseUrl, 'SHADOW_DATABASE_URL');
