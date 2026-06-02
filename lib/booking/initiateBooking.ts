/**
 * initiateCashBooking — orchestrates the cash-payment booking flow.
 *
 * Sits between the POST /api/bookings/initiate route handler and the
 * data + notification primitives:
 *   1. Fetches the hold (with trip → route → bus → operator) and
 *      pre-validates eligibility (active, unexpired, trip not departed).
 *   2. Calls createCashBookingFromHold to atomically materialise the
 *      booking row from the hold. Race-safe + idempotent via
 *      ON CONFLICT ("holdId") at the DB layer.
 *   3. Seeds two NotificationLog rows in 'pending' state (customer SMS
 *      + operator SMS) synchronously so the audit trail exists before
 *      the HTTP response leaves.
 *   4. Defers the actual eSMS dispatch + log update to the caller's
 *      `afterFn` (defaults to next/server `after`) — the request
 *      returns quickly and provider latency does not block the user.
 *   5. Calls attachGuestBooking (no-op today, future "remember on this
 *      device" hook).
 *
 * On `already_booked` from the repo (idempotent re-attempt) we recover
 * the existing booking and short-circuit — no duplicate notifications,
 * no second dispatch is queued.
 *
 * Notification dispatch failures (eSMS down, etc.) do NOT roll back the
 * booking. The booking row is the source of truth; NotificationLog rows
 * are updated to 'failed' so ops can replay.
 */

import { after } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  createCashBookingFromHold,
  getBookingByHoldId,
} from '@/lib/db/bookingRepo';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import {
  sendSms,
  renderTemplate,
  type SmsTemplate,
} from '@/lib/notifications/esms';
import { attachGuestBooking } from './attachGuestBooking';
import { logger } from '@/lib/logger';

export interface InitiateCashBookingInput {
  holdId: string;
  baseUrl: string;
  /**
   * Customer.id of the signed-in buyer, or null/undefined for a guest (Issue 031).
   * Stamped on the Booking row at creation so the booking is owned without a
   * post-hoc phone-match attach.
   */
  customerId?: string | null;
  /**
   * Inject-able deferred-work scheduler. Defaults to Next.js `after`.
   * Tests pass a collector so they can drive dispatch deterministically.
   */
  afterFn?: (cb: () => Promise<void>) => void;
}

export type InitiateCashBookingResult =
  | { ok: true; bookingId: string; confirmationToken: string }
  | {
      ok: false;
      error:
        | 'hold_not_found'
        | 'hold_expired'
        | 'trip_departed'
        | 'ref_collision';
    };

interface PendingDispatch {
  logId: string;
  to: string;
  template: SmsTemplate;
  payload: Record<string, string | number>;
}

function formatDepartureForSms(d: Date): string {
  // VN locale, Ho Chi Minh tz, short date+time.
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export async function initiateCashBooking(
  input: InitiateCashBookingInput
): Promise<InitiateCashBookingResult> {
  const { holdId, baseUrl, customerId = null } = input;
  const afterFn = input.afterFn ?? after;

  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      customerName: true,
      customerPhone: true,
      trip: {
        select: {
          id: true,
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

  if (!hold) return { ok: false, error: 'hold_not_found' };

  // Idempotency check FIRST — if a booking already exists for this hold
  // (e.g. customer retried the POST after a successful first call) recover
  // it without re-running repo logic, re-seeding notifications, or
  // re-queuing dispatch. Cheap unique-index lookup.
  const alreadyExisting = await getBookingByHoldId(holdId);
  if (alreadyExisting) {
    await attachGuestBooking(alreadyExisting.id);
    return {
      ok: true,
      bookingId: alreadyExisting.id,
      confirmationToken: alreadyExisting.confirmationToken,
    };
  }

  const now = new Date();
  if (hold.trip.departureAt <= now) {
    return { ok: false, error: 'trip_departed' };
  }
  // Note: hold.status / hold.expiresAt pre-check intentionally omitted.
  // createCashBookingFromHold's WHERE clause atomically enforces both
  // (`h.status = 'active' AND h.expiresAt > NOW()`); a separate pre-check
  // would race against the repo and complicate the converted-hold-after-
  // success idempotency path handled above.

  const repoResult = await createCashBookingFromHold({
    holdId,
    buyerName: hold.customerName,
    buyerPhone: hold.customerPhone,
    customerId,
  });

  let bookingId: string;
  let confirmationToken: string;
  let bookingRef: string;
  let ticketCount: number;
  let isNewBooking = false;

  if (repoResult.ok) {
    bookingId = repoResult.booking.id;
    confirmationToken = repoResult.booking.confirmationToken;
    bookingRef = repoResult.booking.bookingRef;
    ticketCount = repoResult.booking.ticketCount;
    isNewBooking = true;
  } else if (repoResult.reason === 'already_booked') {
    const existing = await getBookingByHoldId(holdId);
    if (!existing) {
      // Should be impossible — repo signalled already_booked but row gone.
      // Treat as ref_collision so the caller surfaces a 5xx.
      return { ok: false, error: 'ref_collision' };
    }
    bookingId = existing.id;
    confirmationToken = existing.confirmationToken;
    // No need to dispatch — first call already enqueued notifications.
    await attachGuestBooking(bookingId);
    return { ok: true, bookingId, confirmationToken };
  } else if (repoResult.reason === 'hold_expired') {
    // Could be racing TTL crossover (we pre-checked) or trip departed
    // between our pre-check and the repo SELECT. Re-disambiguate.
    const fresh = await prisma.trip.findUnique({
      where: { id: hold.trip.id },
      select: { departureAt: true },
    });
    if (fresh && fresh.departureAt <= new Date()) {
      return { ok: false, error: 'trip_departed' };
    }
    return { ok: false, error: 'hold_expired' };
  } else {
    // ref_collision after MAX_REF_ATTEMPTS — extremely rare.
    return { ok: false, error: 'ref_collision' };
  }

  // Newly-inserted booking: seed pending notifications + queue dispatch.
  if (!isNewBooking) {
    // Defensive — should be unreachable given the branches above.
    return { ok: true, bookingId, confirmationToken };
  }

  const operator = hold.trip.bus.operator;
  const operatorRecipient = operator.notificationPhone ?? operator.contactPhone;
  const confirmationUrl = `${baseUrl}/booking/confirmation/${confirmationToken}`;
  const routeLabel = `${hold.trip.route.origin} - ${hold.trip.route.destination}`;
  const departureLabel = formatDepartureForSms(hold.trip.departureAt);

  const customerPayload: Record<string, string | number> = {
    ticketCount,
    route: routeLabel,
    departureAt: departureLabel,
    bookingRef,
    confirmationUrl,
  };
  const operatorPayload: Record<string, string | number> = {
    ticketCount,
    route: routeLabel,
    departureAt: departureLabel,
    bookingRef,
    buyerPhone: hold.customerPhone,
  };

  const pending: PendingDispatch[] = [];

  const customerLog = await createNotificationLog({
    bookingId,
    template: 'bookingPendingCash',
    recipient: hold.customerPhone,
    payload: renderTemplate('bookingPendingCash', customerPayload),
    status: 'pending',
  });
  pending.push({
    logId: customerLog.id,
    to: hold.customerPhone,
    template: 'bookingPendingCash',
    payload: customerPayload,
  });

  const operatorLog = await createNotificationLog({
    bookingId,
    template: 'operatorNewBooking',
    recipient: operatorRecipient,
    payload: renderTemplate('operatorNewBooking', operatorPayload),
    status: 'pending',
  });
  pending.push({
    logId: operatorLog.id,
    to: operatorRecipient,
    template: 'operatorNewBooking',
    payload: operatorPayload,
  });

  afterFn(async () => {
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
      } catch (err) {
        logger.error(
          { err, bookingId, template: job.template, logId: job.logId },
          'notification.dispatch.error'
        );
        await prisma.notificationLog
          .update({
            where: { id: job.logId },
            data: { status: 'failed' },
          })
          .catch(() => {
            // Already logged; nothing we can do.
          });
      }
    }
  });

  await attachGuestBooking(bookingId);

  return { ok: true, bookingId, confirmationToken };
}
