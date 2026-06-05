/**
 * BookingDto — canonical shape returned by operator booking API responses (Issue 014).
 *
 * Fields ordered to mirror Booking model columns in schema.prisma.
 * No seat-number field (AC6).
 */

export type BookingPaymentStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'trip_cancelled'
  | 'no_show'
  | 'payment_failed_expired'
  // Issue 100: oversold-race terminal — booking was paid then immediately refunded.
  | 'refunded';

export type BookingContactStatus = 'pending' | 'reached' | 'no_answer' | 'callback';

export interface BookingDto {
  id: string;
  bookingRef: string;
  tripId: string;
  holdId: string | null;
  customerId: string | null;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: 'momo' | 'zalopay' | 'card';
  paymentExternalRef: string | null;
  status: BookingPaymentStatus;
  isManual: boolean;
  createdAt: string; // ISO 8601
  // Issue 014 contact / pickup fields
  contactStatus: BookingContactStatus;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupNote: string | null;
  pickedUpAt: string | null; // ISO 8601
  escalationNote: string | null;
  escalatedAt: string | null; // ISO 8601
  // Issue 100: instant of oversold-race refund; null when not refunded via that path.
  refundedAt: string | null; // ISO 8601
  // Nested trip summary
  trip: {
    id: string;
    departureAt: string; // ISO 8601
    price: number;
    departedAt: string | null; // ISO 8601
    completedAt: string | null; // ISO 8601
    route: { origin: string; destination: string };
    bus: { licensePlate: string };
  };
}
