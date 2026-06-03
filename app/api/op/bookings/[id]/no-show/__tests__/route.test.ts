/**
 * Issue 073 — POST /api/op/bookings/:id/no-show route tests.
 *
 * Covers: ok → 200, already_checked_in → 422, not_found → 404, staff scope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockMarkNoShow,
  mockResolveBookingTripId,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockMarkNoShow: vi.fn(),
  mockResolveBookingTripId: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/booking/checkIn', () => ({ markNoShow: mockMarkNoShow }));
vi.mock('@/lib/booking/resolveBookingTripId', () => ({ resolveBookingTripId: mockResolveBookingTripId }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const ADMIN_USER = {
  id: 'op-1', phone: '+8490xxxxxx1', displayName: 'Op Admin',
  requiresPasswordChange: false, disabledAt: null, operatorId: 'op-org-1',
  role: 'admin', assignedTripId: null,
};

function makePost(id = 'b1') {
  return {
    req: new NextRequest(`http://localhost/api/op/bookings/${id}/no-show`, {
      method: 'POST', headers: { Cookie: 'bb_op_access=valid-token' },
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(ADMIN_USER);
});

describe('POST /api/op/bookings/[id]/no-show', () => {
  it('ok → 200 { ok:true }', async () => {
    mockMarkNoShow.mockResolvedValue({ ok: true });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockMarkNoShow).toHaveBeenCalledWith(expect.anything(), { bookingId: 'b1', operatorId: 'op-org-1' });
  });

  it('already_checked_in → 422', async () => {
    mockMarkNoShow.mockResolvedValue({ ok: false, reason: 'already_checked_in' });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('already_checked_in');
  });

  it('not_found → 404', async () => {
    mockMarkNoShow.mockResolvedValue({ ok: false, reason: 'not_found' });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it('staff on a different trip → 404 (resolver mismatch)', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...ADMIN_USER, role: 'staff', assignedTripId: 't-assigned' });
    mockResolveBookingTripId.mockResolvedValue('t-other');
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    expect(mockMarkNoShow).not.toHaveBeenCalled();
  });
});
