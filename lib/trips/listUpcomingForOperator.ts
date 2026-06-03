/**
 * listUpcomingForOperator — paginated upcoming trips for operator dashboard (Issue 014).
 *
 * Sorted by departureAt ASC. Filter by routeId.
 * Tenant-isolated: only trips belonging to the operatorId.
 * Excludes cancelled trips; shows scheduled/departed.
 */

import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { toTripDto } from './toTripDto';
import type { TripDto } from './tripDto';

export const ListUpcomingParamsSchema = z.object({
  routeId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type ListUpcomingParams = z.input<typeof ListUpcomingParamsSchema>;

export interface ListUpcomingResult {
  trips: TripDto[];
  nextCursor: string | null;
}

export async function listUpcomingForOperator(
  operatorId: string,
  params: ListUpcomingParams = {}
): Promise<ListUpcomingResult> {
  const parsed = ListUpcomingParamsSchema.parse(params);
  const { routeId, limit, cursor } = parsed;

  const rows = await prisma.trip.findMany({
    where: {
      operatorId,
      status: { in: ['scheduled', 'departed'] },
      departureAt: { gte: new Date() },
      ...(routeId ? { routeId } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: {
            where: {
              status: { in: ['paid', 'completed'] },
            },
          },
        },
      },
    },
    orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    trips: page.map(toTripDto),
    nextCursor,
  };
}
