/**
 * POST /api/payments/momo/webhook — MoMo IPN receiver.
 *
 * Security: HMAC-SHA256 signature verified via getMomoAdapter().verifyWebhook()
 * before any DB writes. Idempotent: PaymentEvent @@unique([adapter, externalRef])
 * prevents duplicate processing on replay.
 *
 * PII policy: NEVER log buyer phone, raw webhook body, or secret key.
 * Log only bookingRef, event type, sig-verify outcome.
 *
 * Transaction logic:
 *   1. INSERT PaymentEvent (idempotent: P2002 conflict → 200 no-op)
 *   2. If resultCode === 0 (success):
 *      - Guarded UPDATE Booking status → paid_operator_notified
 *        (WHERE status='awaiting_payment' — safe for replays)
 *      - If update count > 0: INSERT 2 NotificationLog rows (pending)
 *   3. If resultCode in failure list: status → payment_failed_expired
 *   4. If resultCode 9000/1000 (pending): no status transition
 *
 * After transaction: schedule SMS dispatch via after() (same pattern as cash).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { Prisma } from '@prisma/client';
import { getMomoAdapter } from '@/lib/payment/momo';
import { prisma } from '@/lib/db/client';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { sendSms, renderTemplate, type SmsTemplate } from '@/lib/notifications/esms';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';

/** MoMo resultCodes that mean payment definitively failed (per Issue 004 spec). */
const FAILURE_RESULT_CODES = new Set([1001, 1002, 1003, 1004, 1005, 4100]);

/** MoMo resultCodes that indicate pending / processing (no status transition yet). */
const PENDING_RESULT_CODES = new Set([9000, 1000]);

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

async function handler(req: NextRequest): Promise<Response> {
  // Read raw body first — needed for HMAC verification
  const rawBody = await req.text();

  const adapter = getMomoAdapter();
  const verifyResult = adapter.verifyWebhook(rawBody);

  logger.info(
    { sigOk: verifyResult.ok, reason: verifyResult.ok ? undefined : verifyResult.reason },
    'momo.webhook.verify'
  );

  if (!verifyResult.ok) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 });
  }

  const { parsed } = verifyResult;
  const { orderId: bookingRef, transId, resultCode } = parsed;

  // Find booking by bookingRef (orderId sent to MoMo = bookingRef)
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
    logger.info({ bookingRef }, 'momo.webhook.booking_not_found — 200 no-op');
    return NextResponse.json({ message: 'ok' }, { status: 200 });
  }

  const pending: PendingDispatch[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      // INSERT PaymentEvent — idempotent: @@unique([adapter, externalRef])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).paymentEvent.create({
        data: {
          bookingId: booking.id,
          adapter: 'momo',
          externalRef: String(transId),
          rawBody, // stored for audit; never logged
          resultCode,
        },
      });

      // Transition logic based on resultCode
      if (resultCode === 0) {
        // Success: guarded status transition
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'paid_operator_notified'::"BookingStatus",
              "paymentExternalRef" = ${String(transId)}
          WHERE id = ${booking.id}::uuid
            AND status = 'awaiting_payment'::"BookingStatus"
        `);

        if ((updated as number) > 0) {
          // Newly transitioned — seed notification rows
          const operator = booking.trip.bus.operator;
          const operatorRecipient = operator.notificationPhone ?? operator.contactPhone;
          const routeLabel = `${booking.trip.route.origin} - ${booking.trip.route.destination}`;
          const departureLabel = formatDepartureForSms(booking.trip.departureAt);
          // We use the confirmationToken as the URL key for the customer SMS.
          // The webhook handler doesn't have a baseUrl; derive from x-forwarded-proto
          // + host headers to build a full URL.
          const proto = req.headers.get('x-forwarded-proto') ?? 'https';
          const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
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
      } else if (FAILURE_RESULT_CODES.has(resultCode)) {
        // Failure: guarded status transition (only from awaiting_payment)
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Booking"
          SET status = 'payment_failed_expired'::"BookingStatus"
          WHERE id = ${booking.id}::uuid
            AND status = 'awaiting_payment'::"BookingStatus"
        `);
      } else if (PENDING_RESULT_CODES.has(resultCode)) {
        // Pending/processing: no transition — PaymentEvent row recorded, nothing else
        logger.info(
          { bookingRef, resultCode },
          'momo.webhook.pending_resultcode — no status transition'
        );
      }
      // Unknown resultCode: log, PaymentEvent row recorded, no transition
    });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // @@unique([adapter, externalRef]) conflict — duplicate IPN delivery
      logger.info({ bookingRef, transId }, 'momo.webhook.duplicate_ipn — 200 idempotent');
      return NextResponse.json({ message: 'ok' }, { status: 200 });
    }
    throw err;
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
            { err: smsErr, bookingRef, template: job.template, logId: job.logId },
            'momo.webhook.notification.dispatch.error'
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

export const POST = withErrorHandler(handler);
