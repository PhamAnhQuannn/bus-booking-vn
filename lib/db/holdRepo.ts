/**
 * Hold repository — atomic seat-reservation via advisory lock + conditional INSERT.
 *
 * createHold():
 *   1. Acquires pg_advisory_xact_lock(hashtext('hold:' || tripId)) — serialises
 *      concurrent attempts for the same trip inside a single DB transaction.
 *   2. Conditionally INSERTs a new Hold only if
 *      (capacity - blockedSeats - active-hold sum) >= ticketCount.
 *   3. Returns { holdId, expiresAt } on success, null when sold-out.
 *
 * Uses Prisma.$queryRaw (template-tag, parameterised) — never $queryRawUnsafe.
 * HOLD_TTL_MINUTES: 10-minute hold window (leaves 2-min buffer inside the 12-min cookie).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export const HOLD_TTL_MINUTES = 10;

export interface CreateHoldInput {
  tripId: string;
  ticketCount: number;
  customerPhone: string;
  customerName: string;
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
  const { tripId, ticketCount, customerPhone, customerName } = input;

  const holdId = randomUUID();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

  type InsertRow = { id: string; expiresAt: Date };

  const rows = await prisma.$transaction(async (tx) => {
    // 1. Acquire advisory lock for this trip (serialises concurrent requests).
    // pg_advisory_xact_lock returns void — use $executeRaw (returns affected row count).
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold:' || ${tripId}))`
    );

    // 2. Conditional INSERT — only if available seats >= ticketCount
    const inserted = await tx.$queryRaw<InsertRow[]>(
      Prisma.sql`
        INSERT INTO "Hold" (id, "tripId", "ticketCount", "customerPhone", "customerName", "expiresAt", status, "createdAt")
        SELECT
          ${holdId},
          ${tripId},
          ${ticketCount},
          ${customerPhone},
          ${customerName},
          ${expiresAt},
          'active'::"HoldStatus",
          NOW()
        WHERE (
          SELECT
            b.capacity
            - t."blockedSeats"
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
                   AND status IN (
                     'pending_cash_payment'::"BookingStatus",
                     'paid_operator_notified'::"BookingStatus",
                     'completed'::"BookingStatus"
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
