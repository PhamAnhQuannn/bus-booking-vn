/**
 * setTripPickupAreas — replace a trip's enabled pickup-area subset (operator edit).
 *
 * Validates the trip belongs to the operator and every id is one of the operator's ACTIVE
 * pickup areas (cross-op / inactive / unknown → invalid_pickup_area). Re-snapshots the
 * current area label into TripPickupArea (so a later rename does not retroactively change
 * already-booked rows — those snapshots live on Hold/Booking). Runs in a $transaction.
 *
 * ('point' is reserved for the traveler-facing PickupKind value; the operator menu rows
 * are OperatorPickupArea — "areas".)
 *
 * Returns the trip's enabled areas after the change.
 */

import { prisma } from '@/lib/core/db/client';
import { TripServiceError } from './errors';
import { resolveOwnedAreas, toPickupAreaRows } from './snapshotPickupAreas';

export interface TripPickupAreaItem {
  areaId: string;
  label: string;
}

export async function setTripPickupAreas({
  operatorId,
  tripId,
  pickupAreaIds,
}: {
  operatorId: string;
  tripId: string;
  pickupAreaIds: string[];
}): Promise<TripPickupAreaItem[]> {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, operatorId },
      select: { id: true },
    });
    if (!trip) throw new TripServiceError('not_found');

    const owned = await resolveOwnedAreas(tx, operatorId, pickupAreaIds);

    // Replace the whole set: clear then re-create with fresh snapshots.
    await tx.tripPickupArea.deleteMany({ where: { tripId } });
    if (owned.length > 0) {
      await tx.tripPickupArea.createMany({
        data: toPickupAreaRows(owned).map((r) => ({ tripId, ...r })),
      });
    }

    const rows = await tx.tripPickupArea.findMany({
      where: { tripId },
      orderBy: { displayOrder: 'asc' },
      select: { operatorPickupAreaId: true, label: true },
    });
    return rows.map((r) => ({ areaId: r.operatorPickupAreaId, label: r.label }));
  });
}
