/**
 * salesToggle — flip salesClosed on a trip (Issue 013 AC7).
 *
 * AC7: flips salesClosed; lib/db/searchTrips.ts:74 already filters salesClosed=false.
 * Bookings/Holds are NOT touched.
 */

import { prisma } from '@/lib/core/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';

export async function salesToggle(
  operatorId: string,
  tripId: string,
  salesClosed: boolean
): Promise<TripDto> {
  return await prisma.$transaction(async (tx) => {
    // Issue 011 rule: SELECT FOR UPDATE serialises concurrent writes on the same trip row.
    // CUIDs are TEXT — no ::uuid cast.
    await tx.$queryRaw`SELECT id FROM "Trip" WHERE id = ${tripId} AND "operatorId" = ${operatorId} FOR UPDATE`;

    // Cross-op guard via ownership check
    const existing = await tx.trip.findFirst({
      where: { id: tripId, operatorId },
      select: { id: true },
    });

    if (!existing) {
      throw new TripServiceError('not_found');
    }

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: { salesClosed },
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
    });

    return toTripDto(updated);
  });
}
