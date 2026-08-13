/**
 * Unit test for lib/account/exportData.ts (#471 PDPL access).
 * Asserts the query is scoped to the caller and never selects secret fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock('@/lib/core/db/client', () => ({
  prisma: { customer: { findUnique: mockFindUnique } },
}));

import { exportCustomerData } from '../exportData';

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ id: 'cust-1', email: 'a@b.co', sessions: [], bookings: [] });
});

describe('exportCustomerData', () => {
  it('scopes the query to the given customerId', async () => {
    await exportCustomerData('cust-1');
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-1' } }),
    );
  });

  it('never selects secret fields (passwordHash / refreshTokenHash / confirmationToken)', async () => {
    await exportCustomerData('cust-1');
    const arg = mockFindUnique.mock.calls[0][0];
    const serialized = JSON.stringify(arg);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshTokenHash');
    expect(serialized).not.toContain('tokenFamily');
    expect(serialized).not.toContain('confirmationToken');
  });

  it('returns the customer row (or null when not found)', async () => {
    expect(await exportCustomerData('cust-1')).toMatchObject({ id: 'cust-1' });
    mockFindUnique.mockResolvedValueOnce(null);
    expect(await exportCustomerData('missing')).toBeNull();
  });
});
