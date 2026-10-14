/**
 * Unit tests for lib/ledger/refund.ts — the refund-out rail (Issue 051).
 *
 * Mocks the Prisma client, appendLedgerEntry, and the PSP refund. Proves:
 *   - refundOut writes refund_debit −amount AND refund_out −amount
 *   - both sourceEventIds are DERIVED from idempotencyKey (NOT providerTxnId)
 *   - double-call with the same key short-circuits to alreadyDone, PSP called
 *     once, no duplicate ledger writes
 *   - the stub PSP refund is deterministic from the key
 *   - non-refundable / missing bookings + bad amounts throw
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const { notifCreateMany, captureMessageMock, obligationUpsert } = vi.hoisted(() => ({
  notifCreateMany: vi.fn(),
  captureMessageMock: vi.fn(),
  obligationUpsert: vi.fn(),
}));
vi.mock('@/lib/observability', () => ({ captureMessage: captureMessageMock }));

vi.mock('@/lib/core/db/client', () => {
  const txMock = {
    ledgerEntry: {},
    notificationLog: { createMany: notifCreateMany },
    refundObligation: { upsert: obligationUpsert },
  };
  return {
    prisma: {
      booking: { findUnique: vi.fn() },
      ledgerEntry: { findUnique: vi.fn() },
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    },
  };
});

// #343: refundOut moved to lib/payment, so appendLedgerEntry is now a CROSS-domain
// import through the lib/ledger barrel — mock the barrel, not the old sibling path.
// A vi.mock left on a stale specifier does not error, it simply never intercepts.
vi.mock('@/lib/ledger', () => ({
  appendLedgerEntry: vi.fn().mockResolvedValue({ id: 'le-1', created: true }),
}));

vi.mock('@/lib/payment/refund', () => ({
  refundPayment: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '@/lib/ledger';
import { refundPayment } from '@/lib/payment/refund';
import { refundOut, RefundOutError, MANUAL_REFUND_PENDING } from '../refundOut';
import { OPS_ALERT_EMAIL } from '@/lib/notification';

const bookingFind = prisma.booking.findUnique as unknown as Mock;
const ledgerFind = prisma.ledgerEntry.findUnique as unknown as Mock;
const append = appendLedgerEntry as unknown as Mock;
const psp = refundPayment as unknown as Mock;

const PAID_BOOKING = {
  id: 'bk-1',
  status: 'paid',
  paymentExternalRef: 'stub_BB-2026-abcd-ef01_success',
  bookingRef: 'BB-2026-abcd-ef01',
  buyerPhone: '+8490xxxxxx1',
  buyerEmail: null,
  trip: { bus: { operatorId: 'op-1' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  notifCreateMany.mockResolvedValue({ count: 1 });
  bookingFind.mockResolvedValue(PAID_BOOKING);
  ledgerFind.mockResolvedValue(null);
  psp.mockResolvedValue({ ok: true, refundTxnId: 'stub_refund_cancel:trip-1:bk-1' });
  append.mockResolvedValue({ id: 'le-1', created: true });
});

describe('refundOut', () => {
  it('writes refund_debit −amount and refund_out −amount with distinct keys derived from idempotencyKey', async () => {
    const res = await refundOut({
      bookingId: 'bk-1',
      amountMinor: 180_000,
      reason: 'operator_cancel',
      idempotencyKey: 'cancel:trip-1:bk-1',
    });

    expect(res).toEqual({ refunded: true, alreadyDone: false });
    expect(append).toHaveBeenCalledTimes(2);

    const debitCall = append.mock.calls.find(
      (c) => c[0].type === 'refund_debit'
    )?.[0];
    const outCall = append.mock.calls.find((c) => c[0].type === 'refund_out')?.[0];

    // Both are −amount, both operatorId-scoped, distinct sourceEventIds derived
    // from the REFUND idempotencyKey (not the inbound providerTxnId).
    expect(debitCall).toMatchObject({
      operatorId: 'op-1',
      bookingId: 'bk-1',
      type: 'refund_debit',
      amountMinor: BigInt(-180_000),
      sourceEventId: 'refund_debit:cancel:trip-1:bk-1',
    });
    expect(outCall).toMatchObject({
      operatorId: 'op-1',
      bookingId: 'bk-1',
      type: 'refund_out',
      amountMinor: BigInt(-180_000),
      sourceEventId: 'refund_out:cancel:trip-1:bk-1',
    });
    // Distinct from the inbound payment key.
    expect(outCall.sourceEventId).not.toContain(PAID_BOOKING.paymentExternalRef);
    expect(debitCall.sourceEventId).not.toContain(PAID_BOOKING.paymentExternalRef);
  });

  it('passes the inbound providerTxnId to the PSP but keys the ledger on idempotencyKey', async () => {
    await refundOut({
      bookingId: 'bk-1',
      amountMinor: 90_000,
      reason: 'overpay_difference',
      idempotencyKey: 'overpay:bk-1:txn-99',
    });
    expect(psp).toHaveBeenCalledWith({
      providerTxnId: PAID_BOOKING.paymentExternalRef,
      amountMinor: 90_000,
      idempotencyKey: 'overpay:bk-1:txn-99',
    });
  });

  it('double-call with same key → alreadyDone, PSP NOT re-called, no duplicate writes', async () => {
    // Second call: the refund_out ledger row already exists.
    ledgerFind.mockResolvedValueOnce({ id: 'existing-out' });

    const res = await refundOut({
      bookingId: 'bk-1',
      amountMinor: 180_000,
      reason: 'operator_cancel',
      idempotencyKey: 'cancel:trip-1:bk-1',
    });

    expect(res).toEqual({ refunded: false, alreadyDone: true });
    expect(psp).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('checks the refund_out sourceEventId for the replay short-circuit', async () => {
    await refundOut({
      bookingId: 'bk-1',
      amountMinor: 180_000,
      reason: 'operator_cancel',
      idempotencyKey: 'cancel:trip-1:bk-1',
    });
    expect(ledgerFind).toHaveBeenCalledWith({
      where: { sourceEventId: 'refund_out:cancel:trip-1:bk-1' },
      select: { id: true },
    });
  });

  it('throws booking_not_found for a missing booking', async () => {
    bookingFind.mockResolvedValueOnce(null);
    await expect(
      refundOut({
        bookingId: 'nope',
        amountMinor: 1000,
        reason: 'operator_cancel',
        idempotencyKey: 'k',
      })
    ).rejects.toBeInstanceOf(RefundOutError);
  });

  it('throws not_refundable for an unpaid booking', async () => {
    bookingFind.mockResolvedValueOnce({
      ...PAID_BOOKING,
      status: 'awaiting_payment',
    });
    await expect(
      refundOut({
        bookingId: 'bk-1',
        amountMinor: 1000,
        reason: 'operator_cancel',
        idempotencyKey: 'k',
      })
    ).rejects.toMatchObject({ code: 'not_refundable' });
  });

  it('throws invalid_amount for a non-positive amount', async () => {
    await expect(
      refundOut({
        bookingId: 'bk-1',
        amountMinor: 0,
        reason: 'operator_cancel',
        idempotencyKey: 'k',
      })
    ).rejects.toMatchObject({ code: 'invalid_amount' });
  });

  it('handles manual refund when PSP returns ok:false — writes ledger + notification, no throw', async () => {
    psp.mockResolvedValueOnce({ ok: false, manualRefundRequired: true });

    const res = await refundOut({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      reason: 'operator_cancel',
      idempotencyKey: 'cancel:trip-2:bk-1',
    });

    expect(res).toEqual({ refunded: true, alreadyDone: false, manualRefundRequired: true });
    expect(append).toHaveBeenCalledTimes(2);

    // #833: ops-inbox email (a real address the dispatcher can send to), enqueued in the
    // same tx as the ledger legs, with a rendered sentence + the buyer contact.
    expect(notifCreateMany).toHaveBeenCalledTimes(1);
    const arg = notifCreateMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data[0]).toMatchObject({
      bookingId: 'bk-1',
      channel: 'email',
      template: 'manual_refund_required',
      recipient: OPS_ALERT_EMAIL,
      status: 'pending',
    });
    expect(arg.data[0].payload).toContain('BB-2026-abcd-ef01');
    expect(arg.data[0].payload).toContain('200000d');
    expect(arg.data[0].payload).toContain('nha xe huy chuyen');
    expect(arg.data[0].payload).toContain('+8490xxxxxx1');
    expect(() => JSON.parse(arg.data[0].payload)).toThrow();

    // Resend-independent Sentry signal, without the buyer contact.
    expect(captureMessageMock).toHaveBeenCalledWith(
      'payment.manual_refund_required',
      expect.objectContaining({ bookingId: 'bk-1', amountMinor: 200_000, reason: 'operator_cancel' }),
    );
    expect(JSON.stringify(captureMessageMock.mock.calls[0])).not.toContain('+8490xxxxxx1');
  });

  it('manual refund records the owed money: upserts the obligation as manual_pending in the ledger tx (#833)', async () => {
    psp.mockResolvedValueOnce({ ok: false, manualRefundRequired: true });

    await refundOut({
      bookingId: 'bk-1',
      amountMinor: 150_000,
      reason: 'operator_cancel',
      idempotencyKey: 'admin-refund:abc',
    });

    expect(obligationUpsert).toHaveBeenCalledTimes(1);
    expect(obligationUpsert).toHaveBeenCalledWith({
      where: { idempotencyKey: 'admin-refund:abc' },
      create: {
        bookingId: 'bk-1',
        amountMinor: 150_000,
        reason: 'operator_cancel',
        idempotencyKey: 'admin-refund:abc',
        providerTxnId: PAID_BOOKING.paymentExternalRef,
        status: MANUAL_REFUND_PENDING,
      },
      update: { status: MANUAL_REFUND_PENDING },
    });
  });

  it('PSP-ok refund sends no ops alert and records nothing as owed', async () => {
    await refundOut({
      bookingId: 'bk-1',
      amountMinor: 1000,
      reason: 'operator_cancel',
      idempotencyKey: 'cancel:trip-3:bk-1',
    });
    expect(notifCreateMany).not.toHaveBeenCalled();
    expect(captureMessageMock).not.toHaveBeenCalled();
    expect(obligationUpsert).not.toHaveBeenCalled();
  });
});

describe('stub PSP refund determinism', () => {
  it('refundPaymentStub returns stub_refund_<key> deterministically', async () => {
    // Import the stub directly (not the flag-branching wrapper) to assert the
    // deterministic shape.
    const { refundPaymentStub } = await import('@/lib/payment');
    const a = refundPaymentStub({
      providerTxnId: 'txn-1',
      amountMinor: 5000,
      idempotencyKey: 'cancel:t:b',
    });
    const b = refundPaymentStub({
      providerTxnId: 'txn-2', // different inbound txn
      amountMinor: 9999, // different amount
      idempotencyKey: 'cancel:t:b', // same key
    });
    expect(a).toEqual({ ok: true, refundTxnId: 'stub_refund_cancel:t:b' });
    expect(b.refundTxnId).toBe(a.refundTxnId); // pure function of the key
  });
});
