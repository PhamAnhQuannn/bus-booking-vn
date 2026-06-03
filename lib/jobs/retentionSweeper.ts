/**
 * retentionSweeper — JobCore that enforces the two Issue 090 retention windows
 * (lib/account/retentionPolicy.ts) on each daily run:
 *
 *   1. GUEST PII (365d). A single bulk UPDATE scrubs the buyer name/phone/email
 *      SNAPSHOT on guest bookings (customerId IS NULL) whose trip departed more
 *      than GUEST_PII_RETENTION_DAYS ago and whose snapshot has not already been
 *      scrubbed (snapshotAnonymizedAt IS NULL). Money/audit columns
 *      (totalVnd/status/ticketCount/ledger) are UNTOUCHED — erase ≠ delete (S04).
 *      Bulk UPDATE (not per-row) because there is no external side effect: it's a
 *      pure column overwrite, idempotent via the snapshotAnonymizedAt predicate.
 *
 *   2. KYB DOCS (90d). For each KybDocument whose backing storage object is still
 *      present (purgedAt IS NULL), whose owning operator is REJECTED or SUSPENDED
 *      (no longer needed for review/compliance), and whose uploadedAt is past
 *      KYB_DOC_RETENTION_DAYS, delete the storage object (deleteObject) then stamp
 *      purgedAt. This is per-row (each row has a storage-side effect) and claimed
 *      with SELECT … FOR UPDATE SKIP LOCKED + a bounded LIMIT so a concurrent tick
 *      or a backlog can't double-purge or hold the lock indefinitely.
 *
 * Concurrency (Mistake Log 043 run-lock): the whole tick runs under the
 * 'retention-sweep' advisory lock (runJob / withAdvisoryLock), so two overlapping
 * cron ticks cannot both sweep. The KYB claim SELECT runs on the lock `tx`
 * connection with FOR UPDATE SKIP LOCKED; the per-row purge UPDATE runs on the
 * same `tx` so the row lock is held until the tick commits.
 *
 * STORAGE_STUB note: deleteObject under stub removes the blob from the shared
 * stubStore + the StoredObject pointer row. Under real S3 it throws
 * StorageError('s3_not_implemented') (Wave 9) — which would bubble and fail the
 * tick LOUDLY rather than silently stamping purgedAt without removing bytes.
 *
 * Operator-status gate: the KYB candidate join uses Operator.status IN
 * ('REJECTED','SUSPENDED'). SUSPENDED is the canonical "deactivated" state
 * (schema comment: disabledAt is NOT the source of truth — read `status`), so the
 * status enum is the single gate. Documented assumption: uploadedAt is the purge
 * clock (the earliest defensible "no longer needed" instant on the row — there is
 * no per-doc deactivation timestamp).
 *
 * rowsAffected = guest snapshots scrubbed + KYB docs purged.
 */

import type { JobCore } from './types';

/** Bound the per-tick KYB purge so a backlog can't hold the lock indefinitely. */
const KYB_CLAIM_LIMIT = 200;

interface KybPurgeRow {
  id: string;
  storageKey: string;
}

export const retentionSweeper: JobCore = async (tx, opts) => {
  // Lazy imports: lib/db/client + the storage layer construct the Prisma client /
  // read env at module-eval. The cron route's unit tests mock runJob and never
  // invoke this core, so dynamic imports keep the route's static import graph free
  // of the DB client (mirrors charterExpirySweeper / generateTrips).
  const { Prisma } = await import('@prisma/client');
  const { deleteObject } = await import('@/lib/storage');
  const { prisma } = await import('@/lib/core/db/client');
  const { GUEST_PII_RETENTION_DAYS, KYB_DOC_RETENTION_DAYS } = await import(
    '@/lib/account/retentionPolicy'
  );

  const now = opts?.now ?? new Date();

  // PII-safe masked placeholders (Mistake Log 001: the literal-x phone mask can
  // never match the gitleaks \+84[35789]\d{8} regex — \d{8} can't consume 'x').
  const EXPIRED_BUYER_NAME = '[expired]';
  const EXPIRED_BUYER_PHONE = '+8490xxxxxx0';

  // --- 1. Guest PII scrub (single bulk UPDATE) --------------------------------
  // Scrub guest snapshots whose trip departed > GUEST_PII_RETENTION_DAYS ago and
  // that aren't already scrubbed. Money columns untouched. The interval is built
  // from the parameterized day count (Prisma.sql interpolates it as a bound param;
  // the `* INTERVAL '1 day'` multiplication keeps it injection-safe).
  const guestResult = await tx.$executeRaw(Prisma.sql`
    UPDATE "Booking" b
    SET "buyerName" = ${EXPIRED_BUYER_NAME},
        "buyerPhone" = ${EXPIRED_BUYER_PHONE},
        "buyerEmail" = NULL,
        "snapshotAnonymizedAt" = ${now}
    FROM "Trip" t
    WHERE b."tripId" = t."id"
      AND b."customerId" IS NULL
      AND b."snapshotAnonymizedAt" IS NULL
      AND t."departureAt" < ${now}::timestamp - (${GUEST_PII_RETENTION_DAYS} * INTERVAL '1 day')
  `);
  const guestScrubbed = Number(guestResult);

  // --- 2. KYB doc purge (per-row, FOR UPDATE SKIP LOCKED) ---------------------
  // Claim expired KYB docs for operators that are REJECTED/SUSPENDED and whose
  // uploadedAt is past the window. SKIP LOCKED so a row locked by a concurrent
  // action is left alone; LIMIT bounds the per-tick work.
  const kybCandidates = await tx.$queryRaw<KybPurgeRow[]>(Prisma.sql`
    SELECT k."id", k."storageKey"
    FROM "KybDocument" k
    JOIN "Operator" o ON o."id" = k."operatorId"
    WHERE k."purgedAt" IS NULL
      AND o."status" IN ('REJECTED', 'SUSPENDED')
      AND k."uploadedAt" < ${now}::timestamp - (${KYB_DOC_RETENTION_DAYS} * INTERVAL '1 day')
    FOR UPDATE OF k SKIP LOCKED
    LIMIT ${KYB_CLAIM_LIMIT}
  `);

  let docsPurged = 0;
  for (const row of kybCandidates) {
    // Remove the storage object first (deleteObject is idempotent on a missing
    // key under stub). If it throws (real S3 not implemented), the tick fails
    // LOUDLY and purgedAt is NOT stamped — no silent "purged" with bytes intact.
    await deleteObject(prisma, row.storageKey);

    await tx.kybDocument.update({
      where: { id: row.id },
      data: { purgedAt: now },
    });
    docsPurged += 1;
  }

  return { rowsAffected: guestScrubbed + docsPurged, status: 'success' };
};
