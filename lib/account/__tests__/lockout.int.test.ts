/**
 * Integration tests for customer OTP lockout (Issue 008 AC6).
 *
 * Parameterized for both reset-password and phone-change OTP flows.
 * Uses real DB — requires DATABASE_URL in env.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { hash as hashPassword } from '@/lib/auth';
import { generateCode, generateSalt, hashCode } from '@/lib/auth';
import {
  verifyCustomerAccountOtp,
  findCustomerLockoutSentinel,
  MAX_VERIFY_FAILURES,
} from '../customerOtp';

vi.mock('@/lib/notification/esms', () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
}));

const testEmail = (n: number) => `lockout-test-${n}@example.com`;
const TEST_EMAILS = [testEmail(1), testEmail(2)] as const;

beforeAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { email: { in: [...TEST_EMAILS] } } });
});

afterAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { email: { in: [...TEST_EMAILS] } } });
});

/**
 * Helper: insert an OTP row for an email with a known code.
 */
async function seedOtp(email: string): Promise<{ code: string; id: string }> {
  const { randomUUID } = await import('crypto');
  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpAttempt.deleteMany({ where: { email, consumed: false } });

  await prisma.$executeRaw`
    INSERT INTO "OtpAttempt" (id, email, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
    VALUES (${id}, ${email}, ${codeHash}, ${salt}, ${expiresAt}, false, 0, NOW())
  `;

  return { code, id };
}

describe.each([
  { label: 'reset-password flow', email: testEmail(1) },
  { label: 'phone-change flow', email: testEmail(2) },
])('AC6: 3-failure lockout [$label]', ({ email }) => {
  beforeAll(async () => {
    await prisma.otpAttempt.deleteMany({ where: { email } });
  });

  it('3 wrong attempts → locked_out on 3rd and subsequent verify', async () => {
    await seedOtp(email);

    for (let i = 0; i < MAX_VERIFY_FAILURES - 1; i++) {
      const r = await verifyCustomerAccountOtp(email, '000000');
      expect(r.status).toBe('mismatch');
    }

    const r3 = await verifyCustomerAccountOtp(email, '000000');
    expect(r3.status).toBe('mismatch');

    const sentinel = await findCustomerLockoutSentinel(email);
    expect(sentinel).not.toBeNull();
    expect(sentinel!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const r4 = await verifyCustomerAccountOtp(email, '000000');
    expect(r4.status).toBe('locked_out');
  });

  it('correct code after lockout still returns locked_out (not ok)', async () => {
    const { code } = await seedOtp(email);
    const result = await verifyCustomerAccountOtp(email, code);
    expect(result.status).toBe('locked_out');
  });
});
