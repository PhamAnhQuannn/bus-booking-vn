/**
 * toBookingQueueRow — lean queue row shape for the operator booking list (Issue 014).
 *
 * AC6: NO seat-number column.
 * manualFlag = isManual (manual/cash bookings flagged in list)
 * cashFlag = paymentMethod === 'cash' || paymentMethod from pending_cash_payment bookings
 */

import type { BookingContactStatus, BookingPaymentStatus } from './bookingDto';

export interface BookingQueueRow {
  id: string;
  bookingRef: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  contactStatus: BookingContactStatus;
  pickupPointName: string | null;
  paymentStatus: BookingPaymentStatus;
  departureAt: string; // ISO 8601
  escalatedAt: string | null; // ISO 8601
  /** true when isManual=true */
  manualFlag: boolean;
  /** true when paymentMethod='cash' */
  cashFlag: boolean;
}

export interface BookingQueueRawRow {
  id: string;
  bookingRef: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  contactStatus: string;
  paymentMethod: string;
  status: string;
  isManual: boolean;
  escalatedAt: Date | null;
  trip: { departureAt: Date };
  pickupPoint: { name: string } | null;
}

export function toBookingQueueRow(row: BookingQueueRawRow): BookingQueueRow {
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    ticketCount: row.ticketCount,
    contactStatus: row.contactStatus as BookingContactStatus,
    pickupPointName: row.pickupPoint?.name ?? null,
    paymentStatus: row.status as BookingPaymentStatus,
    departureAt: row.trip.departureAt.toISOString(),
    escalatedAt: row.escalatedAt ? row.escalatedAt.toISOString() : null,
    manualFlag: row.isManual,
    cashFlag: row.paymentMethod === 'cash',
  };
}
