/**
 * cancelTrip — atomically cancel a trip and cascade to bookings/holds/notifications (Issue 013 AC4).
 *
 * AC4 atomic sequence (single $transaction callback):
 *   1. SELECT FOR UPDATE Trip → if status=cancelled return early with alreadyCancelled:true (AC3 idempotent)
 *   2. UPDATE Trip status='cancelled', cancelledAt=now, cancelReason
 *   3. UPDATE Booking status='trip_cancelled' WHERE status IN ('confirmed','pending_payment')
 *      Note: schema BookingStatus uses 'paid' for confirmed. Mapping below.
 *   4. UPDATE Hold status='cancelled_trip' WHERE status='active'
 *   5. INSERT NotificationLog (pending, kind='trip_cancelled') per affected Booking
 *      (email when the buyer left one, else SMS; body is a rendered sentence, #834)
 *   6. INSERT RefundObligation (pending) per paid Booking (#835) — driven by the
 *      process-refunds cron, so a failed refund is retried instead of lost
 *
 * I1: $transaction callback form + SELECT FOR UPDATE.
 * I9: NotificationLog payload has NO raw phone (use recipientPhone column = `recipient`).
 */

import { prisma } from '@/lib/core/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';
import { randomUUID } from 'crypto';
import { renderTemplate, SUPPORT_EMAIL } from '@/lib/notification';

/** VN-local short date+time for notification bodies (mirrors processWebhook). */
function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export interface CancelTripResult {
  trip: TripDto;
  alreadyCancelled: boolean;
  cancelledBookings: number;
  cancelledHolds: number;
  notificationsEnqueued: number;
}

export async function cancelTrip(
  operatorId: string,
  tripId: string,
  cancelReason: string
): Promise<CancelTripResult> {
  try {
    const { result } = await prisma.$transaction(async (tx) => {
      // 1. SELECT FOR UPDATE to serialise concurrent cancel ops
      const locked = await tx.$queryRaw<{
        id: string;
        status: string;
        routeId: string;
        departureAt: Date;
      }[]>`
        SELECT id, status, "routeId", "departureAt"
        FROM "Trip"
        WHERE id = ${tripId} AND "operatorId" = ${operatorId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }

      const tripRow = locked[0];

      // AC3 idempotent re-cancel: return 200 with already_cancelled:true instead of throwing
      if (tripRow.status === 'cancelled') {
        const existingTrip = await tx.trip.findUnique({
          where: { id: tripId },
          include: {
            bus: { select: { capacity: true } },
            _count: {
              select: {
                holds: { where: { status: 'active' } },
                bookings: {
                  where: {
                    status: { in: ['paid', 'completed'] },
                  },
                },
              },
            },
          },
        });
        // existingTrip is guaranteed non-null: we just locked it above
        // Already-cancelled re-cancel is idempotent: no new refunds (the
        // original cancel already issued them, keyed on cancel:<tripId>:<id>).
        return {
          result: {
            trip: toTripDto(existingTrip!),
            alreadyCancelled: true,
            cancelledBookings: 0,
            cancelledHolds: 0,
            notificationsEnqueued: 0,
          },
        };
      }

      const now = new Date();

      // 2. Update Trip and get the updated row for the DTO
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason,
        },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: { in: ['paid', 'completed'] },
                },
              },
            },
          },
        },
      });

      // 3. Fetch affected bookings for notification log (need bookingRef, customer phone)
      const affectedBookings = await tx.booking.findMany({
        where: {
          tripId,
          status: {
            in: [
              'awaiting_payment',
              'paid',
              'completed',
            ],
          },
        },
        select: {
          id: true,
          bookingRef: true,
          buyerPhone: true,
          buyerEmail: true,
          customerId: true,
          paymentMethod: true,
        },
      });

      // Issue 051: the bookings that actually had money IN via the PSP (online-paid →
      // paid / completed) get a refund. Cash walk-up bookings (paymentMethod='cash') are
      // excluded: the platform never collected that money, so there is nothing to refund
      // out and no PSP/manual transfer to trigger. Before this change the filter was
      // status-only, so cash bookings were (wrongly) run through refundOut as well; they
      // now get NO refund_debit/refund_out, so the operator's booking_credit for a
      // cancelled cash booking is not clawed back by the ledger (cash refund is settled
      // by the operator at the counter). Captured BEFORE the updateMany flips status.
      const paidBookings = await tx.booking.findMany({
        where: {
          tripId,
          status: { in: ['paid', 'completed'] },
          paymentMethod: { not: 'cash' },
        },
        select: { id: true, totalVnd: true, paymentExternalRef: true },
      });

      // 4. Bulk-update affected bookings
      const bookingResult = await tx.booking.updateMany({
        where: {
          tripId,
          status: {
            in: [
              'awaiting_payment',
              'paid',
              'completed',
            ],
          },
        },
        data: { status: 'trip_cancelled' },
      });

      // 5. Bulk-update active holds
      const holdResult = await tx.hold.updateMany({
        where: { tripId, status: 'active' },
        data: { status: 'cancelled_trip' },
      });

      // 6. Insert NotificationLog for each affected booking (I9: no raw phone in payload)
      const routeInfo = await tx.route.findUnique({
        where: { id: tripRow.routeId },
        select: { origin: true, destination: true },
      });
      const routeLabel = routeInfo
        ? `${routeInfo.origin} → ${routeInfo.destination}`
        : tripRow.routeId;

      if (affectedBookings.length > 0) {
        const paidIds = new Set(paidBookings.map((p) => p.id));
        const departureLabel = formatDepartureForSms(tripRow.departureAt);
        await tx.notificationLog.createMany({
          data: affectedBookings.map((b) => ({
            id: randomUUID().replace(/-/g, '').slice(0, 25), // cuid-compatible length
            bookingId: b.id,
            // unique(bookingId, template): one row per booking — email when we have one
            // (#834: previously SMS only, and eSMS is not live), else the SMS fallback.
            channel: b.buyerEmail ? ('email' as const) : ('sms' as const),
            template: 'trip_cancelled',
            // I9: recipient column holds the contact — payload must NOT duplicate it
            recipient: b.buyerEmail ?? b.buyerPhone,
            // Rendered sentence, not JSON: the dispatcher sends the stored string verbatim.
            payload: renderTemplate('trip_cancelled', {
              bookingRef: b.bookingRef,
              route: routeLabel,
              departureAt: departureLabel,
              refunded: paidIds.has(b.id) ? 1 : 0,
              cash: b.paymentMethod === 'cash' ? 1 : 0,
              supportEmail: SUPPORT_EMAIL,
            }),
            status: 'pending' as const,
          })),
        });
      }

      // 7. #835: durable refund obligations, committed atomically with the cancel (mirrors
      // the #569 overpay path in processWebhook). The process-refunds cron drives them via
      // refundOut with retry + backoff; the key is tied to the cancel event so a replay
      // never double-refunds. skipDuplicates: idempotencyKey is unique.
      if (paidBookings.length > 0) {
        await tx.refundObligation.createMany({
          data: paidBookings.map((b) => ({
            bookingId: b.id,
            amountMinor: b.totalVnd,
            reason: 'operator_cancel',
            idempotencyKey: `cancel:${tripId}:${b.id}`,
            providerTxnId: b.paymentExternalRef ?? `cancel:${tripId}`,
          })),
          skipDuplicates: true,
        });
      }

      return {
        result: {
          trip: toTripDto(updatedTrip),
          alreadyCancelled: false,
          cancelledBookings: bookingResult.count,
          cancelledHolds: holdResult.count,
          notificationsEnqueued: affectedBookings.length,
        },
      };
    });

    return result;
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    throw e;
  }
}
