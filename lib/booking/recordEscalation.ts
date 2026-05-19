/**
 * recordEscalation — flag a booking with an escalation note (Issue 014).
 *
 * Writes escalationNote + escalatedAt. Tenant-isolated via Trip join.
 * $transaction + SELECT FOR UPDATE on Booking.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { BookingServiceError } from './recordCallOutcome';
import { toBookingDto, type BookingDtoRow } from './toBookingDto';
import type { BookingDto } from './bookingDto';

export async function recordEscalation(
  operatorId: string,
  bookingId: string,
  note: string
): Promise<BookingDto> {
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE on Booking to serialise concurrent escalation writes
    const locked = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT b.id
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

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        escalationNote: note,
        escalatedAt: new Date(),
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
