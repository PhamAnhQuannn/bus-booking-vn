/**
 * Unit tests for POST /api/op/trips/[id]/sales-toggle (Issue 013 AC7).
 *
 * Route is requireOperatorAuth({}). Real HOF exercised (jwt + cookies +
 * prisma.operatorUser mocked); salesToggle mocked.
 *
 * Coverage: 200 happy · 401 no cookie · 422 validation_failed · 404 not_found.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockSalesToggle,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockSalesToggle: vi.fn(),
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
vi.mock('@/lib/trips/salesToggle', () => ({ salesToggle: mockSalesToggle }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { TripServiceError } from '@/lib/trips/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const TRIP_ID = 'trip-1';
const ROUTE_CTX = { params: Promise.resolve({ id: TRIP_ID }) };
const TRIP = { id: TRIP_ID, salesClosed: true, operatorId: 'op-org-1' };

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
  return new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/sales-toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockSalesToggle.mockResolvedValue(TRIP);
});

describe('POST /api/op/trips/[id]/sales-toggle', () => {
  it('returns 200 { trip } on success', async () => {
    const res = await POST(makePost({ salesClosed: true }), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trip.id).toBe(TRIP_ID);
    expectNoForbiddenFields(json);
    expect(mockSalesToggle).toHaveBeenCalledWith('op-org-1', TRIP_ID, true);
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost({ salesClosed: true }, false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockSalesToggle).not.toHaveBeenCalled();
  });

  it('returns 422 validation_failed when salesClosed is missing / non-boolean', async () => {
    const res = await POST(makePost({ salesClosed: 'yes' }), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('validation_failed');
    expect(mockSalesToggle).not.toHaveBeenCalled();
  });

  it('returns 404 not_found (cross-op)', async () => {
    mockSalesToggle.mockRejectedValue(new TripServiceError('not_found'));
    const res = await POST(makePost({ salesClosed: false }), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});
