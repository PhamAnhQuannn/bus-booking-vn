/**
 * Shared "booking → paid" effect — the monotonic guarded status transition plus
 * the two double-entry ledger rows (booking_credit +gross / platform_fee −fee).
 *
 * Extracted (Issue 095) so the payment webhook (lib/payment/processWebhook.ts)
 * and the reconciliation sweeper (lib/jobs/reconcilePayments.ts) reach the SAME
 * paid effect and can never drift.
 *
 *   - the status UPDATE derives its WHERE predecessors from the single-source
 *     transition map (`legalPredecessors('paid')`), NEVER a re-typed
 *     `status = 'awaiting_payment'` literal.
 *   - the ledger entries are idempotent on `sourceEventId`.
 *
 * Issue 100: applyPaidStatusTransition now returns { updated, refundTriggered }.
 * When updated > 0 and the trip is genuinely oversold (paid-booking seats >
 * bus capacity), status is immediately flipped to 'refunded' + refundedAt set
 * INSIDE the same transaction (Issue 014: verb-At + status in one tx.update).
 * The caller is responsible for issuing the post-commit refundOut('oversold_race')
 * via after(). The Trip row is locked FOR UPDATE before the capacity check so
 * concurrent paid transitions on the same trip serialize (Issue 011 TOCTOU rule).
 *
 * "Genuinely gone" counts only paid/completed bookings (never holds or
 * awaiting_payment) — prevents the refund-oracle attack where flooding holds
 * could trigger a refund.
 */

import { Prisma } from '@prisma/client';
import { legalPredecessors } from '@/lib/booking';
import {
  appendLedgerEntry,
  getEffectiveFeeRate,
  calcPlatformFeeMinor,
  applyFeePpm,
  VNPAY_MDR_PPM,
} from '@/lib/ledger';

export interface PaidTransitionResult {
  /** 1 on the first (and only) paid transition; 0 on replay / already-advanced. */
  updated: number;
  /**
   * Issue 100: true iff this was the first paid transition AND the trip is
   * genuinely oversold (paid seats > bus capacity). Caller must trigger a
   * post-commit refundOut('oversold_race') when this is true.
   * Always false when updated === 0.
   */
  refundTriggered: boolean;
}

/**
 * Monotonic guarded transition of a booking to `paid`. Returns a PaidTransitionResult.
 *
 * Sequence:
 *  1. UPDATE booking to 'paid' (WHERE status IN legalPredecessors).
 *  2. If 0 rows updated → replay/already-advanced; return early.
 *  3. Lock the Trip row FOR UPDATE to serialize concurrent paid transitions.
 *  4. Count paid/completed seats UNDER the lock (includes this booking, now paid).
 *  5. If SUM > capacity → UPDATE booking to 'refunded' + refundedAt = NOW() in
 *     the same tx; return { updated: 1, refundTriggered: true }.
 *  6. Otherwise → return { updated: 1, refundTriggered: false }.
 */
export async function applyPaidStatusTransition(
  tx: Prisma.TransactionClient,
  bookingId: string,
  providerTxnId: string
): Promise<PaidTransitionResult> {
  // Step 1: Guarded transition to 'paid'.
  const paidPredecessors = Prisma.join(
    legalPredecessors('paid').map((s) => Prisma.sql`${s}::"BookingStatus"`)
  );
  const updated = await tx.$executeRaw(Prisma.sql`
    UPDATE "Booking"
    SET status = 'paid'::"BookingStatus",
        "paymentExternalRef" = ${providerTxnId}
    WHERE id = ${bookingId}::uuid
      AND status IN (${paidPredecessors})
  `);

  // Step 2: Replay / already-advanced — nothing to do.
  if ((updated as number) === 0) {
    return { updated: 0, refundTriggered: false };
  }

  // Step 3: Lock the Trip row FOR UPDATE — serializes concurrent paid transitions
  // on the same trip inside the outer $transaction (Issue 011 TOCTOU rule).
  await tx.$executeRaw(Prisma.sql`
    SELECT t.id
    FROM "Trip" t
    JOIN "Booking" b ON b."tripId" = t.id
    WHERE b.id = ${bookingId}::uuid
    FOR UPDATE OF t
  `);

  // Step 4: Capacity check UNDER the lock.
  // Count only paid/completed bookings (this booking is now paid and included).
  // Issue 100: awaiting_payment deliberately excluded — only confirmed-money seats
  // count for the "genuinely gone" oracle (refund-oracle attack defense).
  type OversoldRow = { oversold: boolean };
  const capacityRows = await tx.$queryRaw<OversoldRow[]>(Prisma.sql`
    SELECT COALESCE(SUM(b."ticketCount"), 0) > bus.capacity AS oversold
    FROM "Booking" b
    JOIN "Trip" t ON t.id = b."tripId"
    JOIN "Bus" bus ON bus.id = t."busId"
    WHERE b."tripId" = (SELECT "tripId" FROM "Booking" WHERE id = ${bookingId}::uuid)
      AND b.status IN (
        'paid'::"BookingStatus",
        'completed'::"BookingStatus"
      )
    GROUP BY bus.capacity
  `);

  // No rows = zero paid bookings on trip (shouldn't happen; we just paid one).
  // Treat as not-oversold to be safe.
  const isOversold = capacityRows.length > 0 && capacityRows[0].oversold;

  if (!isOversold) {
    return { updated: 1, refundTriggered: false };
  }

  // Step 5: Oversold — transition paid → refunded + set refundedAt in same tx.
  // Issue 014: verb-At column and status enum MUST be written in the same update.
  // legalPredecessors('refunded') = ['paid'] (transitions.ts).
  const refundedPredecessors = Prisma.join(
    legalPredecessors('refunded').map((s) => Prisma.sql`${s}::"BookingStatus"`)
  );
  await tx.$executeRaw(Prisma.sql`
    UPDATE "Booking"
    SET status = 'refunded'::"BookingStatus",
        "refundedAt" = NOW()
    WHERE id = ${bookingId}::uuid
      AND status IN (${refundedPredecessors})
  `);

  return { updated: 1, refundTriggered: true };
}

/**
 * Append the booking-paid ledger entries inside the caller's tx:
 *   booking_credit = +gross  (full fare credited to the operator)
 *   platform_fee   = −fee    (the platform's cut)
 *   psp_fee        = −mdr     (VNPay ONLY — the PSP's MDR cut; Issue 123)
 *
 * psp_fee is PLATFORM-FLOAT: it is EXCLUDED from the operator balance
 * (OPERATOR_BALANCE_TYPES in lib/ledger/balance.ts does NOT list it, exactly like
 * refund_out), so the operator is kept whole — VNPay's fee comes out of the
 * platform's margin, not the operator's. The entry exists purely so the platform
 * can measure its per-booking VNPay cost. Written ONLY when adapter === 'vnpay'.
 *
 * Idempotent via per-booking `sourceEventId`s. Call ONLY after a successful
 * (rowcount 1) paid transition so a replay never re-appends.
 */
export async function appendBookingPaidLedger(
  tx: Prisma.TransactionClient,
  input: {
    operatorId: string;
    bookingId: string;
    grossVnd: number;
    now: Date;
    /** Payment adapter/method — 'vnpay' additionally writes a psp_fee entry. */
    adapter: string;
  }
): Promise<void> {
  const { operatorId, bookingId, grossVnd, now, adapter } = input;
  const gross = BigInt(grossVnd);
  const feePpm = await getEffectiveFeeRate(operatorId, now, tx);
  const fee = calcPlatformFeeMinor(gross, feePpm);

  await appendLedgerEntry(
    {
      operatorId,
      bookingId,
      type: 'booking_credit',
      amountMinor: gross,
      currency: 'VND',
      sourceEventId: `booking_credit:${bookingId}`,
    },
    tx
  );
  await appendLedgerEntry(
    {
      operatorId,
      bookingId,
      type: 'platform_fee',
      amountMinor: -fee,
      currency: 'VND',
      sourceEventId: `platform_fee:${bookingId}`,
    },
    tx
  );

  // Issue 123: VNPay MDR cost as a platform-float psp_fee entry (negative =
  // money the platform pays VNPay). BigInt via applyFeePpm (floor). Excluded
  // from operator balance, so it never touches operator-owed money.
  if (adapter === 'vnpay') {
    const pspFee = applyFeePpm(gross, VNPAY_MDR_PPM);
    await appendLedgerEntry(
      {
        operatorId,
        bookingId,
        type: 'psp_fee',
        amountMinor: -pspFee,
        currency: 'VND',
        sourceEventId: `psp_fee:${bookingId}`,
      },
      tx
    );
  }
}
