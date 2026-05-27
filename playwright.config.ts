import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-390',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  // Serve the dev build (NODE_ENV=development) in CI as well as locally. The prod
  // server (`pnpm start`) sets Secure cookies (NODE_ENV=production); CI serves over
  // plain http://localhost and the mobile-390 project is WebKit, which drops Secure
  // cookies on http → bb_csrf/bb_hold never store → CSRF 403 on the hold POST.
  // Dev mode keeps cookies non-Secure so the browser booking flow works over http.
  // (ci.yml still runs `pnpm build` as a separate prerender/compile smoke check.)
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
