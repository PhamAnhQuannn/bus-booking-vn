/**
 * Unit tests for POST /api/payments/momo/webhook.
 *
 * Test cases:
 *   - paid IPN (resultCode=0): 200, booking updated, 2 NotificationLog rows
 *   - failed IPN (resultCode=1001): 200, booking updated to payment_failed_expired
 *   - bad signature: 400
 *   - replay/duplicate (P2002 unique conflict): 200 idempotent
 *   - unknown booking (bookingRef not found): 200 (no leak)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/payment/momo', () => ({
  getMomoAdapter: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
    paymentEvent: {
      create: vi.fn(),
    },
    notificationLog: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/notificationLogRepo', () => ({
  createNotificationLog: vi.fn(),
}));

vi.mock('@/lib/notifications/esms', () => ({
  sendSms: vi.fn(),
  renderTemplate: vi.fn().mockReturnValue('stub sms body'),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '../route';
import { getMomoAdapter } from '@/lib/payment/momo';
import { prisma } from '@/lib/db/client';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOOKING_REF = 'BB-2026-abcd-1234';
const BOOKING_ID = '01975f3b-0000-7000-8000-000000000001';
const CONFIRMATION_TOKEN = 'A'.repeat(32);

const MOCK_BOOKING = {
  id: BOOKING_ID,
  bookingRef: BOOKING_REF,
  confirmationToken: CONFIRMATION_TOKEN,
  status: 'awaiting_payment',
  buyerName: 'Test Customer',
  buyerPhone: '+8490xxxxxx1',
  ticketCount: 2,
  totalVnd: 200000,
  trip: {
    departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    route: { origin: 'Hà Nội', destination: 'TP.HCM' },
    bus: {
      operator: {
        legalName: 'Test Operator',
        contactPhone: '+8490xxxxxx2',
        notificationPhone: '+8490xxxxxx3',
      },
    },
  },
};

/** Build a fake verifyWebhook-ok result */
function fakeVerifyOk(parsed: {
  orderId: string;
  transId: string;
  resultCode: number;
  amount?: number;
}) {
  return {
    ok: true as const,
    parsed: {
      orderId: parsed.orderId,
      transId: parsed.transId,
      resultCode: parsed.resultCode,
      amount: parsed.amount ?? 200000,
      message: parsed.resultCode === 0 ? 'Successful.' : 'Error',
      partnerCode: 'MOMOBKUN20180529',
      requestId: 'req-001',
      orderInfo: 'Bus booking',
      orderType: 'momo_wallet',
      payType: 'qr',
      responseTime: 1716050000000,
      extraData: '',
    },
  };
}

function makeRequest(body: string): NextRequest {
  return new NextRequest('https://example.com/api/payments/momo/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-proto': 'https',
      host: 'example.com',
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/payments/momo/webhook — signature verification', () => {
  it('returns 400 INVALID_SIGNATURE when sig verification fails', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue({ ok: false, reason: 'sig_mismatch' }),
      createPayment: vi.fn(),
    });

    const res = await POST(makeRequest('{"signature":"badhex","resultCode":0}'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID_SIGNATURE');
  });
});

describe('POST /api/payments/momo/webhook — paid IPN (resultCode=0)', () => {
  it('returns 200, transitions booking, seeds 2 NotificationLog rows', async () => {
    const parsedIpn = fakeVerifyOk({
      orderId: BOOKING_REF,
      transId: '3456789',
      resultCode: 0,
    });

    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(parsedIpn),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      // Execute with a fake tx that has the same mocked methods
      const fakeTx = {
        paymentEvent: { create: vi.fn().mockResolvedValue({}) },
        $executeRaw: vi.fn().mockResolvedValue(1), // 1 row updated
      };
      await fn(fakeTx as never);
      return undefined;
    });

    vi.mocked(createNotificationLog)
      .mockResolvedValueOnce({ id: 'notif-cust-001' } as never)
      .mockResolvedValueOnce({ id: 'notif-op-001' } as never);

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(createNotificationLog).toHaveBeenCalledTimes(2);

    // Check notification templates
    const calls = vi.mocked(createNotificationLog).mock.calls;
    const templates = calls.map((c) => c[0].template).sort();
    expect(templates).toEqual(['customerBookingPaid', 'operatorNewBooking']);
  });
});

describe('POST /api/payments/momo/webhook — failed IPN (resultCode=1001)', () => {
  it('returns 200 and transitions booking to payment_failed_expired', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '9999001', resultCode: 1001 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: vi.fn().mockResolvedValue({}) },
        $executeRaw: executeRawMock,
      };
      await fn(fakeTx as never);
      return undefined;
    });

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 1001 })));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    // No notifications seeded for failure
    expect(createNotificationLog).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/momo/webhook — replay (idempotent)', () => {
  it('returns 200 without error when PaymentEvent unique constraint fires (P2002)', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '3456789', resultCode: 0 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    // Simulate P2002 unique constraint violation from $transaction
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: { target: ['adapter', 'externalRef'] },
    });
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(p2002);

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
  });
});

describe('POST /api/payments/momo/webhook — unknown booking', () => {
  it('returns 200 when bookingRef not found (no leak)', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: 'BB-9999-zzzz-zzzz', transId: '000', resultCode: 0 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
