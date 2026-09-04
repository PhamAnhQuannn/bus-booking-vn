/**
 * Unit tests for selectPopularTrips — pure popular-trips card selection.
 *
 * The single corridor's value is its many boarding towns, so a route is FANNED
 * OUT into one card per boarding point (route origin + each stop) — a rider in
 * each pickup town sees their own "Nông Cống → Sài Gòn" card. Cards are deduped
 * by origin→destination and sliced to the limit.
 */

import { describe, it, expect } from 'vitest';
import { selectPopularTrips } from '../selectPopularTrips';
import type { ActiveRoute } from '@/lib/core/db/getActiveRoutes';

function route(overrides: Partial<ActiveRoute> & Pick<ActiveRoute, 'origin' | 'destination'>): ActiveRoute {
  return {
    operatorCount: 1,
    minPrice: 100000,
    minDurationMinutes: 120,
    nextDepartureAt: '2026-09-10T00:00:00.000Z',
    boardingSchedule: null,
    ...overrides,
  };
}

describe('selectPopularTrips', () => {
  it('fans a route with multiple boarding-town stops into one card per pickup', () => {
    const routes: ActiveRoute[] = [
      route({
        origin: 'Thanh Hóa',
        destination: 'Sài Gòn',
        boardingSchedule: [
          { point: 'Nông Cống', time: '03:00' },
          { point: 'Triệu Sơn', time: '03:30' },
          { point: 'Quảng Xương', time: '04:00' },
        ],
      }),
    ];

    const result = selectPopularTrips(routes, {});

    // Route origin + 3 pickups = 4 cards, all to the same destination.
    expect(result.map((r) => `${r.origin}→${r.destination}`)).toEqual([
      'Thanh Hóa→Sài Gòn',
      'Nông Cống→Sài Gòn',
      'Triệu Sơn→Sài Gòn',
      'Quảng Xương→Sài Gòn',
    ]);
  });

  it('fans every route and preserves order across routes', () => {
    const routes: ActiveRoute[] = [
      route({
        origin: 'Thanh Hóa',
        destination: 'Sài Gòn',
        boardingSchedule: [{ point: 'Nông Cống', time: '03:00' }],
      }),
      route({ origin: 'Hà Nội', destination: 'Đà Nẵng' }),
      route({ origin: 'Sài Gòn', destination: 'Đà Lạt' }),
    ];

    const result = selectPopularTrips(routes, {});

    // First route fans into 2 cards (origin + 1 pickup); the other two have no
    // boarding schedule → 1 card each. 4 total.
    expect(result.map((r) => `${r.origin}→${r.destination}`)).toEqual([
      'Thanh Hóa→Sài Gòn',
      'Nông Cống→Sài Gòn',
      'Hà Nội→Đà Nẵng',
      'Sài Gòn→Đà Lạt',
    ]);
  });

  it('dedupes to one card per origin→destination across stops and routes', () => {
    const routes: ActiveRoute[] = [
      // A stop whose point equals the route's own origin must not double-card it.
      route({
        origin: 'Thanh Hóa',
        destination: 'Sài Gòn',
        boardingSchedule: [
          { point: 'Thanh Hóa', time: '02:30' },
          { point: 'Nông Cống', time: '03:00' },
        ],
      }),
      // A second route with the same origin+destination collapses into the same card.
      route({
        origin: 'Thanh Hóa',
        destination: 'Sài Gòn',
        boardingSchedule: [{ point: 'Nông Cống', time: '05:00' }],
      }),
    ];

    const result = selectPopularTrips(routes, {});

    // Only the two distinct origin→destination keys survive.
    expect(result.map((r) => `${r.origin}→${r.destination}`)).toEqual([
      'Thanh Hóa→Sài Gòn',
      'Nông Cống→Sài Gòn',
    ]);
  });

  it('slices the fanned-out selection to the limit', () => {
    const routes: ActiveRoute[] = Array.from({ length: 20 }, (_, i) =>
      route({ origin: `Origin ${i}`, destination: `Dest ${i}` }),
    );

    const result = selectPopularTrips(routes, {}, 12);

    expect(result).toHaveLength(12);
  });

  it('applies the image-fallback map by origin slug and keeps fields intact', () => {
    const routes: ActiveRoute[] = [
      route({ origin: 'Nông Cống', destination: 'Sài Gòn', minPrice: 250000, minDurationMinutes: 480 }),
    ];

    const result = selectPopularTrips(routes, { 'nong-cong': 'thanh-hoa' });

    expect(result).toEqual([
      { origin: 'Nông Cống', destination: 'Sài Gòn', slug: 'thanh-hoa', price: 250000, duration: 480 },
    ]);
  });
});
