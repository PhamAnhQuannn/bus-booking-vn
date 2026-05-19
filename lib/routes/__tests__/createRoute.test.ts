/**
 * Unit tests for createRoute (Issue 012).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRouteCreate } = vi.hoisted(() => ({
  mockRouteCreate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: { route: { create: mockRouteCreate } },
}));

import { createRoute } from '../createRoute';

const BASE = {
  id: 'r1',
  operatorId: 'op1',
  origin: 'Hà Nội',
  destination: 'TP.HCM',
  durationMinutes: 900,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRouteCreate.mockResolvedValue(BASE);
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
});
