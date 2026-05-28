/**
 * Unit tests for lib/op/getActivityFeed (Issue 027).
 *
 * Coverage:
 *   - empty result returns []
 *   - tenant scoping: every query filters by operatorId / trip.operatorId
 *   - merge-sort returns events in timestamp DESC
 *   - result truncated at `limit`
 *   - low_capacity skips trips below the 0.9 threshold
 *   - capacity === 0 is skipped (divide-by-zero guard)
 *   - low_capacity ID is day-bucketed (prevents per-poll re-firing)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockBookingFindMany,
  mockTripFindMany,
} = vi.hoisted(() => ({
  mockBookingFindMany: vi.fn(),
  mockTripFindMany: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: { findMany: mockBookingFindMany },
    trip: { findMany: mockTripFindMany },
  },
}));

import { getActivityFeed } from '../getActivityFeed';

const OPERATOR_ID = 'op-org-A';

beforeEach(() => {
  vi.clearAllMocks();
  // default: all 4 queries return empty
  mockBookingFindMany.mockResolvedValue([]);
  mockTripFindMany.mockResolvedValue([]);
});

describe('getActivityFeed', () => {
  it('returns [] when no data', async () => {
    const result = await getActivityFeed({ operatorId: OPERATOR_ID });
    expect(result).toEqual([]);
  });

  it('scopes every query to operatorId', async () => {
    await getActivityFeed({ operatorId: OPERATOR_ID });
    // 2 booking.findMany calls (paid + escalated) — both via trip.operatorId
    const bookingCalls = mockBookingFindMany.mock.calls;
    expect(bookingCalls).toHaveLength(2);
    for (const [args] of bookingCalls) {
      expect(args.where.trip).toEqual({ operatorId: OPERATOR_ID });
    }
    // 2 trip.findMany calls (lifecycle + lowCap) — both via direct operatorId
    const tripCalls = mockTripFindMany.mock.calls;
    expect(tripCalls).toHaveLength(2);
    for (const [args] of tripCalls) {
      expect(args.where.operatorId).toBe(OPERATOR_ID);
    }
  });

  it('emits a booking.paid event for each paid booking', async () => {
    mockBookingFindMany
      .mockResolvedValueOnce([
        {
          id: 'b-paid-1',
          bookingRef: 'BB-2026-aaaa-1111',
          buyerName: 'Khach A',
          totalVnd: 250_000,
          createdAt: new Date('2026-05-28T10:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([]);
    const events = await getActivityFeed({ operatorId: OPERATOR_ID });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('booking.paid');
    expect(events[0].href).toBe('/op/bookings/b-paid-1');
  });

  it('returns events in DESC timestamp order', async () => {
    const older = new Date('2026-05-28T08:00:00Z');
    const newer = new Date('2026-05-28T12:00:00Z');
    mockBookingFindMany
      .mockResolvedValueOnce([
        { id: 'b-old', bookingRef: 'BB-old', buyerName: 'A', totalVnd: 100, createdAt: older },
        { id: 'b-new', bookingRef: 'BB-new', buyerName: 'B', totalVnd: 200, createdAt: newer },
      ])
      .mockResolvedValueOnce([]);
    const events = await getActivityFeed({ operatorId: OPERATOR_ID });
    expect(events[0].id).toContain('b-new');
    expect(events[1].id).toContain('b-old');
  });

  it('truncates at limit', async () => {
    const now = new Date('2026-05-28T12:00:00Z').getTime();
    const bookings = Array.from({ length: 10 }, (_, i) => ({
      id: `b-${i}`,
      bookingRef: `BB-${i}`,
      buyerName: 'X',
      totalVnd: 1,
      createdAt: new Date(now - i * 1000),
    }));
    mockBookingFindMany.mockResolvedValueOnce(bookings).mockResolvedValueOnce([]);
    const events = await getActivityFeed({ operatorId: OPERATOR_ID, limit: 3 });
    expect(events).toHaveLength(3);
  });

  describe('low_capacity', () => {
    it('emits when sold/capacity >= 0.9', async () => {
      mockTripFindMany
        .mockResolvedValueOnce([]) // lifecycle
        .mockResolvedValueOnce([
          {
            id: 't-full',
            departureAt: new Date('2026-05-28T20:00:00Z'),
            bus: { capacity: 10 },
            route: { origin: 'A', destination: 'B' },
            _count: { bookings: 9 }, // 90%
          },
        ]);
      const events = await getActivityFeed({ operatorId: OPERATOR_ID });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('trip.low_capacity');
    });

    it('skips when sold/capacity < 0.9', async () => {
      mockTripFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 't-mid',
            departureAt: new Date('2026-05-28T20:00:00Z'),
            bus: { capacity: 10 },
            route: { origin: 'A', destination: 'B' },
            _count: { bookings: 8 }, // 80%
          },
        ]);
      const events = await getActivityFeed({ operatorId: OPERATOR_ID });
      expect(events).toHaveLength(0);
    });

    it('skips capacity=0 trips (divide-by-zero guard)', async () => {
      mockTripFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 't-zero',
            departureAt: new Date('2026-05-28T20:00:00Z'),
            bus: { capacity: 0 },
            route: { origin: 'A', destination: 'B' },
            _count: { bookings: 5 },
          },
        ]);
      const events = await getActivityFeed({ operatorId: OPERATOR_ID });
      expect(events).toHaveLength(0);
    });

    it('day-buckets the id so the same trip does not re-fire across polls', async () => {
      const tripRow = {
        id: 't-full',
        departureAt: new Date('2026-05-28T20:00:00Z'),
        bus: { capacity: 10 },
        route: { origin: 'A', destination: 'B' },
        _count: { bookings: 10 },
      };
      mockTripFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([tripRow]);
      const first = await getActivityFeed({ operatorId: OPERATOR_ID });
      mockTripFindMany.mockClear();
      mockTripFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([tripRow]);
      const second = await getActivityFeed({ operatorId: OPERATOR_ID });
      expect(first[0].id).toBe(second[0].id); // stable day-bucketed id
    });
  });
});
