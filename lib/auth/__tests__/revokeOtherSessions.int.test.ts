/**
 * Integration test — "sign out of all other devices" (#497).
 *
 * revokeOtherCustomerSessions keeps the current device's WHOLE token family (incl. a
 * successor minted by a concurrent rotation), revokes every other live session of the
 * customer, leaves other customers and already-revoked rows untouched.
 * findCustomerSessionIdByRefresh resolves the bb_rt cookie value → Session.id.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import {
  createSession,
  rotateRefresh,
  findCustomerSessionIdByRefresh,
  revokeOtherCustomerSessions,
} from '../session';

const customerIds: string[] = [];

async function seedCustomer(): Promise<string> {
  const c = await prisma.customer.create({
    data: {
      email: `revoke-others-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`,
      displayName: 'Revoke Tester',
    },
    select: { id: true },
  });
  customerIds.push(c.id);
  return c.id;
}

afterAll(async () => {
  await prisma.session.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  await prisma.$disconnect();
});

describe('revokeOtherCustomerSessions', () => {
  it('keeps the current family (incl. rotated successor), revokes the others', async () => {
    const customerId = await seedCustomer();
    const other = await seedCustomer();

    const current = await createSession(customerId);
    const deviceB = await createSession(customerId);
    const deviceC = await createSession(customerId);
    const otherCustomer = await createSession(other);

    // Device C was already logged out earlier — its revokedAt must not be rewritten.
    const oldRevokedAt = new Date(Date.now() - 60_000);
    await prisma.session.update({
      where: { refreshTokenHash: deviceC.refreshHash },
      data: { revokedAt: oldRevokedAt },
    });

    const keepId = await findCustomerSessionIdByRefresh(current.refreshToken, customerId);
    expect(keepId).not.toBeNull();

    // Rotation race: the current device refreshes after its id was resolved.
    const rotated = await rotateRefresh(current.refreshHash);
    expect('refreshHash' in rotated).toBe(true);

    const result = await revokeOtherCustomerSessions(customerId, keepId!);
    expect(result).toEqual({ revoked: 1 }); // only device B was live outside the family

    const rows = await prisma.session.findMany({
      where: { customerId: { in: [customerId, other] } },
      select: { tokenFamily: true, customerId: true, revokedAt: true, refreshTokenHash: true },
    });
    const live = rows.filter((r) => r.revokedAt === null);
    // Current family's successor + the other customer's session survive.
    expect(live.map((r) => r.refreshTokenHash).sort()).toEqual(
      [(rotated as { refreshHash: string }).refreshHash, otherCustomer.refreshHash].sort()
    );
    expect(rows.find((r) => r.refreshTokenHash === deviceB.refreshHash)?.revokedAt).not.toBeNull();
    expect(rows.find((r) => r.refreshTokenHash === deviceC.refreshHash)?.revokedAt).toEqual(oldRevokedAt);
  });

  it('returns null (revokes nothing) for a session id of another customer', async () => {
    const customerId = await seedCustomer();
    const other = await seedCustomer();
    await createSession(customerId);
    const foreign = await createSession(other);
    const foreignId = await findCustomerSessionIdByRefresh(foreign.refreshToken, other);

    await expect(revokeOtherCustomerSessions(customerId, foreignId!)).resolves.toBeNull();
    const live = await prisma.session.count({ where: { customerId, revokedAt: null } });
    expect(live).toBe(1);
  });
});

describe('findCustomerSessionIdByRefresh', () => {
  it('rejects a tampered token and a token of another customer', async () => {
    const customerId = await seedCustomer();
    const other = await seedCustomer();
    const s = await createSession(customerId);

    expect(await findCustomerSessionIdByRefresh(`${s.refreshToken}00`, customerId)).toBeNull();
    expect(await findCustomerSessionIdByRefresh('garbage', customerId)).toBeNull();
    expect(await findCustomerSessionIdByRefresh(s.refreshToken, other)).toBeNull();
  });
  it('rejects a dead cookie (whole family revoked) but accepts a just-rotated one', async () => {
    const customerId = await seedCustomer();
    const s = await createSession(customerId);
    const rotated = await rotateRefresh(s.refreshHash);
    expect('refreshToken' in rotated).toBe(true);
    // old (revoked) token whose successor is live → still resolves
    expect(await findCustomerSessionIdByRefresh(s.refreshToken, customerId)).not.toBeNull();
    // kill the whole family → stale cookie must not count as "current device"
    await prisma.session.updateMany({ where: { customerId }, data: { revokedAt: new Date() } });
    expect(await findCustomerSessionIdByRefresh(s.refreshToken, customerId)).toBeNull();
  });
});
