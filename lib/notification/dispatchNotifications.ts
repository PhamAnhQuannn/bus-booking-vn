/**
 * dispatchNotifications — JobCore that delivers due NotificationLog rows via the
 * channel adapters with retry + exponential backoff (Issue 058).
 *
 * Rows are ENQUEUED elsewhere (processWebhook on booking-paid, completeTripCore
 * payout_scheduled, cancelTrip trip_cancelled, …) with status='pending' and NO
 * in-process send. This cron is the single delivery path.
 *
 * Claim-then-dispatch outbox pattern (required by the withAdvisoryLock V1 note —
 * network I/O must NOT be held inside the advisory-lock transaction):
 *
 *   1. Claim a batch of due rows in a SHORT transaction with
 *      `FOR UPDATE SKIP LOCKED` so two concurrent dispatchers never grab the
 *      same row. The advisory lock (lock key 'notify-dispatch') already
 *      serializes whole ticks; SKIP LOCKED is belt-and-suspenders for the case
 *      where a manual trigger races a scheduled tick.
 *   2. Dispatch each claimed row via its channel adapter OUTSIDE any transaction
 *      (sendSms / sendEmail are no-network stubs today, real HTTP later).
 *   3. Persist the per-row outcome:
 *        success → status='sent', sentAt=now, externalRef
 *        failure → attemptCount++, status='failed', lastError,
 *                  nextAttemptAt = now + backoff(attemptCount)
 *
 * AC5 decoupling: a delivery failure updates ONLY the NotificationLog row. The
 * booking's `paid` status is never touched here — this module performs no
 * Booking writes at all.
 *
 * The JobCore receives the advisory-lock `tx` handle but deliberately does NOT
 * use it for the claim/dispatch work (mirrors lib/jobs/generateTrips): the
 * dispatcher's own short transactions commit independently on the pooled
 * `prisma` client. The lock tx exists only to hold the 'notify-dispatch' key.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { sendSmsBody } from '@/lib/notification/esms';
import { sendEmail } from '@/lib/notification/email';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import type { JobCore, JobOpts } from '@/lib/jobs';

/** Max delivery attempts before a row is left permanently failed (not reclaimed). */
export const MAX_ATTEMPTS = 5;

/** How many due rows to claim+dispatch per cron tick. */
export const BATCH_SIZE = 50;

/** Backoff cap (minutes). 2^5 = 32 already exceeds this for high attempt counts. */
const BACKOFF_CAP_MINUTES = 30;

interface DueRow {
  id: string;
  channel: 'sms' | 'email';
  template: string;
  recipient: string;
  payload: string;
  attemptCount: number;
  keySalt: number;
}

/**
 * Exponential backoff: attempt N (the just-completed attempt count, 1-based)
 * waits min(2^N, cap) minutes before the row is eligible again.
 * attemptCount=1 → 2min, 2 → 4min, 3 → 8min, 4 → 16min, 5 → capped 30min.
 */
export function backoffMs(attemptCount: number, now: Date): Date {
  const minutes = Math.min(2 ** attemptCount, BACKOFF_CAP_MINUTES);
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * Claim lease (ms). On claim we push `nextAttemptAt` this far into the future so
 * a concurrent claimer's due-predicate (`nextAttemptAt <= now`) skips the row —
 * an atomic per-row claim WITHOUT holding a row lock across the network send, and
 * without a new status column. A crash between claim and outcome-write leaves the
 * row leased; once the lease expires it becomes due again (a real send is ~1-3s,
 * so 2 min amply covers a slow Resend call).
 */
const CLAIM_LEASE_MS = 2 * 60_000;

const CLAIM_COLUMNS = Prisma.sql`"id", "channel", "template", "recipient", "payload", "attemptCount", "keySalt"`;

/** Rows whose lease/backoff is due AND not exhausted AND not scheduled for later. */
const duePredicate = (now: Date) => Prisma.sql`
  ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
  AND "status" IN ('pending'::"NotificationStatus", 'failed'::"NotificationStatus")
  AND "attemptCount" < ${MAX_ATTEMPTS}
  AND ("scheduledFor" IS NULL OR "scheduledFor" <= ${now})
`;

/**
 * Atomically CLAIM up to `limit` due rows by pushing their `nextAttemptAt` a lease
 * into the future and returning them. `FOR UPDATE SKIP LOCKED` in the sub-select
 * lets concurrent dispatchers claim disjoint batches; the lease bump then makes the
 * claimed rows invisible to any other claimer (cron OR inline `dispatchOne`) until
 * the send finishes and writes the real outcome — so no two callers ever send the
 * same row. Single atomic statement, no held lock across the subsequent network call.
 */
async function claimDueRows(now: Date, limit: number): Promise<DueRow[]> {
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  return prisma.$queryRaw<DueRow[]>(Prisma.sql`
    UPDATE "NotificationLog" SET "nextAttemptAt" = ${leaseUntil}
    WHERE "id" IN (
      SELECT "id" FROM "NotificationLog"
      WHERE ${duePredicate(now)}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ${CLAIM_COLUMNS}
  `);
}

/**
 * Atomically claim ONE row by id (the inline-dispatch path). Returns the row if it
 * was due-and-claimable, or [] if a concurrent cron tick already leased it / it is
 * not due — in which case the caller simply skips (the cron will deliver it).
 */
async function claimRowById(rowId: string, now: Date): Promise<DueRow[]> {
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  return prisma.$queryRaw<DueRow[]>(Prisma.sql`
    UPDATE "NotificationLog" SET "nextAttemptAt" = ${leaseUntil}
    WHERE "id" = ${rowId} AND ${duePredicate(now)}
    RETURNING ${CLAIM_COLUMNS}
  `);
}

/**
 * Dispatch a single claimed row through its channel adapter, passing the
 * already-rendered body string stored in NotificationLog.payload (no re-render).
 */
export interface DispatchOutcome {
  ok: boolean;
  externalRef?: string;
  error?: string;
  /**
   * Failure kind, when `ok` is false (#368). `rejected` = the vendor answered and
   * refused (definitively not sent). `unknown` = no answer (timeout/socket reset), so
   * the message may or may not have been accepted. Acted on in the failure-write:
   * `rejected` advances keySalt (fresh key), `unknown` holds it (retry dedupes) —
   * see the idempotency-key note in dispatchRow.
   */
  outcome?: 'rejected' | 'unknown';
}

async function dispatchRow(row: DueRow): Promise<DispatchOutcome> {
  if (row.channel === 'email') {
    // Resend Idempotency-Key = "<row id>:<keySalt>", so a cron re-run of the SAME
    // attempt (crash between the send and the status write) cannot double-send.
    //
    // The salt is load-bearing, not cosmetic. Per Resend's docs
    // (https://resend.com/docs/dashboard/emails/idempotency-keys) keys live for
    // 24h and a replayed key "returns exactly the same status code and body as
    // the original response — even if the original returned an error". Our five
    // attempts span ~60min of backoff (2+4+8+16+30), well inside that window.
    //
    // #368: the salt is `keySalt`, NOT `attemptCount`. attemptCount advances on
    // every failure (it drives MAX_ATTEMPTS gating + backoff), but keySalt advances
    // ONLY after a definite `rejected` outcome (see the failure-write below). So:
    //   - `rejected` (vendor refused, not sent): salt++ → fresh key → the retry is a
    //     real new send, not a replay of the cached failure (the #335 property).
    //   - `unknown` (timeout/socket — Resend may have accepted): salt unchanged →
    //     the retry reuses the same key → Resend dedupes instead of double-sending.
    //
    // Crash-safety preserved: keySalt (like attemptCount) is persisted and only
    // written once the outcome is known, so a re-claim of an unfinished attempt
    // reads the same salt and rebuilds the same key. cuid ids are alphanumeric, so
    // this stays well under Resend's 256-char limit.
    return sendEmail({
      to: row.recipient,
      template: row.template,
      payload: row.payload,
      idempotencyKey: `${row.id}:${row.keySalt}`,
    });
  }
  // channel === 'sms' — row.id is the eSMS RequestId (idempotency key) so a
  // cron re-run of the same row cannot double-send.
  //
  // NOTE the asymmetry with the email branch above, which salts by keySalt: this
  // passes a BARE row.id, so every eSMS retry replays one key. That is only correct if
  // eSMS does NOT cache and replay failed responses the way Resend does (Resend replays
  // a key's original response for 24h, errors included — which is exactly why the email
  // key needs the salt). No vendor-doc citation exists for eSMS's behaviour here, so
  // this is currently an assumption, not a verified contract. eSMS is stubbed under
  // NOTIFY_STUB and unverified against the live rail; transcribe the real semantics
  // from eSMS's docs before it goes live, per the 2026-07-21 webhook-contract rule.
  return sendSmsBody({ to: row.recipient, template: row.template, body: row.payload, requestId: row.id });
}

/** Send one already-claimed row, catching an escaped throw as an 'unknown' outcome. */
async function sendClaimed(row: DueRow): Promise<DispatchOutcome> {
  try {
    return await dispatchRow(row);
  } catch (err) {
    // A throw that escaped the adapter is an unknown outcome by definition — we never
    // saw the vendor's answer.
    return { ok: false, error: err instanceof Error ? err.message : String(err), outcome: 'unknown' };
  }
}

/**
 * Persist the per-row dispatch outcome (transitions the row OUT of its lease):
 *   success → status='sent', sentAt, externalRef, nextAttemptAt=null
 *   failure → status='failed', attemptCount++, keySalt (per #368), backoff nextAttemptAt
 * Shared by the cron loop and the inline `dispatchOne` path so both write identically.
 */
async function applyDispatchOutcome(row: DueRow, result: DispatchOutcome, now: Date): Promise<void> {
  if (result.ok) {
    await prisma.notificationLog.update({
      where: { id: row.id },
      data: {
        status: 'sent',
        sentAt: now,
        externalRef: result.externalRef ?? null,
        attemptCount: row.attemptCount + 1,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    return;
  }
  const nextAttempt = row.attemptCount + 1;
  // #368: advance the idempotency-key salt ONLY on a definite vendor rejection.
  // 'unknown' (and the caught-throw synthetic 'unknown') leaves keySalt unchanged so
  // the next attempt reuses the same key and Resend dedupes a possibly-accepted send.
  const nextSalt = result.outcome === 'rejected' ? row.keySalt + 1 : row.keySalt;
  await prisma.notificationLog.update({
    where: { id: row.id },
    data: {
      status: 'failed',
      attemptCount: nextAttempt,
      keySalt: nextSalt,
      lastError: (result.error ?? 'dispatch_failed').slice(0, 500),
      // Once attemptCount reaches MAX_ATTEMPTS the claim query stops reclaiming the
      // row regardless of nextAttemptAt, so an exhausted row is permanently failed.
      nextAttemptAt: backoffMs(nextAttempt, now),
    },
  });
  logger.warn(
    {
      logId: row.id,
      channel: row.channel,
      template: row.template,
      attempt: nextAttempt,
      outcome: result.outcome ?? 'unspecified',
    },
    'notify.dispatch.failed'
  );
  // Issue 061 (AC5): alert on a dispatch failure. `recipient` is NOT included (PII).
  captureException(new Error(result.error ?? 'dispatch_failed'), {
    area: 'notification',
    notificationId: row.id,
    channel: row.channel,
  });
}

/**
 * Deliver ONE NotificationLog row immediately (inline-send path — called post-commit
 * from the payment webhook so a paid customer/operator gets their email in seconds
 * instead of waiting for the next cron tick). Atomically claims the row (lease), so a
 * concurrent cron tick can never also send it; if it was already claimed/sent/not-due
 * this is a no-op. Best-effort by contract: the caller wraps it in try/catch and the
 * cron remains the durable retry path for anything not delivered here.
 * Returns true iff the row was claimed AND sent successfully.
 */
export async function dispatchOne(rowId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await claimRowById(rowId, now);
  if (!row) return false; // already claimed by the cron, already sent, or not yet due
  const result = await sendClaimed(row);
  await applyDispatchOutcome(row, result, now);
  return result.ok;
}

export const dispatchNotifications: JobCore = async (_tx, opts?: JobOpts) => {
  const now = opts?.now ?? new Date();

  const rows = await claimDueRows(now, BATCH_SIZE);
  let delivered = 0;

  for (const row of rows) {
    const result = await sendClaimed(row);
    await applyDispatchOutcome(row, result, now);
    if (result.ok) delivered += 1;
  }

  return { rowsAffected: delivered, status: 'success' };
};
