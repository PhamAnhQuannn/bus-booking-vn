import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    // Integration tests (*.int.test.ts) require a live DB — run via `pnpm vitest:int`
    // or `pnpm test:all` (unit + int). Issue 007 AC4 race test lives in otp.int.test.ts.
    exclude: ['node_modules', '.next', 'e2e', '**/*.int.test.ts'],
    setupFiles: [],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
