/**
 * Load hold details for the review/initiate flow.
 *
 * Pure DB read — performs no auth. Callers must verify the bb_hold cookie
 * ownership of `holdId` before calling (route handlers do this with
 * extractHoldCookie; server components with verifyCookieValue).
 *
 * totalVND is server-computed (trip.price * ticketCount) — never trust a
 * client-supplied amount.
 */

import { prisma } from '@/lib/core/db/client';

export interface HoldDetails {
  tripId: string;
  ticketCount: number;
  expiresAt: string;
  unitPriceVND: number;
  totalVND: number;
  routeOrigin: string;
  routeDestination: string;
  departureAt: string;
  operatorLegalName: string;
  /** Issue 107: traveler pickup selection for review display. */
  pickupKind: 'station' | 'point';
  pickupAreaLabel: string | null;
  pickupDetail: string | null;
}

export async function getHoldDetails(holdId: string): Promise<HoldDetails | null> {
  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    select: {
      tripId: true,
      ticketCount: true,
      expiresAt: true,
      pickupKind: true,
      pickupAreaLabel: true,
      pickupDetail: true,
      trip: {
        select: {
          price: true,
          departureAt: true,
          route: { select: { origin: true, destination: true } },
          bus: { select: { operator: { select: { legalName: true } } } },
        },
      },
    },
  });

  if (!hold) return null;

  return {
    tripId: hold.tripId,
    ticketCount: hold.ticketCount,
    expiresAt: hold.expiresAt.toISOString(),
    unitPriceVND: hold.trip.price,
    totalVND: hold.trip.price * hold.ticketCount,
    routeOrigin: hold.trip.route.origin,
    routeDestination: hold.trip.route.destination,
    departureAt: hold.trip.departureAt.toISOString(),
    operatorLegalName: hold.trip.bus.operator.legalName,
    pickupKind: hold.pickupKind,
    pickupAreaLabel: hold.pickupAreaLabel,
    pickupDetail: hold.pickupDetail,
  };
}
