/**
 * processPaymentWebhook — gateway-agnostic IPN handler shared by every
 * payment receiver route (momo, zalopay, card).
 *
 * Security: HMAC signature verified via the injected gateway.verifyWebhook()
 * before any DB writes. Idempotent: PaymentEvent @@unique([adapter, externalRef])
 * prevents duplicate processing on replay.
 *
 * PII policy: NEVER log buyer phone, raw webhook body, or secret key.
 * Log only bookingRef, event type, sig-verify outcome.
 *
 * Transaction logic:
 *   1. INSERT PaymentEvent (idempotent: P2002 conflict → 200 no-op)
 *   2. If resultCode === 0 (success):
 *      - Amount verify (money-loss guard): if IPN amount < booking.totalVnd, REJECT —
 *        log amount_mismatch, leave booking awaiting_payment, no paid transition.
 *      - Else guarded UPDATE Booking status → paid_operator_notified
 *        (WHERE status='awaiting_payment' — safe for replays)
 *      - If update count > 0: attach guest by phone + INSERT 2 NotificationLog
 *   3. If resultCode in failureResultCodes: status → payment_failed_expired
 *   4. If resultCode in pendingResultCodes: no status transition
 *
 * After transaction: schedule SMS dispatch via after() (non-blocking).
 *
 * Each gateway route passes its OWN failure/pending result-code sets
 * (sourced from that gateway's spec verbatim) — never inferred here.
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
  /** resultCodes meaning payment definitively failed (gateway-spec verbatim). */
  failureResultCodes: Set<number>;
  /** resultCodes meaning pending / processing (no status transition yet). */
  pendingResultCodes: Set<number>;
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
  const { rawBody, gateway, adapter, proto, host, failureResultCodes, pendingResultCodes } =
    input;

  const verifyResult = gateway.verifyWebhook(rawBody);

  logger.info(
    { adapter, sigOk: verifyResult.ok, reason: verifyResult.ok ? undefined : verifyResult.reason },
    'payment.webhook.verify'
  );

  if (!verifyResult.ok) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 });
  }

  const { parsed } = verifyResult;
  const { orderId: bookingRef, transId, resultCode } = parsed;

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
      // INSERT PaymentEvent — idempotent: @@unique([adapter, externalRef])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).paymentEvent.create({
        data: {
          bookingId: booking.id,
          adapter,
          externalRef: String(transId),
          rawBody, // stored for audit; never logged
          resultCode,
        },
      });

      if (resultCode === 0 && parsed.amount < booking.totalVnd) {
        // Money-loss guard: a success-code IPN that UNDERPAYS must NOT transition
        // the booking to paid. VND-only by construction (S15#3), so the amount is
        // the server-side check (there is no currency field on the canonical event).
        // The PaymentEvent row is already recorded above for audit; the booking is
        // left in awaiting_payment for the reconciliation sweeper to resolve.
        logger.warn(
          { adapter, bookingRef, expectedVnd: booking.totalVnd, receivedVnd: parsed.amount },
          'payment.webhook.amount_mismatch — underpaid success IPN rejected, not marked paid'
        );
      } else if (resultCode === 0) {
        if (parsed.amount > booking.totalVnd) {
          // Overpayment: still mark paid, but the difference must NOT be silently kept.
          // Record the delta here; the refund-out rail (issue 051, ledger wave) consumes
          // this to refund the difference. VND-only by construction (S15#3).
          logger.warn(
            {
              adapter,
              bookingRef,
              expectedVnd: booking.totalVnd,
              receivedVnd: parsed.amount,
              overpayVnd: parsed.amount - booking.totalVnd,
            },
            'payment.webhook.overpaid — marked paid, overpay delta flagged for refund-out'
          );
        }
        // Success: guarded status transition
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'paid_operator_notified'::"BookingStatus",
              "paymentExternalRef" = ${String(transId)}
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
      } else if (failureResultCodes.has(resultCode)) {
        // Failure: guarded status transition (only from awaiting_payment)
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'payment_failed_expired'::"BookingStatus"
          WHERE id = ${booking.id}::uuid
            AND status = 'awaiting_payment'::"BookingStatus"
        `);
      } else if (pendingResultCodes.has(resultCode)) {
        logger.info(
          { adapter, bookingRef, resultCode },
          'payment.webhook.pending_resultcode — no status transition'
        );
      }
      // Unknown resultCode: PaymentEvent row recorded, no transition
    });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // @@unique([adapter, externalRef]) conflict — duplicate IPN delivery
      logger.info({ adapter, bookingRef, transId }, 'payment.webhook.duplicate_ipn — 200 idempotent');
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
