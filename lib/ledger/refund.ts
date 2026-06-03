/**
 * refundOut — the refund-out rail (Issue 051). MONEY-CRITICAL.
 *
 * Moves money BACK to the customer for a paid booking and records the
 * double-entry on the ledger. Triggered by: operator trip-cancel (default,
 * S15#2), bank-transfer overpayment-difference (issue 032), and the (currently
 * structurally-prevented) oversold race (issue 036).
 *
 * ── DOUBLE-ENTRY MODEL (signs + balance inclusion are EXACT) ─────────────────
 * A refund of `amountMinor` writes TWO LedgerEntry rows, BOTH operatorId-scoped
 * for traceability, with DISTINCT sourceEventIds:
 *
 *   refund_debit = −amountMinor
 *     Claws back the operator's booking credit — the operator does NOT keep
 *     revenue for a refunded booking. This entry COUNTS toward operator balance
 *     (it's in OPERATOR_BALANCE_TYPES).
 *
 *   refund_out   = −amountMinor
 *     Records the actual CASH leaving the platform float to the customer. This
 *     is a PLATFORM-FLOAT entry; it MUST NOT count toward the OPERATOR balance
 *     (lib/ledger/balance.ts excludes it from OPERATOR_BALANCE_TYPES). Counting
 *     both would double-subtract from the operator.
 *
 * ── IDEMPOTENCY ─────────────────────────────────────────────────────────────
 * The caller supplies an `idempotencyKey` that is DISTINCT from the inbound
 * payment's providerTxnId (AC4) — it is tied to the REFUND EVENT (e.g.
 * `cancel:<tripId>:<bookingId>`, `overpay:<bookingId>:<providerTxnId>`). Both
 * ledger sourceEventIds are DERIVED from it:
 *     refund_debit:<idempotencyKey>   refund_out:<idempotencyKey>
 *
 * Replay safety has two layers:
 *   1. Before calling the PSP we check for an existing `refund_out:<key>` ledger
 *      row. If present, the refund already happened → short-circuit to
 *      { refunded:false, alreadyDone:true } WITHOUT re-calling the PSP. This is
 *      what stops a re-cancel from issuing a second real cash refund.
 *   2. The unique sourceEventId on each entry makes the two ledger writes
 *      idempotent at the DB even under a race (appendLedgerEntry swallows P2002).
 *
 * The PSP refund result txn id is deterministic from the key (stub), so even a
 * concurrent double-call converges. Both ledger writes run inside a single
 * `$transaction` so a partial write can never leave one leg without the other.
 */

import { prisma } from '@/lib/db/client';
import { appendLedgerEntry } from './ledgerRepo';
import { refundPayment } from '@/lib/payment/refund';
import { logger } from '@/lib/logger';

export type RefundReason =
  | 'operator_cancel'
  | 'overpay_difference'
  | 'oversold_race';

export interface RefundOutInput {
  bookingId: string;
  /** Refund amount in VND minor units (integer, positive). */
  amountMinor: number;
  reason: RefundReason;
  /** Refund-event idempotency key — DISTINCT from the inbound payment txn id. */
  idempotencyKey: string;
}

export interface RefundOutResult {
  /** true iff this call performed the refund (PSP + ledger writes). */
  refunded: boolean;
  /** true iff the refund had already been recorded for this idempotencyKey. */
  alreadyDone: boolean;
}

/**
 * Booking statuses for which a refund-out is valid: the booking WAS paid. Note
 * that the operator-cancel trigger flips paid bookings to `trip_cancelled`
 * BEFORE refundOut runs (cancelTrip commits first), so `trip_cancelled` must be
 * accepted here. `paid` / `completed` cover the overpay and
 * oversold paths where the booking is still in a live paid state.
 */
const REFUNDABLE_STATUSES = new Set([
  'paid',
  'completed',
  'trip_cancelled',
  'no_show',
]);

export class RefundOutError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'RefundOutError';
  }
}

export async function refundOut(input: RefundOutInput): Promise<RefundOutResult> {
  const { bookingId, amountMinor, reason, idempotencyKey } = input;

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new RefundOutError('invalid_amount');
  }

  // 1. Resolve booking → operatorId + verify refundable paid state.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      paymentExternalRef: true,
      trip: { select: { bus: { select: { operatorId: true } } } },
    },
  });

  if (!booking) throw new RefundOutError('booking_not_found');
  if (!REFUNDABLE_STATUSES.has(booking.status)) {
    throw new RefundOutError('not_refundable');
  }
  const operatorId = booking.trip.bus.operatorId;

  const refundOutSourceId = `refund_out:${idempotencyKey}`;
  const refundDebitSourceId = `refund_debit:${idempotencyKey}`;

  // 2. Replay short-circuit (layer 1): if the refund_out ledger row already
  //    exists for this key, the PSP was already called — DO NOT call it again.
  const existing = await prisma.ledgerEntry.findUnique({
    where: { sourceEventId: refundOutSourceId },
    select: { id: true },
  });
  if (existing) {
    logger.info(
      { bookingId, reason, idempotencyKey },
      'refund.out.already_done — short-circuit, PSP not re-called'
    );
    return { refunded: false, alreadyDone: true };
  }

  // 3. Call the PSP refund (deterministic stub under PAYMENTS_STUB). The result
  //    txn id is a pure function of idempotencyKey, so this is replay-safe even
  //    if two callers race past the layer-1 check.
  const psp = await refundPayment({
    providerTxnId: booking.paymentExternalRef,
    amountMinor,
    idempotencyKey,
  });

  // 4. Write BOTH ledger entries inside one transaction. Each is idempotent on
  //    its DISTINCT sourceEventId (derived from idempotencyKey, NOT from the
  //    inbound providerTxnId), so a concurrent winner makes these no-ops.
  const amt = BigInt(amountMinor);
  await prisma.$transaction(async (tx) => {
    await appendLedgerEntry(
      {
        operatorId,
        bookingId,
        type: 'refund_debit',
        amountMinor: -amt, // clawback of operator credit — COUNTS toward balance
        currency: 'VND',
        sourceEventId: refundDebitSourceId,
      },
      tx
    );
    await appendLedgerEntry(
      {
        operatorId,
        bookingId,
        type: 'refund_out',
        amountMinor: -amt, // cash out to customer — platform float, NOT operator balance
        currency: 'VND',
        sourceEventId: refundOutSourceId,
      },
      tx
    );
  });

  logger.info(
    { bookingId, reason, idempotencyKey, refundTxnId: psp.refundTxnId },
    'refund.out.completed'
  );

  return { refunded: true, alreadyDone: false };
}
