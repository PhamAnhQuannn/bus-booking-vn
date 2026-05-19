/**
 * cancelTrip — atomically cancel a trip and cascade to bookings/holds/notifications (Issue 013 AC4).
 *
 * AC4 atomic sequence (single $transaction callback):
 *   1. SELECT FOR UPDATE Trip → if status=cancelled return early with alreadyCancelled:true (AC3 idempotent)
 *   2. UPDATE Trip status='cancelled', cancelledAt=now, cancelReason
 *   3. UPDATE Booking status='trip_cancelled' WHERE status IN ('confirmed','pending_payment')
 *      Note: schema BookingStatus uses 'pending_cash_payment' not 'pending_payment'
 *      and 'paid_operator_notified' for confirmed. Mapping below.
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
    return await prisma.$transaction(async (tx) => {
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
                    status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
                  },
                },
              },
            },
          },
        });
        // existingTrip is guaranteed non-null: we just locked it above
        return {
          trip: toTripDto(existingTrip!),
          alreadyCancelled: true,
          cancelledBookings: 0,
          cancelledHolds: 0,
          notificationsEnqueued: 0,
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
                  status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
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
              'pending_cash_payment',
              'paid_operator_notified',
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

      // 4. Bulk-update affected bookings
      const bookingResult = await tx.booking.updateMany({
        where: {
          tripId,
          status: {
            in: [
              'awaiting_payment',
              'pending_cash_payment',
              'paid_operator_notified',
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
        trip: toTripDto(updatedTrip),
        alreadyCancelled: false,
        cancelledBookings: bookingResult.count,
        cancelledHolds: holdResult.count,
        notificationsEnqueued: affectedBookings.length,
      };
    });
  } catch (e) {
    const tagged = e as { _trip?: string };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    throw e;
  }
}
