/**
 * Integration tests for resolveGoogleLogin (DS-033 §3) against a real DB.
 * Requires the Account migration (20260807000000) applied. Emails under @example.test.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { resolveGoogleLogin } from '../linkGoogleAccount';

const createdCustomerIds = new Set<string>();
const createdSubs = new Set<string>();

afterEach(async () => {
  await prisma.account.deleteMany({ where: { providerAccountId: { in: [...createdSubs] } } });
  await prisma.customer.deleteMany({ where: { id: { in: [...createdCustomerIds] } } });
  createdCustomerIds.clear();
  createdSubs.clear();
});

describe('resolveGoogleLogin (int, DS-033)', () => {
  it('L3 creates customer+account; a 2nd login with the same sub does not duplicate', async () => {
    const email = 'g-l3@example.test';
    const sub = 'int-sub-l3';
    createdSubs.add(sub);

    const first = await resolveGoogleLogin({ sub, email, emailVerified: true });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdCustomerIds.add(first.customerId);
    expect(first.created).toBe(true);

    const customer = await prisma.customer.findUnique({ where: { id: first.customerId } });
    expect(customer?.email).toBe(email);
    expect(customer?.passwordHash).toBeNull();
    expect(customer?.emailVerifiedAt).not.toBeNull();

    const acct = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
    });
    expect(acct?.customerId).toBe(first.customerId);

    const second = await resolveGoogleLogin({ sub, email, emailVerified: true });
    expect(second).toEqual({ ok: true, customerId: first.customerId, created: false });
    expect(await prisma.customer.count({ where: { email } })).toBe(1);
  });

  it('L2 links a verified Google email (case-insensitive) to an existing customer, no dup', async () => {
    const email = 'g-l2@example.test';
    const sub = 'int-sub-l2';
    createdSubs.add(sub);
    const existing = await prisma.customer.create({
      data: { email, passwordHash: 'scrypt$x$y', emailVerifiedAt: null },
    });
    createdCustomerIds.add(existing.id);

    const res = await resolveGoogleLogin({ sub, email: 'G-L2@Example.TEST', emailVerified: true });
    expect(res).toEqual({ ok: true, customerId: existing.id, created: false });

    const acct = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
    });
    expect(acct?.customerId).toBe(existing.id);
    const c = await prisma.customer.findUnique({ where: { id: existing.id } });
    expect(c?.emailVerifiedAt).not.toBeNull();
    expect(await prisma.customer.count({ where: { email } })).toBe(1);
  });

  it("L2' refuses an unverified Google email against an existing account (no takeover)", async () => {
    const email = 'g-l2p@example.test';
    const sub = 'int-sub-l2p';
    createdSubs.add(sub);
    const existing = await prisma.customer.create({ data: { email, passwordHash: 'scrypt$x$y' } });
    createdCustomerIds.add(existing.id);

    const res = await resolveGoogleLogin({ sub, email, emailVerified: false });
    expect(res).toEqual({ ok: false, reason: 'email_conflict' });
    const acct = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
    });
    expect(acct).toBeNull();
  });

  it('rejects a deleted customer whose Google sub is already linked (inactive)', async () => {
    const email = 'g-del@example.test';
    const sub = 'int-sub-del';
    createdSubs.add(sub);
    const c = await prisma.customer.create({
      data: {
        email,
        passwordHash: null,
        emailVerifiedAt: new Date(),
        deletedAt: new Date(),
        accounts: { create: { provider: 'google', providerAccountId: sub, email } },
      },
    });
    createdCustomerIds.add(c.id);

    const res = await resolveGoogleLogin({ sub, email, emailVerified: true });
    expect(res).toEqual({ ok: false, reason: 'inactive' });
  });
});
