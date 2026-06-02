/**
 * reassignBus — assign a different bus to a scheduled trip (Issue 013 AC3).
 *
 * AC3 validation cascade:
 *   1. bus_deactivated: new bus is deactivated
 *   2. bus_in_maintenance: new bus has maintenance overlapping departureAt
 *   3. capacity_too_small: new capacity < (activeHolds + confirmedBookings + blockedSeats)
 *      → 422 with { required, provided }
 *   4. bus_overlap_with_outbound: new bus already assigned to another trip at same departureAt
 *      → 409
 *
 * Uses $transaction + SELECT FOR UPDATE on Trip (I1 TOCTOU rule, Issue 011).
 * Cross-op = 404 not_found (I2).
 */

import { prisma } from '@/lib/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';
import { busHasOverlappingTrip, tripWindowEnd } from './busOverlap';

export async function reassignBus(
  operatorId: string,
  tripId: string,
  newBusId: string
): Promise<TripDto> {
  let result: Awaited<ReturnType<typeof _updatedTrip>>;

  try {
    result = await prisma.$transaction(async (tx) => {
      // I1: Lock the Trip row (join Route for the duration that defines its overlap window)
      const locked = await tx.$queryRaw<
        { id: string; busId: string; departureAt: Date; blockedSeats: number; durationMinutes: number }[]
      >`
        SELECT t.id, t."busId", t."departureAt", t."blockedSeats", r."durationMinutes"
        FROM "Trip" t
        JOIN "Route" r ON r.id = t."routeId"
        WHERE t.id = ${tripId} AND t."operatorId" = ${operatorId}
        FOR UPDATE OF t
      `;
      if (locked.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }
      const { departureAt, blockedSeats, durationMinutes } = locked[0];

      // Validate new bus ownership + state
      const bus = await tx.bus.findFirst({
        where: { id: newBusId, operatorId },
        select: { id: true, capacity: true, deactivatedAt: true, maintenanceStart: true, maintenanceEnd: true },
      });
      if (!bus) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }
      if (bus.deactivatedAt !== null) {
        throw Object.assign(new Error('bus_deactivated'), { _trip: 'bus_deactivated' });
      }
      if (bus.maintenanceStart !== null && bus.maintenanceEnd !== null) {
        if (bus.maintenanceStart <= departureAt && departureAt < bus.maintenanceEnd) {
          throw Object.assign(new Error('bus_in_maintenance'), { _trip: 'bus_in_maintenance' });
        }
      }

      // Check for capacity: required = activeHolds + confirmedBookings + blockedSeats
      const [holdsAgg, bookingsAgg] = await Promise.all([
        tx.hold.aggregate({
          where: { tripId, status: 'active', expiresAt: { gt: new Date() } },
          _sum: { ticketCount: true },
        }),
        tx.booking.aggregate({
          where: {
            tripId,
            status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
          },
          _sum: { ticketCount: true },
        }),
      ]);

      const activeHolds = holdsAgg._sum.ticketCount ?? 0;
      const confirmedBookings = bookingsAgg._sum.ticketCount ?? 0;
      const required = activeHolds + confirmedBookings + blockedSeats;

      if (bus.capacity < required) {
        throw Object.assign(new Error('capacity_too_small'), {
          _trip: 'capacity_too_small',
          required,
          provided: bus.capacity,
        });
      }

      // Check bus overlap: the new bus cannot run a trip whose occupancy window
      // overlaps this trip's window [departureAt, departureAt + routeDuration + buffer].
      // (Prior bug: this used exact departureAt equality, so overlapping-but-not-equal
      // trips slipped through.) Same operator — other operators' buses aren't visible.
      const overlap = await busHasOverlappingTrip(tx, {
        busId: newBusId,
        candidateStart: departureAt,
        candidateEnd: tripWindowEnd(departureAt, durationMinutes),
        excludeTripId: tripId,
      });
      if (overlap) {
        throw Object.assign(new Error('bus_overlap_with_outbound'), { _trip: 'bus_overlap_with_outbound' });
      }

      return tx.trip.update({
        where: { id: tripId },
        data: { busId: newBusId },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
                },
              },
            },
          },
        },
      });
    });
  } catch (e) {
    const tagged = e as { _trip?: string; required?: number; provided?: number };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    if (tagged._trip === 'bus_deactivated') throw new TripServiceError('bus_deactivated');
    if (tagged._trip === 'bus_in_maintenance') throw new TripServiceError('bus_in_maintenance');
    if (tagged._trip === 'capacity_too_small') {
      throw new TripServiceError('capacity_too_small', {
        required: tagged.required,
        provided: tagged.provided,
      });
    }
    if (tagged._trip === 'bus_overlap_with_outbound') {
      throw new TripServiceError('bus_overlap_with_outbound');
    }
    throw e;
  }

  return toTripDto(result);
}

// Placeholder to satisfy TypeScript (actual return type from prisma.trip.update with include)
async function _updatedTrip(_id: string) {
  return prisma.trip.findFirst({
    where: { id: _id },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: {
            where: { status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] } },
          },
        },
      },
    },
  });
}
