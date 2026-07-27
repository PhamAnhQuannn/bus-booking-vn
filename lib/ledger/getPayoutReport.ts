/**
 * getPayoutReport — list all Payout rows for an operator, newest first.
 *
 * Returns PayoutReportRow[] sorted by scheduledAt descending.
 *
 * I7-exempt: operator-side reporting endpoint.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import type { PayoutStatus } from '@prisma/client';

export { type PayoutStatus };

export interface PayoutReportRow {
  /** null for on-demand WITHDRAWAL payouts (Issue 053) — they have no owning trip. */
  tripId: string | null;
  /** For a withdrawal (null trip) this is a fixed label rather than a route. */
  routeName: string;
  /** null for a withdrawal payout (no trip ⇒ no departure). */
  departureAt: Date | null;
  payoutId: string;
  gross: string;
  platformFee: string;
  net: string;
  status: PayoutStatus;
  scheduledAt: Date;
  settledAt: Date | null;
  failureReason: string | null;
}

export interface GetPayoutReportInput {
  operatorId: string;
}

export async function getPayoutReport(input: GetPayoutReportInput): Promise<PayoutReportRow[]> {
  const { operatorId } = input;

  const payouts = await prisma.payout.findMany({
    ...withOperatorScope(operatorId),
    include: {
      trip: {
        include: {
          route: {
            select: { origin: true, destination: true },
          },
        },
      },
    },
    orderBy: { scheduledAt: 'desc' },
  });

  return payouts.map((p) => ({
    payoutId: p.id,
    tripId: p.tripId,
    // Issue 053: a withdrawal payout has tripId = null and `trip` is null on the
    // LEFT-joined include — optional-chain it. Withdrawals render a fixed label
    // and a null departure instead of a route + departure time.
    routeName: p.trip ? `${p.trip.route.origin} → ${p.trip.route.destination}` : 'Rút tiền (Withdrawal)',
    departureAt: p.trip?.departureAt ?? null,
    gross: p.gross.toString(),
    platformFee: p.platformFee.toString(),
    net: p.net.toString(),
    status: p.status,
    scheduledAt: p.scheduledAt,
    settledAt: p.settledAt,
    failureReason: p.failureReason,
  }));
}
