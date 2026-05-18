/**
 * initiateMomoBooking — orchestrates the MoMo e-wallet booking flow.
 *
 * Pipeline:
 *   1. Validate hold exists (fetches with trip → route → bus → operator)
 *   2. Idempotency check — if booking already exists for this hold, return it
 *   3. Pre-check: trip not yet departed
 *   4. createMomoBookingFromHold — atomic INSERT (ON CONFLICT DO NOTHING)
 *      with paymentMethod='momo', status='awaiting_payment'
 *      Zero NotificationLog rows seeded here (AC-F1: notifications come after IPN)
 *   5. Call MoMo createPayment gateway AFTER booking row exists
 *   6. On gateway failure: compensating $transaction — DELETE booking row +
 *      revert hold from 'converted' → 'active' preserving expiresAt
 *   7. On success: return { ok: true, bookingId, payUrl, confirmationToken }
 *
 * Gateway is injected (PaymentGateway interface) so tests can use a fake.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import {
  createMomoBookingFromHold,
  getBookingByHoldId,
} from '@/lib/db/bookingRepo';
import { getMomoAdapter } from '@/lib/payment/momo';
import { attachGuestBooking } from './attachGuestBooking';
import type { PaymentGateway } from '@/lib/payment/gateway';
import { logger } from '@/lib/logger';

export interface InitiateMomoBookingInput {
  holdId: string;
  /**
   * Absolute base URL of this deployment (e.g. https://example.com).
   * Used to build ipnUrl and redirectUrl passed to MoMo.
   */
  baseUrl: string;
  /**
   * Injectable payment gateway for testing. Defaults to the singleton
   * getMomoAdapter() which reads env vars.
   */
  gateway?: PaymentGateway;
}

export type InitiateMomoBookingResult =
  | { ok: true; bookingId: string; confirmationToken: string; payUrl: string }
  | {
      ok: false;
      error:
        | 'hold_not_found'
        | 'hold_expired'
        | 'trip_departed'
        | 'ref_collision'
        | 'gateway_error';
      gatewayMessage?: string;
    };

export async function initiateMomoBooking(
  input: InitiateMomoBookingInput
): Promise<InitiateMomoBookingResult> {
  const { holdId, baseUrl } = input;
  const gateway = input.gateway ?? getMomoAdapter();

  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      customerName: true,
      customerPhone: true,
      ticketCount: true,
      trip: {
        select: {
          id: true,
          departureAt: true,
          price: true,
          route: { select: { origin: true, destination: true } },
        },
      },
    },
  });

  if (!hold) return { ok: false, error: 'hold_not_found' };

  // Idempotency check — if booking already exists, return it
  const alreadyExisting = await getBookingByHoldId(holdId);
  if (alreadyExisting) {
    // We can't recover a payUrl for an existing booking here.
    // The client should redirect to the result page using the confirmationToken.
    // For now, surface the existing booking; the review page will handle re-entry.
    await attachGuestBooking(alreadyExisting.id);
    // We don't have a stored payUrl — return a placeholder so caller can
    // redirect to the result page. Caller checks confirmationToken to route.
    return {
      ok: true,
      bookingId: alreadyExisting.id,
      confirmationToken: alreadyExisting.confirmationToken,
      payUrl: `${baseUrl}/booking/result/${alreadyExisting.confirmationToken}`,
    };
  }

  const now = new Date();
  if (hold.trip.departureAt <= now) {
    return { ok: false, error: 'trip_departed' };
  }

  const repoResult = await createMomoBookingFromHold({
    holdId,
    buyerName: hold.customerName,
    buyerPhone: hold.customerPhone,
  });

  let bookingId: string;
  let confirmationToken: string;
  let bookingRef: string;
  let totalVnd: number;

  if (repoResult.ok) {
    bookingId = repoResult.booking.id;
    confirmationToken = repoResult.booking.confirmationToken;
    bookingRef = repoResult.booking.bookingRef;
    totalVnd = repoResult.booking.totalVnd;
  } else if (repoResult.reason === 'already_booked') {
    const existing = await getBookingByHoldId(holdId);
    if (!existing) {
      return { ok: false, error: 'ref_collision' };
    }
    await attachGuestBooking(existing.id);
    return {
      ok: true,
      bookingId: existing.id,
      confirmationToken: existing.confirmationToken,
      payUrl: `${baseUrl}/booking/result/${existing.confirmationToken}`,
    };
  } else if (repoResult.reason === 'hold_expired') {
    const fresh = await prisma.trip.findUnique({
      where: { id: hold.trip.id },
      select: { departureAt: true },
    });
    if (fresh && fresh.departureAt <= new Date()) {
      return { ok: false, error: 'trip_departed' };
    }
    return { ok: false, error: 'hold_expired' };
  } else {
    return { ok: false, error: 'ref_collision' };
  }

  // Booking row exists — now call the payment gateway
  const ipnUrl = `${baseUrl}/api/payments/momo/webhook`;
  const redirectUrl = `${baseUrl}/booking/result/${confirmationToken}`;
  const routeLabel = `${hold.trip.route.origin} - ${hold.trip.route.destination}`;

  const gatewayResult = await gateway.createPayment({
    orderId: bookingRef,
    amount: totalVnd,
    orderInfo: `BusBookVN: ${routeLabel}`,
    ipnUrl,
    redirectUrl,
    requestId: bookingId,
  });

  if (!gatewayResult.ok) {
    // Compensating transaction: DELETE booking + revert hold to 'active'
    logger.warn(
      { bookingRef, error: gatewayResult.error },
      'momo.gateway.createPayment.failed — compensating'
    );
    try {
      await prisma.$transaction([
        prisma.$executeRaw(
          Prisma.sql`DELETE FROM "Booking" WHERE id = ${bookingId}::uuid`
        ),
        prisma.$executeRaw(
          Prisma.sql`
            UPDATE "Hold"
            SET status = 'active'::"HoldStatus"
            WHERE id = ${holdId} AND status = 'converted'::"HoldStatus"
          `
        ),
      ]);
    } catch (compensateErr) {
      logger.error(
        { err: compensateErr, bookingRef },
        'momo.compensating.transaction.failed'
      );
    }
    return {
      ok: false,
      error: 'gateway_error',
      gatewayMessage: gatewayResult.error,
    };
  }

  await attachGuestBooking(bookingId);

  return {
    ok: true,
    bookingId,
    confirmationToken,
    payUrl: gatewayResult.payUrl,
  };
}
