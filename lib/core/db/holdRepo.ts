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
 *   2. Acquires pg_TRY_advisory_xact_lock(hashtext('hold:' || tripId)) — serialises
 *      concurrent attempts for the same trip. TRY, not blocking (#362): the whole
 *      transaction is retried from outside on contention, so a waiter never pins a
 *      pooled connection. Throws SeatMapBusyError once TRIP_LOCK_ATTEMPTS is exhausted.
 *      Locks 0 and 1 are try-locks too, but throw RequestInFlightError instead — that is
 *      the caller contending with THEMSELVES (double-click, second tab), not with other
 *      buyers, and the user-facing copy has to differ accordingly.
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
import { withBoundedRetry } from '@/lib/core/retry';
import {
  CONCURRENT_HOLD_CAP,
  SESSION_SEAT_CAP,
  TRIP_LOCK_ATTEMPTS,
  TRIP_LOCK_BACKOFF_BASE_MS,
  HoldCapExceededError,
  SessionSeatCapExceededError,
  SeatMapBusyError,
  RequestInFlightError,
} from './holdErrors';
export {
  CONCURRENT_HOLD_CAP,
  SESSION_SEAT_CAP,
  HoldCapExceededError,
  SessionSeatCapExceededError,
  SeatMapBusyError,
  RequestInFlightError,
} from './holdErrors';

export const HOLD_TTL_MINUTES = 10;
// Issue 100 PSP window — single source in the pure leaf module (client/no-DB safe);
// re-exported here for existing importers (searchTrips, this repo's capacity SQL).
export { PSP_WINDOW_MINUTES } from './pspWindow';
import { PSP_WINDOW_MINUTES } from './pspWindow';

export interface CreateHoldInput {
  tripId: string;
  ticketCount: number;
  customerPhone: string;
  customerName: string;
  /** Issue 042: buyer email captured at hold creation. Required — every write path
   *  (POST /api/holds validation) now enforces a valid email for ticket delivery. */
  customerEmail: string;
  /** Issue 107: traveler pickup selection (already validated + resolved by the caller). */
  pickupKind?: 'station' | 'custom';
  pickupDetail?: string | null;
  /** Chosen boarding point (name) + local time "HH:MM" from the results card. Distinct
   *  from pickupKind/pickupDetail. Optional/nullable. */
  boardingPoint?: string | null;
  boardingTime?: string | null;
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
    customerEmail,
    pickupKind = 'station',
    pickupDetail = null,
    boardingPoint = null,
    boardingTime = null,
    sessionId = null,
  } = input;

  const holdId = randomUUID();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

  type InsertRow = { id: string; expiresAt: Date };

  // The retry wraps the ENTIRE transaction, not a loop inside it. Advisory locks are
  // xact-scoped and release only on commit/rollback, and a Prisma interactive
  // transaction cannot be partially rolled back (2026-07-23 P2002 entry) — so a failed
  // try-lock must throw out of the callback, let the tx roll back, and be re-attempted
  // from scratch. Retrying inside the tx produces `25P02 current transaction is aborted`.
  //
  // Because the sleep happens out here, a waiting retry holds no transaction and
  // therefore no pooled connection. That is the whole reason the blocking lock had to go.
  const rows = await withBoundedRetry(
    () => prisma.$transaction(async (tx) => {
    // 0. Session-level advisory lock (#359) — OUTERMOST, before phone and trip, because a
    // session is the coarsest scope (one session spans many phones). Skipped entirely when
    // no session was supplied, which is why the order stays consistent: a call without a
    // session simply starts at the phone lock, it never takes these out of sequence.
    if (sessionId) {
      const sessionLock = await tx.$queryRaw<{ locked: boolean }[]>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext('hold-session:' || ${sessionId})) AS locked`
      );
      if (!sessionLock[0]?.locked) {
        // The caller's own session, not the trip — see RequestInFlightError.
        throw new RequestInFlightError();
      }

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
    const phoneLock = await tx.$queryRaw<{ locked: boolean }[]>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext('hold-phone:' || ${customerPhone})) AS locked`
    );
    if (!phoneLock[0]?.locked) {
      // The caller's own phone, not the trip — see RequestInFlightError.
      throw new RequestInFlightError();
    }

    // 1a. Concurrent-hold cap: count ACTIVE non-expired holds for this phone.
    // Running inside the phone lock ensures no concurrent hold can slip in between
    // the count and the INSERT for the same phone.
    const activeCount = await tx.hold.count({
      where: { customerPhone, status: 'active', expiresAt: { gt: new Date() } },
    });
    if (activeCount >= CONCURRENT_HOLD_CAP) {
      throw new HoldCapExceededError();
    }

    // 2. Trip lock — a TRY-lock, like the two above it (#362).
    //
    // This is the most contended: on a viral trip hundreds of buyers hash to this single
    // key, and with the blocking variant each waiter pinned a pooled connection for the
    // full queue wait. At DATABASE_POOL_MAX=1 (the Neon-correct value) one blocked hold
    // leaves the warm instance with ZERO free connections — a per-instance outage, not
    // slowness.
    //
    // ALL THREE are try-locks, and that uniformity is the point. An earlier draft kept
    // session and phone blocking, reasoning they are per-caller so contention means one
    // person double-clicked. That reasoning does not survive Phase 1's threat model:
    // there is no customer auth, so `customerPhone` is entirely attacker-chosen (its own
    // validator says so) and `bb_sid` is an unsigned cookie the client can mint. Neither
    // is per-caller in any enforceable sense, and no hold rate limiter is keyed on phone.
    //
    // The failure mode is the same one the trip lock was converted for, because advisory
    // locks are GLOBAL while the pool is PER-INSTANCE: an attacker firing concurrent
    // holds that all share one phone (or one forged sid) has each instance block its only
    // connection waiting on a lock some other instance holds. Fixing that for the trip
    // key alone would have left two attacker-controlled keys with the identical shape —
    // and the rollback doc's claim that "the bounded lock is what makes pool=1 safe"
    // would have been true only of trip contention.
    //
    // So the invariant is now unconditional, and matches what withBoundedRetry's own
    // docblock already claimed: no request EVER holds a pooled connection while waiting
    // for a lock. The cost is that a genuine double-submit gets a jittered retry instead
    // of a short wait, which the retry budget absorbs; if it somehow exhausts, a 429 with
    // Retry-After is a defensible answer to a double-click.
    //
    // A try-lock never waits, so it can never be the blocking half of a deadlock cycle.
    // The session → phone → trip ordering is kept anyway: it costs nothing and keeps the
    // acquisition order reviewable if any of these ever goes back to blocking.
    const lockRows = await tx.$queryRaw<{ locked: boolean }[]>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext('hold:' || ${tripId})) AS locked`
    );
    if (!lockRows[0]?.locked) {
      throw new SeatMapBusyError();
    }

    // 3. Conditional INSERT — only if available seats >= ticketCount
    const inserted = await tx.$queryRaw<InsertRow[]>(
      Prisma.sql`
        INSERT INTO "Hold" (id, "tripId", "ticketCount", "customerPhone", "customerName", "customerEmail", "expiresAt", status, "createdAt", "pickupKind", "pickupDetail", "customPickupRequested", "boardingPoint", "boardingTime", "sessionId")
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
          ${boardingPoint},
          ${boardingTime},
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
    }),
    {
      attempts: TRIP_LOCK_ATTEMPTS,
      baseMs: TRIP_LOCK_BACKOFF_BASE_MS,
      // ONLY contention is retried. The two caps are terminal decisions about this
      // caller — retrying them would just burn attempts and return the same answer.
      // Both contention errors are retryable and share the budget: they differ only in
      // what they mean to the CALLER (someone else's demand vs your own in-flight request),
      // not in how the server should react.
      retryOn: (err) =>
        err instanceof SeatMapBusyError || err instanceof RequestInFlightError,
    }
  );

  if (!rows || rows.length === 0) {
    return null; // sold out or trip unavailable
  }

  return {
    holdId: rows[0].id,
    expiresAt: rows[0].expiresAt,
  };
}
