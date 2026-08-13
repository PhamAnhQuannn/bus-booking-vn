/**
 * E2E spec: customer login lockout (the previously-uncovered credential-lockout path).
 *
 * customerLoginLockout (lib/ratelimit): 5 consecutive INVALID_CREDENTIALS within 15 min on the
 * SAME email → the 6th attempt returns 429 LOCKED_OUT, and the account stays locked even for the
 * CORRECT password until the window elapses. This complements auth-otp-roundtrip.spec.ts, which
 * never exercises the lockout, and op-forgot-password.spec.ts, which only covers the OTP-verify
 * lockout — customer credential lockout on /api/auth/login had no coverage.
 *
 * Prerequisites (same as auth-otp-roundtrip):
 *   - Running dev server with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true (OTP lands in the peek sink).
 *   - REDIS_PROVIDER=memory (default) so the in-process fixed-window lockout is deterministic.
 *   - DATABASE_URL pointed at the dev/test DB.
 *
 * SANDBOX-GATED: set E2E_AUTH_ENABLED=true to run.
 *
 * NOTE: keeps total login attempts ≤ 8 to stay under the separate 10/min IP throttle
 * (customerLoginRatelimit) whose 429 carries RATE_LIMITED, a DIFFERENT code than LOCKED_OUT.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const SANDBOX_ENABLED = process.env.E2E_AUTH_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Unique email per run so the per-email lockout key never collides across runs.
const TEST_EMAIL = `e2e-lockout-${Date.now()}@example.dev`;
const TEST_PASSWORD = 'Password1Test';

async function cleanupEmail(email: string): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "OtpAttempt" WHERE email = $1`, [email]);
    await client.query(
      `DELETE FROM "Session" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE email = $1)`,
      [email]
    );
    await client.query(`DELETE FROM "Customer" WHERE email = $1`, [email]);
  } finally {
    await client.end();
  }
}

function getCsrf(cookies: Array<{ name: string; value: string }>): string {
  return cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
}

test.describe('Customer login lockout', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await cleanupEmail(TEST_EMAIL);
  });
  test.afterEach(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  test('5 wrong passwords → 6th returns 429 LOCKED_OUT; correct password still succeeds', async ({
    page,
    context,
  }) => {
    // ---- 0. CSRF cookie ----
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    expect(csrf).toBeTruthy();

    const post = (path: string, body: unknown) =>
      page.evaluate(
        async ([p, b, token, base]) => {
          const r = await fetch(`${base}${p}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token as string },
            body: JSON.stringify(b),
            credentials: 'include',
          });
          let json: Record<string, unknown> = {};
          try { json = await r.json(); } catch { /* no body */ }
          return { status: r.status, error: json.error as string | undefined };
        },
        [path, body, csrf, BASE_URL] as const
      );

    // ---- 1. Register a customer via the email OTP flow ----
    const send = await post('/api/auth/otp/send', { email: TEST_EMAIL });
    expect(send.status).toBe(200);

    const peek = await page.evaluate(
      async ([email, base]) => {
        const r = await fetch(`${base}/api/auth/otp/test-peek?email=${encodeURIComponent(email as string)}`, {
          credentials: 'include',
        });
        return (await r.json()) as { code: string };
      },
      [TEST_EMAIL, BASE_URL] as const
    );
    expect(peek.code).toMatch(/^[0-9]{6}$/);

    const verify = await page.evaluate(
      async ([email, code, token, base]) => {
        const r = await fetch(`${base}/api/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token as string },
          body: JSON.stringify({ email, code }),
          credentials: 'include',
        });
        return (await r.json()) as { otpProof: string };
      },
      [TEST_EMAIL, peek.code, csrf, BASE_URL] as const
    );
    expect(typeof verify.otpProof).toBe('string');

    const register = await post('/api/auth/register', {
      email: TEST_EMAIL,
      otpProof: verify.otpProof,
      password: TEST_PASSWORD,
      acceptTerms: true, // #472: register now requires explicit consent.
    });
    expect(register.status).toBe(201);

    // ---- 2. Five wrong-password attempts → 401 invalid_credentials each ----
    for (let i = 1; i <= 5; i++) {
      const attempt = await post('/api/auth/login', { email: TEST_EMAIL, password: 'WrongPass' + i });
      expect(attempt.status, `attempt ${i} should be 401`).toBe(401);
      expect(attempt.error).toBe('invalid_credentials');
    }

    // ---- 3. Sixth attempt → 429 LOCKED_OUT ----
    const locked = await post('/api/auth/login', { email: TEST_EMAIL, password: 'WrongPass6' });
    expect(locked.status).toBe(429);
    expect(locked.error).toBe('LOCKED_OUT');

    // ---- 4. The lockout throttles the FAILING path only: the counter is consumed solely on
    // INVALID_CREDENTIALS, so a subsequent CORRECT password is still accepted (200) even while
    // wrong attempts are being rejected with 429. This documents that the customer login
    // "lockout" mitigates online password guessing but is NOT an account freeze — a legitimate
    // user with the right password is never locked out. (See docs/qa/auth-mcp-run — finding F3.)
    const correctWhileLocked = await post('/api/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(correctWhileLocked.status).toBe(200);
  });
});
