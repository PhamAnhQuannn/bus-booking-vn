/**
 * Unit tests for POST /api/op/trips/[id]/reassign-bus (Issue 013 AC3).
 *
 * Route is requireOperatorAuth({}). Real HOF exercised (jwt + cookies +
 * prisma.operatorUser mocked); reassignBus mocked.
 *
 * Status codes verbatim from route source:
 *   404 not_found · 422 bus_deactivated · 422 bus_in_maintenance
 *   422 capacity_too_small { required, provided } · 409 bus_overlap_with_outbound
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockReassignBus,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockReassignBus: vi.fn(),
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
vi.mock('@/lib/trips/reassignBus', () => ({ reassignBus: mockReassignBus }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { TripServiceError } from '@/lib/trips/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const TRIP_ID = 'trip-1';
const ROUTE_CTX = { params: Promise.resolve({ id: TRIP_ID }) };
const TRIP = { id: TRIP_ID, busId: 'bus-9', operatorId: 'op-org-1' };

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
  return new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/reassign-bus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { busId: 'bus-9' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockReassignBus.mockResolvedValue(TRIP);
});

describe('POST /api/op/trips/[id]/reassign-bus', () => {
  it('returns 200 { trip } on success', async () => {
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trip.id).toBe(TRIP_ID);
    expectNoForbiddenFields(json);
    expect(mockReassignBus).toHaveBeenCalledWith('op-org-1', TRIP_ID, 'bus-9');
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(VALID_BODY, false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockReassignBus).not.toHaveBeenCalled();
  });

  it('returns 422 validation_failed for a missing busId', async () => {
    const res = await POST(makePost({}), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('validation_failed');
    expect(mockReassignBus).not.toHaveBeenCalled();
  });

  it('returns 404 not_found', async () => {
    mockReassignBus.mockRejectedValue(new TripServiceError('not_found'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 422 bus_deactivated', async () => {
    mockReassignBus.mockRejectedValue(new TripServiceError('bus_deactivated'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('bus_deactivated');
  });

  it('returns 422 bus_in_maintenance', async () => {
    mockReassignBus.mockRejectedValue(new TripServiceError('bus_in_maintenance'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('bus_in_maintenance');
  });

  it('returns 422 capacity_too_small with { required, provided } meta echoed', async () => {
    mockReassignBus.mockRejectedValue(new TripServiceError('capacity_too_small', { required: 45, provided: 29 }));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('capacity_too_small');
    expect(json.required).toBe(45);
    expect(json.provided).toBe(29);
  });

  it('returns 409 bus_overlap_with_outbound', async () => {
    mockReassignBus.mockRejectedValue(new TripServiceError('bus_overlap_with_outbound'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('bus_overlap_with_outbound');
  });
});
