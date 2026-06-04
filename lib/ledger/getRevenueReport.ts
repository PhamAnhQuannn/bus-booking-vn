/**
 * getRevenueReport — query paid bookings for an operator's trips, grouped by trip.
 *
 * Returns RevenueRow[] sorted by departureAt ascending.
 *
 * Date window: dateFrom/dateTo are ISO date strings (YYYY-MM-DD), interpreted as
 * Asia/Ho_Chi_Minh timezone (UTC+7): from T00:00:00+07:00 to T23:59:59+07:00.
 *
 * "Paid" booking statuses (mirrors getTripOccupancy.ts and markCompleted.ts convention):
 *   paid, completed
 * Excluded: awaiting_payment, cancelled, trip_cancelled, no_show, payment_failed_expired.
 *
 * I7-exempt: operator-side reporting endpoint; operator is the price authority.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { calcPayout } from './calcPayout';
import type { RevenueRow } from './buildRevenueCsv';

// Re-export RevenueRow for use by route handlers.
export type { RevenueRow };

const PAID_STATUSES = ['paid', 'completed'] as const;

export interface GetRevenueReportInput {
  operatorId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  routeId?: string;
}

export async function getRevenueReport(input: GetRevenueReportInput): Promise<RevenueRow[]> {
  const { operatorId, dateFrom, dateTo, routeId } = input;

  // Convert YYYY-MM-DD date strings to VN-tz window boundaries.
  // Rule (Issue 014 Mistake Log): timezone-aware filter windows must use the same tz the UI
  // presents to users — Asia/Ho_Chi_Minh (UTC+7).
  const windowStart = new Date(`${dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${dateTo}T23:59:59+07:00`);

  // Fetch all paid bookings for the operator's trips in the date window.
  // tenant-scoped via trip.operatorId join (model has no top-level operatorId)
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: [...PAID_STATUSES] },
      trip: {
        operatorId,
        departureAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        ...(routeId ? { routeId } : {}),
      },
    },
    select: {
      tripId: true,
      ticketCount: true,
      totalVnd: true,
      trip: {
        select: {
          id: true,
          departureAt: true,
          route: {
            select: {
              origin: true,
              destination: true,
            },
          },
        },
      },
    },
    orderBy: {
      trip: { departureAt: 'asc' },
    },
  });

  // Group by tripId in-memory.
  const tripMap = new Map<
    string,
    {
      tripId: string;
      departureAt: Date;
      routeName: string;
      seatsSold: number;
      grossRevenueVnd: number;
    }
  >();

  for (const booking of bookings) {
    const existing = tripMap.get(booking.tripId);
    const routeName = `${booking.trip.route.origin} → ${booking.trip.route.destination}`;
    if (existing) {
      existing.seatsSold += booking.ticketCount;
      existing.grossRevenueVnd += booking.totalVnd;
    } else {
      tripMap.set(booking.tripId, {
        tripId: booking.tripId,
        departureAt: booking.trip.departureAt,
        routeName,
        seatsSold: booking.ticketCount,
        grossRevenueVnd: booking.totalVnd,
      });
    }
  }

  // Look up payout statuses in bulk for all trips found.
  const tripIds = [...tripMap.keys()];
  const payouts =
    tripIds.length > 0
      ? await prisma.payout.findMany({
          ...withOperatorScope(operatorId, { where: { tripId: { in: tripIds } } }),
          select: { tripId: true, status: true },
        })
      : [];

  const payoutByTripId = new Map<string, string>();
  for (const p of payouts) {
    // Issue 053: Payout.tripId is now nullable (withdrawal payouts carry null).
    // The query above filters `tripId: { in: tripIds }`, so withdrawal rows (null)
    // never match here — but Prisma still types tripId as `string | null`.
    // Skip the null defensively (this is a per-trip revenue report; a withdrawal
    // is NOT trip revenue and has no place in this grouping).
    if (p.tripId !== null) {
      payoutByTripId.set(p.tripId, p.status);
    }
  }

  // Build result rows sorted by departureAt ascending.
  const rows: RevenueRow[] = [...tripMap.values()]
    .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime())
    .map((trip) => {
      const { platformFee, net } = calcPayout({ grossPaidBookings: trip.grossRevenueVnd });
      const rawStatus = payoutByTripId.get(trip.tripId);
      const payoutStatus = (rawStatus as RevenueRow['payoutStatus']) ?? null;
      return {
        tripId: trip.tripId,
        departureAt: trip.departureAt,
        routeName: trip.routeName,
        seatsSold: trip.seatsSold,
        grossRevenueVnd: trip.grossRevenueVnd,
        platformFeeVnd: platformFee,
        netPayoutVnd: net,
        payoutStatus,
      };
    });

  return rows;
}
