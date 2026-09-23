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
 * stubStore + the StoredObject pointer row. Under real S3 it sends a
 * DeleteObjectCommand — any SDK error bubbles and fails the tick LOUDLY rather
 * than silently stamping purgedAt without removing bytes.
 *
 * Operator-status gate: the KYB candidate join uses Operator.status IN
 * ('REJECTED','SUSPENDED'). SUSPENDED is the canonical "deactivated" state
 * (schema comment: disabledAt is NOT the source of truth — read `status`), so the
 * status enum is the single gate. Documented assumption: uploadedAt is the purge
 * clock (the earliest defensible "no longer needed" instant on the row — there is
 * no per-doc deactivation timestamp).
 *
 *   3. ORPHAN PAYMENT PII (#332, 365d). For each orphan bank-transfer PaymentEvent
 *      (bookingId IS NULL) past ORPHAN_PAYMENT_PII_RETENTION_DAYS whose rawBody has not
 *      been redacted (redactedAt IS NULL), strip the SePay payer-PII keys from rawBody
 *      (keeping the money-evidence fields) and stamp redactedAt. Per-row with FOR UPDATE
 *      SKIP LOCKED + a bounded LIMIT, like the KYB arm. The row is NEVER deleted (money
 *      evidence); erase ≠ delete (S04).
 *
 *   4. PLANNER CHAT (90d, W2). Bounded batch DELETE of PlannerConversation rows
 *      inactive past PLANNER_CHAT_RETENTION_DAYS (messages cascade). HARD delete — no
 *      money/audit value, and a scrub would leave re-identifiable dtoJson snapshots.
 *
 *   5. TICKET PDF PURGE (W3). Per-row: for each Booking whose PII snapshot was scrubbed
 *      (snapshotAnonymizedAt set) but whose ticket PDF object is still present
 *      (ticketPdfKey set), deleteObject the PDF (it bakes buyerName/phone) then NULL the
 *      key. Same per-row storage-side-effect shape as the KYB arm.
 *
 *   6. NOTIFICATION PII (180d, W4). Bulk UPDATE scrubs recipient/payload/lastError on
 *      NON-pending NotificationLog rows past NOTIFICATION_PII_RETENTION_DAYS, stamping
 *      redactedAt. Row KEPT (delivery-audit evidence). erase != delete (S04).
 *
 *   7. CHARTER CONTACT PII (365d, W6). Bulk UPDATE scrubs contactName/phone/email/notes
 *      on TERMINAL CharterRequest leads past CHARTER_CONTACT_RETENTION_DAYS, stamping
 *      contactScrubbedAt. ref/status/assignee retained (lead audit). erase != delete.
 *
 * rowsAffected = guest snapshots scrubbed + KYB docs purged + orphan bodies redacted +
 * planner conversations deleted + ticket PDFs purged + notification rows scrubbed +
 * charter leads scrubbed.
 */

import type { JobCore } from './types';

/** Bound the per-tick KYB purge so a backlog can't hold the lock indefinitely. */
const KYB_CLAIM_LIMIT = 200;

/** Bound the per-tick orphan-PII redaction (#332), same rationale as KYB. */
const ORPHAN_REDACT_LIMIT = 200;

/** Bound the per-tick planner-conversation prune (W2). Batched so a launch backlog
 *  can't hold the advisory-lock tx open on one giant DELETE; drains over ticks. */
const PLANNER_DELETE_LIMIT = 200;
const PLANNER_DELETE_MAX_BATCHES = 10;

/** Bound the per-tick ticket-PDF purge (W3), same per-row rationale as KYB. */
const PDF_PURGE_LIMIT = 200;

interface KybPurgeRow {
  id: string;
  storageKey: string;
}

interface OrphanRedactRow {
  id: string;
  rawBody: string;
}

interface TicketPdfPurgeRow {
  id: string;
  ticketPdfKey: string;
}

/**
 * #332: SePay rawBody keys to erase after the retention window. `description` carries
 * the payer's account-holder name. `content` is the transfer memo — for an ORPHAN it
 * failed booking-ref matching, so it is arbitrary payer-typed free text that commonly
 * contains the sender's name ("NGUYEN VAN A chuyen tien …"); erased too. `accumulated`
 * is the platform's running balance (business-sensitive, not per-transfer evidence).
 *
 * KEPT as reconciliation evidence: `accountNumber`/`subAccount` are OUR *receiving*
 * (destination) account + virtual-account token, NOT the sender's — the SePay adapter
 * reports the destination account (see lib/payment/adapters/bankTransfer.ts); they are
 * how ops tells which target a stray transfer hit, so they are evidence, not payer PII.
 * The money-evidence keys (`transferAmount`, `id`, `transactionDate`, `code`,
 * `referenceCode`) are also KEPT.
 */
const ORPHAN_PII_KEYS = ['description', 'content', 'accumulated'];

/**
 * Strip the payer-PII keys from a stored orphan rawBody, preserving money-evidence.
 * Returns the rewritten JSON, or `null` when the body is not parseable JSON (the caller
 * then leaves rawBody unchanged but still stamps redactedAt so the row is not re-claimed
 * forever). Only overwrites when a PII key was actually present and non-null.
 */
function redactOrphanRawBody(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    let changed = false;
    for (const k of ORPHAN_PII_KEYS) {
      if (k in parsed && parsed[k] !== null) {
        parsed[k] = null;
        changed = true;
      }
    }
    return changed ? JSON.stringify(parsed) : rawBody;
  } catch {
    return null;
  }
}

export const retentionSweeper: JobCore = async (tx, opts) => {
  // Lazy imports: lib/db/client + the storage layer construct the Prisma client /
  // read env at module-eval. The cron route's unit tests mock runJob and never
  // invoke this core, so dynamic imports keep the route's static import graph free
  // of the DB client (mirrors charterExpirySweeper / generateTrips).
  const { Prisma } = await import('@prisma/client');
  const { deleteObject } = await import('@/lib/storage');
  const { prisma } = await import('@/lib/core/db/client');
  const { logger } = await import('@/lib/logger');
  const {
    GUEST_PII_RETENTION_DAYS,
    KYB_DOC_RETENTION_DAYS,
    ORPHAN_PAYMENT_PII_RETENTION_DAYS,
    PLANNER_CHAT_RETENTION_DAYS,
    NOTIFICATION_PII_RETENTION_DAYS,
    CHARTER_CONTACT_RETENTION_DAYS,
  } = await import('@/lib/account');
  const { TERMINAL_CHARTER_STATUSES } = await import('@/lib/charter');

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

  // --- 3. Orphan PaymentEvent PII redaction (#332) — per-row, FOR UPDATE SKIP LOCKED --
  // An orphan bank-transfer PaymentEvent's rawBody carries the payer's name / bank
  // account. The row can't be deleted (it is the only evidence money arrived — see the
  // schema comment on PaymentEvent), so past the window we STRIP the PII keys from
  // rawBody while KEEPING the money-evidence fields, then stamp redactedAt. Erase ≠
  // delete (S04), same shape as the guest-snapshot arm. bank_transfer is the only
  // orphan-producing adapter (the webhook records orphans only for SePay); the predicate
  // is gated on it so the JSON.parse below always faces the SePay shape.
  const orphanCandidates = await tx.$queryRaw<OrphanRedactRow[]>(Prisma.sql`
    SELECT pe."id", pe."rawBody"
    FROM "PaymentEvent" pe
    WHERE pe."bookingId" IS NULL
      AND pe."redactedAt" IS NULL
      AND pe."adapter" = 'bank_transfer'
      AND pe."receivedAt" < ${now}::timestamp - (${ORPHAN_PAYMENT_PII_RETENTION_DAYS} * INTERVAL '1 day')
    FOR UPDATE OF pe SKIP LOCKED
    LIMIT ${ORPHAN_REDACT_LIMIT}
  `);

  let orphansRedacted = 0;
  for (const row of orphanCandidates) {
    const redacted = redactOrphanRawBody(row.rawBody);
    if (redacted === null) {
      // Non-JSON body (should not occur for a SePay orphan). Leave rawBody untouched but
      // still stamp redactedAt so the row is not re-claimed every tick forever.
      logger.warn(
        { paymentEventId: row.id },
        'retention.orphan_redact_parse_miss — rawBody not JSON; stamping redactedAt without change'
      );
    }
    await tx.paymentEvent.update({
      where: { id: row.id },
      data: { rawBody: redacted ?? row.rawBody, redactedAt: now },
    });
    orphansRedacted += 1;
  }

  // --- 4. Planner conversation retention (W2) — bounded batch DELETE, cascades ------
  // A PlannerConversation (+ its PlannerMessage rows) carries free-text travel chat
  // with no money/audit obligation, so past PLANNER_CHAT_RETENTION_DAYS from the last
  // activity (updatedAt) the whole conversation is HARD DELETED — messages vanish via
  // the ON DELETE CASCADE FK (schema). Batched with FOR UPDATE SKIP LOCKED so a launch
  // backlog can't hold the tx open on one giant DELETE, and so a conversation locked by
  // a concurrent replaceMessages (which holds FOR UPDATE) is skipped, not blocked.
  let convosDeleted = 0;
  for (let i = 0; i < PLANNER_DELETE_MAX_BATCHES; i++) {
    const n = Number(
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "PlannerConversation"
        WHERE "id" IN (
          SELECT "id" FROM "PlannerConversation"
          WHERE "updatedAt" < ${now}::timestamp - (${PLANNER_CHAT_RETENTION_DAYS} * INTERVAL '1 day')
          ORDER BY "updatedAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${PLANNER_DELETE_LIMIT}
        )
      `)
    );
    convosDeleted += n;
    if (n < PLANNER_DELETE_LIMIT) break;
  }

  // --- 5. Ticket-PDF purge (W3) — per-row storage delete ---------------------------
  // A rendered ticket PDF bakes buyerName/buyerPhone (generateTicketPdfs.ts). When a
  // booking's guest PII snapshot is scrubbed (snapshotAnonymizedAt set — by account
  // deletion OR the guest-365d arm above), the PDF object still holds that PII, so
  // purge the object and NULL the key. Per-row (storage side effect); if deleteObject
  // throws (real S3), the tick fails LOUDLY and the key is NOT nulled (no silent
  // "purged"). generateTicketPdfs's claim is guarded so it never regenerates one.
  const pdfCandidates = await tx.$queryRaw<TicketPdfPurgeRow[]>(Prisma.sql`
    SELECT "id", "ticketPdfKey"
    FROM "Booking"
    WHERE "ticketPdfKey" IS NOT NULL
      AND "snapshotAnonymizedAt" IS NOT NULL
    FOR UPDATE SKIP LOCKED
    LIMIT ${PDF_PURGE_LIMIT}
  `);
  let pdfsPurged = 0;
  for (const row of pdfCandidates) {
    await deleteObject(prisma, row.ticketPdfKey);
    await tx.booking.update({
      where: { id: row.id },
      data: { ticketPdfKey: null, ticketPdfGeneratedAt: null },
    });
    pdfsPurged += 1;
  }

  // --- 6. NotificationLog PII scrub (W4) — bulk UPDATE ------------------------------
  // recipient (phone/email) + payload (rendered SMS/email body w/ buyer name) +
  // lastError are PII. Past NOTIFICATION_PII_RETENTION_DAYS from createdAt, on a
  // NON-pending row (a pending row may still dispatch), scrub those fields and stamp
  // redactedAt. Row KEPT (delivery-audit evidence). erase != delete (S04). Bulk (pure
  // column overwrite, no side effect, idempotent via redactedAt predicate).
  const notifResult = await tx.$executeRaw(Prisma.sql`
    UPDATE "NotificationLog"
    SET "recipient" = 'ANONYMIZED',
        "payload" = '{}',
        "lastError" = NULL,
        "redactedAt" = ${now}
    WHERE "redactedAt" IS NULL
      AND "status" <> 'pending'::"NotificationStatus"
      AND "createdAt" < ${now}::timestamp - (${NOTIFICATION_PII_RETENTION_DAYS} * INTERVAL '1 day')
  `);
  const notifScrubbed = Number(notifResult);

  // --- 7. CharterRequest contact-PII scrub (W6) — bulk UPDATE ----------------------
  // A charter lead (guest-allowed) holds contactName/Phone/Email/notes. Once TERMINAL
  // (REJECTED/COMPLETED/CANCELLED) and past CHARTER_CONTACT_RETENTION_DAYS from the last
  // transition (updatedAt), scrub the contact fields to masked placeholders and stamp
  // contactScrubbedAt. ref/status/assignee/destinations KEPT (operator-lead audit). A
  // live lead is never scrubbed (operator still needs the contact). erase != delete.
  const charterResult = await tx.$executeRaw(Prisma.sql`
    UPDATE "CharterRequest"
    SET "contactName" = ${EXPIRED_BUYER_NAME},
        "contactPhone" = ${EXPIRED_BUYER_PHONE},
        "contactEmail" = '[expired]',
        "notes" = NULL,
        "contactScrubbedAt" = ${now}
    WHERE "contactScrubbedAt" IS NULL
      AND "status" IN (${Prisma.join(
        [...TERMINAL_CHARTER_STATUSES].map((s) => Prisma.sql`${s}::"CharterStatus"`)
      )})
      AND "updatedAt" < ${now}::timestamp - (${CHARTER_CONTACT_RETENTION_DAYS} * INTERVAL '1 day')
  `);
  const chartersScrubbed = Number(charterResult);

  return {
    rowsAffected:
      guestScrubbed +
      docsPurged +
      orphansRedacted +
      convosDeleted +
      pdfsPurged +
      notifScrubbed +
      chartersScrubbed,
    status: 'success',
  };
};
