/**
 * anonymizeCustomers — JobCore that scrubs remaining PII on customers whose
 * accounts were deleted more than 24 months ago.
 *
 * deleteAccount() (lib/account/anonymizeCustomer.ts) already handles the
 * immediate anonymization at delete time: phone→null, displayName→'Deleted user',
 * booking snapshots scrubbed. This cron is a defensive sweeper for fields that
 * the immediate path does not cover:
 *   - Customer.email (not cleared at delete time)
 *   - Customer.passwordHash (not cleared at delete time)
 *   - NotificationLog.recipient for that customer's bookings
 *
 * Runs daily (vercel.json 04:00), batch 100, FOR UPDATE SKIP LOCKED.
 * Lock key: 'customer-pii-anonymize'.
 */

import type { JobCore } from './types';

const BATCH_LIMIT = 100;
const RETENTION_DAYS = 730; // 24 months

interface CandidateRow {
  id: string;
}

export const anonymizeCustomers: JobCore = async (tx, opts) => {
  const { Prisma } = await import('@prisma/client');

  const now = opts?.now ?? new Date();

  const candidates = await tx.$queryRaw<CandidateRow[]>(Prisma.sql`
    SELECT c."id"
    FROM "Customer" c
    WHERE c."deletedAt" IS NOT NULL
      AND c."deletedAt" < ${now}::timestamp - (${RETENTION_DAYS} * INTERVAL '1 day')
      AND (c."email" IS NOT NULL OR c."passwordHash" IS NOT NULL)
    FOR UPDATE SKIP LOCKED
    LIMIT ${BATCH_LIMIT}
  `);

  if (candidates.length === 0) {
    return { rowsAffected: 0, status: 'success' };
  }

  let scrubbed = 0;

  for (const row of candidates) {
    await tx.customer.update({
      where: { id: row.id },
      data: { email: null, passwordHash: null },
    });

    await tx.$executeRaw(Prisma.sql`
      UPDATE "NotificationLog" nl
      SET "recipient" = 'ANONYMIZED'
      FROM "Booking" b
      WHERE nl."bookingId" = b."id"
        AND b."customerId" = ${row.id}
        AND nl."recipient" != 'ANONYMIZED'
    `);

    scrubbed += 1;
  }

  return { rowsAffected: scrubbed, status: 'success' };
};
