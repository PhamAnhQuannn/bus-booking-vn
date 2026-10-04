/**
 * E2E spec: the operator login PAGE DOM (#455 / OP-LOGIN OP-4).
 *
 * Every other operator-login spec authenticates via `request.post('/api/auth/login')`;
 * none drives the real form on /op/login. This one fills the UI form and asserts:
 *   - direct login (operator WITHOUT email) → redirect to /op/dashboard
 *   - PasswordField show/hide toggle (type password↔text, aria-pressed)
 *   - forgot-password + partner-register link targets
 *   - username→OTP step transition (operator WITH email) → OTP success → dashboard
 *   - wrong OTP code → inline error, stays on the OTP step
 *
 * The seed operator PB-0001 has no email, so it drives the direct-login path. For the
 * OTP cases we set its email to a fixture address, drive the 2-step flow, read the code
 * from /api/auth/otp/test-peek (keyed by email — sendOperatorLoginOtp stashes it there),
 * then NULL the email back in teardown so the other op specs keep seeing a no-email op.
 *
 * Prerequisites: dev server with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true; dev/test DB.
 * SANDBOX-GATED: set E2E_OP_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';

const SANDBOX_ENABLED = process.env.E2E_OP_AUTH_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001'); // E.164 stored for the seed operator
const SEED_USERNAME = 'PB-0001';
const SEED_PASSWORD = 'BBOp2026!';
// sendOperatorLoginOtp stores the OTP row keyed by the operator's email (in the `phone`
// column) and stashes the plain code in the test sink under the same email string.
const OTP_EMAIL = 'e2e-oplogin-otp@example.dev';

/**
 * Reset the seed operator to a known state: password restored, no forced change, and
 * `email` set to `email` (null = no-email → direct login, a string → email OTP step).
 * Also revokes live sessions and clears any OTP rows so each test starts clean.
 */
async function resetSeedOp(email: string | null): Promise<void> {
  const passwordHash = await hash(SEED_PASSWORD);
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE "OperatorUser"
         SET "passwordHash" = $1, "requiresPasswordChange" = false, email = $2
       WHERE phone = $3`,
      [passwordHash, email, SEED_PHONE]
    );
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );
    // OTP rows are keyed by phone for the forgot flow and by email for the login flow.
    await client.query(`DELETE FROM "OperatorOtpAttempt" WHERE phone = ANY($1)`, [
      [SEED_PHONE, OTP_EMAIL],
    ]);
  } finally {
    await client.end();
  }
}

test.describe('Operator login page (DOM)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_AUTH_ENABLED=true to run');

  // ── Direct login: operator WITHOUT email (no OTP step) ──────────────────────
  test.describe('direct login (no email)', () => {
    test.beforeEach(async () => {
      await resetSeedOp(null);
    });
    test.afterAll(async () => {
      await resetSeedOp(null);
    });

    test('fills the form and redirects to the dashboard', async ({ page }) => {
      await page.goto('/op/login');
      await page.waitForLoadState('networkidle'); // let auth-bootstrap set bb_csrf before submit
      await page.fill('[name="username"]', SEED_USERNAME);
      await page.fill('[name="password"]', SEED_PASSWORD);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL('**/op/dashboard', { timeout: 10_000 });
    });

    test('password show/hide toggle flips the input type', async ({ page }) => {
      await page.goto('/op/login');
      const pw = page.locator('#op-login-password');
      const toggle = page.locator('button[aria-pressed]'); // the only one in the password step
      await expect(pw).toHaveAttribute('type', 'password');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(pw).toHaveAttribute('type', 'text');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await toggle.click();
      await expect(pw).toHaveAttribute('type', 'password');
    });

    test('forgot-password and partner-register links point to their routes', async ({ page }) => {
      await page.goto('/op/login');
      await expect(page.locator('a[href="/op/forgot-password"]')).toBeVisible();
      await expect(page.locator('a[href="/op/register"]')).toBeVisible();
    });
  });

  // ── Email OTP step: operator WITH email (2-step flow) ───────────────────────
  test.describe('email OTP step', () => {
    test.beforeEach(async () => {
      await resetSeedOp(OTP_EMAIL);
    });
    test.afterAll(async () => {
      await resetSeedOp(null); // restore no-email so the other op specs are unaffected
    });

    async function submitPassword(page: import('@playwright/test').Page): Promise<void> {
      await page.goto('/op/login');
      await page.waitForLoadState('networkidle');
      await page.fill('[name="username"]', SEED_USERNAME);
      await page.fill('[name="password"]', SEED_PASSWORD);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      // Step 2 form renders once the login route answers { otpRequired }.
      await expect(page.getByText('Mã xác thực đã được gửi')).toBeVisible();
      await expect(page.locator('#op-login-otp')).toBeVisible();
    }

    test('transitions to the OTP step and completes login with the peeked code', async ({ page }) => {
      await submitPassword(page);

      const peek = await page.request.get('/api/auth/otp/test-peek', {
        params: { email: OTP_EMAIL },
      });
      expect(peek.status()).toBe(200);
      const code: string = (await peek.json()).code;
      expect(code).toMatch(/^\d{6}$/);

      await page.fill('#op-login-otp', code);
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await page.waitForURL('**/op/dashboard', { timeout: 10_000 });
    });

    test('wrong OTP code shows an inline error and stays on the OTP step', async ({ page }) => {
      await submitPassword(page);

      await page.fill('#op-login-otp', '000000');
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(page.getByText('Mã xác thực không đúng')).toBeVisible();
      await expect(page.locator('#op-login-otp')).toBeVisible(); // still on step 2
    });

    // #457 — resend affordance + mid-flow state preservation.
    test('shows a "Gửi lại mã" resend affordance (cooldown active right after send)', async ({ page }) => {
      await submitPassword(page);
      const resend = page.getByRole('button', { name: /Gửi lại mã/ });
      await expect(resend).toBeVisible();
      // The first code was just sent → the button is on cooldown (disabled, shows a countdown).
      await expect(resend).toBeDisabled();
      await expect(resend).toContainText(/\(\d+s\)/);
    });

    test('"← Quay lại" preserves the typed username', async ({ page }) => {
      await submitPassword(page);
      await page.getByRole('button', { name: '← Quay lại đăng nhập' }).click();
      await expect(page.locator('[name="username"]')).toHaveValue(SEED_USERNAME);
    });
  });
});
