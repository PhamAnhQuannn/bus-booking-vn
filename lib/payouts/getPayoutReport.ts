/**
 * getPayoutReport — list all Payout rows for an operator, newest first.
 *
 * Returns PayoutReportRow[] sorted by scheduledAt descending.
 *
 * I7-exempt: operator-side reporting endpoint.
 */

import { prisma } from '@/lib/db/client';
import type { PayoutStatus } from '@prisma/client';

export { type PayoutStatus };

export interface PayoutReportRow {
  payoutId: string;
  tripId: string;
  routeName: string;
  departureAt: Date;
  gross: number;
  platformFee: number;
  net: number;
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
    where: { operatorId },
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
    routeName: `${p.trip.route.origin} → ${p.trip.route.destination}`,
    departureAt: p.trip.departureAt,
    gross: p.gross,
    platformFee: p.platformFee,
    net: p.net,
    status: p.status,
    scheduledAt: p.scheduledAt,
    settledAt: p.settledAt,
    failureReason: p.failureReason,
  }));
}
