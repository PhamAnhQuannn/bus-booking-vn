/**
 * Issue 073 — operator boarding scan + single-use check-in + no-show.
 *
 * Three operator-side services, all tenant-scoped on Trip.operatorId:
 *
 *   scanTicket()     — resolve a scanned ticket token → a boarding view of the
 *                      booking (operator IS allowed the buyer name, unlike the
 *                      public /verify page). Cross-operator tokens are treated as
 *                      not-found (AC4 — no existence leak across tenants).
 *
 *   checkInBooking() — ATOMIC, single-use boarding mark. The conditional UPDATE
 *                      `SET "checkedInAt" = NOW() WHERE "checkedInAt" IS NULL`
 *                      is the single-use guard: two concurrent scans race on the
 *                      same row, exactly one gets rowcount 1 (alreadyCheckedIn
 *                      false), the other gets rowcount 0 and resolves to the
 *                      idempotent alreadyCheckedIn:true branch (Mistake Log
 *                      Issue 011 — atomic conditional update, not read-then-write).
 *
 *   markNoShow()     — guarded UPDATE setting status='no_show' AND noShowAt=NOW()
 *                      together (Issue 014 verb-At+status pairing rule). The WHERE
 *                      requires a paid/boardable state AND checkedInAt IS NULL — a
 *                      passenger who already boarded can never be no-showed.
 *
 * Tenant scope is enforced INSIDE every mutating UPDATE via
 * `"tripId" IN (SELECT id FROM "Trip" WHERE "operatorId" = ${operatorId})` so a
 * cross-operator bookingId can never be mutated even if the route guard were
 * bypassed — defense in depth, not the only line of defense.
 *
 * Booking.id is @db.Uuid, so every ${bookingId} bind in raw SQL is cast ::uuid.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { verifyTicketToken } from '@/lib/ticketing/ticketToken';

/** Booking statuses that mean the seat is paid and the passenger may board. */
export const BOARDABLE_STATUSES = ['paid_operator_notified', 'completed'] as const;

/** A minimal client surface — accepts the full PrismaClient or a tx handle. */
type Db = PrismaClient;

/** The boarding view returned to the operator after a successful scan. */
export interface ScanBooking {
  id: string;
  bookingRef: string;
  ticketCount: number;
  /** Operator IS allowed the buyer name for boarding (unlike the public page). */
  buyerName: string;
  checkedInAt: string | null;
  noShowAt: string | null;
  status: string;
  tripId: string;
}

export type ScanReason = 'invalid_token' | 'wrong_operator' | 'not_paid';

export type ScanResult =
  | { ok: true; booking: ScanBooking }
  | { ok: false; reason: ScanReason };

export type CheckInResult =
  | { ok: true; alreadyCheckedIn: boolean }
  | { ok: false; reason: 'not_found' };

export type NoShowResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_checked_in' };

/**
 * Resolve a scanned ticket token to a boarding view of the booking, tenant-scoped.
 *
 * - invalid/tampered/wrong-scope token → { ok:false, reason:'invalid_token' }
 * - booking belongs to a different operator → { ok:false, reason:'wrong_operator' }
 *   (AC4 — treat as not-found/forbidden; the route maps this to 404, never leaking
 *   that the booking exists under another tenant)
 * - not in a paid/boardable state → { ok:false, reason:'not_paid' }
 * - otherwise → { ok:true, booking } with the live check-in/no-show state so the
 *   operator UI can render the row and decide whether to check in.
 */
export async function scanTicket(
  db: Db,
  { token, operatorId }: { token: string; operatorId: string },
): Promise<ScanResult> {
  const claims = await verifyTicketToken(token);
  if (!claims) return { ok: false, reason: 'invalid_token' };

  // Live read keyed on the ct claim (== Booking.confirmationToken, unique).
  const booking = await db.booking.findUnique({
    where: { confirmationToken: claims.ct },
    select: {
      id: true,
      bookingRef: true,
      ticketCount: true,
      buyerName: true,
      checkedInAt: true,
      noShowAt: true,
      status: true,
      tripId: true,
      trip: { select: { operatorId: true } },
    },
  });

  // Unknown token-claim OR cross-operator → both surface as wrong_operator/not-found
  // so the operator can never distinguish "no such booking" from "another tenant's
  // booking" (AC4 no cross-operator leak). A bookingRef/ct mismatch is also a reject.
  if (!booking || booking.bookingRef !== claims.ref) {
    return { ok: false, reason: 'wrong_operator' };
  }
  if (booking.trip.operatorId !== operatorId) {
    return { ok: false, reason: 'wrong_operator' };
  }

  if (!(BOARDABLE_STATUSES as readonly string[]).includes(booking.status)) {
    return { ok: false, reason: 'not_paid' };
  }

  return {
    ok: true,
    booking: {
      id: booking.id,
      bookingRef: booking.bookingRef,
      ticketCount: booking.ticketCount,
      buyerName: booking.buyerName,
      checkedInAt: booking.checkedInAt ? booking.checkedInAt.toISOString() : null,
      noShowAt: booking.noShowAt ? booking.noShowAt.toISOString() : null,
      status: booking.status,
      tripId: booking.tripId,
    },
  };
}

/**
 * Single-use boarding check-in. Atomic conditional UPDATE (Issue 011/S07 pattern).
 *
 * rowcount 1 → we won the race / first check-in → { ok:true, alreadyCheckedIn:false }
 * rowcount 0 → either already checked in OR not-found/wrong-operator. Disambiguate
 *              with a follow-up scoped read:
 *                - row exists (in tenant) with checkedInAt set → idempotent double
 *                  scan → { ok:true, alreadyCheckedIn:true }
 *                - otherwise → { ok:false, reason:'not_found' }
 *
 * The conditional WHERE (`"checkedInAt" IS NULL`) is the single-use guard. Two
 * concurrent calls on the same booking → exactly one rowcount-1; the loser reads
 * back the now-set checkedInAt and returns the idempotent branch (AC2).
 */
export async function checkInBooking(
  db: Db,
  { bookingId, operatorId }: { bookingId: string; operatorId: string },
): Promise<CheckInResult> {
  const updated = await db.$executeRaw(Prisma.sql`
    UPDATE "Booking"
    SET "checkedInAt" = NOW()
    WHERE id = ${bookingId}::uuid
      AND "checkedInAt" IS NULL
      AND "tripId" IN (SELECT id FROM "Trip" WHERE "operatorId" = ${operatorId})
  `);

  if (updated === 1) {
    return { ok: true, alreadyCheckedIn: false };
  }

  // rowcount 0 — disambiguate already-checked-in vs not-found, still tenant-scoped.
  const rows = await db.$queryRaw<Array<{ checkedInAt: Date | null }>>(Prisma.sql`
    SELECT b."checkedInAt"
    FROM "Booking" b
    JOIN "Trip" t ON t.id = b."tripId"
    WHERE b.id = ${bookingId}::uuid
      AND t."operatorId" = ${operatorId}
    LIMIT 1
  `);

  if (rows.length === 1 && rows[0].checkedInAt !== null) {
    return { ok: true, alreadyCheckedIn: true };
  }
  return { ok: false, reason: 'not_found' };
}

/**
 * Mark a booking as no-show. Pairs status='no_show' with noShowAt=NOW() in the
 * SAME update (Issue 014 verb-At+status rule). Guarded so it can only fire on a
 * paid/boardable booking that has NOT been checked in — you can't no-show someone
 * who already boarded.
 *
 * rowcount 1 → { ok:true }
 * rowcount 0 → row missing/cross-operator OR already-checked-in OR wrong state.
 *              Disambiguate: if the (scoped) row exists with checkedInAt set →
 *              already_checked_in; otherwise not_found.
 */
export async function markNoShow(
  db: Db,
  { bookingId, operatorId }: { bookingId: string; operatorId: string },
): Promise<NoShowResult> {
  const updated = await db.$executeRaw(Prisma.sql`
    UPDATE "Booking"
    SET status = 'no_show'::"BookingStatus",
        "noShowAt" = NOW()
    WHERE id = ${bookingId}::uuid
      AND "checkedInAt" IS NULL
      AND status IN ('paid_operator_notified'::"BookingStatus", 'completed'::"BookingStatus")
      AND "tripId" IN (SELECT id FROM "Trip" WHERE "operatorId" = ${operatorId})
  `);

  if (updated === 1) {
    return { ok: true };
  }

  const rows = await db.$queryRaw<Array<{ checkedInAt: Date | null }>>(Prisma.sql`
    SELECT b."checkedInAt"
    FROM "Booking" b
    JOIN "Trip" t ON t.id = b."tripId"
    WHERE b.id = ${bookingId}::uuid
      AND t."operatorId" = ${operatorId}
    LIMIT 1
  `);

  if (rows.length === 1 && rows[0].checkedInAt !== null) {
    return { ok: false, reason: 'already_checked_in' };
  }
  return { ok: false, reason: 'not_found' };
}
