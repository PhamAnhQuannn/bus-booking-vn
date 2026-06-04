/**
 * reconcilePayments — JobCore that resolves stuck `awaiting_payment` bookings
 * the webhook left behind (Issue 095, spec [SYS06]/[SYS10]/[S12]).
 *
 * WHY THIS EXISTS
 * ───────────────
 * Issue 032 intentionally leaves underpaid / wrong-currency success IPNs in
 * `awaiting_payment` "for the reconciliation sweeper to resolve", and a confirmed
 * payment whose IPN never arrived (or arrived with a garbled bank-transfer memo
 * so it never linked to its booking) also strands the booking. Nothing swept
 * these up — they lived forever. This core is that sweeper.
 *
 * THRESHOLD
 * ─────────
 * Only bookings created longer ago than RECONCILE_THRESHOLD_MINUTES (30 min) are
 * considered. The hold TTL is shorter than this, so by 30 min a genuinely-paying
 * customer's IPN has either landed (→ paid) or is never coming (→ expire). A
 * fresh booking still mid-checkout is below threshold and skipped.
 *
 * PER-BOOKING BRANCHES (each documented at its site below):
 *   (a) a confirming PaymentEvent exists (status paid, amount >= totalVnd,
 *       currency VND) → transition to `paid` via the SAME guarded monotonic path
 *       + ledger entries as processWebhook (shared applyPaidStatusTransition /
 *       appendBookingPaidLedger — issues 034/049/095). Enqueue paid notices.
 *   (b) no confirmation AND the hold has expired → `payment_failed_expired`.
 *       Enqueue the expiry notice.
 *   (c) only an UNDERPAID / wrong-currency success event exists (the rows issue
 *       032 parks): NEVER mark paid; treat as genuinely unpaid and expire it
 *       once the hold has lapsed (falls into branch (b)).
 *
 * DEGRADED MATCH (SYS06 bank transfer): when a confirming event's memo/orderRef
 * was garbled so the webhook could not link it to its booking, matchDegraded()
 * recovers it by amount + receiving-account (the PaymentEvent.adapter, our proxy
 * for "which account the money landed in" — there is no separate account column)
 * + a conservative time-window around hold creation. Exact amount only.
 *
 * CONCURRENCY (Mistake Log 043 run-lock + 011/095 row-claim):
 *   - The whole tick runs under the 'reconcile-payments' advisory lock (runJob /
 *     withAdvisoryLock) so two overlapping cron ticks cannot both sweep.
 *   - Each candidate is claimed with SELECT … FOR NO KEY UPDATE SKIP LOCKED on
 *     the lock tx, so a row a concurrent tick already claimed is skipped, not
 *     blocked. FOR NO KEY UPDATE (not FOR UPDATE) is deliberate: it still
 *     excludes a second tick yet stays compatible with the FOR KEY SHARE lock the
 *     NotificationLog→Booking FK insert takes on the same row inside this tx.
 *   - The paid transition is the map-derived monotonic guarded UPDATE: rowcount 0
 *     (row already advanced) → skip every paid side-effect, NEVER regress.
 *
 * NOTIFICATIONS (Issue 058): reconcile-outcome notices are ENQUEUED as pending
 * NotificationLog rows (unique(bookingId, template)); the dispatch-notifications
 * cron delivers them. Nothing is sent in-process here. A duplicate enqueue across
 * ticks collides on the unique constraint and is swallowed.
 *
 * rowsAffected = paidCount + expiredCount.
 */

import type { JobCore } from './types';

/**
 * Bookings created more than this many minutes ago are candidates. > hold TTL so
 * a still-checking-out customer is never swept. Documented const, not magic.
 */
export const RECONCILE_THRESHOLD_MINUTES = 30;

/**
 * Conservative ± window (minutes) around hold creation for the degraded
 * bank-transfer match. Only an exact-amount event on the right receiving account
 * (adapter) landing inside [holdCreatedAt − W, holdCreatedAt + W] is accepted.
 */
export const DEGRADED_MATCH_WINDOW_MINUTES = 30;

/** Bound work per tick so a backlog can't hold the lock indefinitely. */
const CLAIM_LIMIT = 200;

interface StuckBookingRow {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  /** The rail the booking was created with — the receiving account a degraded
   * (memo-less) event must have landed on. PaymentEvent.adapter mirrors this. */
  paymentMethod: string;
  createdAt: Date;
  operatorId: string;
  operatorContactPhone: string;
  operatorNotificationPhone: string | null;
  origin: string;
  destination: string;
  departureAt: Date;
  /** Hold expiry — null when no hold (manual bookings); only expired holds expire. */
  holdExpiresAt: Date | null;
  holdCreatedAt: Date | null;
}

/** Recovered view of a stored PaymentEvent (amount/success parsed from rawBody). */
interface RecoveredEvent {
  paymentEventId: string;
  bookingId: string | null;
  adapter: string;
  providerTxnId: string;
  amount: number;
  currency: string;
  /** True when the stored IPN body carried a success resultCode (0). */
  success: boolean;
  receivedAt: Date;
}

/**
 * Recover amount + success from a stored PaymentEvent.rawBody. We do NOT
 * re-verify the signature — the row only exists because verifyWebhook already
 * passed at ingest (processWebhook inserts the row only after a verified IPN).
 * The PaymentEvent table stores neither amount nor status as columns, so we read
 * them from the persisted body.
 *
 * Both the MoMo and stub adapters sign a body with `amount` and `resultCode`,
 * and BOTH treat `resultCode === 0` as success (momo: classifyMomoStatus 0→paid;
 * stub: STUB_SUCCESS_CODE === 0). A non-zero code is a failure/pending/unknown —
 * none of which are confirming, so we only need the success boolean. A non-JSON
 * or shapeless body yields success=false and is never a confirmation.
 */
function recoverEvent(
  row: { id: string; bookingId: string | null; adapter: string; providerTxnId: string; currency: string; rawBody: string; receivedAt: Date }
): RecoveredEvent {
  let amount = 0;
  let success = false;
  try {
    const parsed = JSON.parse(row.rawBody) as Record<string, unknown>;
    amount = Number(parsed.amount ?? 0);
    success = Number(parsed.resultCode ?? -1) === 0;
  } catch {
    // Non-JSON / shapeless body → not a confirmation.
  }
  return {
    paymentEventId: row.id,
    bookingId: row.bookingId,
    adapter: row.adapter,
    providerTxnId: row.providerTxnId,
    amount,
    currency: row.currency,
    success,
    receivedAt: row.receivedAt,
  };
}

/** A confirming event = a genuine, full, VND payment. Underpaid/non-VND are NOT. */
function isConfirming(ev: RecoveredEvent, totalVnd: number): boolean {
  return ev.success && ev.currency === 'VND' && ev.amount >= totalVnd;
}

/**
 * Degraded match (SYS06): find a confirming event that the webhook could not
 * link to this booking by orderRef (garbled bank-transfer memo). Conservative —
 * an UNLINKED (or cross-linked) event qualifies ONLY when its receiving account
 * (adapter) is one the booking actually used, the amount is EXACTLY the booking
 * total, the currency is VND, the status is paid, AND it landed within the
 * window around hold creation. Returns the first qualifying event or null.
 */
export function matchDegraded(
  booking: StuckBookingRow,
  candidates: RecoveredEvent[],
  usedAdapters: Set<string>,
  windowMinutes = DEGRADED_MATCH_WINDOW_MINUTES
): RecoveredEvent | null {
  const anchor = booking.holdCreatedAt ?? booking.createdAt;
  const windowMs = windowMinutes * 60_000;
  const lo = anchor.getTime() - windowMs;
  const hi = anchor.getTime() + windowMs;
  for (const ev of candidates) {
    if (ev.bookingId === booking.id) continue; // already linked → not degraded
    if (!ev.success || ev.currency !== 'VND') continue;
    if (ev.amount !== booking.totalVnd) continue; // EXACT amount only
    if (!usedAdapters.has(ev.adapter)) continue; // right receiving account
    const t = ev.receivedAt.getTime();
    if (t < lo || t > hi) continue; // inside the window
    return ev;
  }
  return null;
}

export const reconcilePayments: JobCore = async (tx, opts) => {
  // Lazy imports: the DB client + ledger construct Prisma at module-eval (throws
  // when DATABASE_URL is unset). The cron route's unit tests mock runJob and
  // never invoke this core, so dynamic import keeps the route's static graph free
  // of the DB client (mirrors charterExpirySweeper / generateTrips).
  const { Prisma } = await import('@prisma/client');
  const { after } = await import('next/server');
  const { renderTemplate } = await import('@/lib/notification');
  const { logger } = await import('@/lib/logger');
  const { legalPredecessors } = await import('@/lib/booking/transitions');
  const { applyPaidStatusTransition, appendBookingPaidLedger } = await import(
    '@/lib/payment/applyPaidTransition'
  );
  const { refundOut } = await import('@/lib/ledger/refund');

  const now = opts?.now ?? new Date();
  const thresholdAt = new Date(now.getTime() - RECONCILE_THRESHOLD_MINUTES * 60_000);

  // Claim stuck candidates under the tick's lock connection. SKIP LOCKED so a row
  // a live webhook is mid-transition on is left to that webhook, not blocked.
  const candidates = await tx.$queryRaw<StuckBookingRow[]>(Prisma.sql`
    SELECT b."id",
           b."bookingRef",
           b."confirmationToken",
           b."buyerName",
           b."buyerPhone",
           b."ticketCount",
           b."totalVnd",
           b."paymentMethod"::text       AS "paymentMethod",
           b."createdAt",
           t."operatorId"            AS "operatorId",
           op."contactPhone"         AS "operatorContactPhone",
           op."notificationPhone"    AS "operatorNotificationPhone",
           r."origin"                AS "origin",
           r."destination"           AS "destination",
           t."departureAt"           AS "departureAt",
           h."expiresAt"             AS "holdExpiresAt",
           h."createdAt"             AS "holdCreatedAt"
    FROM "Booking" b
    JOIN "Trip" t      ON t."id" = b."tripId"
    JOIN "Operator" op ON op."id" = t."operatorId"
    JOIN "Route" r     ON r."id" = t."routeId"
    LEFT JOIN "Hold" h ON h."id" = b."holdId"
    WHERE b."status" = 'awaiting_payment'::"BookingStatus"
      AND b."createdAt" < ${thresholdAt}
    ORDER BY b."createdAt" ASC
    LIMIT ${CLAIM_LIMIT}
    FOR NO KEY UPDATE OF b SKIP LOCKED
  `);

  let paidCount = 0;
  let expiredCount = 0;

  for (const booking of candidates) {
    // Load every PaymentEvent we might match: those already linked to THIS
    // booking, plus orphan/cross-linked ones for the degraded bank-transfer
    // match. rawBody carries the canonical amount/status the table doesn't store.
    const rawEvents = await tx.$queryRaw<
      { id: string; bookingId: string | null; adapter: string; providerTxnId: string; currency: string; rawBody: string; receivedAt: Date }[]
    >(Prisma.sql`
      SELECT pe."id",
             pe."bookingId",
             pe."adapter",
             pe."providerTxnId",
             pe."currency",
             pe."rawBody",
             pe."receivedAt"
      FROM "PaymentEvent" pe
      WHERE pe."bookingId" = ${booking.id}::uuid
         OR (
           pe."bookingId" IS NULL
           AND pe."receivedAt" >= ${new Date(
             (booking.holdCreatedAt ?? booking.createdAt).getTime() -
               DEGRADED_MATCH_WINDOW_MINUTES * 60_000
           )}
           AND pe."receivedAt" <= ${new Date(
             (booking.holdCreatedAt ?? booking.createdAt).getTime() +
               DEGRADED_MATCH_WINDOW_MINUTES * 60_000
           )}
         )
    `);

    const events = rawEvents.map((e) => recoverEvent(e));
    const linked = events.filter((e) => e.bookingId === booking.id);
    // Receiving accounts this booking could legitimately have been paid into:
    // the rail it was created with (paymentMethod) plus any adapter that already
    // produced a linked event. The paymentMethod entry is what lets a FULLY
    // orphaned (never-linked, garbled-memo) event still degrade-match.
    const usedAdapters = new Set<string>([
      booking.paymentMethod,
      ...linked.map((e) => e.adapter),
    ]);

    // (a) Confirming event among the linked events?
    let confirming = linked.find((e) => isConfirming(e, booking.totalVnd)) ?? null;

    // Degraded match (SYS06): no linked confirmation, try the orphan window.
    if (!confirming) {
      confirming = matchDegraded(booking, events, usedAdapters);
    }

    if (confirming) {
      // (a) Resolve to paid through the SHARED guarded monotonic path + ledger.
      const { updated, refundTriggered } = await applyPaidStatusTransition(
        tx,
        booking.id,
        confirming.providerTxnId
      );
      if (updated > 0) {
        // Issue 100: for an oversold booking discovered during reconciliation,
        // the booking is already `refunded` in the DB. Schedule the ledger
        // refund entries post-commit via after() (same pattern as processWebhook).
        if (refundTriggered) {
          const bid = booking.id;
          const totalVnd = booking.totalVnd;
          const providerTxnId = confirming.providerTxnId;
          after(async () => {
            try {
              await refundOut({
                bookingId: bid,
                amountMinor: totalVnd,
                reason: 'oversold_race',
                idempotencyKey: `oversold:${bid}:${providerTxnId}`,
              });
            } catch (refundErr) {
              logger.error(
                { err: refundErr, bookingRef: booking.bookingRef, bookingId: bid },
                'reconcile.oversold_refund.error — booking refunded, ledger entries need retry'
              );
            }
          });
          // Skip paid ledger + notifications — booking is refunded, not paid.
          paidCount += 1;
          logger.info(
            { bookingRef: booking.bookingRef, providerTxnId: confirming.providerTxnId, oversold: true },
            'reconcile.booking_paid_then_refunded_oversold'
          );
          continue;
        }

        await appendBookingPaidLedger(tx, {
          operatorId: booking.operatorId,
          bookingId: booking.id,
          grossVnd: booking.totalVnd,
          now,
        });

        // Enqueue the paid-confirmation notices (Issue 058 — pending only). The
        // cron has no request host, so confirmationUrl is the bare token (the
        // webhook falls back to the same when no baseUrl is available).
        const routeLabel = `${booking.origin} - ${booking.destination}`;
        const departureLabel = booking.departureAt.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          dateStyle: 'short',
          timeStyle: 'short',
        });
        const operatorRecipient =
          booking.operatorNotificationPhone ?? booking.operatorContactPhone;

        await enqueuePendingNotification(tx, logger, {
          bookingId: booking.id,
          template: 'customerBookingPaid',
          recipient: booking.buyerPhone,
          payload: renderTemplate('customerBookingPaid', {
            ticketCount: booking.ticketCount,
            route: routeLabel,
            departureAt: departureLabel,
            bookingRef: booking.bookingRef,
            confirmationUrl: booking.confirmationToken,
          }),
        });
        await enqueuePendingNotification(tx, logger, {
          bookingId: booking.id,
          template: 'operatorNewBooking',
          recipient: operatorRecipient,
          payload: renderTemplate('operatorNewBooking', {
            ticketCount: booking.ticketCount,
            route: routeLabel,
            departureAt: departureLabel,
            bookingRef: booking.bookingRef,
            buyerPhone: booking.buyerPhone,
          }),
        });

        paidCount += 1;
        logger.info(
          { bookingRef: booking.bookingRef, providerTxnId: confirming.providerTxnId, degraded: confirming.bookingId !== booking.id },
          'reconcile.booking_paid'
        );
      }
      continue;
    }

    // (b)/(c) No confirmation. Expire ONLY when the hold has genuinely lapsed.
    // (c) underpaid / wrong-currency success rows parked by issue 032 reach here
    // (they were never confirming) and expire exactly like a no-event booking —
    // we never accept their short payment as paid.
    const holdExpired =
      booking.holdExpiresAt !== null && booking.holdExpiresAt <= now;
    if (!holdExpired) {
      // Hold still active (or no hold yet expired) → leave it; a payment may
      // still confirm. Below-threshold rows were already excluded by the claim.
      continue;
    }

    // Monotonic guarded transition to payment_failed_expired. Predecessors from
    // the same single-source map (issue 034) — a row that raced to paid via a
    // concurrent webhook matches 0 rows and is never regressed.
    const expiredPredecessors = Prisma.join(
      legalPredecessors('payment_failed_expired').map(
        (s) => Prisma.sql`${s}::"BookingStatus"`
      )
    );
    const expired = await tx.$executeRaw(Prisma.sql`
      UPDATE "Booking"
      SET status = 'payment_failed_expired'::"BookingStatus"
      WHERE id = ${booking.id}::uuid
        AND status IN (${expiredPredecessors})
    `);

    if ((expired as number) > 0) {
      const routeLabel = `${booking.origin} - ${booking.destination}`;
      const departureLabel = booking.departureAt.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      });
      await enqueuePendingNotification(tx, logger, {
        bookingId: booking.id,
        template: 'customerBookingExpired',
        recipient: booking.buyerPhone,
        payload: renderTemplate('customerBookingExpired', {
          bookingRef: booking.bookingRef,
          route: routeLabel,
          departureAt: departureLabel,
        }),
      });
      expiredCount += 1;
      logger.info({ bookingRef: booking.bookingRef }, 'reconcile.booking_expired');
    }
  }

  return { rowsAffected: paidCount + expiredCount, status: 'success' };
};

/**
 * Enqueue a pending NotificationLog row INSIDE the sweep's transaction (`tx`),
 * not the global client — the candidate claim holds a row lock on Booking, so a
 * cross-connection insert with the NotificationLog→Booking FK would contend on
 * the same row. Writing through `tx` keeps it on the locked connection.
 *
 * The unique(bookingId, template) P2002 collision (a duplicate enqueue across
 * ticks) is swallowed so it never aborts the sweep.
 */
async function enqueuePendingNotification(
  tx: import('@prisma/client').Prisma.TransactionClient,
  logger: { warn: (obj: unknown, msg: string) => void },
  input: {
    bookingId: string;
    channel?: 'sms' | 'email';
    template: string;
    recipient: string;
    payload: string;
  }
): Promise<void> {
  try {
    await tx.notificationLog.create({
      data: {
        bookingId: input.bookingId,
        channel: input.channel ?? 'sms',
        template: input.template,
        recipient: input.recipient,
        payload: input.payload,
        status: 'pending',
      },
    });
  } catch (err) {
    logger.warn(
      { template: input.template, err: err instanceof Error ? err.message : String(err) },
      'reconcile.enqueue_skipped'
    );
  }
}
