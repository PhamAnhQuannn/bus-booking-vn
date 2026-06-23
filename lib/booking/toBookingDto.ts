/**
 * toBookingDto — converts a Prisma Booking row (with includes) to BookingDto (Issue 014).
 * Centralises the field mapping to avoid drift between route handlers and pages.
 */

import type { BookingDto } from './bookingDto';

export interface BookingDtoRow {
  id: string;
  bookingRef: string;
  tripId: string;
  holdId: string | null;
  customerId: string | null;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: string;
  paymentExternalRef: string | null;
  status: string;
  isManual: boolean;
  createdAt: Date;
  contactStatus: string;
  pickupKind: string;
  pickupDetail: string | null;
  pickedUpAt: Date | null;
  escalationNote: string | null;
  escalatedAt: Date | null;
  refundedAt: Date | null;
  trip: {
    id: string;
    departureAt: Date;
    price: number;
    departedAt: Date | null;
    completedAt: Date | null;
    route: { origin: string; destination: string };
    bus: { licensePlate: string };
  };
}

export function toBookingDto(row: BookingDtoRow): BookingDto {
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    tripId: row.tripId,
    holdId: row.holdId,
    customerId: row.customerId,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    ticketCount: row.ticketCount,
    totalVnd: row.totalVnd,
    paymentMethod: row.paymentMethod as BookingDto['paymentMethod'],
    paymentExternalRef: row.paymentExternalRef,
    status: row.status as BookingDto['status'],
    isManual: row.isManual,
    createdAt: row.createdAt.toISOString(),
    contactStatus: row.contactStatus as BookingDto['contactStatus'],
    pickupKind: row.pickupKind as BookingDto['pickupKind'],
    pickupDetail: row.pickupDetail,
    pickedUpAt: row.pickedUpAt ? row.pickedUpAt.toISOString() : null,
    escalationNote: row.escalationNote,
    escalatedAt: row.escalatedAt ? row.escalatedAt.toISOString() : null,
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
    trip: {
      id: row.trip.id,
      departureAt: row.trip.departureAt.toISOString(),
      price: row.trip.price,
      departedAt: row.trip.departedAt ? row.trip.departedAt.toISOString() : null,
      completedAt: row.trip.completedAt ? row.trip.completedAt.toISOString() : null,
      route: row.trip.route,
      bus: row.trip.bus,
    },
  };
}
