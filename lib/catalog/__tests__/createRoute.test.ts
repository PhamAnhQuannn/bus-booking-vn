/**
 * Unit tests for createRoute (Issue 012).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRouteCreate, mockResolveOrCreatePlace } = vi.hoisted(() => ({
  mockRouteCreate: vi.fn(),
  mockResolveOrCreatePlace: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: { route: { create: mockRouteCreate } },
}));

vi.mock('@/lib/places', () => ({
  resolveOrCreatePlace: mockResolveOrCreatePlace,
}));

import { createRoute } from '../createRoute';

const BASE = {
  id: 'r1',
  operatorId: 'op1',
  origin: 'Hà Nội',
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
  mockRouteCreate.mockResolvedValue(BASE);
  mockResolveOrCreatePlace.mockImplementation((name: string) =>
    Promise.resolve({ id: `place-${name}`, canonicalName: name })
  );
});

describe('createRoute', () => {
  it('calls prisma.route.create with correct operatorId and data', async () => {
    const result = await createRoute({
      operatorId: 'op1',
      data: { origin: 'Hà Nội', destination: 'TP.HCM', durationMinutes: 900 },
    });
    expect(mockRouteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorId: 'op1',
          origin: 'Hà Nội',
          destination: 'TP.HCM',
          durationMinutes: 900,
        }),
      })
    );
    expect(result.id).toBe('r1');
  });

  it('returns the created route from prisma', async () => {
    const result = await createRoute({
      operatorId: 'op1',
      data: { origin: 'A', destination: 'B', durationMinutes: 60 },
    });
    expect(result).toEqual(BASE);
  });

  it('resolves Place FKs for origin + destination and writes them (Issue 044)', async () => {
    await createRoute({
      operatorId: 'op1',
      data: { origin: 'Hà Nội', destination: 'TP.HCM', durationMinutes: 900 },
    });
    expect(mockResolveOrCreatePlace).toHaveBeenCalledWith('Hà Nội');
    expect(mockResolveOrCreatePlace).toHaveBeenCalledWith('TP.HCM');
    expect(mockRouteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originPlaceId: 'place-Hà Nội',
          destPlaceId: 'place-TP.HCM',
        }),
      })
    );
  });
});
