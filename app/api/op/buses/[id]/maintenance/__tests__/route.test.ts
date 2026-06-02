/**
 * Unit tests for POST /api/op/buses/[id]/maintenance — Issue 011.
 *
 * Coverage:
 *   AC4 maintenance-vs-maintenance overlap → 409 maintenance_overlap (HARD block).
 *   AC4 maintenance-vs-trip overlap → 201 with conflictingTrips[] (SOFT warning).
 *   AC6 cross-op → 404 not_found.
 *   AC11 deactivated bus → 422 reactivation_not_supported.
 *   Happy path (no overlaps) → 201 { maintenance, conflictingTrips: [] }.
 *   Invalid input → 400.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockBusFindFirst,
  mockBusMaintFindMany,
  mockBusMaintCreate,
  mockTripFindMany,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockBusFindFirst: vi.fn(),
  mockBusMaintFindMany: vi.fn(),
  mockBusMaintCreate: vi.fn(),
  mockTripFindMany: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    bus: { findFirst: mockBusFindFirst },
    busMaintenance: { findMany: mockBusMaintFindMany, create: mockBusMaintCreate },
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

function makePost(id: string, body: unknown) {
  return {
    req: new NextRequest(`http://localhost/api/op/buses/${id}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

// Future-relative window so the schema's `startAt > new Date()` refine stays
// satisfied as wall-clock advances. The prior hardcoded 2026-06-01 window became
// "now" on that date and 422'd every DB-path test — a date time-bomb (see CLAUDE.md
// Mistake Log: hardcoded future dates that age into the past).
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_START = new Date(Date.now() + 7 * DAY_MS);
WINDOW_START.setUTCHours(0, 0, 0, 0);
const WINDOW_END = new Date(WINDOW_START.getTime() + DAY_MS);
const VALID_BODY = {
  startAt: WINDOW_START.toISOString(),
  endAt: WINDOW_END.toISOString(),
  reason: 'routine',
};

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

describe('POST /api/op/buses/[id]/maintenance', () => {
  it('AC6: returns 404 cross-op bus', async () => {
    mockBusFindFirst.mockResolvedValueOnce(null);
    const { req, ctx } = makePost('b-other-op', VALID_BODY);
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it('AC11: returns 422 reactivation_not_supported for deactivated bus', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: new Date() });
    const { req, ctx } = makePost('b1', VALID_BODY);
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
  });

  it('AC4 hard-block: returns 409 maintenance_overlap when overlapping maintenance found', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: null });
    mockBusMaintFindMany.mockResolvedValue([
      {
        id: 'm-existing',
        startAt: new Date(WINDOW_START.getTime() + 12 * 60 * 60 * 1000),
        endAt: new Date(WINDOW_START.getTime() + 18 * 60 * 60 * 1000),
      },
    ]);
    const { req, ctx } = makePost('b1', VALID_BODY);
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('maintenance_overlap');
    expect(json.overlapping).toHaveLength(1);
    expect(mockBusMaintCreate).not.toHaveBeenCalled();
  });

  it('AC4 soft-warn: returns 201 with conflictingTrips when maintenance overlaps a trip', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: null });
    mockBusMaintFindMany.mockResolvedValue([]); // no maintenance overlap
    mockBusMaintCreate.mockResolvedValue({
      id: 'm-new',
      startAt: new Date(VALID_BODY.startAt),
      endAt: new Date(VALID_BODY.endAt),
      reason: 'routine',
    });
    mockTripFindMany.mockResolvedValue([
      { id: 't1', departureAt: new Date(WINDOW_START.getTime() + 8 * 60 * 60 * 1000) },
    ]);

    const { req, ctx } = makePost('b1', VALID_BODY);
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.maintenance.id).toBe('m-new');
    expect(json.conflictingTrips).toHaveLength(1);
    expect(json.conflictingTrips[0].tripId).toBe('t1');
  });

  it('happy path: returns 201 with empty conflictingTrips when no overlap', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1', deactivatedAt: null });
    mockBusMaintFindMany.mockResolvedValue([]);
    mockBusMaintCreate.mockResolvedValue({
      id: 'm-new',
      startAt: new Date(VALID_BODY.startAt),
      endAt: new Date(VALID_BODY.endAt),
      reason: 'routine',
    });
    mockTripFindMany.mockResolvedValue([]);

    const { req, ctx } = makePost('b1', VALID_BODY);
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.conflictingTrips).toEqual([]);
  });

  it('AC9: returns 422 invalid_input when endAt <= startAt', async () => {
    const { req, ctx } = makePost('b1', {
      startAt: '2026-06-02T00:00:00.000Z',
      endAt: '2026-06-01T00:00:00.000Z',
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('AC9: returns 422 invalid_input when startAt is in the past', async () => {
    const { req, ctx } = makePost('b1', {
      startAt: '2020-01-01T00:00:00.000Z',
      endAt: '2020-01-02T00:00:00.000Z',
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 422 invalid_input when startAt is not ISO', async () => {
    const { req, ctx } = makePost('b1', { startAt: 'not-a-date', endAt: VALID_BODY.endAt });
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
  });
});
