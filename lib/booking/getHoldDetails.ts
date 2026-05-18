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

import { prisma } from '@/lib/db/client';

export interface HoldDetails {
  tripId: string;
  ticketCount: number;
  expiresAt: string;
  totalVND: number;
}

export async function getHoldDetails(holdId: string): Promise<HoldDetails | null> {
  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    select: {
      tripId: true,
      ticketCount: true,
      expiresAt: true,
      trip: { select: { price: true } },
    },
  });

  if (!hold) return null;

  return {
    tripId: hold.tripId,
    ticketCount: hold.ticketCount,
    expiresAt: hold.expiresAt.toISOString(),
    totalVND: hold.trip.price * hold.ticketCount,
  };
}
