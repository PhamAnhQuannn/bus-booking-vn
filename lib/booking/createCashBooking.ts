/**
 * createCashBooking — operator creates a walk-up cash booking (WT-13, GL-006).
 *
 * No hold needed — operator directly allocates seats. Booking goes straight to
 * 'paid' with paymentMethod='cash', isManual=true. Ledger entries (booking_credit
 * + platform_fee) are written in the same transaction.
 *
 * I7-exempt: operator IS the price authority; price derives from Trip.price
 * (not request body). The operator only sets ticketCount.
 *
 * Capacity check runs under SELECT FOR UPDATE on Trip (Issue 011 TOCTOU rule).
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { generateBookingRef } from './bookingRef';
import { generateConfirmationToken } from './confirmationToken';
import { appendBookingPaidLedger } from '@/lib/payment';

export interface CreateCashBookingInput {
  tripId: string;
  operatorId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string | null;
  ticketCount: number;
}

export type CashBookingErrorCode =
  | 'trip_not_found'
  | 'trip_not_bookable'
  | 'insufficient_capacity';

export class CashBookingError extends Error {
  constructor(public readonly code: CashBookingErrorCode) {
    super(code);
    this.name = 'CashBookingError';
  }
}

export interface CashBookingResult {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  tripId: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
}

const MAX_REF_ATTEMPTS = 5;

export async function createCashBooking(
  input: CreateCashBookingInput
): Promise<CashBookingResult> {
  const {
    tripId,
    operatorId,
    buyerName,
    buyerPhone,
    buyerEmail = null,
    ticketCount,
  } = input;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const bookingId = uuidv7();
    const bookingRef = generateBookingRef();
    const confirmationToken = generateConfirmationToken();

    try {
      const result = await prisma.$transaction(async (tx) => {
        type TripRow = {
          id: string;
          price: number;
          status: string;
          salesClosed: boolean;
          departureAt: Date;
          busCapacity: number;
          tripOperatorId: string;
        };
        const trips = await tx.$queryRaw<TripRow[]>(Prisma.sql`
          SELECT
            t.id,
            t.price,
            t.status,
            t."salesClosed",
            t."departureAt",
            bus.capacity AS "busCapacity",
            bus."operatorId" AS "tripOperatorId"
          FROM "Trip" t
          JOIN "Bus" bus ON bus.id = t."busId"
          WHERE t.id = ${tripId}
          FOR UPDATE OF t
        `);

        if (trips.length === 0) {
          return { kind: 'error' as const, code: 'trip_not_found' as const };
        }

        const trip = trips[0];

        if (trip.tripOperatorId !== operatorId) {
          return { kind: 'error' as const, code: 'trip_not_found' as const };
        }

        if (
          trip.status !== 'scheduled' ||
          trip.salesClosed ||
          trip.departureAt <= new Date()
        ) {
          return { kind: 'error' as const, code: 'trip_not_bookable' as const };
        }

        type SeatRow = { taken: number };
        const seatRows = await tx.$queryRaw<SeatRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("ticketCount"), 0)::int AS taken
          FROM "Booking"
          WHERE "tripId" = ${tripId}
            AND status IN (
              'awaiting_payment'::"BookingStatus",
              'paid'::"BookingStatus",
              'completed'::"BookingStatus"
            )
        `);
        const taken = seatRows.length > 0 ? seatRows[0].taken : 0;

        if (taken + ticketCount > trip.busCapacity) {
          return { kind: 'error' as const, code: 'insufficient_capacity' as const };
        }

        const totalVnd = trip.price * ticketCount;

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "Booking" (
            id, "bookingRef", "confirmationToken", "tripId", "holdId",
            "customerId", "buyerName", "buyerPhone", "buyerEmail",
            "ticketCount", "totalVnd",
            "paymentMethod", status, "isManual", "createdAt",
            "pickupKind"
          )
          VALUES (
            ${bookingId}::uuid,
            ${bookingRef},
            ${confirmationToken},
            ${tripId},
            NULL,
            NULL,
            ${buyerName},
            ${buyerPhone},
            ${buyerEmail}::text,
            ${ticketCount},
            ${totalVnd},
            'cash'::"PaymentMethod",
            'paid'::"BookingStatus",
            true,
            NOW(),
            'station'::"PickupKind"
          )
        `);

        await appendBookingPaidLedger(tx, {
          operatorId,
          bookingId,
          grossVnd: totalVnd,
          now: new Date(),
        });

        return {
          kind: 'ok' as const,
          booking: {
            id: bookingId,
            bookingRef,
            confirmationToken,
            tripId,
            buyerName,
            buyerPhone,
            ticketCount,
            totalVnd,
          },
        };
      });

      if (result.kind === 'error') {
        throw new CashBookingError(result.code);
      }
      return result.booking;
    } catch (err: unknown) {
      if (err instanceof CashBookingError) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Booking ref collision after max retries');
}
