/**
 * sendReminders — fire the 24h pre-departure SMS reminder once per booking
 * (Issue 019 AC4).
 *
 * Selects unpaid-or-paid cash bookings on trips departing in the 23–25h window
 * whose reminderSentAt is still NULL, locking each Booking row (FOR UPDATE OF b
 * SKIP LOCKED). The reminderSentAt guard makes the send fire exactly once; the
 * 23–25h window keeps a single run from re-selecting a booking already handled.
 *
 * Per row: send SMS via the esms stub, set reminderSentAt=now, append a
 * NotificationLog audit row reflecting the dispatch result.
 *
 * V1 note: sendSms is a no-network stub (see lib/notifications/esms.ts), so the
 * call is safe inside the job transaction. When real eSMS HTTP lands this must
 * move to claim-then-dispatch (commit reminderSentAt first, send outside the tx).
 */

import { Prisma } from '@prisma/client';
import { sendSms, renderTemplate } from '@/lib/notifications/esms';
import type { JobCore } from './types';

interface ReminderRow {
  id: string;
  bookingRef: string;
  buyerPhone: string;
  ticketCount: number;
  departureAt: Date;
  origin: string;
  destination: string;
}

/** VN-local short date+time for SMS bodies (mirrors initiateBooking). */
function formatDepartureForSms(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export const sendReminders: JobCore = async (tx) => {
  const due = await tx.$queryRaw<ReminderRow[]>(
    Prisma.sql`
      SELECT b.id,
             b."bookingRef",
             b."buyerPhone",
             b."ticketCount",
             t."departureAt",
             r.origin,
             r.destination
      FROM "Booking" b
      JOIN "Trip" t ON t.id = b."tripId"
      JOIN "Route" r ON r.id = t."routeId"
      WHERE b.status IN ('paid'::"BookingStatus")
        AND b."reminderSentAt" IS NULL
        AND t."departureAt" BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
      FOR UPDATE OF b SKIP LOCKED
    `
  );

  let sent = 0;
  for (const row of due) {
    const payload = {
      route: `${row.origin} - ${row.destination}`,
      departureAt: formatDepartureForSms(row.departureAt),
      ticketCount: row.ticketCount,
      bookingRef: row.bookingRef,
    };

    const result = await sendSms({
      to: row.buyerPhone,
      template: 'bookingReminder24h',
      payload,
    });

    await tx.booking.update({
      where: { id: row.id },
      data: { reminderSentAt: new Date() },
    });

    await tx.notificationLog.create({
      data: {
        bookingId: row.id,
        channel: 'sms',
        template: 'bookingReminder24h',
        recipient: row.buyerPhone,
        payload: renderTemplate('bookingReminder24h', payload),
        status: result.ok ? 'sent' : 'failed',
        externalRef: result.externalRef ?? null,
        sentAt: result.ok ? new Date() : null,
      },
    });

    sent += 1;
  }

  return { rowsAffected: sent, status: 'success' };
};
