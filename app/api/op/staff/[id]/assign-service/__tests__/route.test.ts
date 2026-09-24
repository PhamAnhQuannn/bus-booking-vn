/**
 * Unit tests for POST /api/op/staff/[id]/assign-service (Issue 017).
 *
 * adminOnly. Real HOF exercised (jwt + cookies + prisma.operatorUser mocked);
 * assignService mocked.
 *
 * Status codes verbatim from route source:
 *   404 not_found · 404 trip_not_found · 422 trip_not_assignable · 400 invalid_input(+issues).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockAssignService,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockAssignService: vi.fn(),
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
vi.mock('@/lib/staff/assignService', () => ({ assignService: mockAssignService }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { StaffServiceError } from '@/lib/staff/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const STAFF_ID = 'opu-staff';
const ROUTE_CTX = { params: Promise.resolve({ id: STAFF_ID }) };

const STAFF_DTO = {
  id: STAFF_ID,
  displayName: 'Staff Driver',
  phone: '+8490xxxxxx1',
  role: 'staff',
  requiresPasswordChange: false,
  disabled: false,
  assignedTripId: 'trip-7',
  createdAt: '2026-09-01T00:00:00.000Z',
};

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

const STAFF_USER = { ...OPERATOR_ADMIN, id: STAFF_ID, role: 'staff', assignedTripId: 'trip-9' };

function makePost(body: unknown, withCookie = true): NextRequest {
  return new NextRequest(`http://localhost/api/op/staff/${STAFF_ID}/assign-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { tripId: 'trip-7' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockAssignService.mockResolvedValue(STAFF_DTO);
});

describe('POST /api/op/staff/[id]/assign-service', () => {
  it('returns 200 { staff } on success', async () => {
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.staff.assignedTripId).toBe('trip-7');
    expectNoForbiddenFields(json);
    expect(mockAssignService).toHaveBeenCalledWith({ operatorId: 'op-org-1', staffId: STAFF_ID, tripId: 'trip-7' });
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(VALID_BODY, false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockAssignService).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin (staff) role — service NOT called', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
    expect(mockAssignService).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_input for a missing tripId', async () => {
    const res = await POST(makePost({}), ROUTE_CTX);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_input');
    expect(mockAssignService).not.toHaveBeenCalled();
  });

  it('returns 404 not_found (staff missing / cross-op)', async () => {
    mockAssignService.mockRejectedValue(new StaffServiceError('not_found'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 404 trip_not_found', async () => {
    mockAssignService.mockRejectedValue(new StaffServiceError('trip_not_found'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('trip_not_found');
  });

  it('returns 422 trip_not_assignable', async () => {
    mockAssignService.mockRejectedValue(new StaffServiceError('trip_not_assignable'));
    const res = await POST(makePost(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('trip_not_assignable');
  });
});
