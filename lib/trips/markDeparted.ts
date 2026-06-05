/**
 * markDeparted — operator marks trip as departed (Issue 014 AC5).
 *
 * Sets Trip.departedAt. Discriminated result { ok, alreadyDeparted, trip }.
 * After departure: further new holds/bookings on this trip are blocked.
 * Blocking is enforced via departedAt check in lib/buses/getTripOccupancy.ts
 * (or hold creation) — see capacityGuard note below.
 *
 * $transaction + SELECT FOR UPDATE on Trip (TOCTOU guard).
 *
 * AC5: depart blocks further bookings on that trip.
 * Enforcement: the hold-creation path checks Trip.departedAt != null and
 * rejects with 409 trip_departed (matching existing convention in bookingRepo
 * where "t.departureAt > NOW()" is enforced at hold-creation time).
 * Additionally, salesClosed is set to true so the trip search route
 * excludes it and new holds cannot be created.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { TripServiceError } from './errors';
import { toTripDto } from './toTripDto';
import type { TripDto } from './tripDto';

export interface MarkDepartedResult {
  ok: true;
  alreadyDeparted: boolean;
  trip: TripDto;
}

export async function markDeparted(
  operatorId: string,
  tripId: string
): Promise<MarkDepartedResult> {
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE to serialise concurrent depart calls
    const locked = await tx.$queryRaw<{
      id: string;
      status: string;
      departedAt: Date | null;
    }[]>(
      Prisma.sql`
        SELECT id, status, "departedAt"
        FROM "Trip"
        WHERE id = ${tripId}
          AND "operatorId" = ${operatorId}
        FOR UPDATE
      `
    );

    if (locked.length === 0) {
      throw new TripServiceError('not_found');
    }

    const row = locked[0];

    if (row.status === 'cancelled') {
      throw new TripServiceError('trip_cancelled');
    }

    // Idempotency: already departed
    if (row.departedAt !== null) {
      const existing = await tx.trip.findUnique({
        where: { id: tripId },
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
      return { ok: true, alreadyDeparted: true, trip: toTripDto(existing!) };
    }

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: {
        departedAt: new Date(),
        status: 'departed',
        // AC5: close sales so no new holds/bookings can be created
        salesClosed: true,
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
    });

    return { ok: true, alreadyDeparted: false, trip: toTripDto(updated) };
  });
}
