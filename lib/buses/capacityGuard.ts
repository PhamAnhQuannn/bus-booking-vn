/**
 * Pure capacity-reduction guard.
 *
 * AC3: a capacity reduction MUST NOT drop below max(activeHolds + paidBookings)
 * across any of the bus's future trips. Caller supplies the occupancy snapshot
 * (one row per future trip); this helper does the math.
 */

export interface TripOccupancy {
  tripId: string;
  heldSeats: number;
  bookedSeats: number;
}

export interface ViolatingTrip {
  tripId: string;
  occupancy: number;
}

export type CapacityGuardResult =
  | { ok: true }
  | { ok: false; violatingTrips: ViolatingTrip[] };

export function canReduceCapacity(
  newCapacity: number,
  trips: TripOccupancy[]
): CapacityGuardResult {
  const violatingTrips: ViolatingTrip[] = [];
  for (const t of trips) {
    const occupancy = t.heldSeats + t.bookedSeats;
    if (occupancy > newCapacity) {
      violatingTrips.push({ tripId: t.tripId, occupancy });
    }
  }
  if (violatingTrips.length === 0) return { ok: true };
  return { ok: false, violatingTrips };
}
