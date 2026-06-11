/**
 * Unit tests for setRoutePickupAreas + the route-scope guard semantics (Issue 113).
 * All Prisma calls are mocked — no live DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    route: { findFirst: vi.fn() },
    operatorPickupArea: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { setRoutePickupAreas, RoutePickupAreaServiceError } from '../setRoutePickupAreas';
import { prisma } from '@/lib/core/db/client';

const mockRouteFindFirst = prisma.route.findFirst as Mock;
const mockAreaFindMany = prisma.operatorPickupArea.findMany as Mock;
const mockTransaction = prisma.$transaction as Mock;

function wireTx() {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
    fn({ routePickupArea: { deleteMany, createMany } })
  );
  return { deleteMany, createMany };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setRoutePickupAreas', () => {
  it('throws not_found when the route is not operator-owned', async () => {
    mockRouteFindFirst.mockResolvedValue(null);

    await expect(
      setRoutePickupAreas({ operatorId: 'op1', routeId: 'r1', areaIds: ['a1'] })
    ).rejects.toBeInstanceOf(RoutePickupAreaServiceError);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('full-replaces the assignments for owned active areas', async () => {
    mockRouteFindFirst.mockResolvedValue({ id: 'r1' });
    mockAreaFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    const { deleteMany, createMany } = wireTx();

    const res = await setRoutePickupAreas({ operatorId: 'op1', routeId: 'r1', areaIds: ['a1', 'a2'] });

    expect(res.assigned).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { routeId: 'r1' } });
    const data = createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      { routeId: 'r1', operatorPickupAreaId: 'a1', displayOrder: 0 },
      { routeId: 'r1', operatorPickupAreaId: 'a2', displayOrder: 1 },
    ]);
  });

  it('rejects an id that is not one of the operator\'s active areas', async () => {
    mockRouteFindFirst.mockResolvedValue({ id: 'r1' });
    mockAreaFindMany.mockResolvedValue([{ id: 'a1' }]); // only 1 of 2 owned

    await expect(
      setRoutePickupAreas({ operatorId: 'op1', routeId: 'r1', areaIds: ['a1', 'a2'] })
    ).rejects.toMatchObject({ code: 'invalid_pickup_area' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('clears all assignments when given an empty list (no ownership query)', async () => {
    mockRouteFindFirst.mockResolvedValue({ id: 'r1' });
    const { deleteMany, createMany } = wireTx();

    const res = await setRoutePickupAreas({ operatorId: 'op1', routeId: 'r1', areaIds: [] });

    expect(res.assigned).toBe(0);
    expect(mockAreaFindMany).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({ where: { routeId: 'r1' } });
    expect(createMany).not.toHaveBeenCalled();
  });
});
