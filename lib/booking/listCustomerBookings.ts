/**
 * listCustomerBookings — paginated bookings history for an authenticated
 * customer (Issue 009, PRD story 15).
 *
 * Scope: customerId only (the JWT sub). No tenant/operator dimension — a
 * customer sees exactly their own attached bookings.
 *
 * Tabs (partition — every booking falls in exactly one):
 *   upcoming = active status AND trip.departureAt >= now
 *   past     = trip.departureAt < now OR terminal status
 * Sort: upcoming ASC (soonest first), past DESC (most recent first).
 *
 * Pagination: Prisma cursor on booking id (+ id tiebreaker in orderBy so the
 * cursor is stable even when two trips share a departureAt).
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { BookingPaymentStatus } from './bookingDto';

export const ListCustomerBookingsParamsSchema = z.object({
  tab: z.enum(['upcoming', 'past']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type ListCustomerBookingsParams = z.input<typeof ListCustomerBookingsParamsSchema>;

/** Statuses for a booking that is still live (not yet terminal). */
const ACTIVE_STATUSES = [
  'awaiting_payment',
  'pending_cash_payment',
  'paid',
] as const;

/** Terminal statuses — a booking here is always "past" regardless of date. */
const TERMINAL_STATUSES = [
  'completed',
  'cancelled',
  'trip_cancelled',
  'no_show',
  'payment_failed_expired',
] as const;

export const customerBookingSelect = {
  id: true,
  bookingRef: true,
  customerId: true,
  ticketCount: true,
  totalVnd: true,
  paymentMethod: true,
  status: true,
  createdAt: true,
  trip: {
    select: {
      departureAt: true,
      route: { select: { origin: true, destination: true } },
    },
  },
} as const satisfies Prisma.BookingSelect;

type CustomerBookingRaw = Prisma.BookingGetPayload<{ select: typeof customerBookingSelect }>;

export interface CustomerBookingRow {
  id: string;
  bookingRef: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: 'cash' | 'momo' | 'zalopay' | 'card';
  status: BookingPaymentStatus;
  createdAt: string; // ISO 8601
  route: { origin: string; destination: string };
  departureAt: string; // ISO 8601
}

export interface ListCustomerBookingsResult {
  rows: CustomerBookingRow[];
  nextCursor: string | null;
}

function toCustomerBookingRow(row: CustomerBookingRaw): CustomerBookingRow {
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    ticketCount: row.ticketCount,
    totalVnd: row.totalVnd,
    paymentMethod: row.paymentMethod as CustomerBookingRow['paymentMethod'],
    status: row.status as BookingPaymentStatus,
    createdAt: row.createdAt.toISOString(),
    route: { origin: row.trip.route.origin, destination: row.trip.route.destination },
    departureAt: row.trip.departureAt.toISOString(),
  };
}

export async function listCustomerBookings(
  customerId: string,
  params: ListCustomerBookingsParams
): Promise<ListCustomerBookingsResult> {
  const { tab, limit, cursor } = ListCustomerBookingsParamsSchema.parse(params);
  const now = new Date();

  const where: Prisma.BookingWhereInput =
    tab === 'upcoming'
      ? {
          customerId,
          status: { in: [...ACTIVE_STATUSES] },
          trip: { departureAt: { gte: now } },
        }
      : {
          customerId,
          OR: [
            { trip: { departureAt: { lt: now } } },
            { status: { in: [...TERMINAL_STATUSES] } },
          ],
        };

  const orderBy: Prisma.BookingOrderByWithRelationInput[] =
    tab === 'upcoming'
      ? [{ trip: { departureAt: 'asc' } }, { id: 'asc' }]
      : [{ trip: { departureAt: 'desc' } }, { id: 'desc' }];

  const rows = await prisma.booking.findMany({
    where,
    select: customerBookingSelect,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    rows: page.map(toCustomerBookingRow),
    nextCursor,
  };
}
