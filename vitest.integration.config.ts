import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { loadEnvLocal } from './test/loadEnvLocal';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.int.test.ts'],
    exclude: ['node_modules', '.next', 'e2e'],
    testTimeout: 30_000,
    reporters: ['default'],
    // DATABASE_POOL_MAX must be >1 here and the default is now 1 (#301: correct for
    // Vercel, where Neon's pooler handles cross-invocation concurrency and each warm
    // instance needs one physical connection). Integration tests are the opposite shape:
    // one process drives genuinely concurrent transactions — Promise.all fan-out, the
    // 20-parallel oversell race, SKIP LOCKED and advisory-lock contention. At max:1 those
    // deadlock against themselves and surface as "Unable to start a transaction in the
    // given time", which reads like a code bug and is not one.
    //
    // Set here rather than left to each developer's .env.local so `pnpm vitest:int`
    // is self-sufficient; CI sets the same value explicitly in its job env.
    // `loadEnvLocal()` comes second so a deliberate local override still wins.
    env: { DATABASE_POOL_MAX: '5', ...loadEnvLocal() },
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
