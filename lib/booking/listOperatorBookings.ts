/**
 * listOperatorBookings — paginated paid booking queue for operator (Issue 014 AC2).
 *
 * Filters: busId, serviceDate (YYYY-MM-DD), routeId, contactStatus
 * Sorts: trip.departureAt ASC (soonest first)
 * Paid statuses only: paid, completed
 * Tenant-isolated: only trips belonging to operator's operatorId.
 *
 * Pagination: cursor-based (cursor = last booking id in previous page).
 */

import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { toBookingQueueRow, type BookingQueueRow } from './toBookingQueueRow';

export const ListOperatorBookingsParamsSchema = z.object({
  busId: z.string().optional(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  routeId: z.string().optional(),
  tripId: z.string().optional(),
  contactStatus: z.enum(['pending', 'reached', 'no_answer', 'callback']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type ListOperatorBookingsParams = z.input<typeof ListOperatorBookingsParamsSchema>;

export interface ListOperatorBookingsResult {
  rows: BookingQueueRow[];
  nextCursor: string | null;
}

const PAID_STATUSES = [
  'paid',
  // 'completed' is also included for the manifest/queue — operators need to see it
  'completed',
] as const;

const bookingQueueSelect = {
  id: true,
  bookingRef: true,
  buyerName: true,
  buyerPhone: true,
  ticketCount: true,
  contactStatus: true,
  paymentMethod: true,
  status: true,
  isManual: true,
  escalatedAt: true,
  trip: {
    select: {
      id: true,
      departureAt: true,
      busId: true,
      routeId: true,
    },
  },
  pickupAreaLabel: true,
} as const;

export async function listOperatorBookings(
  operatorId: string,
  params: ListOperatorBookingsParams
): Promise<ListOperatorBookingsResult> {
  const parsed = ListOperatorBookingsParamsSchema.parse(params);
  const { busId, serviceDate, routeId, tripId, contactStatus, limit, cursor } = parsed;

  // Build date range filter from serviceDate.
  // Trip.departureAt is stored in UTC. Vietnam timezone is UTC+7, so a Vietnam-local
  // day (e.g. 2026-05-20 00:00–23:59 VN) maps to 2026-05-19T17:00:00Z–2026-05-20T16:59:59.999Z.
  // Using explicit +07:00 offset is server-timezone-agnostic.
  // Vietnam-local day window (UTC+7) — server timezone-agnostic
  let dateFilter: { gte: Date; lte: Date } | undefined;
  if (serviceDate) {
    const startUtc = new Date(`${serviceDate}T00:00:00+07:00`);
    const endUtc = new Date(`${serviceDate}T23:59:59.999+07:00`);
    dateFilter = { gte: startUtc, lte: endUtc };
  }

  // tenant-scoped via trip.operatorId join (model has no top-level operatorId)
  const rows = await prisma.booking.findMany({
    where: {
      status: { in: [...PAID_STATUSES] },
      ...(contactStatus ? { contactStatus } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
      trip: {
        operatorId,
        ...(tripId ? { id: tripId } : {}),
        ...(busId ? { busId } : {}),
        ...(routeId ? { routeId } : {}),
        ...(dateFilter ? { departureAt: dateFilter } : {}),  // VN-local day window
      },
    },
    select: bookingQueueSelect,
    orderBy: [{ trip: { departureAt: 'asc' } }, { id: 'asc' }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    rows: page.map(toBookingQueueRow),
    nextCursor,
  };
}
