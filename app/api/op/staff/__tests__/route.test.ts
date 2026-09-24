/**
 * Unit tests for /api/op/staff (Issue 017) — GET list + POST create.
 *
 * Both adminOnly. Real HOF exercised (jwt + cookies + prisma.operatorUser mocked);
 * listStaff + createStaff mocked.
 *
 * Coverage:
 *   GET  → 200 { staff:[...] } · 401 no cookie · 403 staff role (service NOT called).
 *   POST → 201 { staff } · 400 invalid_input (opaque, NO issues array per #566) ·
 *          409 phone_in_use · 403 staff role.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockListStaff,
  mockCreateStaff,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockListStaff: vi.fn(),
  mockCreateStaff: vi.fn(),
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
vi.mock('@/lib/staff/listStaff', () => ({ listStaff: mockListStaff }));
vi.mock('@/lib/staff/createStaff', () => ({ createStaff: mockCreateStaff }));

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { StaffServiceError } from '@/lib/staff/errors';
import { expectNoForbiddenFields } from '@/test/helpers/responseShape';

const STAFF_DTO = {
  id: 'opu-staff',
  displayName: 'Staff Driver',
  phone: '+8490xxxxxx1',
  role: 'staff',
  requiresPasswordChange: true,
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

const STAFF_USER = { ...OPERATOR_ADMIN, id: 'opu-staff', role: 'staff', assignedTripId: 'trip-9' };

function makeReq(method: 'GET' | 'POST', body?: unknown, withCookie = true): NextRequest {
  return new NextRequest('http://localhost/api/op/staff', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'opu-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_ADMIN);
  mockListStaff.mockResolvedValue([STAFF_DTO]);
  mockCreateStaff.mockResolvedValue(STAFF_DTO);
});

describe('GET /api/op/staff', () => {
  it('returns 200 { staff:[...] }', async () => {
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.staff).toHaveLength(1);
    expect(json.staff[0].id).toBe('opu-staff');
    expectNoForbiddenFields(json);
  });

  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await GET(makeReq('GET', undefined, false));
    expect(res.status).toBe(401);
    expect(mockListStaff).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin (staff) role — service NOT called', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
    expect(mockListStaff).not.toHaveBeenCalled();
  });
});

describe('POST /api/op/staff', () => {
  // +84901234567 = canonical fabricated doc-example number (allowlisted in .gitleaks.toml)
  // and passes the real normalizePhone refinement in CreateStaffSchema.
  const VALID_BODY = { name: 'Nguyen Van A', phone: '+84901234567' };

  it('returns 201 { staff } on success', async () => {
    const res = await POST(makeReq('POST', VALID_BODY));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.staff.id).toBe('opu-staff');
    expectNoForbiddenFields(json);
    expect(mockCreateStaff).toHaveBeenCalledTimes(1);
    expect(mockCreateStaff.mock.calls[0][0].operatorId).toBe('op-org-1');
  });

  it('returns 400 invalid_input WITHOUT an issues array (opaque, #566 SEC-ZOD-LEAK)', async () => {
    const res = await POST(makeReq('POST', { name: '', phone: 'not-a-phone' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
    expect(json.issues).toBeUndefined();
    expect(mockCreateStaff).not.toHaveBeenCalled();
  });

  it('returns 409 phone_in_use on phone collision', async () => {
    mockCreateStaff.mockRejectedValue(new StaffServiceError('phone_in_use'));
    const res = await POST(makeReq('POST', VALID_BODY));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('phone_in_use');
  });

  it('returns 403 for a non-admin (staff) role — service NOT called', async () => {
    mockOperatorFindUnique.mockResolvedValue(STAFF_USER);
    const res = await POST(makeReq('POST', VALID_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
    expect(mockCreateStaff).not.toHaveBeenCalled();
  });
});
