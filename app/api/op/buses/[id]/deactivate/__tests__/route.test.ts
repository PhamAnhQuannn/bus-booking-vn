/**
 * Unit tests for POST /api/op/buses/[id]/deactivate — Issue 011.
 *
 * Coverage:
 *   AC6  cross-op → 404 not_found.
 *   AC10 future trips assigned → 422 future_trips_assigned with tripIds[].
 *   AC11 already deactivated → 422 reactivation_not_supported.
 *   Happy path → 200 { ok: true, deactivatedAt }.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockBusFindFirst,
  mockBusUpdate,
  mockTripFindMany,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockBusFindFirst: vi.fn(),
  mockBusUpdate: vi.fn(),
  mockTripFindMany: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    bus: { findFirst: mockBusFindFirst, update: mockBusUpdate },
    trip: { findMany: mockTripFindMany },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const OPERATOR_USER = {
  id: 'op-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

function makePost(id: string) {
  return {
    req: new NextRequest(`http://localhost/api/op/buses/${id}/deactivate`, {
      method: 'POST',
      headers: { Cookie: 'bb_op_access=valid-token' },
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
});

describe('POST /api/op/buses/[id]/deactivate', () => {
  it('AC6: returns 404 when bus is cross-op (findFirst null)', async () => {
    mockBusFindFirst.mockResolvedValueOnce(null);
    const { req, ctx } = makePost('b-other-op');
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it('AC11: returns 422 reactivation_not_supported when already deactivated', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: new Date() });
    const { req, ctx } = makePost('b1');
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('reactivation_not_supported');
  });

  it('AC10: returns 422 future_trips_assigned with tripIds[]', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: null });
    mockTripFindMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    const { req, ctx } = makePost('b1');
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('future_trips_assigned');
    expect(json.tripIds).toEqual(['t1', 't2']);
  });

  it('happy path: returns 200 { ok: true, deactivatedAt }', async () => {
    // First findFirst (route-level ownership check)
    mockBusFindFirst
      .mockResolvedValueOnce({ id: 'b1', deactivatedAt: null })
      // Second findFirst inside deactivateBus
      .mockResolvedValueOnce({ id: 'b1', deactivatedAt: null });
    mockTripFindMany.mockResolvedValue([]);
    mockBusUpdate.mockResolvedValue({ id: 'b1' });
    const { req, ctx } = makePost('b1');
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deactivatedAt).toBeDefined();
  });
});
