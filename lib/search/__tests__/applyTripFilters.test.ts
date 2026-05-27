import { describe, it, expect } from 'vitest';
import { applyTripFilters, vnHour, windowOf } from '@/lib/search/applyTripFilters';
import { searchFiltersSchema } from '@/lib/validation/search';
import type { TripResult } from '@/lib/db/searchTrips';

/** Build a TripResult with sensible defaults. departureAt given as a VN wall-clock
 * hour, converted to the matching UTC instant (VN = UTC+7) on a fixed date. */
function trip(overrides: Partial<TripResult> & { vnHourLocal?: number } = {}): TripResult {
  const { vnHourLocal = 8, ...rest } = overrides;
  const utcHour = (vnHourLocal - 7 + 24) % 24;
  const departureAt = `2026-06-01T${String(utcHour).padStart(2, '0')}:00:00.000Z`;
  return {
    tripId: 't1',
    departureAt,
    price: 200_000,
    availableSeats: 30,
    operatorLegalName: 'Nhà xe A',
    operatorId: 'op-a',
    busType: 'coach',
    durationMinutes: 360,
    routeOrigin: 'Hà Nội',
    routeDestination: 'TP.HCM',
    ...rest,
  };
}

const defaults = () => searchFiltersSchema.parse({});

describe('vnHour / windowOf', () => {
  it('maps UTC instant to VN-local hour (UTC+7)', () => {
    // 01:00 UTC = 08:00 VN
    expect(vnHour('2026-06-01T01:00:00.000Z')).toBe(8);
    // 18:00 UTC = 01:00 VN next day
    expect(vnHour('2026-06-01T18:00:00.000Z')).toBe(1);
  });

  it('buckets hours into windows', () => {
    expect(windowOf(5)).toBe('morning');
    expect(windowOf(10)).toBe('morning');
    expect(windowOf(11)).toBe('afternoon');
    expect(windowOf(16)).toBe('afternoon');
    expect(windowOf(17)).toBe('evening');
    expect(windowOf(21)).toBe('evening');
    expect(windowOf(22)).toBe('night');
    expect(windowOf(4)).toBe('night');
  });
});

describe('applyTripFilters — facets', () => {
  it('derives facets from the unfiltered base set', () => {
    const base = [
      trip({ tripId: 'a', operatorId: 'op-a', operatorLegalName: 'A', busType: 'coach', price: 100_000, durationMinutes: 240 }),
      trip({ tripId: 'b', operatorId: 'op-b', operatorLegalName: 'B', busType: 'sleeper', price: 300_000, durationMinutes: 480 }),
      trip({ tripId: 'c', operatorId: 'op-a', operatorLegalName: 'A', busType: 'coach', price: 200_000, durationMinutes: 360 }),
    ];
    const { facets } = applyTripFilters(base, defaults());
    expect(facets.operators).toEqual([
      { id: 'op-a', legalName: 'A', count: 2 },
      { id: 'op-b', legalName: 'B', count: 1 },
    ]);
    expect(facets.priceRange).toEqual({ min: 100_000, max: 300_000 });
    expect(facets.durationRange).toEqual({ min: 240, max: 480 });
    expect(facets.busTypes).toContainEqual({ value: 'coach', count: 2 });
    expect(facets.busTypes).toContainEqual({ value: 'sleeper', count: 1 });
  });

  it('keeps full facets even when a filter narrows results', () => {
    const base = [
      trip({ tripId: 'a', operatorId: 'op-a' }),
      trip({ tripId: 'b', operatorId: 'op-b' }),
    ];
    const filters = searchFiltersSchema.parse({ operatorId: 'op-a' });
    const { trips, facets } = applyTripFilters(base, filters);
    expect(trips).toHaveLength(1);
    expect(facets.operators).toHaveLength(2); // both still offered
  });

  it('empty base → null ranges', () => {
    const { facets, trips, totalBeforeFilters } = applyTripFilters([], defaults());
    expect(trips).toHaveLength(0);
    expect(totalBeforeFilters).toBe(0);
    expect(facets.priceRange).toBeNull();
    expect(facets.durationRange).toBeNull();
  });
});

describe('applyTripFilters — filtering', () => {
  const base = [
    trip({ tripId: 'a', operatorId: 'op-a', busType: 'coach', price: 100_000, durationMinutes: 240, vnHourLocal: 7 }),
    trip({ tripId: 'b', operatorId: 'op-b', busType: 'sleeper', price: 300_000, durationMinutes: 600, vnHourLocal: 14 }),
    trip({ tripId: 'c', operatorId: 'op-a', busType: 'limousine', price: 500_000, durationMinutes: 480, vnHourLocal: 20 }),
  ];

  it('filters by operator', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ operatorId: 'op-a' }));
    expect(trips.map((t) => t.tripId)).toEqual(['a', 'c']);
  });

  it('filters by busType (csv)', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ busType: 'coach,sleeper' }));
    expect(trips.map((t) => t.tripId).sort()).toEqual(['a', 'b']);
  });

  it('filters by price range', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ priceMin: '150000', priceMax: '400000' }));
    expect(trips.map((t) => t.tripId)).toEqual(['b']);
  });

  it('filters by max duration', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ maxDurationMinutes: '400' }));
    expect(trips.map((t) => t.tripId)).toEqual(['a']);
  });

  it('filters by departure window (VN tz)', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ window: 'evening' }));
    expect(trips.map((t) => t.tripId)).toEqual(['c']); // 20:00 VN
  });

  it('ignores unknown busType tokens', () => {
    const { trips } = applyTripFilters(base, searchFiltersSchema.parse({ busType: 'coach,bogus' }));
    expect(trips.map((t) => t.tripId)).toEqual(['a']);
  });
});

describe('applyTripFilters — sorting', () => {
  // VN hours kept ≥7 so the UTC instant stays on the same date (avoids prev-day wrap).
  const base = [
    trip({ tripId: 'mid', price: 200_000, durationMinutes: 360, vnHourLocal: 12 }),
    trip({ tripId: 'cheap', price: 100_000, durationMinutes: 480, vnHourLocal: 8 }),
    trip({ tripId: 'pricey', price: 300_000, durationMinutes: 240, vnHourLocal: 18 }),
  ];

  it('default departure_asc', () => {
    const { trips } = applyTripFilters(base, defaults());
    expect(trips.map((t) => t.tripId)).toEqual(['cheap', 'mid', 'pricey']);
  });

  it('price_asc / price_desc', () => {
    expect(
      applyTripFilters(base, searchFiltersSchema.parse({ sort: 'price_asc' })).trips.map((t) => t.tripId)
    ).toEqual(['cheap', 'mid', 'pricey']);
    expect(
      applyTripFilters(base, searchFiltersSchema.parse({ sort: 'price_desc' })).trips.map((t) => t.tripId)
    ).toEqual(['pricey', 'mid', 'cheap']);
  });

  it('duration_asc', () => {
    expect(
      applyTripFilters(base, searchFiltersSchema.parse({ sort: 'duration_asc' })).trips.map((t) => t.tripId)
    ).toEqual(['pricey', 'mid', 'cheap']);
  });
});
