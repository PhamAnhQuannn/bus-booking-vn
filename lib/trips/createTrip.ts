/**
 * createTrip — create a one-off operator trip (Issue 013 AC1).
 *
 * Validates:
 *   AC1: bus must not be in maintenance during trip window
 *   bus must belong to operator (cross-op 404)
 *   bus must be active (not deactivated)
 *   bus must not already run an overlapping trip (window-vs-window double-book guard)
 *
 * Runs inside a $transaction with `SELECT ... FOR UPDATE` on the bus row so concurrent
 * create/reassign on the same bus serialize (P1 fix 2026-06-01: create previously ran
 * with NO overlap guard and NO transaction — a bus could be double-booked on create).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { TripServiceError } from './errors';
import { resolveOwnedAreas, toPickupAreaRows } from './snapshotPickupAreas';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';
import { busHasOverlappingTrip, tripWindowEnd } from './busOverlap';

export interface CreateTripInput {
  operatorId: string;
  routeId: string;
  busId: string;
  departureAt: Date;
  price: number;
  blockedSeats?: number;
  recurringTemplateId?: string;
  pairedTripId?: string;
  /** Issue 106: OperatorPickupArea ids enabled for this trip (must be owned + active). */
  pickupAreaIds?: string[];
}

export async function createTrip(input: CreateTripInput): Promise<TripDto> {
  const {
    operatorId,
    routeId,
    busId,
    departureAt,
    price,
    blockedSeats = 0,
    pickupAreaIds,
    recurringTemplateId,
    pairedTripId,
  } = input;

  // Route must belong to the operator; its duration defines the trip's occupancy window.
  const route = await prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    select: { durationMinutes: true },
  });
  if (!route) {
    throw new TripServiceError('not_found');
  }
  const candidateEnd = tripWindowEnd(departureAt, route.durationMinutes);

  try {
    const trip = await prisma.$transaction(async (tx) => {
      // I1: lock the bus row so concurrent create/reassign on this bus serialize.
      const lockedBus = await tx.$queryRaw<
        {
          id: string;
          deactivatedAt: Date | null;
          maintenanceStart: Date | null;
          maintenanceEnd: Date | null;
        }[]
      >(Prisma.sql`
        SELECT id, "deactivatedAt", "maintenanceStart", "maintenanceEnd"
        FROM "Bus"
        WHERE id = ${busId} AND "operatorId" = ${operatorId}
        FOR UPDATE
      `);
      if (lockedBus.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }
      const bus = lockedBus[0];

      if (bus.deactivatedAt !== null) {
        throw Object.assign(new Error('bus_deactivated'), { _trip: 'bus_deactivated' });
      }

      // AC1: maintenance window overlap check (Issue 001 pattern — departure as the event).
      if (bus.maintenanceStart !== null && bus.maintenanceEnd !== null) {
        if (bus.maintenanceStart <= departureAt && departureAt < bus.maintenanceEnd) {
          throw Object.assign(new Error('bus_in_maintenance'), { _trip: 'bus_in_maintenance' });
        }
      }

      // Double-book guard: reject if the bus already runs an overlapping trip.
      const overlap = await busHasOverlappingTrip(tx, {
        busId,
        candidateStart: departureAt,
        candidateEnd,
      });
      if (overlap) {
        throw Object.assign(new Error('bus_overlap'), { _trip: 'bus_overlap' });
      }

      const created = await tx.trip.create({
        data: {
          routeId,
          busId,
          operatorId,
          departureAt,
          price,
          blockedSeats,
          status: 'scheduled',
          salesClosed: false,
          ...(recurringTemplateId ? { recurringTemplateId } : {}),
          ...(pairedTripId ? { pairedTripId } : {}),
        },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: { where: { status: { in: ['paid', 'completed'] } } },
            },
          },
        },
      });

      // Issue 106: per-trip pickup-area subset. Validate every id is one of THIS
      // operator's active menu areas (cross-op / inactive / unknown → reject), then
      // snapshot the label into TripPickupArea. resolveOwnedAreas throws
      // TripServiceError('invalid_pickup_area') — re-thrown as-is by the catch below.
      if (pickupAreaIds && pickupAreaIds.length > 0) {
        const owned = await resolveOwnedAreas(tx, operatorId, pickupAreaIds);
        await tx.tripPickupArea.createMany({
          data: toPickupAreaRows(owned).map((r) => ({ tripId: created.id, ...r })),
        });
      }

      return created;
    });

    return toTripDto(trip);
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    if (tagged._trip === 'bus_deactivated') throw new TripServiceError('bus_deactivated');
    if (tagged._trip === 'bus_in_maintenance') throw new TripServiceError('bus_in_maintenance');
    if (tagged._trip === 'bus_overlap') throw new TripServiceError('bus_overlap');
    throw e;
  }
}
