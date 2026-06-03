/**
 * Unit tests for deactivateRoute (Issue 012).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRouteFindFirst, mockRouteUpdate } = vi.hoisted(() => ({
  mockRouteFindFirst: vi.fn(),
  mockRouteUpdate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    route: {
      findFirst: mockRouteFindFirst,
      update: mockRouteUpdate,
    },
  },
}));

import { deactivateRoute } from '../deactivateRoute';
import { RouteServiceError } from '../updateRoute';

const ACTIVE_ROUTE = { id: 'r1', deactivatedAt: null };
const DEACTIVATED_ROUTE = { id: 'r1', deactivatedAt: new Date('2026-01-01') };
const DEACTIVATED_RESULT = {
  id: 'r1',
  operatorId: 'op1',
  origin: 'A',
  destination: 'B',
  durationMinutes: 60,
  deactivatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRouteUpdate.mockResolvedValue(DEACTIVATED_RESULT);
});

describe('deactivateRoute', () => {
  it('soft-deletes active route and returns updated record', async () => {
    mockRouteFindFirst.mockResolvedValue(ACTIVE_ROUTE);
    const result = await deactivateRoute({ operatorId: 'op1', routeId: 'r1' });
    expect(mockRouteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ deactivatedAt: expect.any(Date) }),
      })
    );
    expect(result.deactivatedAt).not.toBeNull();
  });

  it('throws not_found when route does not exist or cross-op', async () => {
    mockRouteFindFirst.mockResolvedValue(null);
    await expect(
      deactivateRoute({ operatorId: 'op1', routeId: 'missing' })
    ).rejects.toSatisfy((e: RouteServiceError) => e.code === 'not_found');
  });

  it('throws already_deactivated when route already soft-deleted', async () => {
    mockRouteFindFirst.mockResolvedValue(DEACTIVATED_ROUTE);
    await expect(
      deactivateRoute({ operatorId: 'op1', routeId: 'r1' })
    ).rejects.toSatisfy((e: RouteServiceError) => e.code === 'already_deactivated');
  });

  it('scopes findFirst to operatorId to prevent cross-op deactivation', async () => {
    mockRouteFindFirst.mockResolvedValue(null);
    await expect(
      deactivateRoute({ operatorId: 'other-op', routeId: 'r1' })
    ).rejects.toBeInstanceOf(RouteServiceError);
    expect(mockRouteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1', operatorId: 'other-op' } })
    );
  });
});
