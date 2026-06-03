/**
 * Issue 069 (Part D): unit tests for getOpenReports + getModeratedItems.
 *
 * Inject fake prisma stubs. Asserts the open-reports status filter + seek-cursor
 * pagination (take = limit + 1, nextCursor = last kept row id) and the
 * moderated-items shape (trip label = "origin → destination", route fields).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { getOpenReports, getModeratedItems } from '../getModerationQueue';

interface ReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  reportedBy: string | null;
  createdAt: Date;
}

function makeReports(n: number): ReportRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `rep_${i}`,
    targetType: 'trip',
    targetId: `trip_${i}`,
    reason: `reason ${i}`,
    reportedBy: i % 2 === 0 ? `cust_${i}` : null,
    createdAt: new Date(2026, 0, n - i),
  }));
}

function reportsPrisma(rows: ReportRow[], capture?: (args: unknown) => void) {
  return {
    contentReport: {
      findMany: vi.fn(async (args: unknown) => {
        capture?.(args);
        return rows;
      }),
    },
  } as never;
}

describe('getOpenReports', () => {
  it('filters status:open, take = limit + 1, nextCursor = last kept row id on overflow', async () => {
    let captured: { where?: unknown; take?: number } | undefined;
    const prisma = reportsPrisma(makeReports(3), (a) => {
      captured = a as { where?: unknown; take?: number };
    });
    const res = await getOpenReports({ limit: 2 }, prisma);

    expect(captured?.where).toEqual({ status: 'open' });
    expect(captured?.take).toBe(3); // limit + 1
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('rep_1'); // id of last KEPT row
    expect(res.items[0].reportedBy).toBe('cust_0');
  });

  it('returns nextCursor null with no overflow', async () => {
    const prisma = reportsPrisma(makeReports(2));
    const res = await getOpenReports({ limit: 5 }, prisma);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBeNull();
  });

  it('passes a seek cursor (cursor + skip:1) when a cursor is given', async () => {
    let captured: { cursor?: unknown; skip?: number } | undefined;
    const prisma = reportsPrisma(makeReports(1), (a) => {
      captured = a as { cursor?: unknown; skip?: number };
    });
    await getOpenReports({ cursor: 'rep_9' }, prisma);
    expect(captured?.cursor).toEqual({ id: 'rep_9' });
    expect(captured?.skip).toBe(1);
  });
});

describe('getModeratedItems', () => {
  it('returns disabled trips (with origin→dest label) and routes', async () => {
    let tripWhere: unknown;
    let routeWhere: unknown;
    const prisma = {
      trip: {
        findMany: vi.fn(async (a: { where?: unknown }) => {
          tripWhere = a.where;
          return [
            {
              id: 'trip_1',
              departureAt: new Date(2026, 5, 1, 8, 0),
              route: { origin: 'Hanoi', destination: 'Sapa' },
            },
          ];
        }),
      },
      route: {
        findMany: vi.fn(async (a: { where?: unknown }) => {
          routeWhere = a.where;
          return [{ id: 'route_1', origin: 'Hue', destination: 'Da Nang' }];
        }),
      },
    } as never;

    const res = await getModeratedItems(prisma);

    expect(tripWhere).toEqual({ moderatedAt: { not: null } });
    expect(routeWhere).toEqual({ moderatedAt: { not: null } });
    expect(res.trips).toEqual([
      { id: 'trip_1', label: 'Hanoi → Sapa', departureAt: new Date(2026, 5, 1, 8, 0) },
    ]);
    expect(res.routes).toEqual([{ id: 'route_1', origin: 'Hue', destination: 'Da Nang' }]);
  });
});
