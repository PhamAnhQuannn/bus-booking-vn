/**
 * Unit tests for PATCH /api/op/trips/[id] — price-lock-after-sale (issue 035, S15#6).
 *
 * Coverage:
 *   - 422 price_locked_after_sale when a price change is attempted on a trip with ≥1 paid booking
 *   - 200 when price changed on a trip with zero paid bookings
 *   - 200 when a non-price field (salesClosed) is changed even with paid bookings
 *   - 422 already_cancelled
 *   - 404 not_found (cross-op / missing)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyOperatorAccess, mockOperatorFindUnique, mockCookieStore, mockTx, mockTransaction } =
  vi.hoisted(() => {
    const tx = {
      $queryRaw: vi.fn(),
      booking: { count: vi.fn() },
      trip: { update: vi.fn() },
    };
    return {
      mockVerifyOperatorAccess: vi.fn(),
      mockOperatorFindUnique: vi.fn(),
      mockCookieStore: { get: vi.fn() },
      mockTx: tx,
      mockTransaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
  });

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    $transaction: mockTransaction,
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/trips/toTripDto', () => ({ toTripDto: (t: unknown) => t }));

import { PATCH } from '../route';
import { NextRequest } from 'next/server';

const TRIP_ID = 'trip-001';
const OPERATOR_ID = 'op-org-1';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: OPERATOR_ID,
  role: 'owner',
};

function makeReq(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/op/trips/trip-001', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: 'bb_op_at=tok' },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: TRIP_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'op-access-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: OPERATOR_USER.id,
    operatorId: OPERATOR_ID,
    role: 'owner',
    requiresPasswordChange: false,
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
});

describe('PATCH /api/op/trips/[id] — price-lock-after-sale', () => {
  it('returns 422 price_locked_after_sale when price change attempted on a trip with paid bookings', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: TRIP_ID, status: 'scheduled' }]);
    mockTx.booking.count.mockResolvedValue(2); // 2 paid bookings

    const res = await PATCH(makeReq({ price: 150000 }), ctx);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('price_locked_after_sale');
    expect(mockTx.trip.update).not.toHaveBeenCalled();
  });

  it('allows price change when no paid bookings exist', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: TRIP_ID, status: 'scheduled' }]);
    mockTx.booking.count.mockResolvedValue(0);
    mockTx.trip.update.mockResolvedValue({ id: TRIP_ID, price: 150000 });

    const res = await PATCH(makeReq({ price: 150000 }), ctx);
    expect(res.status).toBe(200);
    expect(mockTx.trip.update).toHaveBeenCalledOnce();
  });

  it('allows a non-price field change (salesClosed) even with paid bookings (no lock check)', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: TRIP_ID, status: 'scheduled' }]);
    mockTx.trip.update.mockResolvedValue({ id: TRIP_ID, salesClosed: true });

    const res = await PATCH(makeReq({ salesClosed: true }), ctx);
    expect(res.status).toBe(200);
    expect(mockTx.booking.count).not.toHaveBeenCalled(); // lock check skipped (no price)
    expect(mockTx.trip.update).toHaveBeenCalledOnce();
  });

  it('returns 422 already_cancelled for a cancelled trip', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: TRIP_ID, status: 'cancelled' }]);

    const res = await PATCH(makeReq({ price: 150000 }), ctx);
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('already_cancelled');
  });

  it('returns 404 when the trip is not found / cross-op', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    const res = await PATCH(makeReq({ price: 150000 }), ctx);
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe('not_found');
  });
});
