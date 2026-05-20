/**
 * markCompleted — operator marks trip as completed (Issue 014 AC5).
 *
 * Thin $transaction wrapper over completeTripCore (Issue 019): the core holds
 * all in-tx logic (SELECT FOR UPDATE, idempotency, status/completedAt write,
 * payout_scheduled audit rows, aggregate Payout row creation). autoCompleteTrips
 * calls the same core within its job lock-tx.
 *
 * Discriminated result { ok, alreadyCompleted, trip }.
 */

import { prisma } from '@/lib/db/client';
import { completeTripCore } from './completeTripCore';
import { toTripDto } from './toTripDto';
import type { TripDto } from './tripDto';

export interface MarkCompletedResult {
  ok: true;
  alreadyCompleted: boolean;
  trip: TripDto;
  payoutJobsEnqueued: number;
}

export async function markCompleted(
  operatorId: string,
  tripId: string
): Promise<MarkCompletedResult> {
  return prisma.$transaction(async (tx) => {
    const result = await completeTripCore(tx, { tripId, operatorId });
    return {
      ok: true,
      alreadyCompleted: result.alreadyCompleted,
      trip: toTripDto(result.trip),
      payoutJobsEnqueued: result.paidBookingCount,
    };
  });
}
