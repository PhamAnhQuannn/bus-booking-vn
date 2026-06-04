/**
 * getBookingDetailPage — server-side bundle for /op/dashboard/[id] (Issue 014).
 *
 * Returns the full booking DTO plus the active pickup points for the booking's
 * route (so the call-outcome form renders a dropdown when the route has points,
 * free-text when it does not — AC3 of story 47). Called in-process by the page
 * server component (never self-fetch own API — Issue 002/003 hardened rule).
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { getOperatorBooking } from './getOperatorBooking';
import { listPickupPoints } from '@/lib/catalog/listPickupPoints';
import type { BookingDto } from './bookingDto';

export interface PickupPointOption {
  id: string;
  name: string;
}

export interface BookingDetailPageData {
  booking: BookingDto;
  pickupPoints: PickupPointOption[];
}

export async function getBookingDetailPage(
  operatorId: string,
  bookingId: string
): Promise<BookingDetailPageData | null> {
  const booking = await getOperatorBooking(operatorId, bookingId);
  if (!booking) return null;

  const trip = await prisma.trip.findFirst({
    ...withOperatorScope(operatorId, { where: { id: booking.tripId } }),
    select: { routeId: true },
  });

  const all = trip
    ? await listPickupPoints({ operatorId, routeId: trip.routeId })
    : null;

  const pickupPoints: PickupPointOption[] = (all ?? [])
    .filter((p) => p.deactivatedAt === null)
    .map((p) => ({ id: p.id, name: p.name }));

  return { booking, pickupPoints };
}
