/**
 * Integration tests for lib/account/forgotPassword.ts (Issue 008 AC1).
 *
 * Uses real DB — requires DATABASE_URL in env.
 * PII-safe phone: +8490xxxxxx6
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hash as hashPassword } from '@/lib/auth/password';

// Mock sendSms to avoid real SMS in tests
vi.mock('@/lib/notifications/esms', () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
}));

const TEST_PHONE = '+8490xxxxxx6';
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
    const result = await forgotPassword('+8490xxxxxx7');
    expect(result.ok).toBe(true);
  });

  it('AC1: sends OTP and creates OtpAttempt row for existing phone', async () => {
    const before = await prisma.otpAttempt.count({ where: { phone: TEST_PHONE } });
    const { forgotPassword } = await import('../forgotPassword');
    await forgotPassword(TEST_PHONE);
    const after = await prisma.otpAttempt.count({ where: { phone: TEST_PHONE } });
    expect(after).toBeGreaterThan(before);
  });
});
