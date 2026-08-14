// Regression tests for the trip-planner correctness fixes (#528 / #529).
import { describe, it, expect } from 'vitest';
import { nights } from '../labels';
import { requestFromParams, toURLSearchParams } from '../fromParams';
import { buildItinerary } from '../plan';
import type { Store } from '../store';
import type { KbRecord, TripRequest } from '../types';

describe('nights() — clamp >= 0 (#529)', () => {
  it('0 days → 0 nights (was "-1 đêm")', () => expect(nights(0)).toBe(0));
  it('3 days → 2 nights', () => expect(nights(3)).toBe(2));
  it('1 day → 0 nights', () => expect(nights(1)).toBe(0));
});

describe('toURLSearchParams — repeated array params preserved (#528)', () => {
  it('joins string[] as CSV instead of dropping all but v[0]', () => {
    const sp = toURLSearchParams({ interests: ['a', 'b'], slug: 'da-lat' });
    expect(sp.get('interests')).toBe('a,b');
    expect(sp.get('slug')).toBe('da-lat');
  });
});

describe('requestFromParams — adults floor (#528)', () => {
  it('?adults=0 → default 2 (no zero-person trip)', () => {
    expect(requestFromParams(new URLSearchParams('adults=0')).party.adults).toBe(2);
  });
  it('?adults=3 → 3 (valid value kept)', () => {
    expect(requestFromParams(new URLSearchParams('adults=3')).party.adults).toBe(3);
  });
  it('children/elders still accept 0', () => {
    const r = requestFromParams(new URLSearchParams('children=0&elders=0'));
    expect(r.party.children).toBe(0);
    expect(r.party.elders).toBe(0);
  });
});

describe('buildItinerary — NaN OSRM matrix does not throw (#529)', () => {
  function rec(id: string, lat: number, lon: number): KbRecord {
    return { id, name: `Nơi ${id}`, region_id: 'r1', source_ids: ['s'], coordinates: { latitude: lat, longitude: lon } };
  }
  // Ragged matrix (island city) — off-diagonal durations are NaN.
  const store: Store = {
    slug: 'phu-quoc',
    generatedAt: '2026-01-01',
    tam: { lat: 10.22, lon: 103.96 },
    destinations: [rec('d1', 10.22, 103.96), rec('d2', 10.29, 103.99)],
    restaurants: [],
    hotels: [rec('h1', 10.22, 103.96)],
    matrix: { ids: ['d1', 'd2'], durations: [[0, NaN], [NaN, 0]], distances: [[0, 0], [0, 0]] },
    matrixIndex: new Map([['d1', 0], ['d2', 1]]),
  };
  const req: TripRequest = { slug: 'phu-quoc', days: 1, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('returns an itinerary with finite leg costs (haversine fallback)', () => {
    const it = buildItinerary(req, store);
    const items = it.days.flatMap((d) => d.items);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      if (i.leg_from_prev) expect(Number.isFinite(i.leg_from_prev.minutes)).toBe(true);
    }
  });
});
