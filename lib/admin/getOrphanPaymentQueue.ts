/**
 * getOrphanPaymentQueue — admin Finance tab reconciliation reads (#331).
 *
 * In-process Prisma (NEVER self-fetch — AGENTS.md Issue 002/003). One list, oldest first:
 * every ORPHAN PaymentEvent (bookingId NULL) not yet resolved, each with the
 * `awaiting_payment` bookings it is SUSPECTED for — the same predicates the reconcile
 * sweeper's degraded match uses to hold a booking (exact amount, same rail, transfer inside
 * ±DEGRADED_MATCH_WINDOW_MINUTES of the hold/booking creation). Grouping by orphan (= by
 * providerTxnId, unique per adapter) makes N bookings held on one transfer read as ONE item.
 *
 * rawBody is read only to recover the transfer amount in-process; it is NEVER returned
 * (it carries payer PII — #332). Structured columns only.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { recoverSepayEvent } from '@/lib/payment';
import { DEGRADED_MATCH_WINDOW_MINUTES } from '@/lib/jobs';

export interface SuspectedBookingRow {
  bookingRef: string;
  createdAt: Date;
}

export interface OrphanPaymentRow {
  id: string;
  adapter: string;
  providerTxnId: string;
  /** Recovered transfer amount; null when the stored body yields none. */
  amountVnd: number | null;
  unmatchedReason: string | null;
  receivedAt: Date;
  /** awaiting_payment bookings the sweeper holds on this transfer (suspicion only). */
  suspectedBookings: SuspectedBookingRow[];
}

type PrismaLike = Pick<typeof defaultPrisma, 'paymentEvent' | 'booking'>;

const LIMIT = 100;

export async function getOrphanPaymentQueue(
  prisma: PrismaLike = defaultPrisma
): Promise<OrphanPaymentRow[]> {
  const events = await prisma.paymentEvent.findMany({
    where: { bookingId: null, resolvedAt: null },
    orderBy: { receivedAt: 'asc' },
    take: LIMIT,
    select: {
      id: true,
      adapter: true,
      providerTxnId: true,
      currency: true,
      rawBody: true,
      unmatchedReason: true,
      receivedAt: true,
    },
  });

  const orphans = events.map((e) => {
    const { amount, success } =
      e.adapter === 'bank_transfer' ? recoverSepayEvent(e.rawBody) : { amount: 0, success: false };
    return { ...e, amountVnd: success && e.currency === 'VND' ? amount : null };
  });

  const amounts = [...new Set(orphans.flatMap((o) => (o.amountVnd === null ? [] : [o.amountVnd])))];
  const candidates = amounts.length
    ? await prisma.booking.findMany({
        where: { status: 'awaiting_payment', totalVnd: { in: amounts } },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: {
          bookingRef: true,
          totalVnd: true,
          paymentMethod: true,
          createdAt: true,
          hold: { select: { createdAt: true } },
        },
      })
    : [];

  const windowMs = DEGRADED_MATCH_WINDOW_MINUTES * 60_000;
  return orphans.map((o) => ({
    id: o.id,
    adapter: o.adapter,
    providerTxnId: o.providerTxnId,
    amountVnd: o.amountVnd,
    unmatchedReason: o.unmatchedReason,
    receivedAt: o.receivedAt,
    suspectedBookings:
      o.amountVnd === null
        ? []
        : candidates
            .filter((b) => {
              const anchor = (b.hold?.createdAt ?? b.createdAt).getTime();
              return (
                b.totalVnd === o.amountVnd &&
                b.paymentMethod === o.adapter &&
                Math.abs(o.receivedAt.getTime() - anchor) <= windowMs
              );
            })
            .map((b) => ({ bookingRef: b.bookingRef, createdAt: b.createdAt })),
  }));
}
