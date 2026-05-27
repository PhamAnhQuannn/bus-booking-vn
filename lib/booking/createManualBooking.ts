/**
 * createManualBooking — operator walk-in / phone-in booking (Issue 015).
 *
 * Flow:
 *   1. Acquire pg_advisory_xact_lock(hashtext('hold:' || tripId)) — same key
 *      as createHold(), so manual bookings and online holds are serialised
 *      against each other on a per-trip basis.
 *   2. SELECT ... FOR UPDATE on Trip filtered by operatorId (tenant isolation
 *      + TOCTOU guard — Issue 011 rule).
 *   3. State gates: status='scheduled' AND departureAt > NOW().
 *      salesClosed is intentionally BYPASSED for operator walk-in/phone-in.
 *      // Operator override: salesClosed intentionally bypassed for walk-in/phone-in
 *   4. Capacity recompute inside the lock:
 *      capacity - blockedSeats - active-hold sum - confirmed-booking sum >= ticketCount
 *   5. Raw INSERT into Booking with:
 *        isManual=true, holdId=NULL, customerId=NULL, pickupPointId=NULL
 *        paymentMethod = input.paymentMethod ('cash' or 'paid' → maps to DB enum)
 *        status = 'paid_operator_notified' (paid) | 'pending_cash_payment' (cash)
 *        contactStatus = 'pending'::"ContactStatus"
 *        totalVnd = trip.price * ticketCount
 *      NO updatedAt column — Booking model has no @updatedAt (Issue 013 trap).
 *   6. Returns discriminated result; afterFn seeds NotificationLog rows and
 *      dispatches SMS post-response.
 *
 * // I7-exempt: operator is price authority for their own trips — totalVnd is
 * // derived server-side from trip.price, not from the request body.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { generateBookingRef, BOOKING_REF_REGEX } from '@/lib/booking/bookingRef';
import { generateConfirmationToken } from '@/lib/booking/confirmationToken';
import { attachGuestBookingByPhone } from '@/lib/booking/attachGuestBookingByPhone';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { sendSms, renderTemplate } from '@/lib/notifications/esms';
import { logger } from '@/lib/logger';
import type { SmsTemplate } from '@/lib/notifications/esms';

const MAX_REF_ATTEMPTS = 5;

export type ManualBookingErrorReason =
  | 'not_found'
  | 'trip_not_bookable'
  | 'sold_out'
  | 'ref_collision';

export interface ManualBookingInput {
  tripId: string;
  operatorId: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  paymentMethod: 'paid' | 'cash';
}

export interface ManualBookingRow {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  tripId: string;
  holdId: null;
  customerId: null;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: 'cash';
  status: 'paid_operator_notified' | 'pending_cash_payment';
  isManual: boolean;
  createdAt: Date;
}

export type CreateManualBookingResult =
  | { ok: true; booking: ManualBookingRow; afterFn: () => Promise<void> }
  | { ok: false; reason: ManualBookingErrorReason };

function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export async function createManualBooking(
  input: ManualBookingInput
): Promise<CreateManualBookingResult> {
  const { tripId, operatorId, buyerName, buyerPhone, ticketCount, paymentMethod } = input;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const bookingId = uuidv7();
    const bookingRef = generateBookingRef();
    const confirmationToken = generateConfirmationToken();

    // Verify bookingRef matches expected regex (defensive, mirrors Issue 003 rule)
    if (!BOOKING_REF_REGEX.test(bookingRef)) {
      logger.error({ bookingRef }, 'createManualBooking: generated ref failed regex');
      continue;
    }

    try {
      type TripLockRow = {
        id: string;
        status: string;
        salesClosed: boolean;
        departureAt: Date;
        price: number;
        blockedSeats: number;
        capacity: number;
        routeOrigin: string;
        routeDestination: string;
        operatorContactPhone: string;
        operatorNotificationPhone: string | null;
      };

      type AvailRow = { available: number };

      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Advisory lock — same key as createHold() to serialise with online holds
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('hold:' || ${tripId}))`
        );

        // Step 2: SELECT FOR UPDATE with tenant isolation (operatorId guard)
        const tripRows = await tx.$queryRaw<TripLockRow[]>(
          Prisma.sql`
            SELECT
              t.id,
              t.status,
              t."salesClosed",
              t."departureAt",
              t.price,
              t."blockedSeats",
              b.capacity,
              r.origin AS "routeOrigin",
              r.destination AS "routeDestination",
              op."contactPhone" AS "operatorContactPhone",
              op."notificationPhone" AS "operatorNotificationPhone"
            FROM "Trip" t
            JOIN "Bus" b ON b.id = t."busId"
            JOIN "Route" r ON r.id = t."routeId"
            JOIN "Operator" op ON op.id = t."operatorId"
            WHERE t.id = ${tripId}
              AND t."operatorId" = ${operatorId}
            FOR UPDATE
          `
        );

        if (tripRows.length === 0) {
          return { kind: 'not_found' as const };
        }

        const trip = tripRows[0];

        // Step 3: State gates
        // salesClosed is intentionally BYPASSED — operator override for walk-in/phone-in
        if (trip.status !== 'scheduled') {
          return { kind: 'trip_not_bookable' as const };
        }
        if (trip.departureAt <= new Date()) {
          return { kind: 'trip_not_bookable' as const };
        }

        // Step 4: Capacity recompute inside lock
        const availRows = await tx.$queryRaw<AvailRow[]>(
          Prisma.sql`
            SELECT
              ${trip.capacity}::int
              - ${trip.blockedSeats}::int
              - COALESCE(
                  (SELECT SUM("ticketCount")
                   FROM "Hold"
                   WHERE "tripId" = ${tripId}
                     AND status = 'active'::"HoldStatus"
                     AND "expiresAt" > NOW()),
                  0
                )::int
              - COALESCE(
                  (SELECT SUM("ticketCount")
                   FROM "Booking"
                   WHERE "tripId" = ${tripId}
                     AND status IN (
                       'pending_cash_payment'::"BookingStatus",
                       'paid_operator_notified'::"BookingStatus",
                       'completed'::"BookingStatus"
                     )),
                  0
                )::int
              AS available
          `
        );

        const available = Number(availRows[0]?.available ?? 0);
        if (available < ticketCount) {
          return { kind: 'sold_out' as const };
        }

        // Step 5: Raw INSERT — NO updatedAt (Booking model has no @updatedAt)
        const bookingStatus =
          paymentMethod === 'paid'
            ? 'paid_operator_notified'
            : 'pending_cash_payment';

        const inserted = await tx.$queryRaw<ManualBookingRow[]>(
          Prisma.sql`
            INSERT INTO "Booking" (
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "customerId", "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "contactStatus", "createdAt"
            ) VALUES (
              ${bookingId}::uuid,
              ${bookingRef},
              ${confirmationToken},
              ${tripId},
              NULL,
              NULL,
              ${buyerName},
              ${buyerPhone},
              ${ticketCount}::int,
              ${trip.price * ticketCount}::int,
              'cash'::"PaymentMethod",
              ${bookingStatus}::"BookingStatus",
              true,
              'pending'::"ContactStatus",
              NOW()
            )
            RETURNING
              id, "bookingRef", "confirmationToken", "tripId", "holdId",
              "customerId", "buyerName", "buyerPhone", "ticketCount", "totalVnd",
              "paymentMethod", status, "isManual", "createdAt"
          `
        );

        // Issue 009: attach to a registered customer by phone. Only the 'paid'
        // path lands at paid_operator_notified; 'cash' attaches later at
        // recordCashCollected. customerId is NULL at insert, so this is the
        // first attach attempt.
        if (bookingStatus === 'paid_operator_notified') {
          await attachGuestBookingByPhone(tx, inserted[0].id, inserted[0].buyerPhone);
        }

        return {
          kind: 'ok' as const,
          booking: inserted[0],
          trip,
        };
      });

      if (result.kind === 'not_found') return { ok: false, reason: 'not_found' };
      if (result.kind === 'trip_not_bookable') return { ok: false, reason: 'trip_not_bookable' };
      if (result.kind === 'sold_out') return { ok: false, reason: 'sold_out' };

      // Success — build afterFn for post-response notification dispatch
      const { booking, trip } = result;
      const routeLabel = `${trip.routeOrigin} - ${trip.routeDestination}`;
      const departureLabel = formatDepartureForSms(trip.departureAt);
      const operatorRecipient = trip.operatorNotificationPhone ?? trip.operatorContactPhone;

      const customerTemplate = paymentMethod === 'paid' ? 'manualBookingPaid' : 'manualBookingCash';
      const customerPayload: Record<string, string | number> = {
        ticketCount,
        route: routeLabel,
        departureAt: departureLabel,
        bookingRef: booking.bookingRef,
        operatorPhone: operatorRecipient,
      };
      const operatorPayload: Record<string, string | number> = {
        ticketCount,
        route: routeLabel,
        departureAt: departureLabel,
        bookingRef: booking.bookingRef,
        buyerPhone,
      };

      // Seed 2 NotificationLog rows in 'pending' state synchronously
      const customerLog = await createNotificationLog({
        bookingId: booking.id,
        template: customerTemplate,
        recipient: buyerPhone,
        payload: renderTemplate(customerTemplate, customerPayload),
        status: 'pending',
      });

      const operatorLog = await createNotificationLog({
        bookingId: booking.id,
        template: 'operatorNewBooking',
        recipient: operatorRecipient,
        payload: renderTemplate('operatorNewBooking', operatorPayload),
        status: 'pending',
      });

      type DispatchJob = { logId: string; to: string; template: SmsTemplate; payload: Record<string, string | number> };
      const afterFn = async () => {
        const jobs: DispatchJob[] = [
          { logId: customerLog.id, to: buyerPhone, template: customerTemplate, payload: customerPayload },
          { logId: operatorLog.id, to: operatorRecipient, template: 'operatorNewBooking', payload: operatorPayload },
        ];
        for (const job of jobs) {
          try {
            const smsResult = await sendSms({
              to: job.to,
              template: job.template,
              payload: job.payload,
            });
            await prisma.notificationLog.update({
              where: { id: job.logId },
              data: {
                status: smsResult.ok ? 'sent' : 'failed',
                externalRef: smsResult.externalRef ?? null,
                sentAt: smsResult.ok ? new Date() : null,
              },
            });
          } catch (err) {
            logger.error(
              { err, bookingId: booking.id, template: job.template, logId: job.logId },
              'manual-booking.notification.dispatch.error'
            );
            await prisma.notificationLog
              .update({ where: { id: job.logId }, data: { status: 'failed' } })
              .catch(() => {});
          }
        }
      };

      return { ok: true, booking, afterFn };
    } catch (err: unknown) {
      // P2002: bookingRef or confirmationToken unique collision — retry
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        continue;
      }
      throw err;
    }
  }

  return { ok: false, reason: 'ref_collision' };
}
