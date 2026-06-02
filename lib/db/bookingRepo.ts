/**
 * Booking repository — atomic cash-booking creation and confirmation lookup.
 *
 * createCashBookingFromHold():
 *   Race-safe, idempotent insert from an active hold.
 *
 *   1. INSERT ... ON CONFLICT ("holdId") DO NOTHING RETURNING * — this
 *      eliminates the read-then-write race entirely. Two concurrent calls
 *      with the same holdId: one inserts, one returns 0 rows.
 *   2. The WHERE clause inside the SELECT subquery validates the hold is
 *      still active + unexpired AND the trip is still scheduled + open.
 *      If either is false the INSERT is suppressed via WHERE EXISTS.
 *   3. After insert, mark the hold as 'converted' (best-effort — the booking
 *      row is the source of truth).
 *
 *   Returns:
 *     { ok: true, booking } — success
 *     { ok: false, reason: 'hold_expired'    } — hold no longer eligible
 *     { ok: false, reason: 'already_booked'  } — idempotent re-attempt (DB unique
 *                                                hit) — caller should fetch the
 *                                                existing booking
 *     { ok: false, reason: 'ref_collision'   } — bookingRef unique constraint
 *                                                tripped (caller retries)
 *
 * Uses Prisma.$queryRaw (template-tag, parameterised) — never $queryRawUnsafe.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { generateBookingRef } from '@/lib/booking/bookingRef';
import { generateConfirmationToken } from '@/lib/booking/confirmationToken';
import { bookingDetailSelect, type BookingFullDetails } from '@/lib/db/bookingSelects';

export { bookingDetailSelect, type BookingFullDetails };

export interface CreateCashBookingInput {
  holdId: string;
  buyerName: string;
  buyerPhone: string;
  /**
   * Customer.id of the signed-in buyer, or null for a guest booking (Issue 031).
   * Stamped on the Booking row at creation — session is the ownership proof, so
   * no post-hoc phone-match attach is needed (or wanted: phone-match is spoofable).
   */
  customerId?: string | null;
}

export interface CreateMomoBookingInput {
  holdId: string;
  buyerName: string;
  buyerPhone: string;
  customerId?: string | null;
}

export type OnlineBookingMethod = 'momo' | 'zalopay' | 'card';

export interface CreateOnlineBookingInput {
  holdId: string;
  buyerName: string;
  buyerPhone: string;
  /** Customer.id of the signed-in buyer, or null for a guest booking (Issue 031). */
  customerId?: string | null;
}

export type CreateCashBookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; reason: 'hold_expired' | 'already_booked' | 'ref_collision' };

export interface BookingRow {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  tripId: string;
  holdId: string | null;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: 'cash' | 'momo' | 'zalopay' | 'card';
  status:
    | 'awaiting_payment'
    | 'pending_cash_payment'
    | 'paid_operator_notified'
    | 'completed'
    | 'cancelled'
    | 'trip_cancelled'
    | 'no_show'
    | 'payment_failed_expired';
  isManual: boolean;
  createdAt: Date;
}

const MAX_REF_ATTEMPTS = 5;

export async function createCashBookingFromHold(
  input: CreateCashBookingInput
): Promise<CreateCashBookingResult> {
  const { holdId, buyerName, buyerPhone, customerId = null } = input;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const bookingId = uuidv7();
    const bookingRef = generateBookingRef();
    const confirmationToken = generateConfirmationToken();

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Race-safe insert: ON CONFLICT (holdId) DO NOTHING.
        // The SELECT subquery joins Hold + Trip and asserts the hold is still
        // eligible. If the hold is expired/converted/cancelled OR the trip
        // is no longer scheduled, no row is selected → no row is inserted.
        const inserted = await tx.$queryRaw<BookingRow[]>(
          Prisma.sql`
            INSERT INTO "Booking" (
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "customerId", "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "createdAt"
            )
            SELECT
              ${bookingId}::uuid,
              ${bookingRef},
              ${confirmationToken},
              h."tripId",
              h.id,
              ${customerId}::text,
              ${buyerName},
              ${buyerPhone},
              h."ticketCount",
              t.price * h."ticketCount",
              'cash'::"PaymentMethod",
              'pending_cash_payment'::"BookingStatus",
              false,
              NOW()
            FROM "Hold" h
            JOIN "Trip" t ON t.id = h."tripId"
            WHERE h.id = ${holdId}
              AND h.status = 'active'::"HoldStatus"
              AND h."expiresAt" > NOW()
              AND t.status = 'scheduled'::"TripStatus"
              AND t."salesClosed" = false
              AND t."departureAt" > NOW()
            ON CONFLICT ("holdId") DO NOTHING
            RETURNING
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "createdAt"
          `
        );

        if (inserted.length === 0) {
          // Either: (a) hold ineligible (zero rows from SELECT subquery), or
          //        (b) ON CONFLICT fired (holdId already has a booking).
          // Disambiguate by checking for an existing booking on this holdId.
          const existing = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT id FROM "Booking" WHERE "holdId" = ${holdId} LIMIT 1`
          );
          if (existing.length > 0) {
            return { kind: 'already_booked' as const };
          }
          return { kind: 'hold_expired' as const };
        }

        // Convert the hold so it no longer counts toward capacity.
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "Hold"
            SET status = 'converted'::"HoldStatus"
            WHERE id = ${holdId} AND status = 'active'::"HoldStatus"
          `
        );

        return { kind: 'ok' as const, booking: inserted[0] };
      });

      if (result.kind === 'ok') return { ok: true, booking: result.booking };
      if (result.kind === 'already_booked') return { ok: false, reason: 'already_booked' };
      return { ok: false, reason: 'hold_expired' };
    } catch (err: unknown) {
      // P2002: unique violation. bookingRef or confirmationToken collided.
      // confirmationToken is 192-bit random — collision is astronomically rare.
      // bookingRef is 8 base36 chars → ~2.8e12 space → still rare but possible
      // across years. Retry with fresh values.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        continue;
      }
      throw err;
    }
  }

  return { ok: false, reason: 'ref_collision' };
}

/**
 * createOnlineBookingFromHold — same atomic pattern as createCashBookingFromHold,
 * generalised across every online (pay-first) method: momo | zalopay | card.
 *
 * Differences vs cash:
 *   - paymentMethod = the passed `method`
 *   - status = 'awaiting_payment'
 *   - paymentExternalRef = NULL (filled in after IPN confirms payment)
 *
 * The method is bound as a text param and cast to the PaymentMethod enum
 * (`${method}::"PaymentMethod"`) — parameterised, never interpolated.
 *
 * Zero NotificationLog rows are seeded here — notifications are deferred
 * to webhook receipt (after the gateway confirms payment). AC-F1.
 */
export async function createOnlineBookingFromHold(
  input: CreateOnlineBookingInput,
  method: OnlineBookingMethod
): Promise<CreateCashBookingResult> {
  const { holdId, buyerName, buyerPhone, customerId = null } = input;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const bookingId = uuidv7();
    const bookingRef = generateBookingRef();
    const confirmationToken = generateConfirmationToken();

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Issue 036: serialize concurrent sells on the same trip by locking the
        // trip row FOR UPDATE before the convert. The oversell vector itself is
        // already closed at HOLD CREATION (capacity-bounded advisory lock in
        // lib/db/holdRepo.ts) — converting an already-held seat cannot oversell,
        // so available-capacity is re-validated structurally by the hold
        // invariant, not recomputed here. This lock is defense-in-depth: it makes
        // racing conversions on one trip queue rather than interleave (Mistake
        // Log 011 FOR-UPDATE pattern). Locks only the Trip row (FOR UPDATE OF t).
        await tx.$executeRaw(
          Prisma.sql`
            SELECT t.id
            FROM "Trip" t
            JOIN "Hold" h ON h."tripId" = t.id
            WHERE h.id = ${holdId}
            FOR UPDATE OF t
          `
        );

        const inserted = await tx.$queryRaw<BookingRow[]>(
          Prisma.sql`
            INSERT INTO "Booking" (
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "customerId", "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "createdAt"
            )
            SELECT
              ${bookingId}::uuid,
              ${bookingRef},
              ${confirmationToken},
              h."tripId",
              h.id,
              ${customerId}::text,
              ${buyerName},
              ${buyerPhone},
              h."ticketCount",
              t.price * h."ticketCount",
              ${method}::"PaymentMethod",
              'awaiting_payment'::"BookingStatus",
              false,
              NOW()
            FROM "Hold" h
            JOIN "Trip" t ON t.id = h."tripId"
            WHERE h.id = ${holdId}
              AND h.status = 'active'::"HoldStatus"
              AND h."expiresAt" > NOW()
              AND t.status = 'scheduled'::"TripStatus"
              AND t."salesClosed" = false
              AND t."departureAt" > NOW()
            ON CONFLICT ("holdId") DO NOTHING
            RETURNING
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "createdAt"
          `
        );

        if (inserted.length === 0) {
          const existing = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT id FROM "Booking" WHERE "holdId" = ${holdId} LIMIT 1`
          );
          if (existing.length > 0) {
            return { kind: 'already_booked' as const };
          }
          return { kind: 'hold_expired' as const };
        }

        // Convert the hold so it no longer counts toward capacity.
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "Hold"
            SET status = 'converted'::"HoldStatus"
            WHERE id = ${holdId} AND status = 'active'::"HoldStatus"
          `
        );

        return { kind: 'ok' as const, booking: inserted[0] };
      });

      if (result.kind === 'ok') return { ok: true, booking: result.booking };
      if (result.kind === 'already_booked') return { ok: false, reason: 'already_booked' };
      return { ok: false, reason: 'hold_expired' };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        continue;
      }
      throw err;
    }
  }

  return { ok: false, reason: 'ref_collision' };
}

/**
 * createMomoBookingFromHold — thin wrapper preserved for existing callers/tests.
 * Delegates to the generic createOnlineBookingFromHold with method 'momo'.
 */
export async function createMomoBookingFromHold(
  input: CreateMomoBookingInput
): Promise<CreateCashBookingResult> {
  return createOnlineBookingFromHold(input, 'momo');
}

export async function getBookingByConfirmationToken(
  confirmationToken: string
): Promise<BookingFullDetails | null> {
  return prisma.booking.findUnique({
    where: { confirmationToken },
    select: bookingDetailSelect,
  });
}

/**
 * Lookup booking by holdId. Returns the minimum fields the orchestrator needs
 * to recover from an idempotent re-attempt (when createCashBookingFromHold
 * returns `already_booked`).
 */
export async function getBookingByHoldId(
  holdId: string
): Promise<{ id: string; confirmationToken: string } | null> {
  return prisma.booking.findUnique({
    where: { holdId },
    select: { id: true, confirmationToken: true },
  });
}
