/**
 * Integration test for P2 (#426) — delete->re-register email lockout fix.
 *
 * Requires the narrowed partial unique index `Customer_email_key`
 * (WHERE email IS NOT NULL AND deletedAt IS NULL) from migration
 * 20260806120000. Uses real DB — DATABASE_URL required.
 */

import crypto from 'crypto';
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { register, AuthServiceError } from '@/lib/auth';
import { deleteAccount } from '../anonymizeCustomer';

// Unique per run so parallel/repeat runs don't collide.
const REUSE_EMAIL = `p2-reuse-${crypto.randomBytes(4).toString('hex')}@test.dev`;
const DUP_EMAIL = `p2-dup-${crypto.randomBytes(4).toString('hex')}@test.dev`;
const createdIds: string[] = [];

afterAll(async () => {
  await prisma.session.deleteMany({ where: { customerId: { in: createdIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
});

describe('re-register after delete (P2)', () => {
  it('lets a customer register the same email again after deleting their account, as a NEW row', async () => {
    const first = await register({ email: REUSE_EMAIL, password: 'Password1!' });
    createdIds.push(first.customer.id);

    await deleteAccount(first.customer.id);

    // Same email, fresh signup — must succeed and produce a distinct Customer.
    const second = await register({ email: REUSE_EMAIL, password: 'Password2!' });
    createdIds.push(second.customer.id);

    expect(second.customer.id).not.toBe(first.customer.id);
    expect(second.customer.email).toBe(REUSE_EMAIL);

    // The deleted row is untouched (soft-deleted, still holds the email).
    const oldRow = await prisma.customer.findUnique({ where: { id: first.customer.id } });
    expect(oldRow?.deletedAt).toBeInstanceOf(Date);
  });

  it('still rejects a duplicate email for an ACTIVE (non-deleted) customer', async () => {
    const active = await register({ email: DUP_EMAIL, password: 'Password1!' });
    createdIds.push(active.customer.id);

    await expect(register({ email: DUP_EMAIL, password: 'Password2!' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
    // sanity: the thrown error is the typed AuthServiceError
    await expect(register({ email: DUP_EMAIL, password: 'Password2!' })).rejects.toBeInstanceOf(
      AuthServiceError
    );
  });
});
