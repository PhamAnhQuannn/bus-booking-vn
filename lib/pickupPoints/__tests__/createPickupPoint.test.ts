/**
 * Unit tests for createPickupPoint (Issue 012).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRouteFindFirst,
  mockPickupPointCount,
  mockPickupPointAggregate,
  mockPickupPointCreate,
} = vi.hoisted(() => ({
  mockRouteFindFirst: vi.fn(),
  mockPickupPointCount: vi.fn(),
  mockPickupPointAggregate: vi.fn(),
  mockPickupPointCreate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    route: { findFirst: mockRouteFindFirst },
    pickupPoint: {
      count: mockPickupPointCount,
      aggregate: mockPickupPointAggregate,
      create: mockPickupPointCreate,
    },
  },
}));

import { createPickupPoint, PickupPointServiceError } from '../createPickupPoint';

const PP = {
  id: 'pp1',
  routeId: 'r1',
  name: 'Bến xe Mỹ Đình',
  address: '20 Phạm Hùng, Hà Nội',
  displayOrder: 1,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRouteFindFirst.mockResolvedValue({ id: 'r1' });
  mockPickupPointCount.mockResolvedValue(0);
  mockPickupPointAggregate.mockResolvedValue({ _max: { displayOrder: null } });
  mockPickupPointCreate.mockResolvedValue(PP);
});

describe('createPickupPoint', () => {
  it('creates pickup point with auto displayOrder=1 when no existing points', async () => {
    const result = await createPickupPoint({
      operatorId: 'op1',
      routeId: 'r1',
      data: { name: 'Bến xe Mỹ Đình', address: '20 Phạm Hùng, Hà Nội' },
    });
    expect(mockPickupPointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayOrder: 1, routeId: 'r1' }),
      })
    );
    expect(result.name).toBe('Bến xe Mỹ Đình');
  });

  it('appends displayOrder = max+1 when existing points present', async () => {
    mockPickupPointAggregate.mockResolvedValue({ _max: { displayOrder: 3 } });
    await createPickupPoint({
      operatorId: 'op1',
      routeId: 'r1',
      data: { name: 'New', address: 'Addr' },
    });
    expect(mockPickupPointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayOrder: 4 }),
      })
    );
  });

  it('uses explicit displayOrder when provided', async () => {
    await createPickupPoint({
      operatorId: 'op1',
      routeId: 'r1',
      data: { name: 'New', address: 'Addr', displayOrder: 7 },
    });
    expect(mockPickupPointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayOrder: 7 }),
      })
    );
    // aggregate should not be called when displayOrder is explicit
    expect(mockPickupPointAggregate).not.toHaveBeenCalled();
  });

  it('throws not_found when route does not belong to operator', async () => {
    mockRouteFindFirst.mockResolvedValue(null);
    await expect(
      createPickupPoint({ operatorId: 'other', routeId: 'r1', data: { name: 'X', address: 'Y' } })
    ).rejects.toSatisfy((e: PickupPointServiceError) => e.code === 'not_found');
  });

  it('throws too_many_pickup_points at MAX_PICKUP_POINTS=50', async () => {
    mockPickupPointCount.mockResolvedValue(50);
    await expect(
      createPickupPoint({ operatorId: 'op1', routeId: 'r1', data: { name: 'X', address: 'Y' } })
    ).rejects.toSatisfy((e: PickupPointServiceError) => e.code === 'too_many_pickup_points');
  });
});
