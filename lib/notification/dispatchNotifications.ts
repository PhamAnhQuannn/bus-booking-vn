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
 * Claim a batch of due rows inside a short transaction with FOR UPDATE SKIP
 * LOCKED, returning the claimed rows. The rows stay in their current status
 * (pending/failed) — the dispatch outcome is written per-row afterward. The
 * SKIP LOCKED claim ensures a concurrent dispatcher does not re-claim them
 * while this tick holds the row locks for the (brief) duration of this tx.
 *
 * NOTE: because dispatch happens AFTER this tx commits (the lock is released),
 * the gating predicate (attemptCount < MAX, nextAttemptAt/scheduledFor due)
 * plus the advisory lock 'notify-dispatch' serializing whole ticks is what
 * prevents double-send — not a held row lock across the network call.
 */
async function claimDueRows(now: Date, limit: number): Promise<DueRow[]> {
  return prisma.$transaction(async (tx) => {
    return tx.$queryRaw<DueRow[]>(Prisma.sql`
      SELECT "id", "channel", "template", "recipient", "payload", "attemptCount"
      FROM "NotificationLog"
      WHERE "status" IN ('pending'::"NotificationStatus", 'failed'::"NotificationStatus")
        AND "attemptCount" < ${MAX_ATTEMPTS}
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
        AND ("scheduledFor" IS NULL OR "scheduledFor" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);
  });
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
   * the message may or may not have been accepted. Currently OBSERVED but not yet acted
   * on — see the idempotency-key note in dispatchRow.
   */
  outcome?: 'rejected' | 'unknown';
}

async function dispatchRow(row: DueRow): Promise<DispatchOutcome> {
  if (row.channel === 'email') {
    // Resend Idempotency-Key = "<row id>:<attemptCount>", so a cron re-run of the
    // SAME attempt (crash between the send and the status='sent' write) cannot
    // double-send, while a genuine retry after a failure gets a fresh key.
    //
    // The attempt number is load-bearing, not cosmetic. Per Resend's docs
    // (https://resend.com/docs/dashboard/emails/idempotency-keys) keys live for
    // 24h and a replayed key "returns exactly the same status code and body as
    // the original response — even if the original returned an error". Our five
    // attempts span ~60min of backoff (2+4+8+16+30), well inside that window, so
    // a bare row.id would make attempts 2-5 replay attempt 1's cached FAILURE and
    // turn any transient Resend error into permanent non-delivery.
    //
    // Crash-safety is preserved because attemptCount is a persisted column and is
    // only incremented once the attempt's outcome is written: a re-claim of an
    // unfinished attempt reads the same value and therefore rebuilds the same key.
    // cuid ids are alphanumeric, so this stays well under Resend's 256-char limit.
    //
    // KNOWN RESIDUAL (#368), deliberately not fixed here. attemptCount advances on
    // EVERY failure, so an `unknown` outcome (timeout, socket reset — Resend may
    // already have accepted the message) also gets a fresh key on the next attempt,
    // and that sends a real duplicate. The trade favours delivery over
    // duplicate-avoidance, which is right for a ticket confirmation, but it should be
    // a decision rather than an accident.
    //
    // Fixing it needs the PREVIOUS attempt's outcome at claim time, i.e. a persisted
    // column — the salt would advance only on `rejected`. sendViaResend now returns
    // that discriminator and it is carried through DispatchOutcome and logged, so the
    // information exists; only the column and the salt change remain. Scheduled with
    // the other schema work rather than bolted onto an unrelated column: overloading
    // `externalRef` (vendor message id) or `lastError` (operator-visible text) with
    // retry control state is the dual-meaning trap the mistake log already records.
    return sendEmail({
      to: row.recipient,
      template: row.template,
      payload: row.payload,
      idempotencyKey: `${row.id}:${row.attemptCount}`,
    });
  }
  // channel === 'sms' — row.id is the eSMS RequestId (idempotency key) so a
  // cron re-run of the same row cannot double-send.
  //
  // NOTE the asymmetry with the email branch above, which salts by attemptCount: this
  // passes a BARE row.id, so every eSMS retry replays one key. That is only correct if
  // eSMS does NOT cache and replay failed responses the way Resend does (Resend replays
  // a key's original response for 24h, errors included — which is exactly why the email
  // key needs the salt). No vendor-doc citation exists for eSMS's behaviour here, so
  // this is currently an assumption, not a verified contract. eSMS is stubbed under
  // NOTIFY_STUB and unverified against the live rail; transcribe the real semantics
  // from eSMS's docs before it goes live, per the 2026-07-21 webhook-contract rule.
  return sendSmsBody({ to: row.recipient, template: row.template, body: row.payload, requestId: row.id });
}

export const dispatchNotifications: JobCore = async (_tx, opts?: JobOpts) => {
  const now = opts?.now ?? new Date();

  const rows = await claimDueRows(now, BATCH_SIZE);
  let delivered = 0;

  for (const row of rows) {
    let result: DispatchOutcome;
    try {
      result = await dispatchRow(row);
    } catch (err) {
      // A throw that escaped the adapter is an unknown outcome by definition — we never
      // saw the vendor's answer.
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        outcome: 'unknown',
      };
    }

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
      delivered += 1;
    } else {
      const nextAttempt = row.attemptCount + 1;
      await prisma.notificationLog.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          attemptCount: nextAttempt,
          lastError: (result.error ?? 'dispatch_failed').slice(0, 500),
          // Always record the next-eligible instant. Once attemptCount reaches
          // MAX_ATTEMPTS the claim query stops reclaiming the row regardless of
          // nextAttemptAt, so an exhausted row is permanently failed.
          nextAttemptAt: backoffMs(nextAttempt, now),
        },
      });
      logger.warn(
        {
          logId: row.id,
          channel: row.channel,
          template: row.template,
          attempt: nextAttempt,
          // #368: 'unknown' means the next attempt re-keys and may send a REAL duplicate.
          // Surfacing it makes the residual measurable — if these are rare in practice
          // the column fix stays low priority; if they are common it is urgent.
          outcome: result.outcome ?? 'unspecified',
        },
        'notify.dispatch.failed'
      );
      // Issue 061 (AC5): alert on a dispatch failure. Additive + non-throwing;
      // the status='failed' write + backoff above are unchanged. `recipient` is
      // NOT included (PII) — area/notificationId/channel only.
      captureException(new Error(result.error ?? 'dispatch_failed'), {
        area: 'notification',
        notificationId: row.id,
        channel: row.channel,
      });
    }
  }

  return { rowsAffected: delivered, status: 'success' };
};
