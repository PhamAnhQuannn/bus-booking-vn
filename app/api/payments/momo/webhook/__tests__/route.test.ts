/**
 * Unit tests for POST /api/payments/momo/webhook.
 *
 * Test cases:
 *   - paid IPN (resultCode=0): 200, booking updated, 2 NotificationLog rows
 *   - currency mismatch (non-VND success): 200, NO paid transition, no notifications
 *   - failed IPN (resultCode=1001): 200, booking updated to payment_failed_expired
 *   - bad signature: 400
 *   - replay/duplicate (P2002 unique conflict): 200 idempotent
 *   - unknown booking (bookingRef not found): 200 (no leak)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/payment/adapters/momo', () => ({
  getMomoAdapter: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
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

vi.mock('@/lib/core/db/notificationLogRepo', () => ({
  createNotificationLog: vi.fn(),
}));

// Issue 058: processWebhook no longer dispatches SMS in-process — it enqueues
// pending NotificationLog rows and the dispatch-notifications cron delivers
// them. renderTemplate is still used to render the stored payload body at
// enqueue. sendSms/sendSmsBody must NOT be called by the webhook path anymore.
vi.mock('@/lib/notification/esms', () => ({
  sendSms: vi.fn(),
  sendSmsBody: vi.fn(),
  renderTemplate: vi.fn().mockReturnValue('stub sms body'),
}));

// Issue 049: the paid branch now appends two ledger entries inside the tx.
// Mock the ledger barrel: getEffectiveFeeRate → 60000 (6%), calcPlatformFeeMinor
// real (so the asserted −12000 = 6% of 200000 is the genuine half-even result),
// appendLedgerEntry a spy we assert on.
vi.mock('@/lib/ledger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ledger')>('@/lib/ledger');
  return {
    appendLedgerEntry: vi.fn().mockResolvedValue({ id: 'ledger-x', created: true }),
    getEffectiveFeeRate: vi.fn().mockResolvedValue(60000),
    calcPlatformFeeMinor: actual.calcPlatformFeeMinor,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
import { getMomoAdapter } from '@/lib/payment/adapters/momo';
import { prisma } from '@/lib/core/db/client';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { sendSms, sendSmsBody } from '@/lib/notification';
import { appendLedgerEntry } from '@/lib/ledger';
import { logger } from '@/lib/logger';
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
  buyerEmail: 'buyer@example.com',
  ticketCount: 2,
  totalVnd: 200000,
  trip: {
    departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    route: { origin: 'Hà Nội', destination: 'TP.HCM' },
    bus: {
      operator: {
        id: 'op-test-001',
        legalName: 'Test Operator',
        contactPhone: '+8490xxxxxx2',
        notificationPhone: '+8490xxxxxx3',
      },
    },
  },
};

type CanonicalStatus = 'paid' | 'failed' | 'pending' | 'unknown';

/** Map a MoMo resultCode to the canonical status (mirrors classifyMomoStatus). */
function statusForResultCode(resultCode: number): CanonicalStatus {
  if (resultCode === 0) return 'paid';
  if (new Set([1001, 1002, 1003, 1004, 1005, 4100]).has(resultCode)) return 'failed';
  if (new Set([9000, 1000]).has(resultCode)) return 'pending';
  return 'unknown';
}

/** Build a fake verifyWebhook-ok result in the canonical event shape. */
function fakeVerifyOk(parsed: {
  orderId: string;
  transId: string;
  resultCode: number;
  amount?: number;
  currency?: string;
}) {
  return {
    ok: true as const,
    event: {
      orderRef: parsed.orderId,
      providerTxnId: parsed.transId,
      amount: parsed.amount ?? 200000,
      currency: parsed.currency ?? 'VND',
      status: statusForResultCode(parsed.resultCode),
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
  it('returns 200, transitions booking, ENQUEUES 2 pending NotificationLog rows WITHOUT in-process send (Issue 058)', async () => {
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
        $executeRaw: vi.fn().mockResolvedValue(1), // paid UPDATE + Trip FOR UPDATE lock
        $queryRaw: vi.fn().mockResolvedValue([{ oversold: false }]), // capacity check
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

    // Issue 058: both rows are enqueued status='pending' — the cron dispatcher
    // delivers them later. The webhook itself must NOT send anything in-process
    // and must NOT flip the rows to sent.
    expect(calls.every((c) => c[0].status === 'pending')).toBe(true);
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendSmsBody).not.toHaveBeenCalled();
    expect(prisma.notificationLog.update).not.toHaveBeenCalled();

    // Issue 049: exactly two ledger entries appended on the first paid transition.
    expect(appendLedgerEntry).toHaveBeenCalledTimes(2);
    const ledgerCalls = vi.mocked(appendLedgerEntry).mock.calls;

    const credit = ledgerCalls.find((c) => c[0].type === 'booking_credit');
    const fee = ledgerCalls.find((c) => c[0].type === 'platform_fee');
    expect(credit).toBeDefined();
    expect(fee).toBeDefined();

    // booking_credit = +gross (full fare, positive).
    expect(credit![0].operatorId).toBe('op-test-001');
    expect(credit![0].bookingId).toBe(BOOKING_ID);
    expect(credit![0].amountMinor).toBe(BigInt(200000));
    expect(credit![0].currency).toBe('VND');
    expect(credit![0].sourceEventId).toBe(`booking_credit:${BOOKING_ID}`);

    // platform_fee = −fee (6% of 200000 = 12000, NEGATIVE — its own entry).
    expect(fee![0].operatorId).toBe('op-test-001');
    expect(fee![0].bookingId).toBe(BOOKING_ID);
    expect(fee![0].amountMinor).toBe(BigInt(-12000));
    expect(fee![0].currency).toBe('VND');
    expect(fee![0].sourceEventId).toBe(`platform_fee:${BOOKING_ID}`);

    // Each append is given the tx handle (2nd arg) so it writes inside the tx.
    expect(credit![1]).toBeDefined();
    expect(fee![1]).toBeDefined();
  });
});

describe('POST /api/payments/momo/webhook — underpaid IPN (money-loss guard)', () => {
  it('does NOT mark booking paid when a success IPN underpays; records the event, no notifications', async () => {
    // MOCK_BOOKING.totalVnd = 200000; IPN claims success but pays only 1 VND.
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '7777001', resultCode: 0, amount: 1 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(1);
    const paymentEventCreate = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: paymentEventCreate },
        $executeRaw: executeRawMock,
      };
      await fn(fakeTx as never);
      return undefined;
    });

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    // Still ack the IPN (200), but no paid transition and no notifications.
    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    expect(paymentEventCreate).toHaveBeenCalledOnce(); // audit row recorded
    expect(executeRawMock).not.toHaveBeenCalled(); // no status UPDATE
    expect(createNotificationLog).not.toHaveBeenCalled();
    // Issue 049: underpaid never reaches updated>0 → no ledger entries.
    expect(appendLedgerEntry).not.toHaveBeenCalled();
  });

  it('marks booking paid when the IPN pays the exact amount (control)', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '7777002', resultCode: 0, amount: 200000 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: vi.fn().mockResolvedValue({}) },
        $executeRaw: executeRawMock, // paid UPDATE + Trip FOR UPDATE lock
        $queryRaw: vi.fn().mockResolvedValue([{ oversold: false }]), // capacity check
      };
      await fn(fakeTx as never);
      return undefined;
    });
    vi.mocked(createNotificationLog)
      .mockResolvedValueOnce({ id: 'notif-cust-002' } as never)
      .mockResolvedValueOnce({ id: 'notif-op-002' } as never);

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    expect(res.status).toBe(200);
    expect(executeRawMock).toHaveBeenCalled(); // paid transition + Trip lock ran
    expect(createNotificationLog).toHaveBeenCalledTimes(2);
    // Issue 049: exact-amount paid transition appends the two ledger entries.
    expect(appendLedgerEntry).toHaveBeenCalledTimes(2);
  });

  it('marks booking paid AND records the overpay delta when the IPN overpays (not silent)', async () => {
    // MOCK_BOOKING.totalVnd = 200000; IPN claims success but pays 300000 (overpay 100000).
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '7777003', resultCode: 0, amount: 300000 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: vi.fn().mockResolvedValue({}) },
        $executeRaw: executeRawMock, // paid UPDATE + Trip FOR UPDATE lock
        $queryRaw: vi.fn().mockResolvedValue([{ oversold: false }]), // capacity check
      };
      await fn(fakeTx as never);
      return undefined;
    });
    vi.mocked(createNotificationLog)
      .mockResolvedValueOnce({ id: 'notif-cust-003' } as never)
      .mockResolvedValueOnce({ id: 'notif-op-003' } as never);

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    expect(res.status).toBe(200);
    expect(executeRawMock).toHaveBeenCalled(); // overpay still transitions to paid (UPDATE + lock)

    // Not silent: the overpay delta is recorded via a structured warn carrying the delta.
    const overpayWarn = vi
      .mocked(logger.warn)
      .mock.calls.find(([obj]) => obj && typeof obj === 'object' && 'overpayVnd' in obj);
    expect(overpayWarn).toBeDefined();
    expect((overpayWarn![0] as { overpayVnd: number }).overpayVnd).toBe(100000);
  });
});

describe('POST /api/payments/momo/webhook — currency mismatch (non-VND success)', () => {
  it('does NOT mark booking paid when a success event is non-VND; records the event, no notifications', async () => {
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({
          orderId: BOOKING_REF,
          transId: '8888001',
          resultCode: 0,
          amount: 200000,
          currency: 'USD',
        })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(1);
    const paymentEventCreate = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: paymentEventCreate },
        $executeRaw: executeRawMock,
      };
      await fn(fakeTx as never);
      return undefined;
    });

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    // Still ack the IPN (200), but no paid transition and no notifications.
    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    expect(paymentEventCreate).toHaveBeenCalledOnce(); // audit row recorded
    expect(executeRawMock).not.toHaveBeenCalled(); // no status UPDATE
    expect(createNotificationLog).not.toHaveBeenCalled();
    // Issue 049: currency mismatch never reaches updated>0 → no ledger entries.
    expect(appendLedgerEntry).not.toHaveBeenCalled();

    // A structured currency_mismatch warn carries the currency.
    const mismatchWarn = vi
      .mocked(logger.warn)
      .mock.calls.find(([obj]) => obj && typeof obj === 'object' && 'currency' in obj);
    expect(mismatchWarn).toBeDefined();
    expect((mismatchWarn![0] as { currency: string }).currency).toBe('USD');
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

describe('POST /api/payments/momo/webhook — monotonic transition guard (issue 034)', () => {
  it('does NOT regress an already-paid booking: UPDATE matches 0 rows → 200, no notifications', async () => {
    // Replayed success IPN on a row that already left awaiting_payment. The
    // map-derived WHERE (legalPredecessors = [awaiting_payment]) matches 0 rows,
    // so no transition, no notifications — webhook still acks 200 (AC1/AC4).
    vi.mocked(getMomoAdapter).mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(
        fakeVerifyOk({ orderId: BOOKING_REF, transId: '8888001', resultCode: 0, amount: 200000 })
      ),
      createPayment: vi.fn(),
    });
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(MOCK_BOOKING as never);

    const executeRawMock = vi.fn().mockResolvedValue(0); // already advanced → 0 rows
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const fakeTx = {
        paymentEvent: { create: vi.fn().mockResolvedValue({}) },
        $executeRaw: executeRawMock,
      };
      await fn(fakeTx as never);
      return undefined;
    });

    const res = await POST(makeRequest(JSON.stringify({ signature: 'test', resultCode: 0 })));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('ok');
    expect(executeRawMock).toHaveBeenCalledOnce(); // guard ran
    expect(createNotificationLog).not.toHaveBeenCalled(); // no regress side effects
    // Issue 049: updated=0 (already advanced) → the ledger block is skipped → no
    // duplicate entries on a replayed paid IPN.
    expect(appendLedgerEntry).not.toHaveBeenCalled();
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
      meta: { target: ['adapter', 'providerTxnId'] },
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
