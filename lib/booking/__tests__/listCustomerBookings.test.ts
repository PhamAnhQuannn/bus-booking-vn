/**
 * Unit tests for lib/booking/listCustomerBookings.ts
 * prisma.booking.findMany is mocked; the tab partition (where/orderBy) and
 * cursor slicing are asserted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    booking: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/core/db/client';
import { listCustomerBookings } from '../listCustomerBookings';

const findMany = prisma.booking.findMany as unknown as ReturnType<typeof vi.fn>;

function rawRow(id: string) {
  return {
    id,
    bookingRef: `BB-2026-${id}-aaaa`,
    customerId: 'cust-1',
    ticketCount: 2,
    totalVnd: 300000,
    paymentMethod: 'momo',
    status: 'paid',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    trip: {
      departureAt: new Date('2026-06-01T03:00:00Z'),
      route: { origin: 'Hanoi', destination: 'Sapa' },
    },
  };
}

describe('listCustomerBookings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upcoming: active statuses + future departure, ASC sort, scoped to customerId', async () => {
    findMany.mockResolvedValue([rawRow('aaa')]);

    await listCustomerBookings('cust-1', { tab: 'upcoming' });

    const arg = findMany.mock.calls[0][0];
    expect(arg.where.customerId).toBe('cust-1');
    expect(arg.where.status.in).toEqual([
      'awaiting_payment',
      'paid',
    ]);
    expect(arg.where.trip.departureAt.gte).toBeInstanceOf(Date);
    expect(arg.orderBy).toEqual([{ trip: { departureAt: 'asc' } }, { id: 'asc' }]);
  });

  it('past: departed OR terminal status, DESC sort', async () => {
    findMany.mockResolvedValue([]);

    await listCustomerBookings('cust-1', { tab: 'past' });

    const arg = findMany.mock.calls[0][0];
    expect(arg.where.customerId).toBe('cust-1');
    expect(arg.where.OR).toEqual([
      { trip: { departureAt: { lt: expect.any(Date) } } },
      {
        status: {
          in: ['completed', 'cancelled', 'trip_cancelled', 'no_show', 'payment_failed_expired'],
        },
      },
    ]);
    expect(arg.orderBy).toEqual([{ trip: { departureAt: 'desc' } }, { id: 'desc' }]);
  });

  it('defaults to upcoming tab and limit 50', async () => {
    findMany.mockResolvedValue([]);
    await listCustomerBookings('cust-1', {});
    const arg = findMany.mock.calls[0][0];
    expect(arg.take).toBe(51); // limit + 1
    expect(arg.where.status).toBeDefined(); // upcoming branch
  });

  it('returns nextCursor when an extra row beyond limit is fetched', async () => {
    findMany.mockResolvedValue([rawRow('a'), rawRow('b'), rawRow('c')]);
    const result = await listCustomerBookings('cust-1', { tab: 'upcoming', limit: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.nextCursor).toBe('b');
  });

  it('returns null nextCursor when rows fit within limit', async () => {
    findMany.mockResolvedValue([rawRow('a')]);
    const result = await listCustomerBookings('cust-1', { tab: 'upcoming', limit: 2 });
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('passes Prisma cursor + skip when a cursor is supplied', async () => {
    findMany.mockResolvedValue([]);
    await listCustomerBookings('cust-1', { tab: 'upcoming', cursor: 'bk-9' });
    const arg = findMany.mock.calls[0][0];
    expect(arg.cursor).toEqual({ id: 'bk-9' });
    expect(arg.skip).toBe(1);
  });

  it('maps raw rows to the customer DTO shape (ISO dates, route flattened)', async () => {
    findMany.mockResolvedValue([rawRow('aaa')]);
    const result = await listCustomerBookings('cust-1', { tab: 'upcoming' });
    expect(result.rows[0]).toEqual({
      id: 'aaa',
      bookingRef: 'BB-2026-aaa-aaaa',
      ticketCount: 2,
      totalVnd: 300000,
      paymentMethod: 'momo',
      status: 'paid',
      createdAt: '2026-05-01T00:00:00.000Z',
      route: { origin: 'Hanoi', destination: 'Sapa' },
      departureAt: '2026-06-01T03:00:00.000Z',
    });
  });
});
