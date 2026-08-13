/**
 * Integration test — rotateRefresh hardening (auth-audit-2026-08).
 *
 *  #463 (P0): concurrent double-refresh of one still-valid token must NOT fork the
 *             session family into two live leaves (no SELECT FOR UPDATE + no
 *             revokedAt guard let both rotate). Exactly one may rotate; the other
 *             must be caught as reuse.
 *  #464 (P0): a suspended/deleted customer must NOT be able to rotate forever —
 *             rotate re-checks active state and denies + revokes the family.
 *  #476 (P2): an expired Session (expiresAt <= now) must be denied at rotate.
 *
 * These encode the CORRECT behaviour → FAIL on the unhardened rotateRefresh.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createSession, rotateRefresh } from '../session';

const customerIds: string[] = [];

async function seedCustomer(overrides: { suspendedAt?: Date; deletedAt?: Date } = {}): Promise<string> {
  const c = await prisma.customer.create({
    data: {
      email: `rotate-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`,
      displayName: 'Rotate Tester',
      suspendedAt: overrides.suspendedAt ?? null,
      deletedAt: overrides.deletedAt ?? null,
    },
    select: { id: true },
  });
  customerIds.push(c.id);
  return c.id;
}

afterEach(async () => {
  // Sessions cascade-cleaned via customer delete in afterAll; nothing per-test.
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  await prisma.$disconnect();
});

describe('rotateRefresh hardening', () => {
  it('#463 concurrent double-refresh does not fork the family (exactly one rotation succeeds)', async () => {
    const customerId = await seedCustomer();
    const { refreshHash, family } = await createSession(customerId);

    const [a, b] = await Promise.allSettled([
      rotateRefresh(refreshHash),
      rotateRefresh(refreshHash),
    ]);

    const outcomes = [a, b].map((r) =>
      r.status === 'fulfilled' ? ('reuse' in r.value ? 'reuse' : 'rotated') : 'threw',
    );
    const rotated = outcomes.filter((o) => o === 'rotated').length;

    // BUG: both rotate (no FOR UPDATE / no revokedAt guard) → 2 live leaves.
    expect(rotated).toBe(1);

    // No two live (non-revoked) leaves survive in the family.
    const live = await prisma.session.count({ where: { tokenFamily: family, revokedAt: null } });
    expect(live).toBeLessThanOrEqual(1);
  });

  it('#464 a suspended customer cannot rotate — inactive sentinel + family revoked', async () => {
    const customerId = await seedCustomer({ suspendedAt: new Date() });
    const { refreshHash, family } = await createSession(customerId);

    const result = await rotateRefresh(refreshHash);
    expect('inactive' in result).toBe(true);

    const live = await prisma.session.count({ where: { tokenFamily: family, revokedAt: null } });
    expect(live).toBe(0); // family revoked (committed — sentinel returns, does not throw)
  });

  it('#464 a deleted customer cannot rotate', async () => {
    const customerId = await seedCustomer({ deletedAt: new Date() });
    const { refreshHash } = await createSession(customerId);
    const result = await rotateRefresh(refreshHash);
    expect('inactive' in result).toBe(true);
  });

  it('#476 an expired session cannot rotate', async () => {
    const customerId = await seedCustomer();
    const { refreshHash } = await createSession(customerId);
    // Force the session past its expiry.
    await prisma.session.updateMany({
      where: { refreshTokenHash: refreshHash },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(rotateRefresh(refreshHash)).rejects.toThrow();
  });
});
