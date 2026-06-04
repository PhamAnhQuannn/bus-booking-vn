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
 *   (e) degraded match — a memo-less (unlinked) event on amount+account+window pays
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

vi.mock('@/lib/payment', () => ({
  applyPaidStatusTransition: mockApplyPaid,
  appendBookingPaidLedger: mockAppendLedger,
}));
vi.mock('@/lib/notification', () => ({ renderTemplate: mockRenderTemplate }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/booking/transitions', () => ({ legalPredecessors: mockLegalPredecessors }));
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

const NOW = new Date('2026-06-03T12:00:00.000Z');
// Created 40 min ago — comfortably past the 30-min threshold.
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

describe('reconcilePayments (e) degraded match', () => {
  it('resolves a memo-less (unlinked) event on amount + account + window', async () => {
    // Linked events: none confirming. An UNLINKED momo event with the exact
    // amount, inside the window, on an adapter the booking used → degraded match.
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
    const tx = makeTx([baseBooking()], [[linkedNonConfirming, orphan]]);
    const res = await reconcilePayments(tx as never, { now: NOW });

    expect(mockApplyPaid).toHaveBeenCalledWith(tx, baseBooking().id, 'txn-orphan');
    expect(mockAppendLedger).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
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
