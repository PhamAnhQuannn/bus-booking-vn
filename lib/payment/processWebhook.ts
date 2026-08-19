/**
 * processPaymentWebhook — gateway-agnostic IPN handler shared by every
 * payment receiver route (momo, zalopay, card).
 *
 * Security: HMAC signature verified via the injected gateway.verifyWebhook()
 * before any DB writes. The adapter returns a normalized CanonicalPaymentEvent
 * { orderRef, providerTxnId, amount, currency, status } — native gateway field
 * names + result codes never reach this function. Idempotent: PaymentEvent
 * @@unique([adapter, providerTxnId]) prevents duplicate processing on replay.
 *
 * PII policy: NEVER log buyer phone, raw webhook body, or secret key.
 * Log only bookingRef, event type, sig-verify outcome.
 *
 * Bug B (2026-07-23): a bank_transfer payment we cannot resolve to a booking is
 * recorded as an ORPHAN PaymentEvent (bookingId NULL) via
 * recordUnmatchedPaymentEvent, not dropped — it is the only DB evidence the money
 * arrived, and the reconcile sweeper degrade-matches it back to its booking.
 * Consequently the linked-event write CLAIMS a matching orphan first and only
 * inserts when there is none — a P2002 inside the tx is unrecoverable (Postgres
 * aborts the whole transaction), so the ambiguity must be resolved before the write,
 * not after it.
 *
 * Transaction logic:
 *   1. CLAIM an orphan PaymentEvent, else INSERT (idempotent: P2002 → 200 no-op)
 *   2. If status === 'paid':
 *      - Currency guard FIRST: if currency !== 'VND', log currency_mismatch and
 *        do NOT transition (audit row stays, booking stays awaiting_payment).
 *      - Amount verify (money-loss guard): if amount < booking.totalVnd, REJECT —
 *        log amount_mismatch, leave booking awaiting_payment, no paid transition.
 *      - Else guarded UPDATE Booking status → paid
 *        (WHERE status='awaiting_payment' — safe for replays)
 *      - If update count > 0: INSERT 2 NotificationLog
 *   3. If status === 'failed': status → payment_failed_expired
 *   4. If status === 'pending': no status transition
 *   5. If status === 'unknown': no status transition (PaymentEvent row recorded)
 *
 * After transaction: schedule SMS dispatch via after() (non-blocking).
 *
 * Status mapping (native result code → canonical status) lives entirely in each
 * adapter (lib/payment/{momo,stub}.ts) — never inferred here.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { renderTemplate, dispatchOne } from '@/lib/notification';
import { logger } from '@/lib/logger';
import { captureException, captureMessage } from '@/lib/observability';
import { track, sessionIdForBooking } from '@/lib/analytics';
import type { PaymentGateway } from './gateway';
import { legalPredecessors } from '@/lib/core/booking';
import {
  applyPaidStatusTransition,
  appendBookingPaidLedger,
} from './applyPaidTransition';

export interface ProcessPaymentWebhookInput {
  rawBody: string;
  gateway: PaymentGateway;
  /** Gateway label stored on PaymentEvent.adapter: 'momo' | 'zalopay' | 'card' | 'vnpay' | 'bank_transfer'. */
  adapter: string;
  /** x-forwarded-proto header (for building the confirmation URL in SMS). */
  proto: string;
  /** host header (for building the confirmation URL in SMS). */
  host: string;
}

function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * #370: canonical reasons a bank-transfer orphan (bookingId NULL) is unmatched,
 * persisted verbatim to `PaymentEvent.unmatchedReason`. ACCOUNT_MISMATCH (Issue 334)
 * is unactionable — "not our money" — so it is excluded from the admin actionable
 * orphan count and surfaced in its own tile; the others are human-reconcilable.
 * Shared so the producer (webhook route) and the consumers (getFailureAlerts count +
 * exclusion) can never drift on the literal — a typo in either would silently
 * reintroduce the ratchet this alerting set out to remove.
 */
export const UNMATCHED_REASON = {
  ACCOUNT_MISMATCH: 'account_mismatch',
  NO_BOOKING_REF: 'no_booking_ref_in_memo',
  BOOKING_NOT_FOUND: 'booking_not_found',
} as const;

/**
 * Bug B: persist an ORPHAN PaymentEvent (bookingId NULL) for a validated inbound
 * payment that could not be resolved to a booking.
 *
 * Two callers, both bank_transfer: the webhook route's `no_booking_ref_in_memo`
 * short-circuit (the common case — a VN bank memo the customer never typed or the
 * bank mangled past recognition) and the `booking_not_found` branch below. Without
 * this row the money leaves no DB trace at all and the reconcile sweeper's
 * degraded match has nothing to work with.
 *
 * Idempotent via @@unique([adapter, providerTxnId]) — SePay retries a non-acked
 * delivery up to 7 times, and each retry must be a no-op here.
 *
 * NEVER throws. This is a diagnostic write on a path that has already decided to
 * ack 200; failing it would turn an unmatched-but-recorded transfer into an
 * unmatched-and-retried one, which is strictly worse.
 */
export async function recordUnmatchedPaymentEvent(input: {
  adapter: string;
  providerTxnId: string;
  rawBody: string;
  /**
   * #370: why the transfer is unmatched. Persisted so the admin actionable-orphan
   * count can exclude 'account_mismatch' (Issue 334 — not our money, never resolvable).
   */
  unmatchedReason: string;
}): Promise<void> {
  const { adapter, providerTxnId, rawBody, unmatchedReason } = input;
  try {
    await prisma.paymentEvent.create({
      data: { bookingId: null, adapter, providerTxnId, currency: 'VND', rawBody, unmatchedReason },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Already recorded (SePay retry) — nothing to do, and NO re-alert.
      return;
    }
    logger.error(
      { adapter, providerTxnId, err: err instanceof Error ? err.message : String(err) },
      'payment.webhook.unmatched_record_failed — money arrived with NO DB trace'
    );
    captureException(err, { adapter, providerTxnId, area: 'payment.webhook.unmatched' });
    return;
  }

  // The orphan row committed. Log + alert OUTSIDE the try so a throw in the
  // observability seam can't be misread by the catch above as a failed DB write
  // ("money arrived with NO DB trace") — the row IS on file at this point.
  logger.warn(
    { adapter, providerTxnId, unmatchedReason },
    'payment.webhook.unmatched_recorded — orphan PaymentEvent stored for reconciliation'
  );
  // #370: the alert half of #327. Emit on orphan CREATION (not just the dashboard
  // read) so the backlog is visible before an admin happens to open the tile. The
  // repo has no metrics util; captureMessage is the existing alerting seam (routes
  // to Sentry issue frequency when SENTRY_DSN is set, logs a fallback otherwise).
  // `account_mismatch` still emits — a spike of foreign-account transfers is itself
  // worth seeing — but it is excluded from the admin actionable COUNT and shown in
  // its own tile, which is a different signal.
  captureMessage('payment.webhook.orphan_created', {
    adapter,
    providerTxnId,
    unmatchedReason,
    area: 'payment.webhook.unmatched',
  });
}

export async function processPaymentWebhook(
  input: ProcessPaymentWebhookInput
): Promise<Response> {
  const { rawBody, gateway, adapter, proto, host } = input;

  const verifyResult = gateway.verifyWebhook(rawBody);

  logger.info(
    { adapter, sigOk: verifyResult.ok, reason: verifyResult.ok ? undefined : verifyResult.reason },
    'payment.webhook.verify'
  );

  if (!verifyResult.ok) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 });
  }

  const { event } = verifyResult;
  const { orderRef: bookingRef, providerTxnId, amount, currency, status } = event;

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    select: {
      id: true,
      bookingRef: true,
      confirmationToken: true,
      status: true,
      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,
      ticketCount: true,
      totalVnd: true,
      customPickupRequested: true,
      pickupDetail: true,
      boardingPoint: true,
      boardingTime: true,
      trip: {
        select: {
          departureAt: true,
          route: { select: { origin: true, destination: true } },
          bus: {
            select: {
              operator: {
                select: {
                  id: true,
                  legalName: true,
                  contactPhone: true,
                  notificationPhone: true,
                  contactEmail: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) {
    // Bug B: the money is real and already in the account — record it as an ORPHAN
    // PaymentEvent so the reconcile sweeper can degrade-match it, instead of leaving
    // zero DB trace. Scoped to bank_transfer: MoMo/VNPay/card orderRefs are ones we
    // generated and the PSP echoed back, so an unresolvable ref there is a genuinely
    // nonexistent booking, not a mistyped memo.
    if (adapter === 'bank_transfer' && status === 'paid') {
      await recordUnmatchedPaymentEvent({ adapter, providerTxnId, rawBody, unmatchedReason: UNMATCHED_REASON.BOOKING_NOT_FOUND });
    }
    // Don't leak existence — return 200 to prevent enumeration. Status, body and
    // headers are identical on every branch above and below, so recording the orphan
    // adds no new enumeration signal.
    logger.info({ adapter, bookingRef }, 'payment.webhook.booking_not_found — 200 no-op');
    return NextResponse.json({ message: 'ok' }, { status: 200 });
  }

  let paidBookingId: string | null = null;
  // Inline confirmation-email fast path: the ids of the customer + operator
  // NotificationLog rows enqueued in-tx below, so they can be dispatched immediately
  // post-commit (instant email) instead of waiting for the next dispatch cron tick.
  let customerNotifId: string | null = null;
  let operatorNotifId: string | null = null;
  // #569: overpay + oversold refund-outs are enqueued as durable RefundObligation rows
  // inside the paid tx below (was a captured box + best-effort after()).

  try {
    await prisma.$transaction(async (tx) => {
      // INSERT PaymentEvent — idempotent: @@unique([adapter, providerTxnId]).
      // providerTxnId + currency are non-PII reconciliation fields, intentionally
      // loggable (logger redact list reviewed — no new redaction needed).
      // Bug B: CLAIM BEFORE INSERT. Since orphan rows exist, this delivery may
      // already be on file unlinked — recorded when its ref didn't resolve, and
      // redelivered (SePay retries) or replayed now that the booking exists. Claiming
      // first turns that into a normal paid transition instead of a P2002 no-op.
      //
      // Claim-then-insert, NOT insert-then-recover: a unique violation aborts the
      // whole Postgres transaction, so a P2002 caught INSIDE this tx cannot be
      // recovered from — every subsequent statement fails with "current transaction
      // is aborted". The UPDATE is an indexed hit on @@unique([adapter, providerTxnId]).
      //
      // A row that is already LINKED does not match `bookingId: null`, so a genuine
      // duplicate delivery still falls through to the create → P2002 → outer catch
      // → 200 idempotent no-op, exactly as before.
      const claimedOrphan = await tx.paymentEvent.updateMany({
        where: { adapter, providerTxnId, bookingId: null },
        data: { bookingId: booking.id },
      });
      if (claimedOrphan.count > 0) {
        logger.info(
          { adapter, bookingRef, providerTxnId },
          'payment.webhook.orphan_claimed — previously unmatched payment linked to booking'
        );
      } else {
        await tx.paymentEvent.create({
          data: {
            bookingId: booking.id,
            adapter,
            providerTxnId,
            currency,
            rawBody, // stored for audit; never logged
          },
        });
      }

      if (status === 'paid' && currency !== 'VND') {
        // Currency guard (FIRST, before amount): the amount check is VND-denominated
        // by construction (S15#3). A non-VND success event cannot be amount-compared
        // safely, so do NOT transition. PaymentEvent row already recorded for audit;
        // booking stays awaiting_payment for the reconciliation sweeper to resolve.
        logger.warn(
          { adapter, bookingRef, currency },
          'payment.webhook.currency_mismatch — non-VND success event rejected, not marked paid'
        );
      } else if (status === 'paid' && amount < booking.totalVnd) {
        // Money-loss guard: a paid event that UNDERPAYS must NOT transition the
        // booking to paid. The PaymentEvent row is already recorded above for audit;
        // the booking is left in awaiting_payment for the reconciliation sweeper.
        logger.warn(
          { adapter, bookingRef, expectedVnd: booking.totalVnd, receivedVnd: amount },
          'payment.webhook.amount_mismatch — underpaid paid event rejected, not marked paid'
        );
      } else if (status === 'paid') {
        if (amount > booking.totalVnd) {
          // Overpayment: still mark paid, but the difference must NOT be silently kept.
          // Record the delta here; the refund-out rail (issue 051, ledger wave) consumes
          // this to refund the difference. VND-only by construction (S15#3).
          logger.warn(
            {
              adapter,
              bookingRef,
              expectedVnd: booking.totalVnd,
              receivedVnd: amount,
              overpayVnd: amount - booking.totalVnd,
            },
            'payment.webhook.overpaid — marked paid, overpay delta flagged for refund-out'
          );
        }
        // Success: monotonic guarded transition. The legal predecessor set is
        // derived from the single-source transition map (issue 034), never from
        // re-typed `status = 'awaiting_payment'` literals. Shared with the
        // reconciliation sweeper via applyPaidStatusTransition (issue 095) so the
        // two paid paths can never drift.
        const { updated, refundTriggered } = await applyPaidStatusTransition(tx, booking.id, providerTxnId);

        if (updated > 0) {
          // Issue 031: no phone-match attach here. A signed-in buyer already has
          // Booking.customerId stamped at initiate; a guest stays unlinked and
          // claims via OTP-proven register backfill. The old phone-match attach
          // was spoofable (any typed phone matching an account would link).
          //
          // Issue 100: don't fire booking_paid when the booking was immediately
          // refunded due to oversell — its final state is `refunded`, not `paid`.
          if (!refundTriggered) {
            paidBookingId = booking.id; // funnel booking_paid fired post-commit
          }

          // Issue 051: if this paid event OVERPAID, schedule a refund-out of the
          // difference. Captured ONLY inside the updated>0 branch (the FIRST and
          // only paid transition) so a replayed IPN never re-refunds. Executed
          // post-commit in after() — best-effort + logged, NOT inside this tx.
          // #515: fire even when oversold. The oversold path (below) refunds only
          // the FARE (totalVnd, operator clawback); the overpay delta is platform
          // float (reason 'overpay_difference' → no operator clawback), so BOTH
          // refunds must run for the rider to get back the full `amount` they paid.
          // Previously `&& !refundTriggered` skipped this, silently keeping the delta.
          if (amount > booking.totalVnd) {
            // #569: enqueue the overpay refund-out durably INSIDE the paid tx (was a
            // best-effort after()). Commits with the paid transition; the process-refunds
            // cron drives it. idempotencyKey unique → no double-enqueue on a replayed IPN.
            await tx.refundObligation.create({
              data: {
                bookingId: booking.id,
                amountMinor: amount - booking.totalVnd,
                reason: 'overpay_difference',
                idempotencyKey: `overpay:${booking.id}:${providerTxnId}`,
                providerTxnId,
              },
            });
          }

          // ── Issue 049: ledger entries at booking-paid ───────────────────
          // Two double-entry rows for this first-and-only paid transition:
          //   booking_credit = +gross  (full fare credited to the operator)
          //   platform_fee   = −fee    (the platform's cut, its OWN entry —
          //                             NOT folded into the credit, per AC).
          // Operator balance = SUM = gross − fee = net.
          //
          // Idempotency: this whole block runs ONLY when `updated > 0`, i.e. the
          // FIRST time the booking flips to paid. A replayed paid IPN finds the
          // row already advanced → guarded UPDATE matches 0 rows → updated=0 →
          // this block is skipped → no duplicate entries. The unique
          // sourceEventId on each entry is belt-and-suspenders on top of that.
          //
          // Written inside the SAME `tx` as the status update so a rolled-back
          // payment transaction never leaves orphan ledger rows. Legacy
          // Payout.platformFee coexists untouched (balance derivation migrates
          // in slice 050) — this slice ONLY adds the two entries. Shared with the
          // reconciliation sweeper via appendBookingPaidLedger (issue 095).
          const operatorId = booking.trip.bus.operator.id;
          await appendBookingPaidLedger(tx, {
            operatorId,
            bookingId: booking.id,
            grossVnd: booking.totalVnd,
            now: new Date(),
            // Issue 123: 'vnpay' additionally writes a platform-float psp_fee entry.
            adapter,
            // A-5: oversold → no platform fee; booking_credit offsets the oversold
            // refund_debit so the operator nets 0 (not −fee).
            skipPlatformFee: refundTriggered,
          });

          // Issue 100: for an oversold booking, the booking is already `refunded`
          // in the DB. Capture the refund details for the post-commit after().
          // Skip paid notifications — the booking was never durably paid.
          if (refundTriggered) {
            // #569: enqueue the oversold full-fare refund-out durably in-tx (was after()).
            await tx.refundObligation.create({
              data: {
                bookingId: booking.id,
                amountMinor: booking.totalVnd,
                reason: 'oversold_race',
                idempotencyKey: `oversold:${booking.id}:${providerTxnId}`,
                providerTxnId,
              },
            });
          } else {
            const operator = booking.trip.bus.operator;
            const operatorRecipient = operator.notificationPhone ?? operator.contactPhone;
            const routeLabel = `${booking.trip.route.origin} - ${booking.trip.route.destination}`;
            const departureLabel = formatDepartureForSms(booking.trip.departureAt);
            const baseUrl = host ? `${proto}://${host}` : '';
            const confirmationUrl = baseUrl
              ? `${baseUrl}/booking/confirmation/${booking.confirmationToken}`
              : booking.confirmationToken;

            const customerPayload: Record<string, string | number> = {
              ticketCount: booking.ticketCount,
              route: routeLabel,
              departureAt: departureLabel,
              bookingRef: booking.bookingRef,
              confirmationUrl,
            };
            // Chosen boarding point — tell the rider where to board in the first
            // "you're confirmed" message, not only later via the ticket email.
            if (booking.boardingPoint) {
              customerPayload.boardingPoint = booking.boardingPoint;
              if (booking.boardingTime) customerPayload.boardingTime = booking.boardingTime;
            }
            const operatorPayload: Record<string, string | number> = {
              ticketCount: booking.ticketCount,
              route: routeLabel,
              departureAt: departureLabel,
              bookingRef: booking.bookingRef,
              buyerPhone: booking.buyerPhone,
            };
            // Chosen boarding point along the route — the driver needs to know which of the
            // ~10 stops this passenger boards at. Renderer appends a "Don tai" line.
            if (booking.boardingPoint) {
              operatorPayload.boardingPoint = booking.boardingPoint;
              if (booking.boardingTime) operatorPayload.boardingTime = booking.boardingTime;
            }
            // Issue 111: fold the custom-pickup request into the SAME operator SMS (no second
            // message — avoids notification spam). The renderer appends a "Diem don rieng" line.
            if (booking.customPickupRequested && booking.pickupDetail) {
              operatorPayload.customPickup = booking.pickupDetail;
            }

            // Bug B / email-first: the customer confirmation goes by EMAIL (bank
            // transfer is the live rail and email is the customer channel). buyerEmail
            // is required at booking (Issue 042); fall back to SMS only for legacy
            // pre-042 rows with a null email.
            const customerChannel = booking.buyerEmail ? 'email' : 'sms';
            const customerRecipient = booking.buyerEmail ?? booking.buyerPhone;

            // Issue 058: enqueue status='pending'. Enqueued IN-TX (via `tx`) so the
            // rows commit atomically with the paid transition — a rolled-back booking
            // never leaves an orphan "paid" notification. Their ids are captured and
            // dispatched inline post-commit (instant email); the dispatch-notifications
            // cron remains the durable retry path for anything not delivered inline.
            // The pre-rendered body is stored in `payload` so the dispatcher
            // re-presents it without re-rendering.
            const [customerNotif, operatorNotif] = await Promise.all([
              createNotificationLog({
                bookingId: booking.id,
                template: 'customerBookingPaid',
                channel: customerChannel,
                recipient: customerRecipient,
                payload: renderTemplate('customerBookingPaid', customerPayload),
                status: 'pending',
              }, tx),
              // Issue 328: route the operator notice to EMAIL — SMS is stubbed under
              // NOTIFY_STUB, so operators were blind under the email-first launch.
              // ONE row per (bookingId, template) — NotificationLog is unique on that
              // pair, so a second same-template row would P2002. Mirrors the customer
              // notice channel selection above. Falls back to SMS if no contactEmail.
              createNotificationLog({
                bookingId: booking.id,
                template: 'operatorNewBooking',
                channel: operator.contactEmail ? 'email' : 'sms',
                recipient: operator.contactEmail ?? operatorRecipient,
                payload: renderTemplate('operatorNewBooking', operatorPayload),
                status: 'pending',
              }, tx),
            ]);
            customerNotifId = customerNotif.id;
            operatorNotifId = operatorNotif.id;
          }
        }
        if ((updated as number) === 0) {
          // Current row is not a legal predecessor of paid (replay or already
          // advanced). Illegal/duplicate move logged, NOT thrown — webhook still
          // returns 200 (issue 034 AC4); the monotonic guard prevents any regress.
          logger.info(
            { adapter, bookingRef, currentStatus: booking.status, target: 'paid' },
            'payment.webhook.transition_skipped — not a legal predecessor, no-op'
          );
        }
      } else if (status === 'failed') {
        // Failure: monotonic guarded transition; predecessors from the same map.
        const failedPredecessors = Prisma.join(
          legalPredecessors('payment_failed_expired').map(
            (s) => Prisma.sql`${s}::"BookingStatus"`
          )
        );
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'payment_failed_expired'::"BookingStatus"
          WHERE id = ${booking.id}::uuid
            AND status IN (${failedPredecessors})
        `);
      } else if (status === 'pending') {
        logger.info(
          { adapter, bookingRef },
          'payment.webhook.pending — no status transition'
        );
      }
      // Unknown status: PaymentEvent row recorded, no transition
    });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // @@unique([adapter, providerTxnId]) conflict — duplicate IPN delivery
      logger.info({ adapter, bookingRef, providerTxnId }, 'payment.webhook.duplicate_ipn — 200 idempotent');
      return NextResponse.json({ message: 'ok' }, { status: 200 });
    }
    // Issue 061 (AC5): alert on a non-idempotent webhook failure before rethrow.
    // Additive + non-throwing; the rethrow + status write are unchanged.
    captureException(err, { adapter, bookingRef, area: 'payment.webhook' });
    throw err;
  }

  // Funnel: booking_paid (post-commit, fire-and-forget). The webhook has no user
  // cookie, so the session is resolved from the earlier payment_initiated event.
  if (paidBookingId) {
    const bid = paidBookingId;
    // Issue 063: enrich the booking_paid event context with the gross amount so
    // GMV is ALSO derivable from the event stream, not only the Booking table.
    // Fire-and-forget — mirrors the existing track() call, adds no awaited DB work.
    const gmvVnd = booking.totalVnd;
    void sessionIdForBooking(bid).then((sessionId) =>
      track('booking_paid', {
        sessionId,
        bookingId: bid,
        context: { adapter, amount: gmvVnd, gmvVnd },
      })
    );
  }

  // Inline confirmation delivery: send the customer + operator emails NOW (post-commit,
  // awaited) so a paid booking is confirmed in seconds instead of at the next dispatch
  // cron tick. Best-effort: dispatchOne atomically claims each row (a concurrent cron
  // tick can never also send it) and is wrapped so it NEVER throws — anything not
  // delivered here stays pending/failed for the dispatch-notifications cron to retry.
  // Gated on paidBookingId, which is only set inside the committed paid transition, so a
  // rolled-back booking never emits a confirmation.
  if (paidBookingId && (customerNotifId || operatorNotifId)) {
    await Promise.all(
      ([customerNotifId, operatorNotifId] as (string | null)[])
        .filter((id): id is string => id !== null)
        .map((notifId) =>
          dispatchOne(notifId).catch((err) => {
            logger.warn({ notificationId: notifId, err }, 'notify.inline.failed');
            captureException(err, { area: 'notification.inline', notificationId: notifId });
          })
        )
    );
  }

  // #569: overpay (Issue 051) + oversold (Issue 100) refund-outs are no longer fired
  // best-effort in after(). They are enqueued as durable RefundObligation rows INSIDE the
  // paid transaction above (committing atomically with the paid/refunded transition) and
  // driven by the process-refunds cron with backoff. refundOut stays ledger-idempotent.

  // Issue 058: notifications are NOT dispatched in-process here anymore. The two
  // NotificationLog rows above are enqueued status='pending'; the
  // /api/cron/dispatch-notifications cron (lib/notifications/dispatchNotifications)
  // is the single delivery path, with retry + exponential backoff. Decoupling
  // the send from the webhook means a delivery failure never affects the paid
  // booking — it only updates the NotificationLog row (AC5).

  return NextResponse.json({ message: 'ok' }, { status: 200 });
}
