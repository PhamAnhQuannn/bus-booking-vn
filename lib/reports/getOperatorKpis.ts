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
  /** Daily gross revenue across the window (continuous, one entry per day) — for sparklines. */
  dailyRevenue: number[];
  /** % change in gross revenue vs the previous equal-length window; null when no prior data. */
  revenueDeltaPct: number | null;
}

const PAID_SQL = Prisma.sql`b.status IN ('paid'::"BookingStatus",'completed'::"BookingStatus")`;

/** Enumerate YYYY-MM-DD strings from dateFrom..dateTo inclusive. */
function dateRange(dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  const d = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface GetOperatorKpisInput {
  operatorId: string;
  dateFrom: string;
  dateTo: string;
}

const PAID_STATUSES = ['paid', 'completed'];

export async function getOperatorKpis(input: GetOperatorKpisInput): Promise<OperatorKpis> {
  const { operatorId, dateFrom, dateTo } = input;
  const windowStart = new Date(`${dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${dateTo}T23:59:59+07:00`);
  // Previous equal-length window, ending just before this one.
  const spanMs = windowEnd.getTime() - windowStart.getTime();
  const prevEnd = new Date(windowStart.getTime() - 1);
  const prevStart = new Date(windowStart.getTime() - 1 - spanMs);

  const [revenueRows, breakdownRows, capacityRows, dailyRows, prevRows] = await Promise.all([
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
    // Daily gross revenue (paid bookings) bucketed by VN-local departure date.
    prisma.$queryRaw<{ d: string; rev: bigint }[]>(
      Prisma.sql`
        SELECT to_char((t."departureAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS d,
               COALESCE(SUM(b."totalVnd"), 0)::bigint AS rev
        FROM "Booking" b
        JOIN "Trip" t ON b."tripId" = t.id
        WHERE t."operatorId" = ${operatorId}
          AND ${PAID_SQL}
          AND t."departureAt" >= ${windowStart}
          AND t."departureAt" <= ${windowEnd}
        GROUP BY d
      `
    ),
    // Previous-window gross (paid) for the period-compare delta.
    prisma.$queryRaw<{ rev: bigint }[]>(
      Prisma.sql`
        SELECT COALESCE(SUM(b."totalVnd"), 0)::bigint AS rev
        FROM "Booking" b
        JOIN "Trip" t ON b."tripId" = t.id
        WHERE t."operatorId" = ${operatorId}
          AND ${PAID_SQL}
          AND t."departureAt" >= ${prevStart}
          AND t."departureAt" <= ${prevEnd}
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

  // Continuous daily series (fill zero-revenue days) for the sparkline.
  const revByDay = new Map(dailyRows.map((r) => [r.d, Number(r.rev)]));
  const dailyRevenue = dateRange(dateFrom, dateTo).map((d) => revByDay.get(d) ?? 0);

  const prevGross = Number(prevRows[0]?.rev ?? 0);
  const revenueDeltaPct = prevGross > 0 ? Math.round(((grossRevenueVnd - prevGross) / prevGross) * 100) : null;

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
    dailyRevenue,
    revenueDeltaPct,
  };
}
