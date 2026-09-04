/**
 * Unit tests for selectPopularTrips — pure popular-trips card selection.
 *
 * Regression coverage for the landing-page near-duplicate bug: a route with
 * several boarding-town stops must contribute exactly one card, so the section
 * shows route diversity instead of N near-identical cards (same destination,
 * price, duration; differing only by pickup town).
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
  it('caps a route with multiple boarding-town stops to a single card', () => {
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

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ origin: 'Thanh Hóa', destination: 'Sài Gòn' });
  });

  it('preserves distinct routes as separate cards', () => {
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

    expect(result).toHaveLength(3);
    expect(result.map((r) => `${r.origin}→${r.destination}`)).toEqual([
      'Thanh Hóa→Sài Gòn',
      'Hà Nội→Đà Nẵng',
      'Sài Gòn→Đà Lạt',
    ]);
  });

  it('slices the final diverse selection to the limit', () => {
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
