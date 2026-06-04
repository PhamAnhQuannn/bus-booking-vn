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
 * Transaction logic:
 *   1. INSERT PaymentEvent (idempotent: P2002 conflict → 200 no-op)
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

import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { renderTemplate } from '@/lib/notification';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import { track, sessionIdForBooking } from '@/lib/analytics';
import type { PaymentGateway } from './gateway';
import { legalPredecessors } from '@/lib/booking/transitions';
import { refundOut } from '@/lib/ledger';
import {
  applyPaidStatusTransition,
  appendBookingPaidLedger,
} from './applyPaidTransition';

export interface ProcessPaymentWebhookInput {
  rawBody: string;
  gateway: PaymentGateway;
  /** Gateway label stored on PaymentEvent.adapter: 'momo' | 'zalopay' | 'card'. */
  adapter: string;
  /** x-forwarded-proto header (for building the confirmation URL in SMS). */
  proto: string;
  /** host header (for building the confirmation URL in SMS). */
  host: string;
}

/** Issue 051: captured overpay info, refunded post-commit in after(). */
interface OverpayRefund {
  bookingId: string;
  overpayVnd: number;
  providerTxnId: string;
}

/** Issue 100: oversold booking — paid then immediately refunded inside the tx. */
interface OversoldRefund {
  bookingId: string;
  totalVnd: number;
  providerTxnId: string;
}

function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
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
      ticketCount: true,
      totalVnd: true,
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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) {
    // Don't leak existence — return 200 to prevent enumeration
    logger.info({ adapter, bookingRef }, 'payment.webhook.booking_not_found — 200 no-op');
    return NextResponse.json({ message: 'ok' }, { status: 200 });
  }

  let paidBookingId: string | null = null;
  // Issue 051: overpay refund-out captured here, executed AFTER the paid tx
  // commits (refundOut opens its own tx + reads the committed paid state).
  const overpayRefundBox: { value: OverpayRefund | null } = { value: null };
  // Issue 100: oversold refund-out captured here, executed AFTER the paid tx
  // commits. The booking is already in `refunded` state at that point.
  const oversoldRefundBox: { value: OversoldRefund | null } = { value: null };

  try {
    await prisma.$transaction(async (tx) => {
      // INSERT PaymentEvent — idempotent: @@unique([adapter, providerTxnId]).
      // providerTxnId + currency are non-PII reconciliation fields, intentionally
      // loggable (logger redact list reviewed — no new redaction needed).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).paymentEvent.create({
        data: {
          bookingId: booking.id,
          adapter,
          providerTxnId,
          currency,
          rawBody, // stored for audit; never logged
        },
      });

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
          // Issue 100: skip overpay handling for an oversold booking (the entire
          // amount is refunded via the oversoldRefundBox path below).
          if (amount > booking.totalVnd && !refundTriggered) {
            overpayRefundBox.value = {
              bookingId: booking.id,
              overpayVnd: amount - booking.totalVnd,
              providerTxnId,
            };
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
          });

          // Issue 100: for an oversold booking, the booking is already `refunded`
          // in the DB. Capture the refund details for the post-commit after().
          // Skip paid notifications — the booking was never durably paid.
          if (refundTriggered) {
            oversoldRefundBox.value = {
              bookingId: booking.id,
              totalVnd: booking.totalVnd,
              providerTxnId,
            };
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
            const operatorPayload: Record<string, string | number> = {
              ticketCount: booking.ticketCount,
              route: routeLabel,
              departureAt: departureLabel,
              bookingRef: booking.bookingRef,
              buyerPhone: booking.buyerPhone,
            };

            // Issue 058: enqueue ONLY (status='pending'). No in-process send —
            // the dispatch-notifications cron delivers these with retry/backoff.
            // The pre-rendered body is stored in `payload` so the dispatcher
            // re-presents it without re-rendering.
            await Promise.all([
              createNotificationLog({
                bookingId: booking.id,
                template: 'customerBookingPaid',
                recipient: booking.buyerPhone,
                payload: renderTemplate('customerBookingPaid', customerPayload),
                status: 'pending',
              }),
              createNotificationLog({
                bookingId: booking.id,
                template: 'operatorNewBooking',
                recipient: operatorRecipient,
                payload: renderTemplate('operatorNewBooking', operatorPayload),
                status: 'pending',
              }),
            ]);
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

  // Issue 051: refund the overpay difference AFTER the paid tx committed. In
  // after() so it never blocks the 200 IPN ack and never runs inside the status
  // tx (refundOut opens its own tx and reads the committed paid booking).
  // Best-effort + logged: a refund failure must not fail the webhook (the paid
  // transition already succeeded). Idempotency key is tied to the overpay event
  // (`overpay:<bookingId>:<providerTxnId>`), distinct from the inbound payment.
  if (overpayRefundBox.value) {
    const ovr = overpayRefundBox.value;
    after(async () => {
      try {
        await refundOut({
          bookingId: ovr.bookingId,
          amountMinor: ovr.overpayVnd,
          reason: 'overpay_difference',
          idempotencyKey: `overpay:${ovr.bookingId}:${ovr.providerTxnId}`,
        });
      } catch (refundErr) {
        logger.error(
          { err: refundErr, adapter, bookingRef, bookingId: ovr.bookingId },
          'payment.webhook.overpay_refund.error — booking stays paid, refund needs retry'
        );
      }
    });
  }

  // Issue 100: refund the full fare AFTER the paid tx committed for oversold
  // bookings. The booking is already in `refunded` state in the DB. Best-effort
  // + logged: a ledger failure must not fail the webhook IPN ack.
  // Idempotency key: `oversold:<bookingId>:<providerTxnId>`.
  if (oversoldRefundBox.value) {
    const ovs = oversoldRefundBox.value;
    after(async () => {
      try {
        await refundOut({
          bookingId: ovs.bookingId,
          amountMinor: ovs.totalVnd,
          reason: 'oversold_race',
          idempotencyKey: `oversold:${ovs.bookingId}:${ovs.providerTxnId}`,
        });
      } catch (refundErr) {
        logger.error(
          { err: refundErr, adapter, bookingRef, bookingId: ovs.bookingId },
          'payment.webhook.oversold_refund.error — booking refunded, ledger entries need retry'
        );
      }
    });
  }

  // Issue 058: notifications are NOT dispatched in-process here anymore. The two
  // NotificationLog rows above are enqueued status='pending'; the
  // /api/cron/dispatch-notifications cron (lib/notifications/dispatchNotifications)
  // is the single delivery path, with retry + exponential backoff. Decoupling
  // the send from the webhook means a delivery failure never affects the paid
  // booking — it only updates the NotificationLog row (AC5).

  return NextResponse.json({ message: 'ok' }, { status: 200 });
}
