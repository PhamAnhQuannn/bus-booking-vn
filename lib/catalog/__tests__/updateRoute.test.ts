/**
 * Unit tests for updateRoute (Issue 012).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRouteFindFirst, mockRouteUpdate, mockResolveOrCreatePlace } = vi.hoisted(() => ({
  mockRouteFindFirst: vi.fn(),
  mockRouteUpdate: vi.fn(),
  mockResolveOrCreatePlace: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    route: {
      findFirst: mockRouteFindFirst,
      update: mockRouteUpdate,
    },
  },
}));

vi.mock('@/lib/places', () => ({
  resolveOrCreatePlace: mockResolveOrCreatePlace,
}));

import { updateRoute, RouteServiceError } from '../updateRoute';

const ACTIVE_ROUTE = { id: 'r1', deactivatedAt: null };
const DEACTIVATED_ROUTE = { id: 'r1', deactivatedAt: new Date() };
const UPDATED = {
  id: 'r1',
  operatorId: 'op1',
  origin: 'Hà Nội Updated',
  destination: 'TP.HCM',
  durationMinutes: 900,
  originPlaceId: 'place-origin',
  destPlaceId: 'place-dest',
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRouteUpdate.mockResolvedValue(UPDATED);
  mockResolveOrCreatePlace.mockImplementation((name: string) =>
    Promise.resolve({ id: `place-${name}`, canonicalName: name })
  );
});

describe('updateRoute', () => {
  it('updates route when found and active', async () => {
    mockRouteFindFirst.mockResolvedValue(ACTIVE_ROUTE);
    const result = await updateRoute({
      operatorId: 'op1',
      routeId: 'r1',
      data: { origin: 'Hà Nội Updated' },
    });
    expect(mockRouteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' } })
    );
    expect(result.origin).toBe('Hà Nội Updated');
  });

  it('throws not_found when route does not exist or cross-op', async () => {
    mockRouteFindFirst.mockResolvedValue(null);
    await expect(
      updateRoute({ operatorId: 'op1', routeId: 'r-missing', data: {} })
    ).rejects.toSatisfy((e: RouteServiceError) => e.code === 'not_found');
  });

  it('throws reactivation_not_supported for deactivated route', async () => {
    mockRouteFindFirst.mockResolvedValue(DEACTIVATED_ROUTE);
    await expect(
      updateRoute({ operatorId: 'op1', routeId: 'r1', data: { origin: 'X' } })
    ).rejects.toSatisfy((e: RouteServiceError) => e.code === 'reactivation_not_supported');
  });

  it('throws RouteServiceError (not generic Error) on not_found', async () => {
    mockRouteFindFirst.mockResolvedValue(null);
    await expect(
      updateRoute({ operatorId: 'op1', routeId: 'r1', data: {} })
    ).rejects.toBeInstanceOf(RouteServiceError);
  });

  it('passes only defined patch fields to prisma update', async () => {
    mockRouteFindFirst.mockResolvedValue(ACTIVE_ROUTE);
    await updateRoute({
      operatorId: 'op1',
      routeId: 'r1',
      data: { durationMinutes: 120 },
    });
    const call = mockRouteUpdate.mock.calls[0][0];
    expect(call.data).toHaveProperty('durationMinutes', 120);
    expect(call.data).not.toHaveProperty('origin');
    expect(call.data).not.toHaveProperty('destination');
    // No text change → no Place re-resolve, no FK write (Issue 044).
    expect(mockResolveOrCreatePlace).not.toHaveBeenCalled();
    expect(call.data).not.toHaveProperty('originPlaceId');
    expect(call.data).not.toHaveProperty('destPlaceId');
  });

  it('re-resolves the Place FK when origin text changes (Issue 044)', async () => {
    mockRouteFindFirst.mockResolvedValue(ACTIVE_ROUTE);
    await updateRoute({
      operatorId: 'op1',
      routeId: 'r1',
      data: { origin: 'Hà Nội Updated' },
    });
    expect(mockResolveOrCreatePlace).toHaveBeenCalledWith('Hà Nội Updated');
    const call = mockRouteUpdate.mock.calls[0][0];
    expect(call.data).toHaveProperty('originPlaceId', 'place-Hà Nội Updated');
    // destination untouched → no dest FK write.
    expect(call.data).not.toHaveProperty('destPlaceId');
  });
});
