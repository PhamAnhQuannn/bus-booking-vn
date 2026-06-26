import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    hold: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/core/db/client';
import { getHoldDetails } from '../getHoldDetails';

const findUnique = prisma.hold.findUnique as unknown as ReturnType<typeof vi.fn>;

function rawHold() {
  return {
    tripId: 'trip-1',
    ticketCount: 2,
    expiresAt: new Date('2026-06-27T10:00:00Z'),
    pickupKind: 'station' as 'station' | 'custom',
    pickupDetail: null as string | null,
    trip: {
      price: 270000,
      departureAt: new Date('2026-06-28T01:30:00Z'),
      route: { origin: 'Hà Nội', destination: 'Sài Gòn' },
      bus: { operator: { legalName: 'Nhà xe Phương Trang' } },
    },
  };
}

describe('getHoldDetails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full HoldDetails DTO with all fields mapped', async () => {
    findUnique.mockResolvedValue(rawHold());
    const result = await getHoldDetails('hold-1');

    expect(result).toEqual({
      tripId: 'trip-1',
      ticketCount: 2,
      expiresAt: '2026-06-27T10:00:00.000Z',
      unitPriceVND: 270000,
      totalVND: 540000,
      routeOrigin: 'Hà Nội',
      routeDestination: 'Sài Gòn',
      departureAt: '2026-06-28T01:30:00.000Z',
      operatorLegalName: 'Nhà xe Phương Trang',
      pickupKind: 'station',
      pickupDetail: null,
    });
  });

  it('queries by holdId', async () => {
    findUnique.mockResolvedValue(rawHold());
    await getHoldDetails('hold-abc');
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'hold-abc' } })
    );
  });

  it('returns null when hold not found', async () => {
    findUnique.mockResolvedValue(null);
    const result = await getHoldDetails('nonexistent');
    expect(result).toBeNull();
  });

  it('computes totalVND as price * ticketCount', async () => {
    const hold = rawHold();
    hold.trip.price = 150000;
    hold.ticketCount = 3;
    findUnique.mockResolvedValue(hold);

    const result = await getHoldDetails('hold-1');
    expect(result!.unitPriceVND).toBe(150000);
    expect(result!.totalVND).toBe(450000);
  });

  it('converts date fields to ISO strings', async () => {
    findUnique.mockResolvedValue(rawHold());
    const result = await getHoldDetails('hold-1');
    expect(result!.expiresAt).toBe('2026-06-27T10:00:00.000Z');
    expect(result!.departureAt).toBe('2026-06-28T01:30:00.000Z');
  });

  it('handles custom pickup with detail', async () => {
    const hold = rawHold();
    hold.pickupKind = 'custom';
    hold.pickupDetail = '123 Nguyen Trai, Q5';
    findUnique.mockResolvedValue(hold);

    const result = await getHoldDetails('hold-1');
    expect(result!.pickupKind).toBe('custom');
    expect(result!.pickupDetail).toBe('123 Nguyen Trai, Q5');
  });
});
