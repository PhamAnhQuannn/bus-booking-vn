import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { readFileSync } from 'fs';

/**
 * Vitest config for integration tests.
 * Requires DATABASE_URL to be set (real postgres:16 instance with seeded data).
 * Run: pnpm vitest:int
 *
 * Loads .env.local at config-evaluation time so DATABASE_URL is available
 * when vitest workers import the Prisma client module.
 */
function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    }
  } catch {
    // CI sets env vars externally
  }
  return env;
}

const localEnv = loadEnvLocal();

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.int.test.ts'],
    exclude: ['node_modules', '.next', 'e2e'],
    testTimeout: 30_000,
    reporters: ['default'],
    env: localEnv,
    // Sequential execution required: initiateBooking.int.test.ts has a global
    // notificationLog.deleteMany({}) afterEach that races with any concurrent test
    // that also creates NotificationLog rows. The integration DB is shared.
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // `server-only`/`client-only` are Next compiler markers, not resolvable
      // node packages — stub them so barrel-widened module graphs load under vitest.
      'server-only': resolve(__dirname, 'test/stubs/server-only.ts'),
      'client-only': resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
});
