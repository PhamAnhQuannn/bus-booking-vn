/**
 * toTripDto — converts a Prisma Trip row (with includes) to TripDto.
 * Centralises the field mapping to avoid drift between route handlers.
 */

import type { TripDto } from './tripDto';

interface TripRow {
  id: string;
  routeId: string;
  busId: string;
  operatorId: string;
  departureAt: Date;
  price: number;
  status: string;
  salesClosed: boolean;
  recurringTemplateId: string | null;
  pairedTripId: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  bus: { capacity: number };
  _count: { holds: number; bookings: number };
}

export function toTripDto(row: TripRow): TripDto {
  const capacity = row.bus.capacity;
  const holdsCount = row._count.holds;
  const bookingsCount = row._count.bookings;
  // Issue 040: blockedSeats removed from availability (block-seats retired).
  const availableSeats = Math.max(0, capacity - holdsCount - bookingsCount);

  return {
    id: row.id,
    routeId: row.routeId,
    busId: row.busId,
    operatorId: row.operatorId,
    departureAt: row.departureAt.toISOString(),
    price: row.price,
    status: row.status as TripDto['status'],
    salesClosed: row.salesClosed,
    capacity,
    holdsCount,
    bookingsCount,
    availableSeats,
    recurringTemplateId: row.recurringTemplateId,
    pairedTripId: row.pairedTripId,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
  };
}
