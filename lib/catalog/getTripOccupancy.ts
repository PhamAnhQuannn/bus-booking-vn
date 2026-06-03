/**
 * getTripOccupancy — snapshot the per-future-trip seat occupancy for a bus.
 *
 * AC3: feeds canReduceCapacity(). Only **future** trips count
 *   (departureAt > now); occupancy = active-hold seats + paid-booking seats.
 *
 * Excludes:
 *   - past trips (departureAt <= now)
 *   - holds with status != 'active' OR expiresAt <= now
 *   - bookings with status in (cancelled, trip_cancelled, no_show, payment_failed_expired)
 *
 * Paid statuses counted: awaiting_payment is NOT counted as paid; we count
 * `paid` and `completed` as paid-seats
 * since each represents seats currently committed to a passenger.
 */

import { prisma } from '@/lib/db/client';
import { BookingStatus } from '@prisma/client';
import type { TripOccupancy } from './capacityGuard';

const PAID_STATUSES: BookingStatus[] = [
  BookingStatus.paid,
  BookingStatus.completed,
];

export async function getTripOccupancy(busId: string): Promise<TripOccupancy[]> {
  const now = new Date();

  const trips = await prisma.trip.findMany({
    where: { busId, departureAt: { gt: now } },
    select: {
      id: true,
      holds: {
        where: { status: 'active', expiresAt: { gt: now } },
        select: { ticketCount: true },
      },
      bookings: {
        where: { status: { in: PAID_STATUSES } },
        select: { ticketCount: true },
      },
    },
  });

  return trips.map((t) => ({
    tripId: t.id,
    heldSeats: t.holds.reduce((sum, h) => sum + h.ticketCount, 0),
    bookedSeats: t.bookings.reduce((sum, b) => sum + b.ticketCount, 0),
  }));
}
