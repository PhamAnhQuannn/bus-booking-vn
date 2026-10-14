/**
 * getManualRefundQueue — admin Finance tab "money still owed" reads (#833, #851).
 *
 * In-process Prisma (NEVER self-fetch — AGENTS.md Issue 002/003). Two lists, oldest first:
 *   - refunds   RefundObligation rows in 'manual_pending': refundOut ran on the no-PSP manual
 *               rail (ledger legs written) but no admin has confirmed the bank transfer yet.
 *               refundOut upserts this row for every manual refund (cron, admin refund-out,
 *               reconcile oversold), so this is the complete owed set.
 *   - payments  LINKED PaymentEvents tagged unfulfilled (late / duplicate / underpaid) with
 *               resolvedAt NULL — money held that never became a booking payment.
 *
 * Select whitelists are exactly the UI columns — no buyer contact here (the ops email
 * carries it); the admin looks the booking up by bookingRef.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { MANUAL_REFUND_PENDING, UNFULFILLED_REASON } from '@/lib/payment';

export interface OwedManualRefundRow {
  id: string;
  bookingRef: string | null;
  amountMinor: number;
  reason: string;
  createdAt: Date;
}

export interface UnresolvedPaymentRow {
  id: string;
  bookingRef: string | null;
  providerTxnId: string;
  unmatchedReason: string | null;
  receivedAt: Date;
}

export interface ManualRefundQueue {
  refunds: OwedManualRefundRow[];
  payments: UnresolvedPaymentRow[];
}

type PrismaLike = Pick<typeof defaultPrisma, 'refundObligation' | 'paymentEvent' | 'booking'>;

const LIMIT = 100;

export async function getManualRefundQueue(
  prisma: PrismaLike = defaultPrisma
): Promise<ManualRefundQueue> {
  const [obligations, events] = await Promise.all([
    prisma.refundObligation.findMany({
      where: { status: MANUAL_REFUND_PENDING },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
      select: { id: true, bookingId: true, amountMinor: true, reason: true, createdAt: true },
    }),
    prisma.paymentEvent.findMany({
      where: {
        bookingId: { not: null },
        unmatchedReason: { in: Object.values(UNFULFILLED_REASON) },
        resolvedAt: null,
      },
      orderBy: { receivedAt: 'asc' },
      take: LIMIT,
      select: {
        id: true,
        providerTxnId: true,
        unmatchedReason: true,
        receivedAt: true,
        booking: { select: { bookingRef: true } },
      },
    }),
  ]);

  // RefundObligation has no Booking relation — resolve refs in one batched read.
  const bookingIds = [...new Set(obligations.map((o) => o.bookingId))];
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, bookingRef: true },
      })
    : [];
  const refById = new Map(bookings.map((b) => [b.id, b.bookingRef]));

  return {
    refunds: obligations.map((o) => ({
      id: o.id,
      bookingRef: refById.get(o.bookingId) ?? null,
      amountMinor: o.amountMinor,
      reason: o.reason,
      createdAt: o.createdAt,
    })),
    payments: events.map((e) => ({
      id: e.id,
      bookingRef: e.booking?.bookingRef ?? null,
      providerTxnId: e.providerTxnId,
      unmatchedReason: e.unmatchedReason,
      receivedAt: e.receivedAt,
    })),
  };
}
