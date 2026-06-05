/**
 * Issue 069 (Part C): unit tests for the moderation services.
 *
 * Mock-prisma + writeAdminAuditLog. The headline assertion is "only-the-column"
 * (AC4 — disable, never edit): each update's `data` object must contain EXACTLY the
 * moderation column (moderatedAt) / the resolve fields — NO catalog keys (price,
 * departureAt, origin, destination, etc.) ever appear.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { setTripModeration, setRouteModeration, resolveReport } from '../moderation';

function makePrisma() {
  const tx = {
    trip: { update: vi.fn() },
    route: { update: vi.fn() },
    contentReport: { update: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prisma, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('setTripModeration', () => {
  it('disable: stamps ONLY moderatedAt (a Date) and writes moderate-disable-trip audit', async () => {
    const { prisma, tx } = makePrisma();

    await setTripModeration(prisma as never, {
      tripId: 'trip-1',
      disabled: true,
      actor: 'admin:a1',
      reason: 'spam listing',
    });

    expect(tx.trip.update).toHaveBeenCalledTimes(1);
    const arg = tx.trip.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'trip-1' });
    // ONLY-THE-COLUMN: data has exactly { moderatedAt }, nothing else.
    expect(Object.keys(arg.data)).toEqual(['moderatedAt']);
    expect(arg.data.moderatedAt).toBeInstanceOf(Date);

    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a1',
      action: 'moderate-disable-trip',
      target: 'trip-1',
      argsRedacted: JSON.stringify({ reason: 'spam listing' }),
    });
  });

  it('enable: clears moderatedAt to null and writes moderate-enable-trip audit (reason null)', async () => {
    const { prisma, tx } = makePrisma();

    await setTripModeration(prisma as never, {
      tripId: 'trip-2',
      disabled: false,
      actor: 'admin:a2',
    });

    const arg = tx.trip.update.mock.calls[0][0];
    expect(Object.keys(arg.data)).toEqual(['moderatedAt']);
    expect(arg.data.moderatedAt).toBeNull();

    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a2',
      action: 'moderate-enable-trip',
      target: 'trip-2',
      argsRedacted: JSON.stringify({ reason: null }),
    });
  });
});

describe('setRouteModeration', () => {
  it('disable: stamps ONLY moderatedAt and writes moderate-disable-route audit', async () => {
    const { prisma, tx } = makePrisma();

    await setRouteModeration(prisma as never, {
      routeId: 'route-1',
      disabled: true,
      actor: 'admin:a1',
    });

    const arg = tx.route.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'route-1' });
    expect(Object.keys(arg.data)).toEqual(['moderatedAt']);
    expect(arg.data.moderatedAt).toBeInstanceOf(Date);

    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a1',
      action: 'moderate-disable-route',
      target: 'route-1',
      argsRedacted: JSON.stringify({ reason: null }),
    });
  });

  it('enable: clears moderatedAt and writes moderate-enable-route audit', async () => {
    const { prisma, tx } = makePrisma();

    await setRouteModeration(prisma as never, {
      routeId: 'route-2',
      disabled: false,
      actor: 'admin:a2',
    });

    const arg = tx.route.update.mock.calls[0][0];
    expect(Object.keys(arg.data)).toEqual(['moderatedAt']);
    expect(arg.data.moderatedAt).toBeNull();
    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a2',
      action: 'moderate-enable-route',
      target: 'route-2',
      argsRedacted: JSON.stringify({ reason: null }),
    });
  });
});

describe('resolveReport', () => {
  it('sets status/resolvedBy/resolvedAt (no other keys) and writes moderate-resolve-report audit', async () => {
    const { prisma, tx } = makePrisma();

    await resolveReport(prisma as never, { reportId: 'rep-1', actor: 'admin:a3' });

    expect(tx.contentReport.update).toHaveBeenCalledTimes(1);
    const arg = tx.contentReport.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'rep-1' });
    expect(Object.keys(arg.data).sort()).toEqual(['resolvedAt', 'resolvedBy', 'status']);
    expect(arg.data.status).toBe('resolved');
    expect(arg.data.resolvedBy).toBe('admin:a3');
    expect(arg.data.resolvedAt).toBeInstanceOf(Date);

    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a3',
      action: 'moderate-resolve-report',
      target: 'rep-1',
    });
  });
});
