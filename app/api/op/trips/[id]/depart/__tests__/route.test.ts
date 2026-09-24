/**
 * Unit tests for POST /api/op/trips/[id]/depart (Issue 014 AC5).
 *
 * Route is requireOperatorAuth({ staffTripScope: () => id }) — NO body.
 * Real HOF exercised (jwt + cookies + prisma.operatorUser mocked); markDeparted mocked.
 *
 * Coverage:
 *   - 200 happy path (admin).
 *   - 200 alreadyDeparted idempotent.
 *   - 401 without cookie.
 *   - 404 staff assigned to a DIFFERENT trip (staffTripScope reject, service NOT called).
 *   - 404 not_found + 422 trip_cancelled domain errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockMarkDeparted,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockMarkDeparted: vi.fn(),
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
vi.mock('@/lib/trips/markDeparted', () => ({ markDeparted: mockMarkDeparted }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { TripServiceError } from '@/lib/trips/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const TRIP_ID = 'trip-1';
const ROUTE_CTX = { params: Promise.resolve({ id: TRIP_ID }) };
const TRIP = { id: TRIP_ID, status: 'departed', operatorId: 'op-org-1', salesClosed: true };

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

const STAFF_USER = {
  ...OPERATOR_ADMIN,
  id: 'opu-staff',
  displayName: 'Staff Driver',
  role: 'staff',
  assignedTripId: 'trip-OTHER',
};

function makePost(withCookie = true): NextRequest {
  return new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/depart`, {
    method: 'POST',
    headers: withCookie ? { Cookie: 'bb_op_access=valid-token' } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockMarkDeparted.mockResolvedValue({ ok: true, alreadyDeparted: false, trip: TRIP });
});

describe('POST /api/op/trips/[id]/depart', () => {
  it('returns 200 on success (admin)', async () => {
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyDeparted).toBe(false);
    expect(json.trip.id).toBe(TRIP_ID);
    expectNoForbiddenFields(json);
    expect(mockMarkDeparted).toHaveBeenCalledWith('op-org-1', TRIP_ID);
  });

  it('returns 200 alreadyDeparted on idempotent re-depart', async () => {
    mockMarkDeparted.mockResolvedValue({ ok: false, alreadyDeparted: true, trip: TRIP });
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyDeparted).toBe(true);
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockMarkDeparted).not.toHaveBeenCalled();
  });

  it('returns 404 for a staff member assigned to a DIFFERENT trip (service NOT called)', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
    expect(mockMarkDeparted).not.toHaveBeenCalled();
  });

  it('returns 404 not_found domain error', async () => {
    mockMarkDeparted.mockRejectedValue(new TripServiceError('not_found'));
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 422 trip_cancelled', async () => {
    mockMarkDeparted.mockRejectedValue(new TripServiceError('trip_cancelled'));
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('trip_cancelled');
  });
});
