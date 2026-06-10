/**
 * setTripPickupAreas — replace a trip's enabled pickup-point subset (operator edit).
 *
 * Validates the trip belongs to the operator and every id is one of the operator's ACTIVE
 * pickup points (cross-op / inactive / unknown → invalid_pickup_area). Re-snapshots the
 * current point label into TripPickupArea (so a later rename does not retroactively change
 * already-booked rows — those snapshots live on Hold/Booking). Runs in a $transaction.
 *
 * Returns the trip's enabled points after the change.
 */

import { prisma } from '@/lib/core/db/client';
import { composePickupLabel } from '@/lib/catalog';
import { TripServiceError } from './errors';

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
  const uniqueIds = [...new Set(pickupAreaIds)];

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, operatorId },
      select: { id: true },
    });
    if (!trip) throw new TripServiceError('not_found');

    let owned: {
      id: string;
      name: string;
      addressLine: string | null;
      kind: 'station' | 'pickup';
    }[] = [];
    if (uniqueIds.length > 0) {
      owned = await tx.operatorPickupArea.findMany({
        where: { id: { in: uniqueIds }, operatorId, isActive: true },
        select: { id: true, name: true, addressLine: true, kind: true },
      });
      if (owned.length !== uniqueIds.length) {
        throw new TripServiceError('invalid_pickup_area');
      }
    }

    // Replace the whole set: clear then re-create with fresh snapshots.
    await tx.tripPickupArea.deleteMany({ where: { tripId } });
    if (owned.length > 0) {
      await tx.tripPickupArea.createMany({
        data: owned.map((a, i) => ({
          tripId,
          operatorPickupAreaId: a.id,
          label: composePickupLabel(a),
          kind: a.kind, // Issue 110: snapshot kind alongside label.
          displayOrder: i,
        })),
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
