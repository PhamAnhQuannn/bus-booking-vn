/**
 * initiateOnlineBooking — orchestrates every online (pay-first) booking flow:
 * momo | zalopay | card. Generalised from the original MoMo orchestrator so a
 * single code path drives all gateways (real MoMo sandbox or local stub).
 *
 * Pipeline:
 *   1. Validate hold exists (fetches with trip → route)
 *   2. Idempotency check — if booking already exists for this hold, return it
 *   3. Pre-check: trip not yet departed
 *   4. createOnlineBookingFromHold — atomic INSERT (ON CONFLICT DO NOTHING)
 *      with paymentMethod=<method>, status='awaiting_payment'
 *      Zero NotificationLog rows seeded here (notifications come after IPN)
 *   5. Call gateway.createPayment AFTER booking row exists
 *   6. On gateway failure: compensating $transaction — DELETE booking row +
 *      revert hold from 'consumed' → 'active' preserving expiresAt
 *   7. On success: return { ok: true, bookingId, payUrl, confirmationToken }
 *
 * Gateway is injected (PaymentGateway interface) so tests can use a fake;
 * defaults to getGatewayFor(method, baseUrl).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import {
  createOnlineBookingFromHold,
  getBookingByHoldId,
  type OnlineBookingMethod,
} from '@/lib/db/bookingRepo';
import { getGatewayFor } from '@/lib/payment/select';
import { attachGuestBooking } from './attachGuestBooking';
import { isBookable } from '@/lib/onboarding';
import type { PaymentGateway } from '@/lib/payment/gateway';
import { logger } from '@/lib/logger';

export interface InitiateOnlineBookingInput {
  holdId: string;
  /**
   * Absolute base URL of this deployment (e.g. https://example.com).
   * Used to build ipnUrl and redirectUrl passed to the gateway.
   */
  baseUrl: string;
  /** Online payment method: momo | zalopay | card. */
  method: OnlineBookingMethod;
  /**
   * Customer.id of the signed-in buyer, or null/undefined for a guest (Issue 031).
   * Stamped on the Booking row at creation (before payment) so the booking is
   * owned without a spoofable post-hoc phone-match attach at webhook time.
   */
  customerId?: string | null;
  /**
   * Injectable payment gateway for testing. Defaults to
   * getGatewayFor(method, baseUrl) which reads env vars.
   */
  gateway?: PaymentGateway;
}

export type InitiateOnlineBookingResult =
  | { ok: true; bookingId: string; confirmationToken: string; payUrl: string }
  | {
      ok: false;
      error:
        | 'hold_not_found'
        | 'hold_expired'
        | 'trip_departed'
        | 'operator_not_bookable'
        | 'ref_collision'
        | 'gateway_error';
      gatewayMessage?: string;
    };

export async function initiateOnlineBooking(
  input: InitiateOnlineBookingInput
): Promise<InitiateOnlineBookingResult> {
  const { holdId, baseUrl, method, customerId = null } = input;
  const gateway = input.gateway ?? getGatewayFor(method, baseUrl);

  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      ticketCount: true,
      trip: {
        select: {
          id: true,
          departureAt: true,
          price: true,
          route: { select: { origin: true, destination: true } },
          // Issue 046: pull operator status for the bookable re-check below
          // (closes the suspend-after-search race).
          operator: { select: { status: true } },
        },
      },
    },
  });

  if (!hold) return { ok: false, error: 'hold_not_found' };

  // Issue 046 defense-in-depth: re-verify the trip's operator is still bookable
  // (APPROVED) at initiate time. A search result could have been clicked after
  // the operator was suspended/rejected. Derived from the Issue 045 helper.
  if (!isBookable(hold.trip.operator.status)) {
    return { ok: false, error: 'operator_not_bookable' };
  }

  // Idempotency check — if booking already exists, return it
  const alreadyExisting = await getBookingByHoldId(holdId);
  if (alreadyExisting) {
    await attachGuestBooking(alreadyExisting.id);
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

  const repoResult = await createOnlineBookingFromHold(
    {
      holdId,
      buyerName: hold.customerName,
      buyerPhone: hold.customerPhone,
      buyerEmail: hold.customerEmail,
      customerId,
    },
    method
  );

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
  const ipnUrl = `${baseUrl}/api/payments/${method}/webhook`;
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
      { bookingRef, method, error: gatewayResult.error },
      'online.gateway.createPayment.failed — compensating'
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
            WHERE id = ${holdId} AND status = 'consumed'::"HoldStatus"
          `
        ),
      ]);
    } catch (compensateErr) {
      logger.error(
        { err: compensateErr, bookingRef, method },
        'online.compensating.transaction.failed'
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
