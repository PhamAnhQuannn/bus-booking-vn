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
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default'],
    // #374: Vitest's 5s default is not enough for the FIRST test in a file that pays a
    // heavy module-init cost under parallel load — chiefly @react-pdf/renderer in the
    // ticket-PDF suites. The tell is that only the first test in each file fails, at
    // ~6s, while its siblings pass in single-digit milliseconds, and all of them pass in
    // isolation at ~2.6s. Nothing hangs; the work simply does not fit a 5s budget on a
    // cold graph. The integration config already sets 30s for the same reason.
    //
    // A timeout is the honest lever here. Retries would paper over a real slowdown, and
    // a suite that flakes is worse than a slow one: it trains everyone to re-run red and
    // it makes every gate in a change series untrustworthy.
    // 30s, matching vitest.integration.config.ts, not the 15s first proposed: the
    // react-pdf render was measured at 10.6s under full-suite parallel load, so 15s left
    // ~40% headroom on a machine that visibly varies run to run. A ceiling that a healthy
    // test can brush against is just a slower flake.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'app/**/*.{ts,tsx,js,jsx}',
        'components/**/*.{ts,tsx,js,jsx}',
        'lib/**/*.{ts,tsx,js,jsx}',
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.md',
        '.next/**',
        'e2e/**',
        'test/**',
      ],
      thresholds: {
        statements: 40,
        branches: 32,
        functions: 34,
        lines: 40,
      },
    },
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
