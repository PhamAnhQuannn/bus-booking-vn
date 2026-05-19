/**
 * markPickedUp — SET-TRUE-ONLY boarding marker (Issue 014 SPEC NOTE).
 *
 * SPEC NOTE: The AC says "toggle boarding state" but per Phase 1 Q1 resolution,
 * implementation = SET-TRUE-ONLY with discriminated result { ok, alreadyPickedUp, booking }.
 * Toggle on safety-critical boarding state risks accidental un-board; idempotency
 * preserves AC's "no double-mark" intent without enabling reversal.
 * See also: SPEC NOTE in issue 014 spec.
 *
 * Requires: paymentStatus IN ('paid_operator_notified') or the booking is already picked up
 * (idempotent path). Pending cash payment is NOT sufficient — cash must be collected first.
 * Actually per AC: 'paid' means paid_operator_notified here (cash flow also qualifies after
 * cash-collected transitions it to paid_operator_notified).
 *
 * $transaction + SELECT FOR UPDATE on Booking. Discriminated result inside same transaction.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { BookingServiceError } from './recordCallOutcome';
import { toBookingDto, type BookingDtoRow } from './toBookingDto';
import type { BookingDto } from './bookingDto';

const ELIGIBLE_PAYMENT_STATUSES = ['paid_operator_notified', 'completed'] as const;

export interface MarkPickedUpResult {
  ok: true;
  alreadyPickedUp: boolean;
  booking: BookingDto;
}

export async function markPickedUp(
  operatorId: string,
  bookingId: string
): Promise<MarkPickedUpResult> {
  // SPEC NOTE: SET-TRUE-ONLY — no un-board path exists. See module docstring.
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE to serialise concurrent picked-up calls on same booking (TOCTOU guard)
    const locked = await tx.$queryRaw<{
      id: string;
      status: string;
      pickedUpAt: Date | null;
    }[]>(
      Prisma.sql`
        SELECT b.id, b.status, b."pickedUpAt"
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

    const row = locked[0];

    // Idempotency: already picked up — return early without re-writing
    if (row.pickedUpAt !== null) {
      const existing = await tx.booking.findUnique({
        where: { id: bookingId },
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
      return { ok: true, alreadyPickedUp: true, booking: toBookingDto(existing! as BookingDtoRow) };
    }

    // Payment guard — must be in a paid state
    if (!ELIGIBLE_PAYMENT_STATUSES.includes(row.status as typeof ELIGIBLE_PAYMENT_STATUSES[number])) {
      throw new BookingServiceError('payment_required');
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { pickedUpAt: new Date() },
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

    return { ok: true, alreadyPickedUp: false, booking: toBookingDto(updated as BookingDtoRow) };
  });
}
