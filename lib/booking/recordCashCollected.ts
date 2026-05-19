/**
 * recordCashCollected — operator collects cash from passenger (Issue 014 AC4).
 *
 * I7-compliant: amount is server-derived from Booking.totalVnd — NOT from request body.
 * Transition: pending_cash_payment → paid_operator_notified ONLY.
 * Sets cashCollectedAt timestamp.
 *
 * After successful transition, emits operator SMS notification (AC1).
 * SMS dispatch is best-effort and does NOT roll back the state transition.
 *
 * $transaction + SELECT FOR UPDATE on Booking (TOCTOU guard).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { after } from 'next/server';
import { BookingServiceError } from './recordCallOutcome';
import { toBookingDto, type BookingDtoRow } from './toBookingDto';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { sendSms, renderTemplate } from '@/lib/notifications/esms';
import { logger } from '@/lib/logger';
import type { BookingDto } from './bookingDto';

export interface CashCollectedResult {
  booking: BookingDto;
  totalVnd: number;
}

function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export async function recordCashCollected(
  operatorId: string,
  bookingId: string,
  afterFn: (cb: () => Promise<void>) => void = after
): Promise<CashCollectedResult> {
  const { booking, totalVnd, operatorPhone, operatorName, routeLabel, departureLabel } =
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE to serialise concurrent cash-collected calls
      const locked = await tx.$queryRaw<{
        id: string;
        status: string;
        totalVnd: number;
      }[]>(
        Prisma.sql`
          SELECT b.id, b.status, b."totalVnd"
          FROM "Booking" b
          JOIN "Trip" t ON t.id = b."tripId"
          WHERE b.id = ${bookingId}
            AND t."operatorId" = ${operatorId}
          FOR UPDATE
        `
      );

      if (locked.length === 0) {
        throw new BookingServiceError('not_found');
      }

      const row = locked[0];

      // Only pending_cash_payment → paid_operator_notified is valid
      if (row.status !== 'pending_cash_payment') {
        throw new BookingServiceError('invalid_state');
      }

      const now = new Date();

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'paid_operator_notified',
          cashCollectedAt: now,
        },
        select: {
          id: true,
          bookingRef: true,
          tripId: true,
          holdId: true,
          customerId: true,
          buyerName: true,
          buyerPhone: true,
          ticketCount: true,
          totalVnd: true,
          paymentMethod: true,
          paymentExternalRef: true,
          status: true,
          isManual: true,
          createdAt: true,
          contactStatus: true,
          pickupPointId: true,
          pickupNote: true,
          pickedUpAt: true,
          cashCollectedAt: true,
          escalationNote: true,
          escalatedAt: true,
          trip: {
            select: {
              id: true,
              departureAt: true,
              price: true,
              departedAt: true,
              completedAt: true,
              route: { select: { origin: true, destination: true } },
              bus: {
                select: {
                  licensePlate: true,
                  operator: {
                    select: {
                      legalName: true,
                      notificationPhone: true,
                      contactPhone: true,
                    },
                  },
                },
              },
            },
          },
          pickupPoint: { select: { name: true } },
        },
      });

      const operator = updated.trip.bus.operator;
      const opPhone = operator.notificationPhone ?? operator.contactPhone;
      const route = updated.trip.route;

      return {
        booking: toBookingDto({
          ...updated,
          trip: {
            ...updated.trip,
            bus: { licensePlate: updated.trip.bus.licensePlate },
          },
        } as BookingDtoRow),
        totalVnd: updated.totalVnd,
        operatorPhone: opPhone,
        operatorName: operator.legalName,
        routeLabel: `${route.origin} - ${route.destination}`,
        departureLabel: formatDepartureForSms(updated.trip.departureAt),
      };
    });

  // AC1: emit operator SMS on cash payment collected (best-effort, after response)
  const bookingDto = booking;
  afterFn(async () => {
    try {
      const operatorPayload = {
        ticketCount: bookingDto.ticketCount,
        route: routeLabel,
        departureAt: departureLabel,
        bookingRef: bookingDto.bookingRef,
        buyerPhone: bookingDto.buyerPhone,
      };
      const log = await createNotificationLog({
        bookingId: bookingDto.id,
        template: 'operatorNewBooking',
        recipient: operatorPhone,
        payload: renderTemplate('operatorNewBooking', operatorPayload),
        status: 'pending',
      });
      const result = await sendSms({
        to: operatorPhone,
        template: 'operatorNewBooking',
        payload: operatorPayload,
      });
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: result.ok ? 'sent' : 'failed',
          externalRef: result.externalRef ?? null,
          sentAt: result.ok ? new Date() : null,
        },
      });
    } catch (err) {
      logger.error(
        { err, bookingId: bookingDto.id, template: 'operatorNewBooking' },
        'cash-collected.sms.error'
      );
    }
  });

  return { booking, totalVnd };
}
