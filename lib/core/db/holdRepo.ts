/**
 * Hold repository — atomic seat-reservation via advisory lock + conditional INSERT.
 *
 * createHold():
 *   0. Acquires pg_advisory_xact_lock(hashtext('hold-session:' || sessionId)) when a
 *      session is supplied — serialises concurrent attempts from the same browser
 *      session across ALL phones and trips so the SESSION_SEAT_CAP sum is race-safe (#359).
 *   0a. SUMs active seats for the session INSIDE the session lock; throws
 *       SessionSeatCapExceededError when adding ticketCount would exceed SESSION_SEAT_CAP.
 *   1. Acquires pg_advisory_xact_lock(hashtext('hold-phone:' || customerPhone)) —
 *      serialises concurrent attempts from the same phone across ALL trips so that
 *      the per-phone CONCURRENT_HOLD_CAP count is race-safe (Issue 098).
 *   1a. Counts active holds for the phone INSIDE the phone lock; throws
 *       HoldCapExceededError when count >= CONCURRENT_HOLD_CAP.
 *   2. Acquires pg_advisory_xact_lock(hashtext('hold:' || tripId)) — serialises
 *      concurrent attempts for the same trip inside a single DB transaction.
 *   3. Conditionally INSERTs a new Hold only if
 *      (capacity - active-hold sum - confirmed-booking sum) >= ticketCount.
 *      (Issue 040: the blockedSeats term was removed — block-seats is retired.
 *      Trip.blockedSeats column is dropped in a later wave; until then, not read.)
 *   4. Returns { holdId, expiresAt } on success, null when sold-out.
 *
 * Lock ordering: session → phone → trip, ALWAYS in that order, to prevent deadlocks.
 * The session lock is newest and sits OUTERMOST because it is the coarsest scope (one
 * session spans many phones); inserting it anywhere else would create a lock-order
 * inversion against concurrent calls that supply no session.
 *
 * Why the phone cap is not enough on its own (#359): ticketCount is per-hold and capped
 * at 10, so CONCURRENT_HOLD_CAP × 10 = 50 seats from one unverified phone — a 45-seat
 * trip locked in five requests. Phase 1 has no customer auth, so the phone is
 * attacker-chosen. The session cap bounds SEATS; the phone cap stays as defence in depth.
 *
 * Uses Prisma.$queryRaw (template-tag, parameterised) — never $queryRawUnsafe.
 * HOLD_TTL_MINUTES: 10-minute hold window (leaves 2-min buffer inside the 12-min cookie).
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  CONCURRENT_HOLD_CAP,
  SESSION_SEAT_CAP,
  HoldCapExceededError,
  SessionSeatCapExceededError,
} from './holdErrors';
export {
  CONCURRENT_HOLD_CAP,
  SESSION_SEAT_CAP,
  HoldCapExceededError,
  SessionSeatCapExceededError,
} from './holdErrors';

export const HOLD_TTL_MINUTES = 10;
/**
 * Issue 100: PSP payment-confirmation window. A booking in awaiting_payment that was
 * created within this window occupies its seat in the capacity check (the PSP may still
 * confirm and seat the passenger). After the window elapses, the awaiting_payment booking
 * no longer blocks capacity (PSP-abandon self-releases). Must exceed HOLD_TTL_MINUTES so
 * there is no gap between hold expiry and awaiting_payment capacity protection.
 */
export const PSP_WINDOW_MINUTES = 20;

export interface CreateHoldInput {
  tripId: string;
  ticketCount: number;
  customerPhone: string;
  customerName: string;
  /** Issue 042: buyer email captured at hold creation. Optional for back-compat callers. */
  customerEmail?: string | null;
  /** Issue 107: traveler pickup selection (already validated + resolved by the caller). */
  pickupKind?: 'station' | 'custom';
  pickupDetail?: string | null;
  /**
   * #359: anonymous funnel session (bb_sid) making the request, when the caller sent one.
   * Null/undefined skips the session seat cap — a caller with no cookie cannot be
   * attributed to a session, and lumping every such caller into one shared bucket would
   * let one script starve every cookie-less user behind the same CGNAT egress. The route
   * layer rate-limits that population separately instead.
   */
  sessionId?: string | null;
}

export interface HoldResult {
  holdId: string;
  expiresAt: Date;
}

/**
 * Atomically create a seat hold.
 * Returns HoldResult on success, null if the trip is sold out or unavailable.
 */
export async function createHold(input: CreateHoldInput): Promise<HoldResult | null> {
  const {
    tripId,
    ticketCount,
    customerPhone,
    customerName,
    customerEmail = null,
    pickupKind = 'station',
    pickupDetail = null,
    sessionId = null,
  } = input;

  const holdId = randomUUID();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

  type InsertRow = { id: string; expiresAt: Date };

  const rows = await prisma.$transaction(async (tx) => {
    // 0. Session-level advisory lock (#359) — OUTERMOST, before phone and trip, because a
    // session is the coarsest scope (one session spans many phones). Skipped entirely when
    // no session was supplied, which is why the order stays consistent: a call without a
    // session simply starts at the phone lock, it never takes these out of sequence.
    if (sessionId) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold-session:' || ${sessionId}))`
      );

      // 0a. Seat cap for this session. SUM(ticketCount), not COUNT(*) — the whole point is
      // that five holds of ten seats is 50 seats, which a hold COUNT cannot see.
      const agg = await tx.hold.aggregate({
        _sum: { ticketCount: true },
        where: { sessionId, status: 'active', expiresAt: { gt: new Date() } },
      });
      const heldSeats = agg._sum.ticketCount ?? 0;
      if (heldSeats + ticketCount > SESSION_SEAT_CAP) {
        throw new SessionSeatCapExceededError();
      }
    }

    // 1. Phone-level advisory lock — serialises all hold attempts from this phone
    // across every trip, making the cap count check race-safe (Issue 098).
    // Must be acquired BEFORE the trip lock to maintain a consistent lock order.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold-phone:' || ${customerPhone}))`
    );

    // 1a. Concurrent-hold cap: count ACTIVE non-expired holds for this phone.
    // Running inside the phone lock ensures no concurrent hold can slip in between
    // the count and the INSERT for the same phone.
    const activeCount = await tx.hold.count({
      where: { customerPhone, status: 'active', expiresAt: { gt: new Date() } },
    });
    if (activeCount >= CONCURRENT_HOLD_CAP) {
      throw new HoldCapExceededError();
    }

    // 2. Acquire advisory lock for this trip (serialises concurrent requests).
    // pg_advisory_xact_lock returns void — use $executeRaw (returns affected row count).
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold:' || ${tripId}))`
    );

    // 3. Conditional INSERT — only if available seats >= ticketCount
    const inserted = await tx.$queryRaw<InsertRow[]>(
      Prisma.sql`
        INSERT INTO "Hold" (id, "tripId", "ticketCount", "customerPhone", "customerName", "customerEmail", "expiresAt", status, "createdAt", "pickupKind", "pickupDetail", "customPickupRequested", "sessionId")
        SELECT
          ${holdId},
          ${tripId},
          ${ticketCount},
          ${customerPhone},
          ${customerName},
          ${customerEmail},
          ${expiresAt},
          'active'::"HoldStatus",
          NOW(),
          ${pickupKind}::"PickupKind",
          ${pickupDetail},
          (${pickupKind}::"PickupKind" = 'custom'::"PickupKind"),
          ${sessionId}
        WHERE (
          SELECT
            b.capacity
            - COALESCE(
                (SELECT SUM("ticketCount")
                 FROM "Hold"
                 WHERE "tripId" = t.id
                   AND status = 'active'::"HoldStatus"
                   AND "expiresAt" > NOW()),
                0
              )
            - COALESCE(
                (SELECT SUM("ticketCount")
                 FROM "Booking"
                 WHERE "tripId" = t.id
                   AND (
                     -- Definitive bookings: always counted.
                     status IN (
                       'paid'::"BookingStatus",
                       'completed'::"BookingStatus"
                     )
                     OR (
                       -- Issue 100: awaiting_payment bookings within the PSP window
                       -- protect the seat during the payment confirmation window.
                       -- After PSP_WINDOW_MINUTES, an abandoned payment self-releases.
                       status = 'awaiting_payment'::"BookingStatus"
                       AND "createdAt" > NOW() - (${PSP_WINDOW_MINUTES} * INTERVAL '1 minute')
                     )
                   )),
                0
              )
          FROM "Trip" t
          JOIN "Bus" b ON b.id = t."busId"
          WHERE t.id = ${tripId}
            AND t.status = 'scheduled'::"TripStatus"
            AND t."salesClosed" = false
        ) >= ${ticketCount}
        RETURNING id, "expiresAt"
      `
    );

    return inserted;
  });

  if (!rows || rows.length === 0) {
    return null; // sold out or trip unavailable
  }

  return {
    holdId: rows[0].id,
    expiresAt: rows[0].expiresAt,
  };
}
