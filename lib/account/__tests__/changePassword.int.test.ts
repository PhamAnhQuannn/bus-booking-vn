/**
 * Integration tests for lib/account/changePassword.ts (Issue 008 AC2).
 *
 * Uses real DB — requires DATABASE_URL in env.
 * PII-safe phone: +8490xxxxxx3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { hash as hashPassword } from '@/lib/auth';
import { changePassword, ChangePasswordError } from '../changePassword';

const TEST_PHONE = '+8490xxxxxx3';

let customerId: string;
let initialHash: string;

beforeAll(async () => {
  initialHash = await hashPassword('OldPass1!');
  const customer = await prisma.customer.create({
    data: {
      phone: TEST_PHONE,
      passwordHash: initialHash,
      displayName: 'Test User CP',
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } });
});

describe('changePassword', () => {
  it('AC2: changes password with correct current password', async () => {
    await expect(
      changePassword(customerId, 'OldPass1!', 'NewPass2@')
    ).resolves.not.toThrow();

    const updated = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { passwordHash: true },
    });
    expect(updated?.passwordHash).not.toBe(initialHash);
  });

  it('AC2: returns CURRENT_PASSWORD_WRONG when current password is wrong', async () => {
    // After above test, current password is NewPass2@
    await expect(
      changePassword(customerId, 'WrongPass1!', 'AnotherPass3#')
    ).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_WRONG' });
  });

  it('AC2: returns PASSWORD_REUSED when new password equals old', async () => {
    // Current password is NewPass2@
    await expect(
      changePassword(customerId, 'NewPass2@', 'NewPass2@')
    ).rejects.toMatchObject({ code: 'PASSWORD_REUSED' });
  });

  it('AC2: revokes all sessions on password change', async () => {
    // Create a session to verify it gets revoked
    await prisma.session.create({
      data: {
        customerId,
        refreshTokenHash: 'test-hash-cp-' + customerId,
        tokenFamily: 'test-family-cp',
        rotationCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    await changePassword(customerId, 'NewPass2@', 'FinalPass4$');

    const sessions = await prisma.session.findMany({
      where: { customerId, revokedAt: null },
    });
    expect(sessions.length).toBe(0);

    // Update to new password for subsequent tests
    const newHash = await hashPassword('FinalPass4$');
    await prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash: newHash },
    });
  });
});
