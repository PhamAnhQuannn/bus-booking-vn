import { describe, it, expect, beforeEach } from 'vitest';
import { useBookingStore } from '../bookingStore';

beforeEach(() => {
  // Reset store between tests
  useBookingStore.getState().clearBooking();
});

describe('bookingStore', () => {
  it('starts with all null values', () => {
    const state = useBookingStore.getState();
    expect(state.tripId).toBeNull();
    expect(state.ticketCount).toBeNull();
    expect(state.holdId).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.buyerName).toBeNull();
    expect(state.buyerPhone).toBeNull();
    expect(state.buyerEmail).toBeNull();
  });

  it('setTrip updates tripId and ticketCount', () => {
    useBookingStore.getState().setTrip('trip-123', 2);
    const state = useBookingStore.getState();
    expect(state.tripId).toBe('trip-123');
    expect(state.ticketCount).toBe(2);
  });

  it('setTrip clears holdId and expiresAt', () => {
    useBookingStore.getState().setHold('hold-abc', '2026-05-17T13:00:00.000Z');
    useBookingStore.getState().setTrip('trip-456', 1);
    const state = useBookingStore.getState();
    expect(state.holdId).toBeNull();
    expect(state.expiresAt).toBeNull();
  });

  it('setHold updates holdId and expiresAt', () => {
    useBookingStore.getState().setHold('hold-xyz', '2026-05-17T13:10:00.000Z');
    const state = useBookingStore.getState();
    expect(state.holdId).toBe('hold-xyz');
    expect(state.expiresAt).toBe('2026-05-17T13:10:00.000Z');
  });

  it('setBuyerInfo updates buyerName, buyerPhone, and buyerEmail', () => {
    useBookingStore.getState().setBuyerInfo('Nguyen Van A', '0912345678', 'buyer@example.com');
    const state = useBookingStore.getState();
    expect(state.buyerName).toBe('Nguyen Van A');
    expect(state.buyerPhone).toBe('0912345678');
    expect(state.buyerEmail).toBe('buyer@example.com');
  });

  it('clearBooking resets all fields to null', () => {
    useBookingStore.getState().setTrip('trip-1', 2);
    useBookingStore.getState().setHold('hold-1', '2026-05-17T12:00:00.000Z');
    useBookingStore.getState().setBuyerInfo('Test Name', '0912345678', 'test@example.com');
    useBookingStore.getState().clearBooking();
    const state = useBookingStore.getState();
    expect(state.tripId).toBeNull();
    expect(state.ticketCount).toBeNull();
    expect(state.holdId).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.buyerName).toBeNull();
    expect(state.buyerPhone).toBeNull();
    expect(state.buyerEmail).toBeNull();
  });
});
