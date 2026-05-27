/**
 * getOperatorKpis — headline metrics for the operator overview dashboard.
 *
 * Reuses getRevenueReport for the paid-revenue figures (single source of truth for
 * "paid" semantics) and adds a booking-status breakdown + capacity for occupancy.
 *
 * Date window: dateFrom/dateTo are YYYY-MM-DD interpreted as Asia/Ho_Chi_Minh
 * (UTC+7), matching getRevenueReport (Issue 014 timezone rule).
 *
 * I7-exempt: operator-side reporting; operator is the price authority.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { getRevenueReport } from '@/lib/payouts/getRevenueReport';

export interface OperatorKpis {
  periodTrips: number;
  seatsSold: number;
  grossRevenueVnd: number;
  netPayoutVnd: number;
  capacityTotal: number;
  occupancyPct: number; // 0–100, rounded
  totalBookings: number;
  paidBookings: number;
  paidRatePct: number; // 0–100, rounded
  statusBreakdown: { status: string; count: number }[];
}

export interface GetOperatorKpisInput {
  operatorId: string;
  dateFrom: string;
  dateTo: string;
}

const PAID_STATUSES = ['pending_cash_payment', 'paid_operator_notified', 'completed'];

export async function getOperatorKpis(input: GetOperatorKpisInput): Promise<OperatorKpis> {
  const { operatorId, dateFrom, dateTo } = input;
  const windowStart = new Date(`${dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${dateTo}T23:59:59+07:00`);

  const [revenueRows, breakdownRows, capacityRows] = await Promise.all([
    getRevenueReport({ operatorId, dateFrom, dateTo }),
    prisma.$queryRaw<{ status: string; count: number }[]>(
      Prisma.sql`
        SELECT b.status::text AS status, COUNT(*)::int AS count
        FROM "Booking" b
        JOIN "Trip" t ON b."tripId" = t.id
        WHERE t."operatorId" = ${operatorId}
          AND t."departureAt" >= ${windowStart}
          AND t."departureAt" <= ${windowEnd}
        GROUP BY b.status
        ORDER BY count DESC
      `
    ),
    prisma.$queryRaw<{ capacity: number }[]>(
      Prisma.sql`
        SELECT COALESCE(SUM(bus.capacity), 0)::int AS capacity
        FROM "Trip" t
        JOIN "Bus" bus ON t."busId" = bus.id
        WHERE t."operatorId" = ${operatorId}
          AND t."departureAt" >= ${windowStart}
          AND t."departureAt" <= ${windowEnd}
          AND t.status <> 'cancelled'::"TripStatus"
      `
    ),
  ]);

  const seatsSold = revenueRows.reduce((s, r) => s + r.seatsSold, 0);
  const grossRevenueVnd = revenueRows.reduce((s, r) => s + r.grossRevenueVnd, 0);
  const netPayoutVnd = revenueRows.reduce((s, r) => s + r.netPayoutVnd, 0);

  const totalBookings = breakdownRows.reduce((s, r) => s + r.count, 0);
  const paidBookings = breakdownRows
    .filter((r) => PAID_STATUSES.includes(r.status))
    .reduce((s, r) => s + r.count, 0);

  const capacityTotal = capacityRows[0]?.capacity ?? 0;

  return {
    periodTrips: revenueRows.length,
    seatsSold,
    grossRevenueVnd,
    netPayoutVnd,
    capacityTotal,
    occupancyPct: capacityTotal > 0 ? Math.round((seatsSold / capacityTotal) * 100) : 0,
    totalBookings,
    paidBookings,
    paidRatePct: totalBookings > 0 ? Math.round((paidBookings / totalBookings) * 100) : 0,
    statusBreakdown: breakdownRows,
  };
}
