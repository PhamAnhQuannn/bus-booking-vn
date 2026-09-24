/**
 * Unit tests for POST /api/op/trips/[id]/cancel (Issue 013 AC4).
 *
 * Real requireOperatorAuth HOF is exercised (jwt + cookies + prisma.operatorUser
 * mocked); cancelTrip itself is mocked. Route is requireOperatorAuth({}) — NOT
 * adminOnly and NOT staffTripScope-guarded.
 *
 * Coverage:
 *   - 200 { trip, ok:true } happy path.
 *   - 200 { already_cancelled:true } idempotent re-cancel (NOT 422).
 *   - 401 without a session cookie.
 *   - 404 not_found (cross-op) — cancelTrip throws TripServiceError('not_found').
 *   - 422 validation_failed for a too-short reason (service NOT called).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCancelTrip,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCancelTrip: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/trips/cancelTrip', () => ({ cancelTrip: mockCancelTrip }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { TripServiceError } from '@/lib/trips/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const TRIP_ID = 'trip-1';
const ROUTE_CTX = { params: Promise.resolve({ id: TRIP_ID }) };
const TRIP = { id: TRIP_ID, status: 'cancelled', operatorId: 'op-org-1' };

const OPERATOR_ADMIN = {
  id: 'opu-1',
  phone: '+8490xxxxxx0',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
  role: 'admin',
  assignedTripId: null,
};

function makePost(body: unknown, withCookie = true): NextRequest {
  return new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { reason: 'Bus broke down on the highway' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockCancelTrip.mockResolvedValue({
    trip: TRIP,
    alreadyCancelled: false,
    cancelledBookings: 3,
    cancelledHolds: 1,
    notificationsEnqueued: 4,
  });
});

describe('POST /api/op/trips/[id]/cancel', () => {
  it('returns 200 { trip, ok:true } on success', async () => {
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.already_cancelled).toBe(false);
    expect(json.trip.id).toBe(TRIP_ID);
    expect(json.cancelledBookings).toBe(3);
    expectNoForbiddenFields(json);
    expect(mockCancelTrip).toHaveBeenCalledWith('op-org-1', TRIP_ID, VALID_BODY.reason);
  });

  it('returns 200 already_cancelled on idempotent re-cancel (NOT 422)', async () => {
    mockCancelTrip.mockResolvedValue({ trip: TRIP, alreadyCancelled: true });
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.already_cancelled).toBe(true);
    expect(json.ok).toBe(false);
    expectNoForbiddenFields(json);
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(VALID_BODY, false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockCancelTrip).not.toHaveBeenCalled();
  });

  it('returns 404 not_found (cross-op)', async () => {
    mockCancelTrip.mockRejectedValue(new TripServiceError('not_found'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  it('returns 422 validation_failed for a too-short reason', async () => {
    const res = await POST(makePost({ reason: 'short' }), ROUTE_CTX);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('validation_failed');
    expect(mockCancelTrip).not.toHaveBeenCalled();
  });
});
