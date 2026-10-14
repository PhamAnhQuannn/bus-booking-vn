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

  it('#842: includes planner chats, charter requests, booking notifications + consents', async () => {
    await exportCustomerData('cust-1');
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select.plannerConversations.select.messages.select).toEqual({
      role: true,
      text: true,
      createdAt: true,
    });
    expect(select.charterRequests.select).toMatchObject({ ref: true, contactPhone: true, notes: true });
    expect(select.bookings.select.consents.select).toEqual({
      consentType: true,
      version: true,
      consentedAt: true,
    });
    expect(select.bookings.select.notifications.select).toMatchObject({
      template: true,
      recipient: true,
      payload: true,
    });
  });

  it("#842: reaches new data only via the customer's relations (no top-level where on other models)", async () => {
    await exportCustomerData('cust-1');
    const arg = mockFindUnique.mock.calls[0][0];
    // Single scoped query: every nested relation hangs off customer id 'cust-1'.
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(arg.where).toEqual({ id: 'cust-1' });
  });

  it('#842: omits ops-internal fields (delivery-retry state, operator assignment, admin notes)', async () => {
    await exportCustomerData('cust-1');
    const serialized = JSON.stringify(mockFindUnique.mock.calls[0][0]);
    for (const f of [
      'keySalt',
      'attemptCount',
      'nextAttemptAt',
      'lastError',
      'externalRef',
      'assigneeOperatorId',
      'rejectionReason',
      'dtoJson',
    ]) {
      expect(serialized).not.toContain(f);
    }
  });

  it('returns the customer row (or null when not found)', async () => {
    expect(await exportCustomerData('cust-1')).toMatchObject({ id: 'cust-1' });
    mockFindUnique.mockResolvedValueOnce(null);
    expect(await exportCustomerData('missing')).toBeNull();
  });
});
