/**
 * sendReminders — fire the 24h pre-departure SMS reminder once per booking
 * (Issue 019 AC4, B-07 claim-then-dispatch hardening).
 *
 * Two-phase design so SMS network I/O never holds a DB connection:
 *
 * 1. **Claim phase (inside advisory-lock tx):** SELECT … FOR UPDATE SKIP
 *    LOCKED on bookings whose trip departs in the 23–25h window and
 *    reminderSentAt IS NULL, then UPDATE reminderSentAt = now(). The tx
 *    commits and releases the connection + advisory lock.
 *
 * 2. **Dispatch phase (after tx commit):** iterate claimed rows, call
 *    sendSms (real eSMS HTTP when enabled), and write a NotificationLog
 *    audit row via the global prisma client.
 *
 * Delivery guarantee: at-most-once per booking. If SMS dispatch fails after
 * claim, reminderSentAt is already committed — the booking will NOT be
 * re-selected on the next cron tick. The NotificationLog row records
 * status='failed' so operators can audit missed reminders.
 *
 * Exported API:
 * - `claimReminders`  — JobCore (claim only); used by withAdvisoryLock.
 * - `sendReminders`   — full claim-then-dispatch; called from cron route.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { sendSms, renderTemplate } from '@/lib/notification';
import { withAdvisoryLock } from './withAdvisoryLock';
import type { JobCore, JobResult } from './types';

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

/* ── Phase 1: Claim (runs inside advisory-lock tx) ───────────────────── */

export const claimReminders: JobCore = async (tx) => {
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

  const now = new Date();
  for (const row of due) {
    await tx.booking.update({
      where: { id: row.id },
      data: { reminderSentAt: now },
    });
  }

  const result: JobResult & { _claimed?: ReminderRow[] } = {
    rowsAffected: due.length,
    status: 'success',
  };
  result._claimed = due;
  return result;
};

/* ── Phase 2: Dispatch (runs AFTER tx commit, no DB connection held) ── */

async function dispatchReminders(rows: ReminderRow[]): Promise<void> {
  for (const row of rows) {
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

    await prisma.notificationLog.create({
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
  }
}

/* ── Public entry: claim under advisory lock, then dispatch outside ─── */

export async function sendReminders(): Promise<JobResult> {
  const claimResult = await withAdvisoryLock('reminder-24h', claimReminders);

  if (claimResult.status === 'skipped_locked') {
    return claimResult;
  }

  const claimed = (claimResult as JobResult & { _claimed?: ReminderRow[] })._claimed ?? [];
  await dispatchReminders(claimed);

  return { rowsAffected: claimResult.rowsAffected, status: 'success' };
}
