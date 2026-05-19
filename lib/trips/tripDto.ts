/**
 * TripDto — the canonical shape returned by every GET trip response.
 * Computed fields (holdsCount, bookingsCount, availableSeats) are derived from
 * DB aggregates at query time.
 */

export interface TripDto {
  id: string;
  routeId: string;
  busId: string;
  operatorId: string;
  departureAt: string; // ISO 8601
  price: number;
  status: 'scheduled' | 'departed' | 'cancelled' | 'completed';
  salesClosed: boolean;
  blockedSeats: number;
  capacity: number;
  holdsCount: number;
  bookingsCount: number;
  availableSeats: number;
  recurringTemplateId: string | null;
  pairedTripId: string | null;
  cancelReason: string | null;
  cancelledAt: string | null; // ISO 8601 or null
}

export interface TemplateDto {
  id: string;
  operatorId: string;
  routeId: string;
  busId: string;
  departureLocalTime: string; // HH:MM
  daysOfMask: number;
  price: number;
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  deactivatedAt: string | null; // ISO 8601 or null
}
