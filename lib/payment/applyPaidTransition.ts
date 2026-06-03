/**
 * Shared "booking → paid" effect — the monotonic guarded status transition plus
 * the two double-entry ledger rows (booking_credit +gross / platform_fee −fee).
 *
 * Extracted (Issue 095) so the payment webhook (lib/payment/processWebhook.ts)
 * and the reconciliation sweeper (lib/jobs/reconcilePayments.ts) reach the SAME
 * paid effect and can never drift. Behaviour is byte-identical to the inline
 * block that previously lived in processWebhook:
 *
 *   - the status UPDATE derives its WHERE predecessors from the single-source
 *     transition map (Issue 034 `legalPredecessors('paid')`), NEVER a re-typed
 *     `status = 'awaiting_payment'` literal — a replay / already-advanced row
 *     matches 0 rows and is never regressed.
 *   - the ledger entries are idempotent on `sourceEventId`
 *     (`booking_credit:<bookingId>` / `platform_fee:<bookingId>`), so even if the
 *     two callers both reach a booking, the second append is a no-op.
 *
 * Both helpers take a Prisma transaction handle so the status flip + the ledger
 * writes commit atomically with the caller's surrounding work.
 */

import { Prisma } from '@prisma/client';
import { legalPredecessors } from '@/lib/booking/transitions';
import {
  appendLedgerEntry,
  getEffectiveFeeRate,
  calcPlatformFeeMinor,
} from '@/lib/ledger';

/**
 * Monotonic guarded transition of a booking to `paid`. Returns the number of
 * rows updated: 1 on the FIRST (and only) transition, 0 when the row is no
 * longer a legal predecessor of `paid` (replay / already advanced) — the caller
 * uses the 0 case to skip all paid side-effects, never regressing a paid row.
 */
export async function applyPaidStatusTransition(
  tx: Prisma.TransactionClient,
  bookingId: string,
  providerTxnId: string
): Promise<number> {
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
  return updated as number;
}

/**
 * Append the two booking-paid ledger entries inside the caller's tx:
 *   booking_credit = +gross  (full fare credited to the operator)
 *   platform_fee   = −fee    (the platform's cut, its OWN entry — NOT folded
 *                             into the credit). Operator balance = gross − fee.
 *
 * Idempotent via the per-booking `sourceEventId`s. Call ONLY after a successful
 * (rowcount 1) paid transition so a replay never re-appends.
 */
export async function appendBookingPaidLedger(
  tx: Prisma.TransactionClient,
  input: { operatorId: string; bookingId: string; grossVnd: number; now: Date }
): Promise<void> {
  const { operatorId, bookingId, grossVnd, now } = input;
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
}
