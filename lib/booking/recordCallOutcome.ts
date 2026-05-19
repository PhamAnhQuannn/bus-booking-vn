/**
 * recordCallOutcome — save operator call outcome to a booking (Issue 014 AC3).
 *
 * Writes contactStatus, pickupPointId (optional), pickupNote (optional).
 * Tenant-isolated via Trip join. $transaction + SELECT FOR UPDATE on Booking.
 *
 * Returns the updated booking DTO so callers can reflect changes immediately (AC3).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import type { CallOutcomeInput } from './schemas';
import { toBookingDto, type BookingDtoRow } from './toBookingDto';
import type { BookingDto } from './bookingDto';

export type CallOutcomeErrorCode = 'not_found';

export class BookingServiceError extends Error {
  constructor(public readonly code: CallOutcomeErrorCode | 'invalid_state' | 'payment_required' | 'already_departed' | 'already_completed') {
    super(code);
    this.name = 'BookingServiceError';
  }
}

export async function recordCallOutcome(
  operatorId: string,
  bookingId: string,
  input: CallOutcomeInput
): Promise<BookingDto> {
  const { outcome, pickupPointId, pickupNote } = input;

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE on Booking to serialise concurrent outcome writes
    const locked = await tx.$queryRaw<{ id: string; tripOperatorId: string }[]>(
      Prisma.sql`
        SELECT b.id, t."operatorId" AS "tripOperatorId"
        FROM "Booking" b
        JOIN "Trip" t ON t.id = b."tripId"
        WHERE b.id = ${bookingId}
          AND t."operatorId" = ${operatorId}
        FOR UPDATE
      `
    );

    if (locked.length === 0) {
      throw new BookingServiceError('not_found');
    }

    // Map outcome string to ContactStatus enum
    const contactStatus = outcome === 'reached' ? 'reached'
      : outcome === 'no_answer' ? 'no_answer'
      : 'callback';

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        contactStatus,
        ...(pickupPointId !== undefined ? { pickupPointId } : {}),
        ...(pickupNote !== undefined ? { pickupNote } : {}),
      },
      select: {
        id: true,
        bookingRef: true,
        tripId: true,
        holdId: true,
        customerId: true,
        buyerName: true,
        buyerPhone: true,
        ticketCount: true,
        totalVnd: true,
        paymentMethod: true,
        paymentExternalRef: true,
        status: true,
        isManual: true,
        createdAt: true,
        contactStatus: true,
        pickupPointId: true,
        pickupNote: true,
        pickedUpAt: true,
        cashCollectedAt: true,
        escalationNote: true,
        escalatedAt: true,
        trip: {
          select: {
            id: true,
            departureAt: true,
            price: true,
            departedAt: true,
            completedAt: true,
            route: { select: { origin: true, destination: true } },
            bus: { select: { licensePlate: true } },
          },
        },
        pickupPoint: { select: { name: true } },
      },
    });

    return toBookingDto(updated as BookingDtoRow);
  });
}
