/**
 * Unit tests for capacityGuard pure math —
 * checks that a proposed new capacity is at least max(activeHolds + paidBookings)
 * across the supplied trip occupancy snapshots.
 */

import { describe, it, expect } from 'vitest';
import { canReduceCapacity, type TripOccupancy } from '../capacityGuard';

const occ = (id: string, heldSeats: number, bookedSeats: number): TripOccupancy => ({
  tripId: id,
  heldSeats,
  bookedSeats,
});

describe('canReduceCapacity', () => {
  it('accepts when new capacity >= max occupancy across trips', () => {
    const trips: TripOccupancy[] = [occ('t1', 5, 10), occ('t2', 8, 6)];
    expect(canReduceCapacity(20, trips)).toEqual({ ok: true });
  });

  it('rejects when one trip exceeds new capacity', () => {
    const trips: TripOccupancy[] = [occ('t1', 5, 10), occ('t2', 18, 6)];
    const result = canReduceCapacity(20, trips);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violatingTrips).toHaveLength(1);
      expect(result.violatingTrips[0].tripId).toBe('t2');
      expect(result.violatingTrips[0].occupancy).toBe(24);
    }
  });

  it('treats hold + booking sums independently per trip', () => {
    const trips: TripOccupancy[] = [occ('t1', 12, 12)]; // 24
    const result = canReduceCapacity(23, trips);
    expect(result.ok).toBe(false);
  });

  it('accepts when capacity equals max occupancy exactly', () => {
    const trips: TripOccupancy[] = [occ('t1', 10, 10)];
    expect(canReduceCapacity(20, trips)).toEqual({ ok: true });
  });

  it('accepts when no trips supplied (no future occupancy)', () => {
    expect(canReduceCapacity(5, [])).toEqual({ ok: true });
  });

  it('reports all violating trips, not just the first', () => {
    const trips: TripOccupancy[] = [occ('t1', 10, 10), occ('t2', 12, 11), occ('t3', 1, 1)];
    const result = canReduceCapacity(15, trips);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violatingTrips.map((t) => t.tripId).sort()).toEqual(['t1', 't2']);
    }
  });
});
