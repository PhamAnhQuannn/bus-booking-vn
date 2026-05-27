/**
 * Integration tests for lib/account/anonymizeCustomer.ts (Issue 008 AC5).
 *
 * Uses real DB — requires DATABASE_URL in env.
 * PII-safe phone: +8490xxxxxx4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hash as hashPassword } from '@/lib/auth/password';
import { deleteAccount } from '../anonymizeCustomer';

const TEST_PHONE = '+8490xxxxxx4';

let customerId: string;

beforeAll(async () => {
  const ph = await hashPassword('TestPass1!');
  const customer = await prisma.customer.create({
    data: {
      phone: TEST_PHONE,
      passwordHash: ph,
      displayName: 'Test User Del',
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  // Clean up — note phone is NULL after delete, so find by id
  await prisma.session.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
});

describe('deleteAccount', () => {
  it('AC5: sets deletedAt, anonymizedAt, nullifies phone', async () => {
    const result = await deleteAccount(customerId);
    expect(result.alreadyDeleted).toBe(false);
    expect(result.customer.deletedAt).toBeInstanceOf(Date);
    expect(result.customer.anonymizedAt).toBeInstanceOf(Date);
    expect(result.customer.phone).toBeNull();
  });

  it('AC5: idempotent — second call returns alreadyDeleted=true with 200', async () => {
    const result = await deleteAccount(customerId);
    expect(result.alreadyDeleted).toBe(true);
  });

  it('AC5: revokes all sessions on delete', async () => {
    // Create new customer to test session revocation
    const ph2 = await hashPassword('TestPass2!');
    const c2 = await prisma.customer.create({
      data: {
        phone: '+8490xxxxxx5',
        passwordHash: ph2,
        displayName: 'Test User Del2',
      },
    });

    await prisma.session.create({
      data: {
        customerId: c2.id,
        refreshTokenHash: 'anon-test-hash-' + c2.id,
        tokenFamily: 'anon-test-family',
        rotationCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    await deleteAccount(c2.id);

    const sessions = await prisma.session.findMany({
      where: { customerId: c2.id, revokedAt: null },
    });
    expect(sessions.length).toBe(0);

    // Cleanup
    await prisma.session.deleteMany({ where: { customerId: c2.id } });
    await prisma.customer.delete({ where: { id: c2.id } }).catch(() => {});
  });
});
