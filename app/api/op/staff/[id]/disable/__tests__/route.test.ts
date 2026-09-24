/**
 * Unit tests for POST /api/op/staff/[id]/disable (Issue 017).
 *
 * adminOnly. Idempotent: re-disabling an already-disabled staff is a 200 no-op.
 * Real HOF exercised (jwt + cookies + prisma.operatorUser mocked); disableStaff mocked.
 *
 * Coverage: 200 happy · 200 idempotent re-disable · 401 no cookie · 403 staff role · 404 not_found.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockDisableStaff,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockDisableStaff: vi.fn(),
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
vi.mock('@/lib/staff/disableStaff', () => ({ disableStaff: mockDisableStaff }));

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
  disabled: true,
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

function makePost(withCookie = true): NextRequest {
  return new NextRequest(`http://localhost/api/op/staff/${STAFF_ID}/disable`, {
    method: 'POST',
    headers: withCookie ? { Cookie: 'bb_op_access=valid-token' } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockDisableStaff.mockResolvedValue(STAFF_DTO);
});

describe('POST /api/op/staff/[id]/disable', () => {
  it('returns 200 { staff } on success', async () => {
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.staff.disabled).toBe(true);
    expectNoForbiddenFields(json);
    expect(mockDisableStaff).toHaveBeenCalledWith({ operatorId: 'op-org-1', staffId: STAFF_ID });
  });

  it('returns 200 no-op on idempotent re-disable', async () => {
    // disableStaff resolves the same already-disabled DTO — route still 200.
    mockDisableStaff.mockResolvedValue({ ...STAFF_DTO, disabled: true });
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(200);
    expect((await res.json()).staff.disabled).toBe(true);
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(false), ROUTE_CTX);
    expect(res.status).toBe(401);
    expect(mockDisableStaff).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin (staff) role — service NOT called', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
    expect(mockDisableStaff).not.toHaveBeenCalled();
  });

  it('returns 404 not_found (cross-op / not staff)', async () => {
    mockDisableStaff.mockRejectedValue(new StaffServiceError('not_found'));
    const res = await POST(makePost(), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});
