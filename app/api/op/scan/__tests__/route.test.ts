/**
 * Issue 073 — POST /api/op/scan route tests (mocked auth + scanTicket).
 *
 * Covers: reason→status mapping (invalid/wrong-operator→404, not_paid→422, ok→200),
 * missing token → 422, staff trip-scope (assigned trip ok, other trip → 404).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockScanTicket,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockScanTicket: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/booking/checkIn', () => ({ scanTicket: mockScanTicket }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const ADMIN_USER = {
  id: 'op-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
  role: 'admin',
  assignedTripId: null,
};

function makePost(token: unknown = 'tok') {
  return new NextRequest('http://localhost/api/op/scan', {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token', 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(ADMIN_USER);
});

describe('POST /api/op/scan', () => {
  it('missing token → 422', async () => {
    const req = new NextRequest('http://localhost/api/op/scan', {
      method: 'POST',
      headers: { Cookie: 'bb_op_access=valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    expect(mockScanTicket).not.toHaveBeenCalled();
  });

  it('invalid_token → 404', async () => {
    mockScanTicket.mockResolvedValue({ ok: false, reason: 'invalid_token' });
    const res = await POST(makePost());
    expect(res.status).toBe(404);
  });

  it('wrong_operator → 404', async () => {
    mockScanTicket.mockResolvedValue({ ok: false, reason: 'wrong_operator' });
    const res = await POST(makePost());
    expect(res.status).toBe(404);
  });

  it('not_paid → 422', async () => {
    mockScanTicket.mockResolvedValue({ ok: false, reason: 'not_paid' });
    const res = await POST(makePost());
    expect(res.status).toBe(422);
  });

  it('ok → 200 with booking', async () => {
    mockScanTicket.mockResolvedValue({
      ok: true,
      booking: { id: 'b1', bookingRef: 'BB-x', ticketCount: 1, buyerName: 'A', checkedInAt: null, noShowAt: null, status: 'paid', tripId: 't1' },
    });
    const res = await POST(makePost());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.booking.bookingRef).toBe('BB-x');
    expect(mockScanTicket).toHaveBeenCalledWith(expect.anything(), { token: 'tok', operatorId: 'op-org-1' });
  });

  it('staff scanning a booking on a DIFFERENT trip → 404', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...ADMIN_USER, role: 'staff', assignedTripId: 't-assigned' });
    mockScanTicket.mockResolvedValue({
      ok: true,
      booking: { id: 'b1', bookingRef: 'BB-x', ticketCount: 1, buyerName: 'A', checkedInAt: null, noShowAt: null, status: 'paid', tripId: 't-other' },
    });
    const res = await POST(makePost());
    expect(res.status).toBe(404);
  });

  it('staff scanning a booking on their assigned trip → 200', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...ADMIN_USER, role: 'staff', assignedTripId: 't-assigned' });
    mockScanTicket.mockResolvedValue({
      ok: true,
      booking: { id: 'b1', bookingRef: 'BB-x', ticketCount: 1, buyerName: 'A', checkedInAt: null, noShowAt: null, status: 'paid', tripId: 't-assigned' },
    });
    const res = await POST(makePost());
    expect(res.status).toBe(200);
  });
});
