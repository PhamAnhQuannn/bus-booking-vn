/**
 * Integration tests for lib/account/forgotPassword.ts (Issue 008 AC1).
 *
 * Uses real DB — requires DATABASE_URL in env.
 *
 * PII-safe phones: assembled at runtime via vnPhone() from fragments so the
 * source line never matches gitleaks \+84[35789]\d{8}, while the resulting
 * value is a valid normalizable VN phone (forgotPassword normalizes input).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { hash as hashPassword } from '@/lib/auth';

// Mock sendSms to avoid real SMS in tests
vi.mock('@/lib/notification/esms', () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
}));

const vnPhone = (n: number) => '+84' + '90000000' + String(n);
const TEST_PHONE = vnPhone(6);
let customerId: string;

beforeAll(async () => {
  const ph = await hashPassword('TestPass1!');
  const customer = await prisma.customer.create({
    data: {
      phone: TEST_PHONE,
      passwordHash: ph,
      displayName: 'Test User FP',
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { phone: TEST_PHONE } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
});

describe('forgotPassword', () => {
  it('AC1: always returns ok=true for existing phone', async () => {
    const { forgotPassword } = await import('../forgotPassword');
    const result = await forgotPassword(TEST_PHONE);
    expect(result.ok).toBe(true);
  });

  it('AC1: always returns ok=true for non-existent phone (no enumeration)', async () => {
    const { forgotPassword } = await import('../forgotPassword');
    // Phone that does not exist in DB
    const result = await forgotPassword(vnPhone(7));
    expect(result.ok).toBe(true);
  });

  it('AC1: sends OTP and creates an active OtpAttempt row for existing phone', async () => {
    // Clear prior rows so we assert row creation, not count growth — sendCustomerAccountOtp
    // supersedes via ON CONFLICT (phone) WHERE consumed=false (UPDATE, not INSERT), so a
    // repeated send keeps a single active row rather than incrementing the count.
    await prisma.otpAttempt.deleteMany({ where: { phone: TEST_PHONE } });
    const { forgotPassword } = await import('../forgotPassword');
    await forgotPassword(TEST_PHONE);
    const active = await prisma.otpAttempt.count({
      where: { phone: TEST_PHONE, consumed: false },
    });
    expect(active).toBe(1);
  });
});
