/**
 * Unit tests for lib/booking/getCustomerBookingDetail.ts
 * prisma.booking.findFirst is mocked; ownership scoping + DTO mapping asserted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { getCustomerBookingDetail } from '../getCustomerBookingDetail';

const findFirst = prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>;

function rawDetail() {
  return {
    id: 'bk-1',
    bookingRef: 'BB-2026-abcd-efgh',
    customerId: 'cust-1',
    buyerName: 'Nguyen Van A',
    buyerPhone: '0901234567',
    ticketCount: 3,
    totalVnd: 450000,
    paymentMethod: 'cash',
    status: 'paid',
    createdAt: new Date('2026-05-02T01:00:00Z'),
    trip: {
      departureAt: new Date('2026-06-10T22:00:00Z'),
      route: { origin: 'Hanoi', destination: 'Hue' },
      bus: {
        licensePlate: '29B-12345',
        operator: { legalName: 'Phuong Trang', contactPhone: '+84909999999' },
      },
    },
  };
}

describe('getCustomerBookingDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the query by both id AND customerId (strict ownership)', async () => {
    findFirst.mockResolvedValue(rawDetail());
    await getCustomerBookingDetail('cust-1', 'bk-1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bk-1', customerId: 'cust-1' } })
    );
  });

  it('returns null when no owned booking matches', async () => {
    findFirst.mockResolvedValue(null);
    const result = await getCustomerBookingDetail('cust-1', 'bk-x');
    expect(result).toBeNull();
  });

  it('maps to the detail DTO including operator contact phone, no seat fields', async () => {
    findFirst.mockResolvedValue(rawDetail());
    const result = await getCustomerBookingDetail('cust-1', 'bk-1');
    expect(result).toEqual({
      id: 'bk-1',
      bookingRef: 'BB-2026-abcd-efgh',
      buyerName: 'Nguyen Van A',
      buyerPhone: '0901234567',
      ticketCount: 3,
      totalVnd: 450000,
      paymentMethod: 'cash',
      status: 'paid',
      createdAt: '2026-05-02T01:00:00.000Z',
      route: { origin: 'Hanoi', destination: 'Hue' },
      departureAt: '2026-06-10T22:00:00.000Z',
      busLicensePlate: '29B-12345',
      operator: { legalName: 'Phuong Trang', contactPhone: '+84909999999' },
    });
  });
});
