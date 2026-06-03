/**
 * getBookingRevenueRows — query paid bookings for an operator's trips, returning per-booking rows.
 *
 * This is the data source for the CSV export (GET /api/op/reports/revenue.csv).
 * It serves PRD story 57: per-booking rows with 9 columns.
 *
 * Do NOT confuse with getRevenueReport.ts — that returns per-trip aggregated rows for
 * the JSON report (story 56). The two queries are intentionally separate.
 *
 * Date window: dateFrom/dateTo are ISO date strings (YYYY-MM-DD), interpreted as
 * Asia/Ho_Chi_Minh timezone (UTC+7): from T00:00:00+07:00 to T23:59:59+07:00.
 * (Rule from Issue 014 Mistake Log: timezone-aware filter windows must use the same tz
 * the UI presents to users — Asia/Ho_Chi_Minh.)
 *
 * "Paid" booking statuses (same whitelist as getRevenueReport.ts):
 *   paid, completed
 * Excluded: awaiting_payment, cancelled, trip_cancelled, no_show, payment_failed_expired.
 *
 * I7-exempt: operator-side reporting endpoint; operator is the price authority.
 */

import { prisma } from '@/lib/db/client';

const PAID_STATUSES = ['paid', 'completed'] as const;

export interface BookingRevenueRow {
  bookingRef: string;
  routeName: string;
  departureAt: Date;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: string;
  status: string;
}

export interface GetBookingRevenueRowsInput {
  operatorId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  routeId?: string;
}

export async function getBookingRevenueRows(
  input: GetBookingRevenueRowsInput
): Promise<BookingRevenueRow[]> {
  const { operatorId, dateFrom, dateTo, routeId } = input;

  // Convert YYYY-MM-DD date strings to VN-tz window boundaries.
  const windowStart = new Date(`${dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${dateTo}T23:59:59+07:00`);

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
      bookingRef: true,
      buyerName: true,
      buyerPhone: true,
      ticketCount: true,
      totalVnd: true,
      paymentMethod: true,
      status: true,
      trip: {
        select: {
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
    orderBy: [
      { trip: { departureAt: 'asc' } },
      { bookingRef: 'asc' },
    ],
  });

  return bookings.map((b) => ({
    bookingRef: b.bookingRef,
    // Route has no `name` column — compose from origin + destination (same convention as getRevenueReport.ts).
    routeName: `${b.trip.route.origin} → ${b.trip.route.destination}`,
    departureAt: b.trip.departureAt,
    buyerName: b.buyerName,
    buyerPhone: b.buyerPhone,
    ticketCount: b.ticketCount,
    totalVnd: b.totalVnd,
    paymentMethod: b.paymentMethod,
    status: b.status,
  }));
}
