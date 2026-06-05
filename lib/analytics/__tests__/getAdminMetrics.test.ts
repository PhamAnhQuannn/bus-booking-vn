/**
 * Unit tests for lib/analytics/getAdminMetrics.ts (Issue 063).
 *
 * prisma.$queryRaw + prisma.customer/operator.count are mocked. getFunnel is
 * mocked at the module boundary so we assert delegation + that the same VN-tz
 * window input flows through.
 *
 * Money assertions (Issue 016): GMV + revenue come out of SQL as ::text strings;
 * the module parses them via BigInt then Number()s the final integer. revenueVnd
 * is the ABS of the NEGATIVE platform_fee sum.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    customer: { count: vi.fn() },
    operator: { count: vi.fn() },
  },
}));

vi.mock('../getFunnel', () => ({
  getFunnel: vi.fn(),
}));

import { prisma } from '@/lib/core/db/client';
import { getFunnel } from '../getFunnel';
import { getAdminMetrics } from '../getAdminMetrics';

const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;
const customerCount = prisma.customer.count as unknown as ReturnType<typeof vi.fn>;
const operatorCount = prisma.operator.count as unknown as ReturnType<typeof vi.fn>;
const funnelMock = getFunnel as unknown as ReturnType<typeof vi.fn>;

const FUNNEL_RESULT = [
  { step: 'search_performed', label: 'Tìm chuyến', sessions: 100, conversionPct: 100, dropPct: 0 },
  { step: 'booking_paid', label: 'Thanh toán xong', sessions: 25, conversionPct: 25, dropPct: 0 },
];

/**
 * Wire the two $queryRaw calls. getAdminMetrics issues them in a fixed order
 * inside Promise.all: [0] = bookings (cnt+gmv), [1] = revenue (fee_sum).
 */
function mockQueries(opts: { cnt: string; gmv: string; feeSum: string }) {
  queryRaw.mockImplementation((sql: unknown) => {
    // The Prisma.sql tagged-template carries its text fragments; route by content.
    const blob = JSON.stringify(sql);
    if (blob.includes('Booking')) {
      return Promise.resolve([{ cnt: opts.cnt, gmv: opts.gmv }]);
    }
    if (blob.includes('LedgerEntry')) {
      return Promise.resolve([{ fee_sum: opts.feeSum }]);
    }
    return Promise.resolve([]);
  });
}

describe('getAdminMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    funnelMock.mockResolvedValue(FUNNEL_RESULT);
    customerCount.mockResolvedValue(42);
    operatorCount.mockImplementation((arg?: { where?: { status?: string } }) =>
      Promise.resolve(arg?.where?.status === 'APPROVED' ? 7 : 12)
    );
    mockQueries({ cnt: '25', gmv: '12500000', feeSum: '-750000' });
  });

  it('returns customers / operators(total+approved) / bookings / gmv / revenue / funnel', async () => {
    const m = await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });

    expect(m.customers).toBe(42);
    expect(m.operators).toEqual({ total: 12, approved: 7 });
    expect(m.bookings).toBe(25);
    expect(m.gmvVnd).toBe(12_500_000);
    expect(m.revenueVnd).toBe(750_000); // ABS of -750000
    expect(m.funnel).toBe(FUNNEL_RESULT);
  });

  it('counts customers with deletedAt: null (soft-delete excluded)', async () => {
    await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(customerCount).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('counts approved operators with status APPROVED', async () => {
    await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(operatorCount).toHaveBeenCalledWith({ where: { status: 'APPROVED' } });
    expect(operatorCount).toHaveBeenCalledWith(); // total count, no filter
  });

  it('revenueVnd is the ABS of the negative platform_fee sum', async () => {
    mockQueries({ cnt: '3', gmv: '300000', feeSum: '-12000' });
    const m = await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(m.revenueVnd).toBe(12_000);
  });

  it('revenueVnd is 0 when there are no platform_fee entries', async () => {
    mockQueries({ cnt: '0', gmv: '0', feeSum: '0' });
    const m = await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(m.revenueVnd).toBe(0);
    expect(m.gmvVnd).toBe(0);
    expect(m.bookings).toBe(0);
  });

  it('handles a large VND fee sum without float drift (BigInt-parsed)', async () => {
    // 9,007,199,254 VND of fees — comfortably a real platform total; abs of negative.
    mockQueries({ cnt: '5', gmv: '150000000000', feeSum: '-9007199254' });
    const m = await getAdminMetrics({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(m.revenueVnd).toBe(9_007_199_254);
    expect(m.gmvVnd).toBe(150_000_000_000);
  });

  it('delegates the funnel wholesale to getFunnel with the same input', async () => {
    const input = { dateFrom: '2026-05-01', dateTo: '2026-05-31' };
    await getAdminMetrics(input);
    expect(funnelMock).toHaveBeenCalledWith(input);
  });

  it('binds VN-tz window boundaries into the booking + ledger queries', async () => {
    await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });

    // Collect every bound Date across all $queryRaw invocations.
    const dates: Date[] = [];
    const walk = (v: unknown) => {
      if (v instanceof Date) dates.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(queryRaw.mock.calls);

    const start = new Date('2026-05-01T00:00:00+07:00');
    const end = new Date('2026-05-31T23:59:59+07:00');
    expect(dates.some((d) => d.getTime() === start.getTime())).toBe(true);
    expect(dates.some((d) => d.getTime() === end.getTime())).toBe(true);
  });

  it('issues both aggregate queries (bookings + ledger)', async () => {
    await getAdminMetrics({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
