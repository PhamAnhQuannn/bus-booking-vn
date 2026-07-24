/**
 * Issue 095: unit tests for the payment-reconciliation sweeper core.
 *
 * The DB client surface is the stub `tx` (the JobCore's first arg). The shared
 * paid-transition + ledger helpers, the transition map, the template renderer,
 * and the logger are mocked so each branch is asserted in isolation:
 *   (a) stuck + confirming linked event ≥ total → paid + ledger + 2 notices
 *   (b) stuck + no event + expired hold → payment_failed_expired + 1 notice
 *   (c) underpaid success → NOT paid; expired once the hold has lapsed
 *   (d) monotonic guard — applyPaidStatusTransition rowcount 0 → no side-effects
 *   (e) degraded match — a memo-less (unlinked) event that FITS on amount+account+
 *       window HOLDS the booking (no pay, no expire); it never identifies a payer
 *   (e2) Bug B — the same path driven by a real SePay body, plus the control that
 *       a booking with no fitting orphan still expires normally
 *   (f) below-threshold rows are excluded by the claim (none returned → no work)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const {
  mockApplyPaid,
  mockAppendLedger,
  mockRenderTemplate,
  mockLegalPredecessors,
  mockLogger,
} = vi.hoisted(() => ({
  mockApplyPaid: vi.fn(),
  mockAppendLedger: vi.fn(),
  mockRenderTemplate: vi.fn(),
  mockLegalPredecessors: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// `recoverSepayEvent` is supplied REAL (deep import — the barrel would drag
// server-only + the db client). The whole point of Bug B's regression guard is that
// the sweeper runs the ACTUAL SePay parser against an ACTUAL adapter-produced body;
// a stubbed parser would re-encode whatever assumption the test author had, which is
// exactly how the MoMo-shaped parse survived unnoticed.
vi.mock('@/lib/payment', async () => {
  const real = await vi.importActual<typeof import('../../payment/adapters/bankTransfer')>(
    '@/lib/payment/adapters/bankTransfer'
  );
  return {
    applyPaidStatusTransition: mockApplyPaid,
    appendBookingPaidLedger: mockAppendLedger,
    recoverSepayEvent: real.recoverSepayEvent,
  };
});
vi.mock('@/lib/notification', () => ({ renderTemplate: mockRenderTemplate }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
// BOOKING_REF_REGEX comes from the REAL leaf module: the bank_transfer adapter
// imports it through this barrel, and the adapter is loaded for real above.
// Deep-importing the leaf keeps the db client out of the unit graph (Mistake Log 092b).
vi.mock('@/lib/booking', async () => {
  const refs = await vi.importActual<typeof import('../../booking/bookingRef')>(
    '@/lib/booking/bookingRef'
  );
  return { legalPredecessors: mockLegalPredecessors, BOOKING_REF_REGEX: refs.BOOKING_REF_REGEX };
});
// Prisma.sql / Prisma.join are passthroughs — the stub tx ignores the SQL and
// returns staged rows by call order.
vi.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    join: (parts: unknown[]) => ({ parts }),
  },
}));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/ledger', () => ({ refundOut: vi.fn() }));

import { reconcilePayments, matchDegraded } from '../reconcilePayments';
import { getBankTransferAdapter } from '../../payment/adapters/bankTransfer';

const NOW = new Date('2026-06-03T12:00:00.000Z');
// Created 40 min ago — comfortably past the 15-min threshold.
const CREATED_AT = new Date(NOW.getTime() - 40 * 60_000);

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: '01975f3b-0000-7000-8000-000000000001',
    bookingRef: 'BB-2026-abcd-1234',
    confirmationToken: 'A'.repeat(32),
    buyerName: 'Recon Tester',
    buyerPhone: '+8490xxxxxx1',
    ticketCount: 2,
    totalVnd: 200000,
    paymentMethod: 'momo',
    createdAt: CREATED_AT,
    operatorId: 'op-1',
    operatorContactPhone: '+8490xxxxxx2',
    operatorNotificationPhone: '+8490xxxxxx3',
    origin: 'Ha Noi',
    destination: 'TP.HCM',
    departureAt: new Date(NOW.getTime() + 86_400_000),
    holdExpiresAt: null as Date | null,
    holdCreatedAt: CREATED_AT as Date | null,
    customPickupRequested: false,
    pickupDetail: null as string | null,
    ...overrides,
  };
}

/** A stored PaymentEvent row as the per-booking events query returns it. */
function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pe-1',
    bookingId: '01975f3b-0000-7000-8000-000000000001',
    adapter: 'momo',
    providerTxnId: 'txn-1',
    currency: 'VND',
    rawBody: JSON.stringify({ amount: 200000, resultCode: 0 }),
    receivedAt: new Date(NOW.getTime() - 35 * 60_000),
    ...overrides,
  };
}

/**
 * Build a stub tx. `candidates` is returned by the FIRST $queryRaw (the claim);
 * `eventsByCall` returns the per-booking events query results in order.
 */
function makeTx(candidates: unknown[], eventsByCall: unknown[][], expireRows = 1) {
  const queryRaw = vi.fn();
  queryRaw.mockResolvedValueOnce(candidates);
  for (const evs of eventsByCall) queryRaw.mockResolvedValueOnce(evs);
  return {
    $queryRaw: queryRaw,
    $executeRaw: vi.fn().mockResolvedValue(expireRows),
    notificationLog: { create: vi.fn().mockResolvedValue({ id: 'nl-1' }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApplyPaid.mockResolvedValue({ updated: 1, refundTriggered: false });
  mockAppendLedger.mockResolvedValue(undefined);
  mockRenderTemplate.mockReturnValue('stub body');
  mockLegalPredecessors.mockReturnValue(['awaiting_payment']);
});

describe('reconcilePayments (a) confirming linked event → paid', () => {
  it('transitions to paid, writes ledger, enqueues 2 notices, counts 1', async () => {
    const tx = makeTx([baseBooking()], [[eventRow()]]);
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).toHaveBeenCalledTimes(1);
    expect(mockApplyPaid).toHaveBeenCalledWith(tx, baseBooking().id, 'txn-1');
    expect(mockAppendLedger).toHaveBeenCalledWith(tx, {
      operatorId: 'op-1',
      bookingId: baseBooking().id,
      grossVnd: 200000,
      now: NOW,
      // Issue 123: adapter comes from the CONFIRMING event's rail (here 'momo'),
      // so a sweeper-resolved VNPay booking would correctly record its psp_fee.
      adapter: 'momo',
    });
    // Two pending notices (customer + operator) written through the tx.
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(2);
    const createCalls = tx.notificationLog.create.mock.calls as Array<
      [{ data: { template: string; status: string } }]
    >;
    const templates = createCalls.map((c) => c[0].data.template).sort();
    expect(templates).toEqual(['customerBookingPaid', 'operatorNewBooking']);
    expect(createCalls.every((c) => c[0].data.status === 'pending')).toBe(true);
    // No expiry UPDATE on the paid path.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });
});

describe('reconcilePayments (b) no event + expired hold → payment_failed_expired', () => {
  it('runs the guarded expire UPDATE, enqueues the expiry notice, counts 1', async () => {
    const tx = makeTx(
      [baseBooking({ holdExpiresAt: new Date(NOW.getTime() - 60_000) })],
      [[]] // no events
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(mockAppendLedger).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // expire UPDATE
    // One expiry notice.
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(1);
    const expireCall = tx.notificationLog.create.mock.calls[0] as [
      { data: { template: string } },
    ];
    expect(expireCall[0].data.template).toBe('customerBookingExpired');
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('does NOT expire when the hold is still active (no event yet)', async () => {
    const tx = makeTx(
      [baseBooking({ holdExpiresAt: new Date(NOW.getTime() + 60_000) })],
      [[]]
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });
});

describe('reconcilePayments (c) underpaid success → NOT paid, expired when unpaid', () => {
  it('ignores a short success event and expires once the hold lapsed', async () => {
    const underpaid = eventRow({
      rawBody: JSON.stringify({ amount: 1, resultCode: 0 }), // success but short
    });
    const tx = makeTx(
      [baseBooking({ holdExpiresAt: new Date(NOW.getTime() - 60_000) })],
      [[underpaid]]
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    // Never paid — the short event is not confirming.
    expect(mockApplyPaid).not.toHaveBeenCalled();
    // Expired instead.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('a wrong-currency success event is likewise not confirming', async () => {
    const fx = eventRow({ currency: 'USD' });
    const tx = makeTx(
      [baseBooking({ holdExpiresAt: new Date(NOW.getTime() - 60_000) })],
      [[fx]]
    );
    await reconcilePayments(tx as never, { now: NOW });
    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('reconcilePayments (d) monotonic guard — already-paid never regressed', () => {
  it('applyPaidStatusTransition rowcount 0 → no ledger, no notices, count 0', async () => {
    mockApplyPaid.mockResolvedValueOnce({ updated: 0, refundTriggered: false }); // row already advanced
    const tx = makeTx([baseBooking()], [[eventRow()]]);
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).toHaveBeenCalledTimes(1);
    expect(mockAppendLedger).not.toHaveBeenCalled();
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled(); // continue; no expire path
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });
});

describe('reconcilePayments (e) degraded match — SUSPICION ONLY, never pays', () => {
  it('holds a booking whose orphan fits on amount + account + window — no pay, no expire', async () => {
    // Linked events: none confirming. An UNLINKED momo event with the exact
    // amount, inside the window, on an adapter the booking used → degraded match.
    //
    // (amount + rail + window) does not identify a PAYER — with one shared receiving
    // account any same-fare booking in the window fits equally. So the match must
    // flag, never pay. The hold below is EXPIRED, which makes this the load-bearing
    // assertion: without the suspicion branch this booking would be expired, and
    // `payment_failed_expired` is terminal — unfixable by hand afterwards.
    const linkedNonConfirming = eventRow({
      id: 'pe-linked',
      providerTxnId: 'txn-linked',
      rawBody: JSON.stringify({ amount: 1, resultCode: 0 }), // short → not confirming
    });
    const orphan = eventRow({
      id: 'pe-orphan',
      bookingId: null,
      providerTxnId: 'txn-orphan',
      rawBody: JSON.stringify({ amount: 200000, resultCode: 0 }),
      receivedAt: new Date(CREATED_AT.getTime() + 5 * 60_000),
    });
    const tx = makeTx(
      [baseBooking({ holdExpiresAt: new Date(NOW.getTime() - 60_000) })],
      [[linkedNonConfirming, orphan]]
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(mockAppendLedger).not.toHaveBeenCalled();
    // No claim UPDATE and no expire UPDATE — the sweeper never writes here at all.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ paymentEventId: 'pe-orphan', providerTxnId: 'txn-orphan' }),
      expect.stringContaining('unmatched_payment_suspected')
    );
  });

  it('matchDegraded rejects wrong amount / wrong account / outside window', async () => {
    const booking = baseBooking();
    const used = new Set(['momo']);
    const ok = {
      paymentEventId: 'ok',
      bookingId: null,
      adapter: 'momo',
      providerTxnId: 't',
      amount: 200000,
      currency: 'VND',
      success: true,
      receivedAt: new Date(CREATED_AT.getTime()),
    };
    expect(matchDegraded(booking as never, [ok], used)).toBe(ok);
    // wrong amount
    expect(matchDegraded(booking as never, [{ ...ok, amount: 199999 }], used)).toBeNull();
    // wrong account (adapter not used)
    expect(matchDegraded(booking as never, [{ ...ok, adapter: 'card' }], used)).toBeNull();
    // outside window (2h after anchor, window is 30m)
    expect(
      matchDegraded(
        booking as never,
        [{ ...ok, receivedAt: new Date(CREATED_AT.getTime() + 2 * 3600_000) }],
        used
      )
    ).toBeNull();
    // not a success
    expect(matchDegraded(booking as never, [{ ...ok, success: false }], used)).toBeNull();
  });
});

describe('reconcilePayments (e2) degraded match — SePay bank transfer (Bug B)', () => {
  // ONE producer, two consumers. This constant is fed to the REAL adapter to prove
  // it is exactly what the webhook route would have persisted, and the SAME string is
  // then staged as the stored rawBody the sweeper re-reads. Nothing about the SePay
  // wire shape is hand-asserted twice — the trap that hid Bug A and Bug B.
  const GROSS = 200000;
  const sepayPayload = {
    id: 987654,
    gateway: 'Sacombank',
    transactionDate: '2026-06-03 11:25:00',
    accountNumber: '030027766656',
    subAccount: null,
    transferType: 'in',
    transferAmount: GROSS,
    accumulated: 5_000_000,
    code: null,
    content: 'CK tu NGUYEN VAN A khong ghi noi dung', // no bookingRef at all
    referenceCode: 'FT26154000001',
    description: 'Chuyen tien',
  };
  const sepayRawBody = JSON.stringify(sepayPayload);

  it('detects the orphan the adapter would have produced, and HOLDS the booking instead of expiring it', async () => {
    // 1. The REAL adapter must classify this body as unmatched-but-recordable —
    //    i.e. this exact string is what recordUnmatchedPaymentEvent stores.
    const verified = getBankTransferAdapter().verifyWebhook(sepayRawBody);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.reason).toBe('no_booking_ref_in_memo');
    expect(verified.unmatched).toEqual({ providerTxnId: String(sepayPayload.id) });

    // 2. The sweeper re-reads that same stored body. The B1 parser is what makes the
    //    orphan legible at all — against the pre-fix MoMo-shaped recoverEvent this
    //    body yields {0,false}, matchDegraded rejects it at !ev.success, and the
    //    booking is EXPIRED despite the money having arrived.
    const orphan = eventRow({
      id: 'pe-sepay-orphan',
      bookingId: null,
      adapter: 'bank_transfer',
      providerTxnId: verified.unmatched!.providerTxnId,
      rawBody: sepayRawBody,
      receivedAt: new Date(CREATED_AT.getTime() + 5 * 60_000),
    });
    const tx = makeTx(
      [
        baseBooking({
          paymentMethod: 'bank_transfer',
          totalVnd: GROSS,
          holdExpiresAt: new Date(NOW.getTime() - 60_000), // lapsed → would expire
        }),
      ],
      [[orphan]]
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    // Never paid — (amount + rail + window) cannot prove this money is THIS booking's.
    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(mockAppendLedger).not.toHaveBeenCalled();
    // Never expired either: the hold HAS lapsed, so without the suspicion branch this
    // row would go terminal and become unfixable by hand.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ providerTxnId: String(sepayPayload.id), amountVnd: GROSS }),
      expect.stringContaining('unmatched_payment_suspected')
    );
  });

  it('still expires a stuck bank_transfer booking when NO orphan fits it', async () => {
    // Control for the case above: same booking, but the only orphan in the window is
    // for a different amount. Nothing fits → normal expiry must still happen, so the
    // suspicion branch cannot be silently swallowing every expiry.
    const wrongAmount = eventRow({
      id: 'pe-other',
      bookingId: null,
      adapter: 'bank_transfer',
      providerTxnId: '111',
      rawBody: JSON.stringify({ ...sepayPayload, id: 111, transferAmount: GROSS + 1 }),
      receivedAt: new Date(CREATED_AT.getTime() + 5 * 60_000),
    });
    const tx = makeTx(
      [
        baseBooking({
          paymentMethod: 'bank_transfer',
          totalVnd: GROSS,
          holdExpiresAt: new Date(NOW.getTime() - 60_000),
        }),
      ],
      [[wrongAmount]]
    );
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // the expire UPDATE
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });
});

describe('reconcilePayments (g) custom pickup folded into the operator SMS', () => {
  it('includes customPickup in the operatorNewBooking payload on the paid recovery path', async () => {
    const tx = makeTx(
      [baseBooking({ customPickupRequested: true, pickupDetail: '12 Đường Láng, Đống Đa' })],
      [[eventRow()]]
    );
    await reconcilePayments(tx as never, { now: NOW });

    expect(mockRenderTemplate).toHaveBeenCalledWith(
      'operatorNewBooking',
      expect.objectContaining({ customPickup: '12 Đường Láng, Đống Đa' })
    );
  });

  it('omits customPickup when none was requested', async () => {
    const tx = makeTx([baseBooking()], [[eventRow()]]);
    await reconcilePayments(tx as never, { now: NOW });

    const opCall = mockRenderTemplate.mock.calls.find((c) => c[0] === 'operatorNewBooking');
    expect(opCall?.[1]).not.toHaveProperty('customPickup');
  });
});

describe('reconcilePayments (f) below-threshold / no candidates', () => {
  it('does no work when the claim returns no rows', async () => {
    const tx = makeTx([], []);
    const res = await reconcilePayments(tx as never, { now: NOW });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); // only the claim ran
    expect(mockApplyPaid).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });
});
