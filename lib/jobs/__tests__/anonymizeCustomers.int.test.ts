/**
 * Integration test for the customer-PII anonymize sweeper (DS-033 / QA-M2).
 * Requires DATABASE_URL (run via `pnpm vitest:int`).
 *
 * Seeds a customer soft-deleted > 730 days ago with a residual Google Account link, then
 * runs the real 'customer-pii-anonymize' job and asserts the defensive sweep:
 *   - Customer.email / passwordHash / emailVerifiedAt cleared
 *   - the linked Account row purged (no orphaned OAuth identity re-grant)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { runJob } from '../runJob';
import { anonymizeCustomers } from '../anonymizeCustomers';

let customerId = '';

beforeAll(async () => {
  const c = await prisma.customer.create({
    data: {
      email: 'sweep-me@example.dev',
      passwordHash: 'scrypt$x$y',
      emailVerifiedAt: new Date('2023-01-01T00:00:00Z'),
      displayName: 'Deleted user',
    },
  });
  customerId = c.id;
  await prisma.account.create({
    data: {
      customerId: c.id,
      provider: 'google',
      providerAccountId: 'sub-sweep-' + c.id,
      email: 'sweep-me@example.dev',
    },
  });
  // Back-date the soft delete well past the 730-day retention window so it's eligible.
  await prisma.$executeRaw`UPDATE "Customer" SET "deletedAt" = NOW() - INTERVAL '800 days' WHERE "id" = ${customerId}`;
});

afterAll(async () => {
  await prisma.account.deleteMany({ where: { customerId } });
  await prisma.session.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
});

describe('anonymizeCustomers sweeper integration (DS-033 / QA-M2)', () => {
  it('clears email/passwordHash/emailVerifiedAt and purges the OAuth Account link', async () => {
    const result = await runJob('customer-pii-anonymize', anonymizeCustomers);
    expect(result.status).toBe('success');

    const scrubbed = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(scrubbed?.email).toBeNull();
    expect(scrubbed?.passwordHash).toBeNull();
    expect(scrubbed?.emailVerifiedAt).toBeNull();

    const links = await prisma.account.findMany({ where: { customerId } });
    expect(links.length).toBe(0);
  });
});
