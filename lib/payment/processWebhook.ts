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
 *      - Else guarded UPDATE Booking status → paid_operator_notified
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
import { prisma } from '@/lib/db/client';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { sendSms, renderTemplate, type SmsTemplate } from '@/lib/notifications/esms';
import { logger } from '@/lib/logger';
import { track, sessionIdForBooking } from '@/lib/analytics/track';
import type { PaymentGateway } from './gateway';

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

interface PendingDispatch {
  logId: string;
  to: string;
  template: SmsTemplate;
  payload: Record<string, string | number>;
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

  const pending: PendingDispatch[] = [];
  let paidBookingId: string | null = null;

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
        // Success: guarded status transition
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'paid_operator_notified'::"BookingStatus",
              "paymentExternalRef" = ${providerTxnId}
          WHERE id = ${booking.id}::uuid
            AND status = 'awaiting_payment'::"BookingStatus"
        `);

        if ((updated as number) > 0) {
          // Issue 031: no phone-match attach here. A signed-in buyer already has
          // Booking.customerId stamped at initiate; a guest stays unlinked and
          // claims via OTP-proven register backfill. The old phone-match attach
          // was spoofable (any typed phone matching an account would link).
          paidBookingId = booking.id; // funnel booking_paid fired post-commit

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

          const [custLog, opLog] = await Promise.all([
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

          pending.push(
            {
              logId: custLog.id,
              to: booking.buyerPhone,
              template: 'customerBookingPaid',
              payload: customerPayload,
            },
            {
              logId: opLog.id,
              to: operatorRecipient,
              template: 'operatorNewBooking',
              payload: operatorPayload,
            }
          );
        }
        // If updated === 0, already transitioned (replay/duplicate) — no-op
      } else if (status === 'failed') {
        // Failure: guarded status transition (only from awaiting_payment)
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'payment_failed_expired'::"BookingStatus"
          WHERE id = ${booking.id}::uuid
            AND status = 'awaiting_payment'::"BookingStatus"
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
    throw err;
  }

  // Funnel: booking_paid (post-commit, fire-and-forget). The webhook has no user
  // cookie, so the session is resolved from the earlier payment_initiated event.
  if (paidBookingId) {
    const bid = paidBookingId;
    void sessionIdForBooking(bid).then((sessionId) =>
      track('booking_paid', { sessionId, bookingId: bid, context: { adapter } })
    );
  }

  // Schedule SMS dispatch after response (non-blocking)
  if (pending.length > 0) {
    after(async () => {
      for (const job of pending) {
        try {
          const result = await sendSms({
            to: job.to,
            template: job.template,
            payload: job.payload,
          });
          await prisma.notificationLog.update({
            where: { id: job.logId },
            data: {
              status: result.ok ? 'sent' : 'failed',
              externalRef: result.externalRef ?? null,
              sentAt: result.ok ? new Date() : null,
            },
          });
        } catch (smsErr) {
          logger.error(
            { err: smsErr, adapter, bookingRef, template: job.template, logId: job.logId },
            'payment.webhook.notification.dispatch.error'
          );
          await prisma.notificationLog
            .update({ where: { id: job.logId }, data: { status: 'failed' } })
            .catch(() => {});
        }
      }
    });
  }

  return NextResponse.json({ message: 'ok' }, { status: 200 });
}
