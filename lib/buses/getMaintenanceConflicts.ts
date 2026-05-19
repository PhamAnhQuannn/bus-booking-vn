/**
 * getMaintenanceConflicts — query helpers for AC4 maintenance-window scheduling.
 *
 * Two distinct conflict classes:
 *   1. maintenance-vs-maintenance overlap on the SAME bus → hard 409 (blocks insert)
 *   2. maintenance-vs-trip overlap on the SAME bus → soft warning (inserts anyway,
 *      returns conflictingTrips in the response body)
 *
 * Both use window-vs-window overlap per Issue 001 Mistake Log:
 *   intervals [aStart, aEnd] and [bStart, bEnd] overlap iff
 *     aStart <= bEnd AND aEnd >= bStart
 *
 * Encoded as the negation (no overlap) WHERE-clause for the DB query:
 *   OR: [{ startAt: { gt: endUtc } }, { endAt: { lt: startUtc } }]
 * — and then negated via NOT to fetch only overlapping rows.
 */

import { prisma } from '@/lib/db/client';

export interface FindConflictsInput {
  busId: string;
  startAt: Date;
  endAt: Date;
  excludeMaintenanceId?: string;
}

export async function findMaintenanceOverlaps(
  input: FindConflictsInput
): Promise<{ id: string; startAt: Date; endAt: Date }[]> {
  return prisma.busMaintenance.findMany({
    where: {
      busId: input.busId,
      ...(input.excludeMaintenanceId ? { NOT: { id: input.excludeMaintenanceId } } : {}),
      // Overlap: NOT (m.endAt < startAt OR m.startAt > endAt)
      AND: [
        { endAt: { gte: input.startAt } },
        { startAt: { lte: input.endAt } },
      ],
    },
    select: { id: true, startAt: true, endAt: true },
  });
}

export interface ConflictingTrip {
  tripId: string;
  departureAt: Date;
}

export async function findTripOverlaps(
  input: Omit<FindConflictsInput, 'excludeMaintenanceId'>
): Promise<ConflictingTrip[]> {
  // Trip is a point-in-time event (departureAt) — we treat the trip's "occupied
  // window" as the single instant `departureAt`. A maintenance window conflicts
  // with the trip iff startAt <= departureAt <= endAt.
  const rows = await prisma.trip.findMany({
    where: {
      busId: input.busId,
      departureAt: { gte: input.startAt, lte: input.endAt },
      status: { in: ['scheduled', 'departed'] },
    },
    select: { id: true, departureAt: true },
    orderBy: { departureAt: 'asc' },
  });
  return rows.map((t) => ({ tripId: t.id, departureAt: t.departureAt }));
}
