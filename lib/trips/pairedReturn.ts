/**
 * pairedReturn — create a paired return trip for an existing outbound trip (Issue 013 AC6).
 *
 * AC6:
 *   - Server looks up reverse Route by (destination, origin) swap
 *   - If no reverse route exists → 422 no_reverse_route (NO auto-creation)
 *   - Validates returnDepartureAt > source.departureAt + 1h
 *   - Creates return Trip with: pairedTripId=source.id, busId=source.busId, price=source.price
 *   - Updates BOTH trips' pairedTripId in same txn
 *
 * I1: $transaction + SELECT FOR UPDATE on source trip.
 * I2: cross-op → 404 not_found.
 */

import { prisma } from '@/lib/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';

const ONE_HOUR_MS = 60 * 60 * 1000;

export interface PairedReturnResult {
  outboundTrip: TripDto;
  returnTrip: TripDto;
}

export async function pairedReturn(
  operatorId: string,
  outboundTripId: string,
  returnDepartureAt: Date,
  price?: number
): Promise<PairedReturnResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // I1: Lock the outbound trip
      const locked = await tx.$queryRaw<{
        id: string;
        routeId: string;
        busId: string;
        departureAt: Date;
        price: number;
        status: string;
        pairedTripId: string | null;
      }[]>`
        SELECT id, "routeId", "busId", "departureAt", price, status, "pairedTripId"
        FROM "Trip"
        WHERE id = ${outboundTripId} AND "operatorId" = ${operatorId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }

      const source = locked[0];

      if (source.status === 'cancelled') {
        throw Object.assign(new Error('trip_cancelled'), { _trip: 'trip_cancelled' });
      }

      // Validate return departure must be > source.departureAt + 1h
      if (returnDepartureAt.getTime() <= source.departureAt.getTime() + ONE_HOUR_MS) {
        throw Object.assign(new Error('invalid_return_time'), { _trip: 'invalid_return_time' });
      }

      // Look up source route to get origin/destination and durationMinutes (for overlap check)
      const sourceRoute = await tx.route.findUnique({
        where: { id: source.routeId },
        select: { origin: true, destination: true, durationMinutes: true },
      });

      if (!sourceRoute) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }

      // AC6: find reverse route (destination ↔ origin swap), scoped to same operator
      const reverseRoute = await tx.route.findFirst({
        where: {
          operatorId,
          origin: sourceRoute.destination,
          destination: sourceRoute.origin,
          deactivatedAt: null,
        },
        select: { id: true },
      });

      if (!reverseRoute) {
        throw Object.assign(new Error('no_reverse_route'), { _trip: 'no_reverse_route' });
      }

      // Validate bus availability for return trip
      const bus = await tx.bus.findFirst({
        where: { id: source.busId, operatorId },
        select: { id: true, capacity: true, deactivatedAt: true, maintenanceStart: true, maintenanceEnd: true },
      });

      if (!bus || bus.deactivatedAt !== null) {
        throw Object.assign(new Error('bus_deactivated'), { _trip: 'bus_deactivated' });
      }

      if (bus.maintenanceStart !== null && bus.maintenanceEnd !== null) {
        if (bus.maintenanceStart <= returnDepartureAt && returnDepartureAt < bus.maintenanceEnd) {
          throw Object.assign(new Error('bus_in_maintenance'), { _trip: 'bus_in_maintenance' });
        }
      }

      // AC6: bus_overlap_with_outbound — check the bus is not already assigned to another
      // non-cancelled trip whose window overlaps [returnDepartureAt, returnDepartureAt + durationMinutes + 60min].
      // Buffer matches the 60min gap already enforced on returnDepartureAt (ONE_HOUR_MS).
      const durationMinutes = sourceRoute?.durationMinutes ?? 0;
      const returnWindowEndMs =
        returnDepartureAt.getTime() + durationMinutes * 60 * 1000 + ONE_HOUR_MS;
      const returnWindowEnd = new Date(returnWindowEndMs);

      const busOverlap = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Trip"
        WHERE "busId" = ${source.busId}
          AND id != ${outboundTripId}
          AND status != 'cancelled'
          AND "departureAt" < ${returnWindowEnd}
          AND ("departureAt" + INTERVAL '1 minute' * (
                SELECT "durationMinutes" FROM "Route" WHERE id = "routeId"
              )) > ${returnDepartureAt}
        LIMIT 1
      `;

      if (busOverlap.length > 0) {
        throw Object.assign(new Error('bus_overlap_with_outbound'), { _trip: 'bus_overlap_with_outbound' });
      }

      const returnPrice = price ?? source.price;

      // Create the return trip
      const returnTrip = await tx.trip.create({
        data: {
          routeId: reverseRoute.id,
          busId: source.busId,
          operatorId,
          departureAt: returnDepartureAt,
          price: returnPrice,
          status: 'scheduled',
          salesClosed: false,
          blockedSeats: 0,
          pairedTripId: outboundTripId,
        },
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

      // Update outbound trip's pairedTripId to point at the new return trip
      const updatedOutbound = await tx.trip.update({
        where: { id: outboundTripId },
        data: { pairedTripId: returnTrip.id },
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

      return {
        outboundTrip: toTripDto(updatedOutbound),
        returnTrip: toTripDto(returnTrip),
      };
    });
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    if (tagged._trip === 'no_reverse_route') throw new TripServiceError('no_reverse_route');
    if (tagged._trip === 'bus_deactivated') throw new TripServiceError('bus_deactivated');
    if (tagged._trip === 'bus_in_maintenance') throw new TripServiceError('bus_in_maintenance');
    if (tagged._trip === 'trip_cancelled') throw new TripServiceError('trip_cancelled');
    if (tagged._trip === 'bus_overlap_with_outbound') throw new TripServiceError('bus_overlap_with_outbound');
    if (tagged._trip === 'invalid_return_time') throw new Error('returnDepartureAt must be > sourceDepartureAt + 1h');
    throw e;
  }
}
