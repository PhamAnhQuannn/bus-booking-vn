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
    // next-intl ships ESM that bare-imports `next/server` / `next/navigation`. Under pnpm's
    // nested layout vitest's default (externalized) resolution looks for those inside
    // next-intl's own node_modules and fails ("Cannot find module …/next-intl/…/next/server").
    // Inlining next-intl makes vite process it and resolve next/* against the root node_modules.
    server: { deps: { inline: [/next-intl/] } },
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
        // trip-planner ships in the same app (imported via @/trip-planner/*) — incl. the
        // default production LLM adapter — but was invisible to the coverage gate until now.
        'trip-planner/**/*.{ts,tsx,js,jsx}',
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
        // Per-directory coverage lock (C2, #778) — money/PII domains must not silently
        // lose coverage. Vitest per-glob thresholds; set at/just below measured today
        // (`pnpm test:cov`) so they pass now and only fail on a regression.
        //   lib/einvoice — e-invoice issuance (money): measured 100/100/100/100.
        //   lib/audit    — admin audit log + PII phone redaction: measured 100/100/100/100
        //                  (tiny dir: 5 stmts, so thresholds leave 1-line headroom).
        'lib/einvoice/**': { statements: 95, branches: 90, functions: 90, lines: 95 },
        'lib/audit/**': { statements: 80, branches: 75, functions: 80, lines: 80 },
        // lib/reports currently has ZERO test coverage (0/46 stmts) — the lock is a 0 floor
        // that documents the gap and enumerates the dir; it becomes a real ratchet once
        // tests land. FOLLOW-UP (#778): add tests for getBusPerformance / getOperatorKpis.
        'lib/reports/**': { statements: 0, branches: 0, functions: 0, lines: 0 },
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
