/**
 * autoCompleteTrips — sweep departed trips whose journey duration has elapsed
 * and complete them via the shared completeTripCore (Issue 019 AC3).
 *
 * Selects 'departed' trips where departureAt + Route.durationMinutes < now,
 * locking each Trip row (FOR UPDATE OF t SKIP LOCKED) so a concurrent
 * operator-initiated markCompleted doesn't double-complete. completeTripCore
 * holds the per-trip idempotency + Payout-row creation; this core just drives
 * the loop and sums rowsAffected (one per trip newly completed).
 *
 * SPEC NOTE (Issue 019): the issue text references Trip.estimatedDuration —
 * the real field lives on Route as Route.durationMinutes, hence the join.
 */

import { Prisma } from '@prisma/client';
import { completeTripCore } from '@/lib/trips/completeTripCore';
import type { JobCore } from './types';

export const autoCompleteTrips: JobCore = async (tx, opts) => {
  const now = opts?.now ?? new Date();

  const due = await tx.$queryRaw<{ id: string; operatorId: string }[]>(
    Prisma.sql`
      SELECT t.id, t."operatorId"
      FROM "Trip" t
      JOIN "Route" r ON r.id = t."routeId"
      WHERE t.status = 'departed'::"TripStatus"
        AND t."departureAt" + (r."durationMinutes" || ' minutes')::interval < NOW()
      FOR UPDATE OF t SKIP LOCKED
    `
  );

  let completed = 0;
  for (const trip of due) {
    const result = await completeTripCore(tx, {
      tripId: trip.id,
      operatorId: trip.operatorId,
      now,
    });
    if (!result.alreadyCompleted) completed += 1;
  }

  return { rowsAffected: completed, status: 'success' };
};
