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
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
