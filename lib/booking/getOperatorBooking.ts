/**
 * getOperatorBooking — fetch single booking with full DTO (Issue 014).
 *
 * Tenant-isolated: verifies the booking's trip belongs to the operatorId.
 * Returns null on miss or cross-tenant access (both mapped to 404 at route layer).
 */

import { prisma } from '@/lib/db/client';
import { toBookingDto, type BookingDtoRow } from './toBookingDto';
import type { BookingDto } from './bookingDto';

const bookingFullSelect = {
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
      bus: { select: { licensePlate: true } },
    },
  },
  pickupPoint: {
    select: { name: true },
  },
} as const;

export async function getOperatorBooking(
  operatorId: string,
  bookingId: string
): Promise<BookingDto | null> {
  const row = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      trip: { operatorId },
    },
    select: bookingFullSelect,
  });

  if (!row) return null;
  return toBookingDto(row as BookingDtoRow);
}
