/**
 * Integration tests for lib/account/forgotPassword.ts (Issue 008 AC1).
 *
 * Uses real DB — requires DATABASE_URL in env.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { hash as hashPassword } from '@/lib/auth';

vi.mock('@/lib/notification/esms', () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
}));

const TEST_EMAIL = 'forgot-pw-test@example.com';
let customerId: string;

beforeAll(async () => {
  const ph = await hashPassword('TestPass1!');
  const customer = await prisma.customer.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: ph,
      displayName: 'Test User FP',
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
});

describe('forgotPassword', () => {
  it('AC1: always returns ok=true for existing email', async () => {
    const { forgotPassword } = await import('../forgotPassword');
    const result = await forgotPassword(TEST_EMAIL);
    expect(result.ok).toBe(true);
  });

  it('AC1: always returns ok=true for non-existent email (no enumeration)', async () => {
    const { forgotPassword } = await import('../forgotPassword');
    const result = await forgotPassword('nonexistent@example.com');
    expect(result.ok).toBe(true);
  });

  it('AC1: sends OTP and creates an active OtpAttempt row for existing email', async () => {
    await prisma.otpAttempt.deleteMany({ where: { email: TEST_EMAIL } });
    const { forgotPassword } = await import('../forgotPassword');
    await forgotPassword(TEST_EMAIL);
    const active = await prisma.otpAttempt.count({
      where: { email: TEST_EMAIL, consumed: false },
    });
    expect(active).toBe(1);
  });
});
