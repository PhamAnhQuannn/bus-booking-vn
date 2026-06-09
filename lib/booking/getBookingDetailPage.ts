/**
 * getBookingDetailPage — server-side bundle for the operator booking detail page (Issue 014).
 *
 * Returns the full booking DTO. The traveler self-selects pickup at booking time
 * (issue 107); pickup is READ-ONLY for the operator (issue 108), so no pickup-point
 * options are fetched. Called in-process by the page server component (never
 * self-fetch own API — Issue 002/003 hardened rule).
 */

import { getOperatorBooking } from './getOperatorBooking';
import type { BookingDto } from './bookingDto';

export interface BookingDetailPageData {
  booking: BookingDto;
}

export async function getBookingDetailPage(
  operatorId: string,
  bookingId: string
): Promise<BookingDetailPageData | null> {
  const booking = await getOperatorBooking(operatorId, bookingId);
  if (!booking) return null;
  return { booking };
}
