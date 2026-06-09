/**
 * Hold repository — atomic seat-reservation via advisory lock + conditional INSERT.
 *
 * createHold():
 *   0. Acquires pg_advisory_xact_lock(hashtext('hold-phone:' || customerPhone)) —
 *      serialises concurrent attempts from the same phone across ALL trips so that
 *      the per-phone CONCURRENT_HOLD_CAP count is race-safe (Issue 098).
 *   0a. Counts active holds for the phone INSIDE the phone lock; throws
 *       HoldCapExceededError when count >= CONCURRENT_HOLD_CAP.
 *   1. Acquires pg_advisory_xact_lock(hashtext('hold:' || tripId)) — serialises
 *      concurrent attempts for the same trip inside a single DB transaction.
 *   2. Conditionally INSERTs a new Hold only if
 *      (capacity - active-hold sum - confirmed-booking sum) >= ticketCount.
 *      (Issue 040: the blockedSeats term was removed — block-seats is retired.
 *      Trip.blockedSeats column is dropped in a later wave; until then, not read.)
 *   3. Returns { holdId, expiresAt } on success, null when sold-out.
 *
 * Lock ordering: phone lock ALWAYS acquired before trip lock to prevent deadlocks.
 *
 * Uses Prisma.$queryRaw (template-tag, parameterised) — never $queryRawUnsafe.
 * HOLD_TTL_MINUTES: 10-minute hold window (leaves 2-min buffer inside the 12-min cookie).
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CONCURRENT_HOLD_CAP, HoldCapExceededError } from './holdErrors';
export { CONCURRENT_HOLD_CAP, HoldCapExceededError } from './holdErrors';

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
  pickupKind?: 'station' | 'area';
  pickupAreaId?: string | null;
  pickupAreaLabel?: string | null;
  pickupDetail?: string | null;
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
    pickupAreaId = null,
    pickupAreaLabel = null,
    pickupDetail = null,
  } = input;

  const holdId = randomUUID();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

  type InsertRow = { id: string; expiresAt: Date };

  const rows = await prisma.$transaction(async (tx) => {
    // 0. Phone-level advisory lock — serialises all hold attempts from this phone
    // across every trip, making the cap count check race-safe (Issue 098).
    // Must be acquired BEFORE the trip lock to maintain a consistent lock order.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold-phone:' || ${customerPhone}))`
    );

    // 0a. Concurrent-hold cap: count ACTIVE non-expired holds for this phone.
    // Running inside the phone lock ensures no concurrent hold can slip in between
    // the count and the INSERT for the same phone.
    const activeCount = await tx.hold.count({
      where: { customerPhone, status: 'active', expiresAt: { gt: new Date() } },
    });
    if (activeCount >= CONCURRENT_HOLD_CAP) {
      throw new HoldCapExceededError();
    }

    // 1. Acquire advisory lock for this trip (serialises concurrent requests).
    // pg_advisory_xact_lock returns void — use $executeRaw (returns affected row count).
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold:' || ${tripId}))`
    );

    // 2. Conditional INSERT — only if available seats >= ticketCount
    const inserted = await tx.$queryRaw<InsertRow[]>(
      Prisma.sql`
        INSERT INTO "Hold" (id, "tripId", "ticketCount", "customerPhone", "customerName", "customerEmail", "expiresAt", status, "createdAt", "pickupKind", "pickupAreaId", "pickupAreaLabel", "pickupDetail")
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
          ${pickupAreaId},
          ${pickupAreaLabel},
          ${pickupDetail}
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
