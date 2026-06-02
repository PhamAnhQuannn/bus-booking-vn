/**
 * Unit tests for initiateMomoBooking orchestrator.
 *
 * Uses FakePaymentGateway injection — no real DB, no real MoMo calls.
 * DB layer is mocked via vi.mock.
 *
 * Covers:
 *   - happy path: creates booking with status=awaiting_payment, 0 NotificationLog
 *   - gateway failure: hold reverts to active, booking rolled back
 *   - hold_not_found, hold_expired, trip_departed error paths
 *   - idempotency: second call with same holdId returns existing booking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PaymentGateway, CreatePaymentInput } from '@/lib/payment/gateway';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/bookingRepo', () => ({
  createOnlineBookingFromHold: vi.fn(),
  getBookingByHoldId: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    hold: {
      findUnique: vi.fn(),
    },
    trip: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/booking/attachGuestBooking', () => ({
  attachGuestBooking: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { initiateMomoBooking } from '../initiateMomoBooking';
import { createOnlineBookingFromHold, getBookingByHoldId } from '@/lib/db/bookingRepo';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const BASE_URL = 'https://example.com';
const HOLD_ID = 'ckhold000001';
const BOOKING_ID = '01975f3b-0000-7000-8000-000000000001';
const CONFIRMATION_TOKEN = 'A'.repeat(32);
const BOOKING_REF = 'BB-2026-abcd-1234';
const TOTAL_VND = 200000;

const MOCK_HOLD = {
  id: HOLD_ID,
  status: 'active' as const,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  customerName: 'Test Customer',
  customerPhone: '+8490xxxxxx1',
  customerEmail: 'buyer@example.com',
  ticketCount: 2,
  trip: {
    id: 'tripid001',
    departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    price: 100000,
    route: { origin: 'Hà Nội', destination: 'TP.HCM' },
    // Issue 046: operator must be APPROVED for the bookable re-check to pass.
    operator: { status: 'APPROVED' as const },
  },
};

const MOCK_BOOKING_ROW = {
  id: BOOKING_ID,
  bookingRef: BOOKING_REF,
  confirmationToken: CONFIRMATION_TOKEN,
  tripId: MOCK_HOLD.trip.id,
  holdId: HOLD_ID,
  buyerName: MOCK_HOLD.customerName,
  buyerPhone: MOCK_HOLD.customerPhone,
  buyerEmail: MOCK_HOLD.customerEmail,
  ticketCount: 2,
  totalVnd: TOTAL_VND,
  paymentMethod: 'momo' as const,
  status: 'awaiting_payment' as const,
  isManual: false,
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// FakePaymentGateway factory
// ---------------------------------------------------------------------------

interface FakeGatewayOptions {
  payUrl?: string;
  shouldFail?: boolean;
  failureError?: string;
}

function makeFakeGateway(opts: FakeGatewayOptions = {}): PaymentGateway & {
  calls: CreatePaymentInput[];
} {
  const calls: CreatePaymentInput[] = [];
  return {
    calls,
    createPayment: vi.fn(async (input: CreatePaymentInput) => {
      calls.push(input);
      if (opts.shouldFail) {
        return { ok: false as const, error: opts.failureError ?? 'gateway_error' };
      }
      return {
        ok: true as const,
        payUrl: opts.payUrl ?? 'https://payment.momo.vn/pay/app?test=1',
        externalRef: input.orderId,
      };
    }),
    verifyWebhook: () => ({ ok: false, reason: 'not_used_in_these_tests' }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initiateMomoBooking — happy path', () => {
  it('creates awaiting_payment booking, returns payUrl, zero NotificationLog at initiate', async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(MOCK_HOLD as never);
    vi.mocked(getBookingByHoldId).mockResolvedValueOnce(null); // idempotency check
    vi.mocked(createOnlineBookingFromHold).mockResolvedValue({
      ok: true,
      booking: MOCK_BOOKING_ROW,
    });

    const gateway = makeFakeGateway({
      payUrl: 'https://payment.momo.vn/pay/app?orderId=BB-2026-abcd-1234',
    });

    const result = await initiateMomoBooking({ holdId: HOLD_ID, baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.confirmationToken).toBe(CONFIRMATION_TOKEN);
    expect(result.payUrl).toContain('payment.momo.vn');

    // Issue 042: buyerEmail snapshot threads from the hold into the booking insert.
    expect(createOnlineBookingFromHold).toHaveBeenCalledWith(
      expect.objectContaining({ buyerEmail: 'buyer@example.com' }),
      'momo'
    );

    // Verify gateway was called with correct params
    expect(gateway.calls.length).toBe(1);
    expect(gateway.calls[0].orderId).toBe(BOOKING_REF);
    expect(gateway.calls[0].amount).toBe(TOTAL_VND);
    expect(gateway.calls[0].ipnUrl).toBe(`${BASE_URL}/api/payments/momo/webhook`);
    expect(gateway.calls[0].redirectUrl).toBe(`${BASE_URL}/booking/result/${CONFIRMATION_TOKEN}`);

    // Zero NotificationLog rows seeded (AC-F1 — notifications deferred to IPN)
    // (In this unit test, notificationLogRepo is not called — no mock needed)
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
  });
});

describe('initiateMomoBooking — gateway failure', () => {
  it('compensates (deletes booking + reverts hold) when gateway fails', async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(MOCK_HOLD as never);
    vi.mocked(getBookingByHoldId).mockResolvedValueOnce(null);
    vi.mocked(createOnlineBookingFromHold).mockResolvedValue({
      ok: true,
      booking: MOCK_BOOKING_ROW,
    });
    vi.mocked(prisma.$transaction).mockResolvedValue([1, 1] as never);

    const gateway = makeFakeGateway({ shouldFail: true, failureError: 'network_timeout' });

    const result = await initiateMomoBooking({ holdId: HOLD_ID, baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('gateway_error');
    expect(result.gatewayMessage).toBe('network_timeout');

    // Compensating $transaction should have been called
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledOnce();
  });
});

describe('initiateMomoBooking — error paths', () => {
  it('returns hold_not_found when hold does not exist', async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(null);

    const gateway = makeFakeGateway();
    const result = await initiateMomoBooking({ holdId: 'nonexistent', baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('hold_not_found');
    expect(gateway.calls.length).toBe(0);
  });

  it('returns trip_departed when trip departureAt is in the past', async () => {
    const departedHold = {
      ...MOCK_HOLD,
      trip: { ...MOCK_HOLD.trip, departureAt: new Date(Date.now() - 60_000) },
    };
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(departedHold as never);
    vi.mocked(getBookingByHoldId).mockResolvedValueOnce(null);

    const gateway = makeFakeGateway();
    const result = await initiateMomoBooking({ holdId: HOLD_ID, baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('trip_departed');
    expect(gateway.calls.length).toBe(0);
  });

  it('returns hold_expired when repo returns hold_expired', async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(MOCK_HOLD as never);
    vi.mocked(getBookingByHoldId).mockResolvedValueOnce(null);
    vi.mocked(createOnlineBookingFromHold).mockResolvedValue({ ok: false, reason: 'hold_expired' });
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as never);

    const gateway = makeFakeGateway();
    const result = await initiateMomoBooking({ holdId: HOLD_ID, baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('hold_expired');
    expect(gateway.calls.length).toBe(0);
  });
});

describe('initiateMomoBooking — idempotency', () => {
  it('returns existing booking when getBookingByHoldId finds one', async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(MOCK_HOLD as never);
    vi.mocked(getBookingByHoldId).mockResolvedValueOnce({
      id: BOOKING_ID,
      confirmationToken: CONFIRMATION_TOKEN,
    });

    const gateway = makeFakeGateway();
    const result = await initiateMomoBooking({ holdId: HOLD_ID, baseUrl: BASE_URL, gateway });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.confirmationToken).toBe(CONFIRMATION_TOKEN);
    // No new gateway call
    expect(gateway.calls.length).toBe(0);
    // No DB insert
    expect(createOnlineBookingFromHold).not.toHaveBeenCalled();
  });
});
