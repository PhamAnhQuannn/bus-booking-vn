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
 *
 * I1: $transaction callback form + SELECT FOR UPDATE.
 * I9: NotificationLog payload has NO raw phone (use recipientPhone column = `recipient`).
 */

import { prisma } from '@/lib/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';
import { randomUUID } from 'crypto';
import { refundOut } from '@/lib/ledger';
import { logger } from '@/lib/logger';

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
    const { result, paidBookings } = await prisma.$transaction(async (tx) => {
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
          paidBookings: [] as { id: string; totalVnd: number }[],
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
          customerId: true,
        },
      });

      // Issue 051: capture the bookings that actually had money IN via the PSP
      // (online-paid → paid / completed). These get a
      // refund-out AFTER this cancel tx commits (refundOut opens its own tx and
      // must see the committed trip_cancelled state). Cash bookings are excluded —
      // cash was never collected through the platform, so there is nothing to
      // refund out. Captured BEFORE the updateMany flips status.
      const paidBookings = await tx.booking.findMany({
        where: {
          tripId,
          status: { in: ['paid', 'completed'] },
        },
        select: { id: true, totalVnd: true },
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
        await tx.notificationLog.createMany({
          data: affectedBookings.map((b) => ({
            id: randomUUID().replace(/-/g, '').slice(0, 25), // cuid-compatible length
            bookingId: b.id,
            channel: 'sms' as const,
            template: 'trip_cancelled',
            // I9: recipient column holds the phone — payload must NOT duplicate it
            recipient: b.buyerPhone,
            payload: JSON.stringify({
              bookingRef: b.bookingRef,
              route: routeLabel,
              departureAt: tripRow.departureAt.toISOString(),
            }),
            status: 'pending' as const,
          })),
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
        paidBookings,
      };
    });

    // ── Issue 051: refund-out per paid booking, AFTER the cancel tx commits ──
    // refundOut opens its OWN transaction and reads the now-committed
    // trip_cancelled booking state, so it must run post-commit (not inside the
    // cancel tx). Idempotency key is tied to the cancel event
    // (`cancel:<tripId>:<bookingId>`) so a re-cancel never double-refunds. Each
    // refund is best-effort + logged: a single PSP/ledger failure must not undo
    // the (already-committed) trip cancellation. Failed refunds are picked up by
    // re-running cancel (idempotent) or a future reconciliation sweeper.
    for (const b of paidBookings) {
      try {
        await refundOut({
          bookingId: b.id,
          amountMinor: b.totalVnd,
          reason: 'operator_cancel',
          idempotencyKey: `cancel:${tripId}:${b.id}`,
        });
      } catch (refundErr) {
        logger.error(
          { err: refundErr, tripId, bookingId: b.id },
          'cancelTrip.refund_out.error — trip stays cancelled, refund needs retry'
        );
      }
    }

    return result;
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    throw e;
  }
}
