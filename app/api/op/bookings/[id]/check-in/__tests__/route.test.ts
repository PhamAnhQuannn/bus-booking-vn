/**
 * Issue 073 — POST /api/op/bookings/:id/check-in route tests.
 *
 * Covers: ok → 200 { alreadyCheckedIn }, idempotent → 200 alreadyCheckedIn:true,
 * not_found → 404, staff scope (resolveBookingTripId mismatch → 404).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockCheckInBooking,
  mockResolveBookingTripId,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockCheckInBooking: vi.fn(),
  mockResolveBookingTripId: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/booking/checkIn', () => ({ checkInBooking: mockCheckInBooking }));
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
    req: new NextRequest(`http://localhost/api/op/bookings/${id}/check-in`, {
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

describe('POST /api/op/bookings/[id]/check-in', () => {
  it('ok → 200 { ok:true, alreadyCheckedIn:false }', async () => {
    mockCheckInBooking.mockResolvedValue({ ok: true, alreadyCheckedIn: false });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, alreadyCheckedIn: false });
    expect(mockCheckInBooking).toHaveBeenCalledWith(expect.anything(), { bookingId: 'b1', operatorId: 'op-org-1' });
  });

  it('idempotent double scan → 200 alreadyCheckedIn:true', async () => {
    mockCheckInBooking.mockResolvedValue({ ok: true, alreadyCheckedIn: true });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyCheckedIn).toBe(true);
  });

  it('not_found → 404', async () => {
    mockCheckInBooking.mockResolvedValue({ ok: false, reason: 'not_found' });
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
    expect(mockCheckInBooking).not.toHaveBeenCalled();
  });

  it('staff on their assigned trip → 200', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...ADMIN_USER, role: 'staff', assignedTripId: 't-assigned' });
    mockResolveBookingTripId.mockResolvedValue('t-assigned');
    mockCheckInBooking.mockResolvedValue({ ok: true, alreadyCheckedIn: false });
    const { req, ctx } = makePost();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
  });
});
