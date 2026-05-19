/**
 * Unit tests for POST /api/op/trips/[id]/manual-booking (Issue 015).
 *
 * Coverage:
 *   - 200 success (paid + cash variants)
 *   - 422 validation_failed (bad schema)
 *   - 422 trip_not_bookable
 *   - 422 sold_out
 *   - 404 not_found (cross-op)
 *   - 503 ref_collision
 *   - 503 kill-switch (MANUAL_BOOKING_ENABLED=false)
 *   - 401 no auth cookie
 *   - 400 invalid JSON body
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCreateManualBooking,
  mockCookieStore,
  mockAfter,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCreateManualBooking: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockAfter: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/booking/createManualBooking', () => ({
  createManualBooking: mockCreateManualBooking,
}));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mockAfter };
});

import { POST } from '../route';
import { NextRequest } from 'next/server';

const TRIP_ID = 'test-trip-id-001';
const OPERATOR_ID = 'op-org-1';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: OPERATOR_ID,
};

const MOCK_BOOKING = {
  id: '01900000-0000-7000-8000-000000000001',
  bookingRef: 'BB-2026-ab12-cd34',
  confirmationToken: 'tok_abc',
  tripId: TRIP_ID,
  holdId: null,
  customerId: null,
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  ticketCount: 2,
  totalVnd: 300000,
  paymentMethod: 'cash',
  status: 'paid_operator_notified',
  isManual: true,
  createdAt: new Date('2026-05-19T10:00:00Z'),
};

function makePost(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/manual-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'bb_op_access=valid-token',
    },
    body: JSON.stringify(body),
  });
}

function makeCtx(id = TRIP_ID) {
  return { params: Promise.resolve({ id }) };
}

const VALID_BODY = {
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  ticketCount: 2,
  paymentMethod: 'paid',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-user-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: OPERATOR_ID,
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  delete process.env.MANUAL_BOOKING_ENABLED;
});

afterEach(() => {
  delete process.env.MANUAL_BOOKING_ENABLED;
});

describe('POST /api/op/trips/[id]/manual-booking', () => {
  it('200: paid booking created successfully', async () => {
    const mockAfterFn = vi.fn().mockResolvedValue(undefined);
    mockCreateManualBooking.mockResolvedValue({
      ok: true,
      booking: { ...MOCK_BOOKING, status: 'paid_operator_notified' },
      afterFn: mockAfterFn,
    });

    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.booking.status).toBe('paid_operator_notified');
    expect(json.booking.isManual).toBe(true);
    expect(mockAfter).toHaveBeenCalledWith(mockAfterFn);
  });

  it('200: cash booking created successfully', async () => {
    const mockAfterFn = vi.fn().mockResolvedValue(undefined);
    mockCreateManualBooking.mockResolvedValue({
      ok: true,
      booking: { ...MOCK_BOOKING, status: 'pending_cash_payment', paymentMethod: 'cash' },
      afterFn: mockAfterFn,
    });

    const res = await POST(makePost({ ...VALID_BODY, paymentMethod: 'cash' }), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.booking.status).toBe('pending_cash_payment');
  });

  it('422: validation_failed for missing required field', async () => {
    const res = await POST(makePost({ buyerName: 'Nguyen Van A', ticketCount: 2 }), makeCtx());
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('validation_failed');
    expect(mockCreateManualBooking).not.toHaveBeenCalled();
  });

  it('422: validation_failed for invalid paymentMethod', async () => {
    const res = await POST(makePost({ ...VALID_BODY, paymentMethod: 'momo' }), makeCtx());
    expect(res.status).toBe(422);
  });

  it('422: validation_failed for ticketCount = 0', async () => {
    const res = await POST(makePost({ ...VALID_BODY, ticketCount: 0 }), makeCtx());
    expect(res.status).toBe(422);
  });

  it('422: trip_not_bookable', async () => {
    mockCreateManualBooking.mockResolvedValue({ ok: false, reason: 'trip_not_bookable' });
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('trip_not_bookable');
  });

  it('422: sold_out (AC1)', async () => {
    mockCreateManualBooking.mockResolvedValue({ ok: false, reason: 'sold_out' });
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('sold_out');
  });

  it('404: not_found (cross-op tenant isolation)', async () => {
    mockCreateManualBooking.mockResolvedValue({ ok: false, reason: 'not_found' });
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  it('503: ref_collision', async () => {
    mockCreateManualBooking.mockResolvedValue({ ok: false, reason: 'ref_collision' });
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('ref_collision');
  });

  it('503: kill-switch MANUAL_BOOKING_ENABLED=false', async () => {
    process.env.MANUAL_BOOKING_ENABLED = 'false';
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.reason).toBe('feature_disabled');
    expect(mockCreateManualBooking).not.toHaveBeenCalled();
  });

  it('401: no auth cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(VALID_BODY), makeCtx());
    expect(res.status).toBe(401);
  });

  it('400: invalid JSON body', async () => {
    const req = new NextRequest(`http://localhost/api/op/trips/${TRIP_ID}/manual-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: 'not-valid-json',
    });
    const res = await POST(req, makeCtx());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_body');
  });
});
