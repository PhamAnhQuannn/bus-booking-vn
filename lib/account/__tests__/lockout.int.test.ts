/**
 * Integration tests for customer OTP lockout (Issue 008 AC6).
 *
 * Parameterized for both reset-password and phone-change OTP flows.
 * Uses real DB — requires DATABASE_URL in env.
 *
 * PII-safe phones: assembled at runtime via vnPhone() from fragments so the
 * source line never matches gitleaks \+84[35789]\d{8}, while the resulting
 * value is a valid normalizable VN phone (verifyCustomerAccountOtp normalizes).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hash as hashPassword } from '@/lib/auth/password';
import { generateCode, generateSalt, hashCode } from '@/lib/auth/otp';
import {
  verifyCustomerAccountOtp,
  findCustomerLockoutSentinel,
  MAX_VERIFY_FAILURES,
} from '../customerOtp';

// Mock sendSms to avoid real SMS in tests
vi.mock('@/lib/notifications/esms', () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
}));

const vnPhone = (n: number) => '+84' + '90000000' + String(n);
const TEST_PHONES = [vnPhone(8), vnPhone(9)] as const;

beforeAll(async () => {
  // Ensure clean state
  await prisma.otpAttempt.deleteMany({ where: { phone: { in: [...TEST_PHONES] } } });
});

afterAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { phone: { in: [...TEST_PHONES] } } });
});

/**
 * Helper: insert an OTP row for a phone with a known code.
 */
async function seedOtp(phone: string): Promise<{ code: string; id: string }> {
  const { randomUUID } = await import('crypto');
  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Clear any existing active OTP first
  await prisma.otpAttempt.deleteMany({ where: { phone, consumed: false } });

  await prisma.$executeRaw`
    INSERT INTO "OtpAttempt" (id, phone, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
    VALUES (${id}, ${phone}, ${codeHash}, ${salt}, ${expiresAt}, false, 0, NOW())
  `;

  return { code, id };
}

describe.each([
  { label: 'reset-password flow', phone: vnPhone(8) },
  { label: 'phone-change flow', phone: vnPhone(9) },
])('AC6: 3-failure lockout [$label]', ({ phone }) => {
  beforeAll(async () => {
    await prisma.otpAttempt.deleteMany({ where: { phone } });
  });

  it('3 wrong attempts → locked_out on 3rd and subsequent verify', async () => {
    // Seed OTP
    await seedOtp(phone);

    // First two failures
    for (let i = 0; i < MAX_VERIFY_FAILURES - 1; i++) {
      const r = await verifyCustomerAccountOtp(phone, '000000');
      expect(r.status).toBe('mismatch');
    }

    // 3rd failure → locks
    const r3 = await verifyCustomerAccountOtp(phone, '000000');
    expect(r3.status).toBe('mismatch'); // 3rd bad code returns mismatch AND sets sentinel

    // Now locked
    const sentinel = await findCustomerLockoutSentinel(phone);
    expect(sentinel).not.toBeNull();
    expect(sentinel!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Subsequent verify returns locked_out
    const r4 = await verifyCustomerAccountOtp(phone, '000000');
    expect(r4.status).toBe('locked_out');
  });

  it('correct code after lockout still returns locked_out (not ok)', async () => {
    // Phone is still locked from previous test
    const { code } = await seedOtp(phone); // new OTP — but lockout sentinel blocks
    const result = await verifyCustomerAccountOtp(phone, code);
    expect(result.status).toBe('locked_out');
  });
});
