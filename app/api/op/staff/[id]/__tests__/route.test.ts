/**
 * Unit tests for PATCH /api/op/staff/[id] (Issue 017) — rename a staff member.
 *
 * adminOnly. Real HOF exercised (jwt + cookies + prisma.operatorUser mocked);
 * updateStaff mocked. Route exports PATCH only (no GET).
 *
 * Note: unlike POST /api/op/staff (opaque invalid_input), this PATCH DOES echo
 * `issues` on a schema failure — asserted below.
 *
 * Coverage: 200 happy · 401 no cookie · 403 staff role · 400 invalid_input(+issues) · 404 not_found.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockUpdateStaff,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockUpdateStaff: vi.fn(),
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
vi.mock('@/lib/staff/updateStaff', () => ({ updateStaff: mockUpdateStaff }));

import { PATCH } from '../route';
import { NextRequest } from 'next/server';
import { StaffServiceError } from '@/lib/staff/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const STAFF_ID = 'opu-staff';
const ROUTE_CTX = { params: Promise.resolve({ id: STAFF_ID }) };

const STAFF_DTO = {
  id: STAFF_ID,
  displayName: 'New Name',
  phone: '+8490xxxxxx1',
  role: 'staff',
  requiresPasswordChange: false,
  disabled: false,
  assignedTripId: null,
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

function makePatch(body: unknown, withCookie = true): NextRequest {
  return new NextRequest(`http://localhost/api/op/staff/${STAFF_ID}`, {
    method: 'PATCH',
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
  mockUpdateStaff.mockResolvedValue(STAFF_DTO);
});

describe('PATCH /api/op/staff/[id]', () => {
  it('returns 200 { staff } on success', async () => {
    const res = await PATCH(makePatch({ name: 'New Name' }), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.staff.displayName).toBe('New Name');
    expectNoForbiddenFields(json);
    expect(mockUpdateStaff).toHaveBeenCalledWith({ operatorId: 'op-org-1', staffId: STAFF_ID, name: 'New Name' });
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await PATCH(makePatch({ name: 'New Name' }, false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockUpdateStaff).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin (staff) role — service NOT called', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await PATCH(makePatch({ name: 'New Name' }), ROUTE_CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
    expect(mockUpdateStaff).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_input WITH an issues array (PATCH echoes issues)', async () => {
    const res = await PATCH(makePatch({ name: '' }), ROUTE_CTX);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
    expect(Array.isArray(json.issues)).toBe(true);
    expect(mockUpdateStaff).not.toHaveBeenCalled();
  });

  it('returns 404 not_found (cross-op / not staff)', async () => {
    mockUpdateStaff.mockRejectedValue(new StaffServiceError('not_found'));
    const res = await PATCH(makePatch({ name: 'New Name' }), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});
