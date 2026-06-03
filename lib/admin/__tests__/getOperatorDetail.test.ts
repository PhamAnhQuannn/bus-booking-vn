/**
 * Issue 067: unit tests for getOperatorDetail.
 *
 * Mocks the shared prisma client + the ledger lib calls (getOperatorBalance,
 * getEffectiveFeeRate). Asserts the aggregation shape, phone masking, bigint GMV
 * parse, and the null-when-missing contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBalance, mockFeeRate } = vi.hoisted(() => ({
  mockBalance: vi.fn(),
  mockFeeRate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/ledger/balance', () => ({ getOperatorBalance: mockBalance }));
vi.mock('@/lib/ledger/feeConfig', () => ({ getEffectiveFeeRate: mockFeeRate }));

import { getOperatorDetail } from '../getOperatorDetail';

function fakePrisma(opts: {
  operator: unknown;
  busCount?: number;
  tripCount?: number;
  upcomingCount?: number;
  gmv?: string;
  payouts?: unknown[];
}) {
  // trip.count is called twice (total then upcoming) — return in sequence.
  const tripCount = vi
    .fn()
    .mockResolvedValueOnce(opts.tripCount ?? 0)
    .mockResolvedValueOnce(opts.upcomingCount ?? 0);
  return {
    operator: { findUnique: vi.fn(async () => opts.operator) },
    bus: { count: vi.fn(async () => opts.busCount ?? 0) },
    trip: { count: tripCount },
    payout: { findMany: vi.fn(async () => opts.payouts ?? []) },
    $queryRaw: vi.fn(async () => [{ gmv: opts.gmv ?? '0' }]),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBalance.mockResolvedValue({ pending: BigInt(100), available: BigInt(200), paidOut: BigInt(50) });
  mockFeeRate.mockResolvedValue(60000);
});

describe('getOperatorDetail', () => {
  it('returns null when the operator does not exist', async () => {
    const prisma = fakePrisma({ operator: null });
    expect(await getOperatorDetail('missing', prisma)).toBeNull();
  });

  it('aggregates profile, fleet/trips/volume, balance, fee, payouts', async () => {
    const now = new Date('2026-06-02T00:00:00Z');
    const prisma = fakePrisma({
      operator: {
        id: 'op_1',
        legalName: 'Acme Lines',
        contactEmail: 'ops@acme.test',
        contactPhone: '+84901234567',
        status: 'APPROVED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        rejectionReason: null,
      },
      busCount: 4,
      tripCount: 120,
      upcomingCount: 7,
      gmv: '987654321',
      payouts: [
        {
          id: 'po_1',
          net: 5000,
          status: 'paid',
          scheduledAt: new Date('2026-05-01T00:00:00Z'),
          settledAt: new Date('2026-05-02T00:00:00Z'),
        },
      ],
    });

    const detail = await getOperatorDetail('op_1', prisma, now);
    expect(detail).not.toBeNull();
    expect(detail!.legalName).toBe('Acme Lines');
    // Phone masked: last 4 digits kept, rest x'd.
    expect(detail!.contactPhoneMasked).toBe('+xxxxxxx4567');
    expect(detail!.fleetCount).toBe(4);
    expect(detail!.tripCount).toBe(120);
    expect(detail!.upcomingTripCount).toBe(7);
    // GMV parsed as bigint — no float drift.
    expect(detail!.gmvVnd).toBe(BigInt('987654321'));
    expect(detail!.balance).toEqual({ pending: BigInt(100), available: BigInt(200), paidOut: BigInt(50) });
    expect(detail!.currentFeePpm).toBe(60000);
    expect(detail!.payoutHistory).toHaveLength(1);
    expect(detail!.payoutHistory[0]).toMatchObject({ id: 'po_1', net: 5000, status: 'paid' });

    // Fee rate resolved for this operator at `now`.
    expect(mockFeeRate).toHaveBeenCalledWith('op_1', now);
    expect(mockBalance).toHaveBeenCalledWith('op_1');
  });

  it('defaults GMV to 0n when no paid bookings', async () => {
    const prisma = fakePrisma({
      operator: {
        id: 'op_2',
        legalName: 'Empty Co',
        contactEmail: 'e@e.test',
        contactPhone: '+84908888888',
        status: 'APPROVED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        rejectionReason: null,
      },
      gmv: '0',
    });
    const detail = await getOperatorDetail('op_2', prisma);
    expect(detail!.gmvVnd).toBe(BigInt(0));
  });
});
