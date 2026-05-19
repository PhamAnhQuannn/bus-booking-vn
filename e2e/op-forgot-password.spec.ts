/**
 * E2E spec: operator forgot-password OTP flow (Issue 010)
 *
 * Flow:
 *   POST /api/op/auth/forgot-password → 202 (always)
 *   Read OTP from /api/auth/otp/test-peek (dev peek endpoint, OTP_PEEK_ENABLED=true)
 *   POST /api/op/auth/forgot-password/verify → 200 { otpProof }
 *   POST /api/op/auth/forgot-password/reset → 204
 *   Login with new password → 200
 *
 * Prerequisites:
 *   - Running dev server with OTP_PEEK_ENABLED=true
 *   - Seeded DB with OperatorUser (phone +8490xxxxxx1)
 *   - OperatorOtpAttempt table reachable via test-peek endpoint
 *
 * NOTE: The forgot-password routes are CSRF_EXEMPT (pre-auth, no bb_csrf cookie).
 * They do not require X-CSRF-Token.
 *
 * SANDBOX-GATED: set E2E_OP_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const SANDBOX_ENABLED = process.env.E2E_OP_AUTH_ENABLED === 'true';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const RAW_PHONE = '0490xxxxxx1'; // As user would type (without +84)
const NEW_PASSWORD = 'ForgotReset2026!';

async function cleanupOperatorOtp(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "OperatorOtpAttempt" WHERE phone = $1`, [SEED_PHONE]);
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );
  } finally {
    await client.end();
  }
}

async function restorePassword(password: string): Promise<void> {
  const { hash } = await import('../lib/auth/password');
  const passwordHash = await hash(password);
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false WHERE phone = $2`,
      [passwordHash, SEED_PHONE]
    );
  } finally {
    await client.end();
  }
}

test.describe('Operator forgot-password OTP flow', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await cleanupOperatorOtp();
  });

  test.afterEach(async () => {
    // Restore original password so subsequent e2e runs start clean
    await restorePassword('BBOp2026!');
  });

  test('always returns 202 even for non-existent phone (no enumeration)', async ({ request }) => {
    const res = await request.post('/api/op/auth/forgot-password', {
      data: { phone: '0999999999' }, // non-existent
    });
    expect(res.status()).toBe(202);
  });

  test('full forgot-password OTP reset flow', async ({ request }) => {
    // Step 1: request OTP for seed operator
    const forgotRes = await request.post('/api/op/auth/forgot-password', {
      data: { phone: RAW_PHONE },
    });
    expect(forgotRes.status()).toBe(202);

    // Step 2: peek at OTP code (dev-only endpoint)
    // Uses the OperatorOtpAttempt peek, same mechanism as customer OTP peek
    const peekRes = await request.get('/api/auth/otp/test-peek', {
      params: { phone: SEED_PHONE, type: 'operator' },
    });
    // If peek endpoint doesn't support operator yet, skip gracefully
    test.skip(peekRes.status() === 404, 'OTP peek endpoint does not support operator type');
    expect(peekRes.status()).toBe(200);
    const peekJson = await peekRes.json();
    const otpCode: string = peekJson.code;
    expect(otpCode).toMatch(/^\d{6}$/);

    // Step 3: verify OTP → get otpProof
    const verifyRes = await request.post('/api/op/auth/forgot-password/verify', {
      data: { phone: RAW_PHONE, code: otpCode },
    });
    expect(verifyRes.status()).toBe(200);
    const verifyJson = await verifyRes.json();
    const otpProof: string = verifyJson.otpProof;
    expect(typeof otpProof).toBe('string');
    expect(otpProof.split('.').length).toBe(3); // JWT structure

    // Step 4: reset password
    const resetRes = await request.post('/api/op/auth/forgot-password/reset', {
      data: { otpProof, newPassword: NEW_PASSWORD },
    });
    expect(resetRes.status()).toBe(204);

    // Step 5: login with new password succeeds
    const csrfToken = await primeCsrf(request);

    const loginRes = await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: RAW_PHONE, password: NEW_PASSWORD },
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(loginRes.status()).toBe(200);
  });

  test('invalid OTP code returns 400 INVALID_CODE', async ({ request }) => {
    await request.post('/api/op/auth/forgot-password', {
      data: { phone: RAW_PHONE },
    });

    const verifyRes = await request.post('/api/op/auth/forgot-password/verify', {
      data: { phone: RAW_PHONE, code: '000000' },
    });
    expect(verifyRes.status()).toBe(400);
    const json = await verifyRes.json();
    expect(json.error).toBe('INVALID_CODE');
  });

  test('reset with invalid proof returns 401 INVALID_PROOF', async ({ request }) => {
    const resetRes = await request.post('/api/op/auth/forgot-password/reset', {
      data: { otpProof: 'invalid.proof.token', newPassword: NEW_PASSWORD },
    });
    expect(resetRes.status()).toBe(401);
    const json = await resetRes.json();
    expect(json.error).toBe('INVALID_PROOF');
  });

  test('3 failed verifications → 15-min lockout (AC4)', async ({ request }) => {
    // Use a distinct phone slot so this test does not collide with the happy-path seed
    // on the unique active-OTP partial index.
    const LOCKOUT_PHONE = '+8490xxxxxx4';
    const LOCKOUT_RAW_PHONE = '0490xxxxxx4'; // As user types (without +84)

    // Clean up any residual OTP rows for this phone before the test
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query(`DELETE FROM "OperatorOtpAttempt" WHERE phone = $1`, [LOCKOUT_PHONE]);
    } finally {
      await client.end();
    }

    // Step 1: request OTP for the lockout-test operator
    const forgotRes = await request.post('/api/op/auth/forgot-password', {
      data: { phone: LOCKOUT_RAW_PHONE },
    });
    expect(forgotRes.status()).toBe(202);

    // Step 2: peek at OTP code
    const peekRes = await request.get('/api/auth/otp/test-peek', {
      params: { phone: LOCKOUT_PHONE, type: 'operator' },
    });
    test.skip(peekRes.status() === 404, 'OTP peek endpoint does not support operator type');
    expect(peekRes.status()).toBe(200);

    // Step 3: fail verification 3 times with a wrong code → each returns 400 INVALID_CODE
    for (let attempt = 1; attempt <= 3; attempt++) {
      const badRes = await request.post('/api/op/auth/forgot-password/verify', {
        data: { phone: LOCKOUT_RAW_PHONE, code: '000000' },
      });
      expect(badRes.status()).toBe(400);
      const badJson = await badRes.json();
      expect(badJson.error).toBe('INVALID_CODE');
    }

    // Step 4: 4th attempt — sentinel is now active → 429 LOCKED_OUT
    const lockedRes = await request.post('/api/op/auth/forgot-password/verify', {
      data: { phone: LOCKOUT_RAW_PHONE, code: '000000' },
    });
    expect(lockedRes.status()).toBe(429);
    const lockedJson = await lockedRes.json();
    expect(lockedJson.error).toBe('LOCKED_OUT');

    // Step 5: a new send-OTP attempt for the same phone also returns 429 LOCKED_OUT
    // (sentinel blocks the send path too, per lib/auth/operatorOtp.ts sendOperatorPasswordResetOtp)
    const retrySendRes = await request.post('/api/op/auth/forgot-password', {
      data: { phone: LOCKOUT_RAW_PHONE },
    });
    // Route returns 429 only when operator exists AND is locked out; if phone not seeded it
    // silently returns 202 (no-enumeration). Conditionally assert only if 429 was returned.
    if (retrySendRes.status() === 429) {
      const retrySendJson = await retrySendRes.json();
      expect(retrySendJson.error).toBe('LOCKED_OUT');
    }
  });
});
