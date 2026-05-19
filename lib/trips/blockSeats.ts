/**
 * blockSeats — set blockedSeats on a trip (Issue 013 AC2).
 *
 * AC2: blockedSeats > availableSeats (capacity - holds - bookings) → 422 block_exceeds_available
 *
 * Uses $transaction + SELECT FOR UPDATE on Trip to prevent TOCTOU races (I1).
 * availableSeats = capacity - currentBlockedSeats - activeHolds - confirmedBookings
 * The new blockedSeats must not exceed: capacity - activeHolds - confirmedBookings
 * (i.e., cannot block what is already held/booked).
 */

import { prisma } from '@/lib/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';

export async function blockSeats(
  operatorId: string,
  tripId: string,
  blockedSeats: number
): Promise<TripDto> {
  let result: Awaited<ReturnType<typeof fetchTripAfterBlock>>;

  try {
    result = await prisma.$transaction(async (tx) => {
      // I1: SELECT FOR UPDATE on Trip — serialise concurrent block-seats ops
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Trip"
        WHERE id = ${tripId} AND "operatorId" = ${operatorId}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }

      // Re-read full state inside transaction
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          status: true,
          bus: { select: { capacity: true } },
          holds: {
            where: { status: 'active', expiresAt: { gt: new Date() } },
            select: { ticketCount: true },
          },
          bookings: {
            where: {
              status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
            },
            select: { ticketCount: true },
          },
        },
      });

      if (!trip) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }

      const capacity = trip.bus.capacity;
      const activeHolds = trip.holds.reduce((s, h) => s + h.ticketCount, 0);
      const confirmedBookings = trip.bookings.reduce((s, b) => s + b.ticketCount, 0);
      // availableSeats for blocking = capacity - activeHolds - confirmedBookings
      const maxAllowedBlocked = capacity - activeHolds - confirmedBookings;

      if (blockedSeats > maxAllowedBlocked) {
        throw Object.assign(new Error('block_exceeds_available'), { _trip: 'block_exceeds_available' });
      }

      return tx.trip.update({
        where: { id: tripId },
        data: { blockedSeats },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: {
                    in: ['pending_cash_payment', 'paid_operator_notified', 'completed'],
                  },
                },
              },
            },
          },
        },
      });
    });
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    if (tagged._trip === 'block_exceeds_available') {
      throw new TripServiceError('block_exceeds_available');
    }
    throw e;
  }

  return toTripDto(result);
}

// Internal helper — not exported
async function fetchTripAfterBlock(_id: string) {
  return prisma.trip.findFirst({ where: { id: _id }, include: { bus: { select: { capacity: true } }, _count: { select: { holds: { where: { status: 'active' } }, bookings: { where: { status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] } } } } } } });
}
