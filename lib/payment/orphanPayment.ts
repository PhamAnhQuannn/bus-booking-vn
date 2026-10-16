/**
 * Admin reconciliation of ORPHAN PaymentEvents (bookingId NULL) — #331. MONEY-CRITICAL.
 *
 * - linkOrphanPayment: the admin has matched a memo-less transfer to its booking against
 *   the bank statement. Links the orphan (sets bookingId) ONLY. It does NOT mark the
 *   booking paid itself: a linked confirming event is exactly what the reconcile sweeper's
 *   branch (a) pays through the shared applyPaidStatusTransition + appendBookingPaidLedger
 *   + paid-notice enqueue, so the paid effects (ledger, ticket, emails) run on the one
 *   existing path, exactly once (monotonic guarded UPDATE). The route triggers that sweep
 *   right after the link commits.
 * - resolveOrphanPayment: the admin settled an orphan by hand (refunded it, or it is not
 *   our money) → resolvedAt + resolvedBankRef. It leaves the admin list, the orphan tile,
 *   and the sweeper's suspicion input, so any booking it was holding expires normally.
 *
 * Lock order matches the webhook (PaymentEvent → Booking): callback-form $transaction,
 * SELECT … FOR UPDATE on the event, then on the booking. Discriminated results (no thrown
 * sentinels — Issue 013); the route maps them to status codes.
 */

import { prisma } from '@/lib/core/db/client';
import { recoverSepayEvent } from './adapters/bankTransfer';
import { UNMATCHED_REASON } from './processWebhook';

export type LinkOrphanPaymentResult =
  | { ok: true; bookingId: string; replay: boolean }
  | {
      ok: false;
      error:
        | 'not_found'
        | 'booking_not_found'
        | 'already_linked'
        | 'not_linkable'
        | 'booking_not_awaiting_payment'
        | 'amount_mismatch';
    };

export async function linkOrphanPayment(input: {
  paymentEventId: string;
  bookingRef: string;
}): Promise<LinkOrphanPaymentResult> {
  const { paymentEventId, bookingRef } = input;
  return prisma.$transaction(async (tx) => {
    const events = await tx.$queryRaw<
      Array<{
        bookingId: string | null;
        adapter: string;
        currency: string;
        rawBody: string;
        unmatchedReason: string | null;
        resolvedAt: Date | null;
      }>
    >`
      SELECT "bookingId", "adapter", "currency", "rawBody", "unmatchedReason", "resolvedAt"
      FROM "PaymentEvent" WHERE "id" = ${paymentEventId}::uuid FOR UPDATE
    `;
    if (events.length === 0) return { ok: false, error: 'not_found' };
    const ev = events[0];

    const bookings = await tx.$queryRaw<Array<{ id: string; status: string; totalVnd: number; paymentMethod: string }>>`
      SELECT "id", "status"::text AS "status", "totalVnd", "paymentMethod"::text AS "paymentMethod"
      FROM "Booking" WHERE "bookingRef" = ${bookingRef} FOR UPDATE
    `;
    if (bookings.length === 0) return { ok: false, error: 'booking_not_found' };
    const booking = bookings[0];

    if (ev.bookingId !== null) {
      // Idempotent replay: a second click (or the webhook already linked it) is a no-op.
      if (ev.bookingId === booking.id) return { ok: true, bookingId: booking.id, replay: true };
      return { ok: false, error: 'already_linked' };
    }
    // Resolved = settled by hand; account_mismatch = landed on a foreign account (not our
    // money). Orphans are only ever recorded for bank_transfer (recordUnmatchedPaymentEvent),
    // the one body shape we parse here.
    if (
      ev.resolvedAt !== null ||
      ev.unmatchedReason === UNMATCHED_REASON.ACCOUNT_MISMATCH ||
      ev.adapter !== 'bank_transfer'
    ) {
      return { ok: false, error: 'not_linkable' };
    }
    if (booking.status !== 'awaiting_payment') {
      return { ok: false, error: 'booking_not_awaiting_payment' };
    }
    // Same-rail rule as the sweeper's degraded match: a bank transfer only settles a
    // booking that was created to be paid by bank transfer (not cash / VNPay).
    if (booking.paymentMethod !== ev.adapter) return { ok: false, error: 'not_linkable' };
    // EXACT amount (the degraded-match rule): an underpay would never confirm, and an
    // overpay delta has no refund obligation on the reconcile path.
    const { amount, success } = recoverSepayEvent(ev.rawBody);
    if (!success || ev.currency !== 'VND' || amount !== booking.totalVnd) {
      return { ok: false, error: 'amount_mismatch' };
    }

    await tx.paymentEvent.update({
      where: { id: paymentEventId },
      data: { bookingId: booking.id },
    });
    return { ok: true, bookingId: booking.id, replay: false };
  });
}

export type ResolveOrphanPaymentResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'not_resolvable' };

export async function resolveOrphanPayment(input: {
  paymentEventId: string;
  bankRef: string;
  now: Date;
}): Promise<ResolveOrphanPaymentResult> {
  const { paymentEventId, bankRef, now } = input;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ bookingId: string | null; resolvedAt: Date | null }>>`
      SELECT "bookingId", "resolvedAt"
      FROM "PaymentEvent" WHERE "id" = ${paymentEventId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) return { ok: false, error: 'not_found' };
    // Linked events go through the unfulfilled resolve (#851) instead.
    if (rows[0].bookingId !== null || rows[0].resolvedAt !== null) {
      return { ok: false, error: 'not_resolvable' };
    }

    await tx.paymentEvent.update({
      where: { id: paymentEventId },
      data: { resolvedAt: now, resolvedBankRef: bankRef },
    });
    return { ok: true };
  });
}
