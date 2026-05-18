/**
 * Booking store — holds the in-progress booking state across the booking funnel.
 *
 * Cleared on successful payment (Issue 003) or expiry (this issue).
 *
 * Fields:
 *   tripId       — the trip being booked
 *   ticketCount  — number of seats requested
 *   holdId       — UUID returned by POST /api/holds
 *   expiresAt    — ISO timestamp when the hold expires
 *   buyerName    — entered in the customer form
 *   buyerPhone   — entered in the customer form
 */

import { create } from 'zustand';

export interface BookingState {
  tripId: string | null;
  ticketCount: number | null;
  holdId: string | null;
  expiresAt: string | null; // ISO timestamp
  buyerName: string | null;
  buyerPhone: string | null;

  /** Set trip + ticketCount when the user clicks "Book" on the search results. */
  setTrip: (tripId: string, ticketCount: number) => void;

  /** Set hold details after POST /api/holds succeeds. */
  setHold: (holdId: string, expiresAt: string) => void;

  /** Set buyer info after form submission. */
  setBuyerInfo: (name: string, phone: string) => void;

  /** Clear all booking state (on expiry or completion). */
  clearBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  tripId: null,
  ticketCount: null,
  holdId: null,
  expiresAt: null,
  buyerName: null,
  buyerPhone: null,

  setTrip: (tripId, ticketCount) =>
    set({ tripId, ticketCount, holdId: null, expiresAt: null }),

  setHold: (holdId, expiresAt) => set({ holdId, expiresAt }),

  setBuyerInfo: (buyerName, buyerPhone) => set({ buyerName, buyerPhone }),

  clearBooking: () =>
    set({
      tripId: null,
      ticketCount: null,
      holdId: null,
      expiresAt: null,
      buyerName: null,
      buyerPhone: null,
    }),
}));
