/**
 * Issue 073 — staffTripScope resolver: booking id → its tripId, tenant-scoped.
 *
 * Used by the check-in / no-show routes' requireOperatorAuth staffTripScope option
 * (Issue 018 pattern). Returns the tripId so the HOF can compare it against the
 * staff member's assignedTripId. Returns null when the booking is missing OR
 * belongs to a different operator — both surface as a 404 in the HOF (staff must
 * not learn that other operators'/trips' bookings exist).
 */

import { prisma } from '@/lib/core/db/client';

export async function resolveBookingTripId(
  operatorId: string,
  bookingId: string,
): Promise<string | null> {
  // tenant-scoped via trip.operatorId join (model has no top-level operatorId)
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, trip: { operatorId } },
    select: { tripId: true },
  });
  return booking?.tripId ?? null;
}
