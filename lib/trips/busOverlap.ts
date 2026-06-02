/**
 * Bus double-booking guard — shared window-vs-window overlap check.
 *
 * A trip occupies its bus for [departureAt, departureAt + routeDuration + buffer],
 * where the trailing buffer is the turnaround time before the bus can run again.
 * Two trips on the same bus conflict iff their windows overlap (Issue 013 precedent;
 * see lib/buses/windowsOverlap.ts for the pure predicate).
 *
 * Each candidate trip's window is computed from ITS OWN route duration (SQL join),
 * so this must NOT be reduced to a departureAt-equality check (the prior reassignBus
 * bug — overlapping-but-not-equal trips slipped through).
 *
 * MUST be called inside a $transaction that already holds a `SELECT ... FOR UPDATE`
 * lock on the bus row, so concurrent create/reassign on the same bus serialize.
 */

import { Prisma } from '@prisma/client';

export const TRIP_OVERLAP_BUFFER_MINUTES = 60;

export interface BusOverlapParams {
  busId: string;
  /** Candidate trip window start = its departureAt. */
  candidateStart: Date;
  /** Candidate trip window end = departureAt + routeDuration + buffer (caller-computed). */
  candidateEnd: Date;
  /** Exclude this trip id from the scan (used by reassign on the trip being edited). */
  excludeTripId?: string;
}

export async function busHasOverlappingTrip(
  tx: Prisma.TransactionClient,
  { busId, candidateStart, candidateEnd, excludeTripId }: BusOverlapParams
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT t.id
    FROM "Trip" t
    JOIN "Route" r ON r.id = t."routeId"
    WHERE t."busId" = ${busId}
      AND t.status IN ('scheduled'::"TripStatus", 'departed'::"TripStatus")
      ${excludeTripId ? Prisma.sql`AND t.id <> ${excludeTripId}` : Prisma.empty}
      -- window-vs-window overlap: candidate.start <= existing.end AND candidate.end >= existing.start
      AND ${candidateStart} <= (t."departureAt" + ((r."durationMinutes" + ${TRIP_OVERLAP_BUFFER_MINUTES}) * interval '1 minute'))
      AND ${candidateEnd} >= t."departureAt"
    LIMIT 1
  `);
  return rows.length > 0;
}

/** Compute a trip's occupancy window end from its departure + route duration. */
export function tripWindowEnd(departureAt: Date, routeDurationMinutes: number): Date {
  return new Date(
    departureAt.getTime() + (routeDurationMinutes + TRIP_OVERLAP_BUFFER_MINUTES) * 60_000
  );
}
