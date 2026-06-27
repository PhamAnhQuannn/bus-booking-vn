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
    env: loadEnvLocal(),
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
