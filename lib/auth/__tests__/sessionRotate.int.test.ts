/**
 * Integration test — rotateRefresh hardening (auth-audit-2026-08).
 *
 *  #463 (P0): concurrent double-refresh of one still-valid token must NOT fork the
 *             session family into two live leaves (no SELECT FOR UPDATE + no
 *             revokedAt guard let both rotate). Exactly one may rotate.
 *  #464 (P0): a suspended/deleted customer must NOT be able to rotate forever —
 *             rotate re-checks active state and denies + revokes the family.
 *  #476 (P2): an expired Session (expiresAt <= now) must be denied at rotate.
 *  #519 (P1): the LOSER of a benign concurrent double-refresh must NOT nuke the family
 *             (that force-logs-out the user). Within the grace window, with a live
 *             successor, it returns `raced` + a fresh access token. A genuinely
 *             superseded token (successor already rotated away) is still real reuse.
 *  #520 (P1): the expired branch REVOKES the row and RETURNS `expired` — it must not
 *             throw (a throw rolls back the revoke, leaving revokedAt=null forever).
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
  it('#463/#519 concurrent double-refresh: one rotates, the loser races (no logout, no fork)', async () => {
    const customerId = await seedCustomer();
    const { refreshHash, family } = await createSession(customerId);

    const [a, b] = await Promise.allSettled([
      rotateRefresh(refreshHash),
      rotateRefresh(refreshHash),
    ]);

    const outcomes = [a, b].map((r) =>
      r.status !== 'fulfilled'
        ? 'threw'
        : 'raced' in r.value
          ? 'raced'
          : 'reuse' in r.value
            ? 'reuse'
            : 'rotated',
    );

    // Exactly one rotates (FOR UPDATE serializes; no forked family).
    expect(outcomes.filter((o) => o === 'rotated')).toHaveLength(1);
    // #519: the loser is a benign race, NOT reuse — the user is NOT force-logged-out.
    expect(outcomes.filter((o) => o === 'raced')).toHaveLength(1);
    expect(outcomes).not.toContain('reuse');

    // The racer still gets a usable access token.
    const racerValue = [a, b]
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .find((v) => v !== null && 'raced' in v);
    expect(racerValue && 'access' in racerValue && racerValue.access).toBeTruthy();

    // Exactly one live leaf survives (the rotation winner's successor). No fork.
    const live = await prisma.session.count({ where: { tokenFamily: family, revokedAt: null } });
    expect(live).toBe(1);
  });

  it('#519 replay of a superseded token (successor already rotated) is genuine reuse → family revoked', async () => {
    const customerId = await seedCustomer();
    const { refreshHash: hashA, family } = await createSession(customerId);

    const rotA = await rotateRefresh(hashA); // A → B
    expect('refreshHash' in rotA).toBe(true);
    if (!('refreshHash' in rotA)) throw new Error('expected rotation');
    await rotateRefresh(rotA.refreshHash); // B → C (B revoked, C live)

    // Replay A: its successor B has itself been rotated away (revoked), so there is no live
    // successor → NOT a benign race → genuine reuse → nuke the whole family.
    const replay = await rotateRefresh(hashA);
    expect('reuse' in replay).toBe(true);
    const live = await prisma.session.count({ where: { tokenFamily: family, revokedAt: null } });
    expect(live).toBe(0);
  });

  it('#587 raced branch re-checks active — a customer suspended mid-grace is denied, not handed a token', async () => {
    const customerId = await seedCustomer();
    const { refreshHash: hashA, family } = await createSession(customerId);

    const rotA = await rotateRefresh(hashA); // A → B (B live; A revoked, within grace)
    if (!('refreshHash' in rotA)) throw new Error('expected rotation');

    // Customer is suspended AFTER the rotation but the family's live successor B still exists.
    await prisma.customer.update({ where: { id: customerId }, data: { suspendedAt: new Date() } });

    // Replay A: hits the benign-race branch (A revoked-in-grace + live successor B). Without the
    // #587 re-check this would mint a fresh access token for a now-suspended customer.
    const replay = await rotateRefresh(hashA);
    expect('inactive' in replay).toBe(true);
    expect('raced' in replay).toBe(false);

    const live = await prisma.session.count({ where: { tokenFamily: family, revokedAt: null } });
    expect(live).toBe(0); // family revoked
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

  it('#476/#520 an expired session cannot rotate — returns expired AND commits the revoke', async () => {
    const customerId = await seedCustomer();
    const { refreshHash } = await createSession(customerId);
    // Force the session past its expiry.
    await prisma.session.updateMany({
      where: { refreshTokenHash: refreshHash },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const result = await rotateRefresh(refreshHash);
    // #520: returns the sentinel (does NOT throw), so the revoke below is not rolled back.
    expect('expired' in result).toBe(true);

    const row = await prisma.session.findFirst({
      where: { refreshTokenHash: refreshHash },
      select: { revokedAt: true },
    });
    expect(row?.revokedAt).not.toBeNull();
  });
});
