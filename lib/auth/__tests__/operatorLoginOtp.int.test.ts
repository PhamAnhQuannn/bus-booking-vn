/**
 * Integration tests for operator login OTP brute-force hardening (#792).
 *
 * Real DB — requires DATABASE_URL pointed at the local dev database (mirrors
 * lib/account/__tests__/lockout.int.test.ts). Proves the three source fixes:
 *   (i)   cross-resend cap — resend no longer zeroes attemptCount, so the 3-wrong-guess
 *         cap is per-account, not per-OTP-instance.
 *   (ii)  correct code on the 3rd try succeeds and does NOT leave the account locked out
 *         (success no longer increments attemptCount into the lockout-sentinel shape).
 *   (iii) under the FOR-UPDATE transaction a concurrent burst of wrong guesses ends at
 *         exactly the cap — attemptCount never overshoots MAX_VERIFY_FAILURES.
 *
 * The identifier (email) is stored in the OperatorOtpAttempt.phone column.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import {
  sendOperatorLoginOtp,
  verifyOperatorLoginOtp,
  MAX_VERIFY_FAILURES,
} from '../operatorLoginOtp';

const FIXED_CODE = '424242';
const WRONG_CODE = '000000';

// Keep notification side effects out of the DB-backed test.
vi.mock('@/lib/notification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notification')>()),
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  stashTestOtp: vi.fn(),
}));

// Fix the generated OTP so the "correct code" path is deterministic; keep the real
// salt generation + hashing so the stored codeHash verifies exactly as in production.
vi.mock('../otp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../otp')>()),
  generateCode: vi.fn(() => FIXED_CODE),
}));

const email = (n: number) => `op-login-otp-792-${n}@example.com`;
const TEST_EMAILS = [email(1), email(2), email(3)] as const;

async function latestRow(addr: string) {
  return prisma.operatorOtpAttempt.findFirst({
    where: { phone: addr },
    orderBy: { createdAt: 'desc' },
  });
}

beforeAll(async () => {
  await prisma.operatorOtpAttempt.deleteMany({ where: { phone: { in: [...TEST_EMAILS] } } });
});

afterAll(async () => {
  await prisma.operatorOtpAttempt.deleteMany({ where: { phone: { in: [...TEST_EMAILS] } } });
});

describe('operator login OTP brute-force hardening (#792)', () => {
  it('(i) cross-resend cap: 2 wrong + resend + 1 wrong = locked_out', async () => {
    const addr = email(1);
    await prisma.operatorOtpAttempt.deleteMany({ where: { phone: addr } });

    await sendOperatorLoginOtp(addr);

    // Two wrong guesses — count climbs to 2, still under the cap.
    expect((await verifyOperatorLoginOtp(addr, WRONG_CODE)).status).toBe('mismatch');
    expect((await verifyOperatorLoginOtp(addr, WRONG_CODE)).status).toBe('mismatch');

    // Resend. Pre-fix this reset attemptCount to 0; the fix carries it.
    await sendOperatorLoginOtp(addr);
    const afterResend = await latestRow(addr);
    expect(afterResend?.attemptCount).toBe(2);
    expect(afterResend?.consumed).toBe(false);

    // Third wrong guess across the resend trips the cap.
    expect((await verifyOperatorLoginOtp(addr, WRONG_CODE)).status).toBe('mismatch');

    // Now locked out for the window — even a correct code is refused.
    expect((await verifyOperatorLoginOtp(addr, FIXED_CODE)).status).toBe('locked_out');
  });

  it('(ii) correct code on the 3rd try succeeds and does not lock the account out', async () => {
    const addr = email(2);
    await prisma.operatorOtpAttempt.deleteMany({ where: { phone: addr } });

    await sendOperatorLoginOtp(addr);

    expect((await verifyOperatorLoginOtp(addr, WRONG_CODE)).status).toBe('mismatch');
    expect((await verifyOperatorLoginOtp(addr, WRONG_CODE)).status).toBe('mismatch');

    // Correct code on the 3rd attempt (pre-row count == 2) must succeed.
    expect((await verifyOperatorLoginOtp(addr, FIXED_CODE)).status).toBe('ok');

    // Success must NOT bump count to 3 — that would match the lockout sentinel.
    const consumedRow = await latestRow(addr);
    expect(consumedRow?.consumed).toBe(true);
    expect(consumedRow?.attemptCount).toBe(2);

    // No spurious lockout: a fresh send and verify both work.
    const resent = await sendOperatorLoginOtp(addr);
    expect(resent.ok).toBe(true);
    expect((await verifyOperatorLoginOtp(addr, FIXED_CODE)).status).toBe('ok');
  });

  it('(iii) concurrent wrong-guess burst ends at exactly the cap (FOR UPDATE)', async () => {
    const addr = email(3);
    await prisma.operatorOtpAttempt.deleteMany({ where: { phone: addr } });

    await sendOperatorLoginOtp(addr);

    // Fire more guesses than the cap at once. The FOR UPDATE on the gating row
    // serialises them so the counter cannot overshoot MAX_VERIFY_FAILURES.
    const burst = await Promise.all(
      Array.from({ length: MAX_VERIFY_FAILURES + 3 }, () =>
        verifyOperatorLoginOtp(addr, WRONG_CODE)
      )
    );

    expect(burst.every((r) => r.status !== 'ok')).toBe(true);

    const finalRow = await latestRow(addr);
    expect(finalRow?.attemptCount).toBe(MAX_VERIFY_FAILURES);
    expect(finalRow?.consumed).toBe(true);
  });
});
