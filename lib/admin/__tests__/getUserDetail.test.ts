/**
 * Unit tests for getCustomerDetail (Issue 066). Prisma injected as a stub.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: { customer: { findUnique: vi.fn() }, booking: { count: vi.fn() } },
}));

import { getCustomerDetail } from '../getUserDetail';

function makePrisma(customer: unknown, bookingCount = 0) {
  return {
    customer: { findUnique: vi.fn().mockResolvedValue(customer) },
    booking: { count: vi.fn().mockResolvedValue(bookingCount) },
  } as never;
}

describe('getCustomerDetail', () => {
  it('returns null when the customer does not exist', async () => {
    expect(await getCustomerDetail('nope', makePrisma(null))).toBeNull();
  });

  it('maps the profile, masks the phone, derives status, and counts bookings', async () => {
    const prisma = makePrisma(
      {
        id: 'c1',
        displayName: 'Alice',
        phone: '+84901234567',
        email: 'a@x.test',
        suspendedAt: new Date('2026-05-02'),
        deletedAt: null,
        createdAt: new Date('2026-05-01'),
        lastLoginAt: new Date('2026-05-10'),
      },
      4
    );

    const detail = await getCustomerDetail('c1', prisma);
    expect(detail).toEqual({
      id: 'c1',
      name: 'Alice',
      phoneMasked: '+xxxxxxx4567',
      email: 'a@x.test',
      status: 'suspended',
      createdAt: new Date('2026-05-01'),
      lastLoginAt: new Date('2026-05-10'),
      bookingCount: 4,
    });
  });

  it('reports deleted status and a null masked phone for an anonymized customer', async () => {
    const prisma = makePrisma({
      id: 'c2',
      displayName: null,
      phone: null,
      email: null,
      suspendedAt: null,
      deletedAt: new Date('2026-05-05'),
      createdAt: new Date('2026-05-01'),
      lastLoginAt: null,
    });
    const detail = await getCustomerDetail('c2', prisma);
    expect(detail?.status).toBe('deleted');
    expect(detail?.phoneMasked).toBeNull();
    expect(detail?.name).toBe('—');
  });
});
