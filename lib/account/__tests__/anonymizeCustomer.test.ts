/**
 * #837: unit tests for the account-deletion retention gaps (credential drop, Booking /
 * Hold pickupDetail + buyer PII). DB mocked; the integration suite covers the happy path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    customer: { update: vi.fn() },
    session: { updateMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    booking: { updateMany: vi.fn() },
    hold: { updateMany: vi.fn() },
    plannerConversation: { deleteMany: vi.fn() },
    notificationLog: { updateMany: vi.fn() },
    charterRequest: { updateMany: vi.fn() },
  };
  const mockPrisma = {
    customer: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, mockPrisma };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/charter', () => ({
  TERMINAL_CHARTER_STATUSES: new Set(['REJECTED', 'COMPLETED', 'CANCELLED']),
}));

import { deleteAccount } from '../anonymizeCustomer';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.customer.findUnique.mockResolvedValue({
    id: 'c1',
    deletedAt: null,
    anonymizedAt: null,
    phone: null,
  });
  tx.customer.update.mockResolvedValue({ id: 'c1', deletedAt: new Date(), anonymizedAt: new Date(), phone: null });
});

describe('deleteAccount retention (#837)', () => {
  it('nulls passwordHash + emailVerifiedAt in the same customer update', async () => {
    await deleteAccount('c1');
    const arg = tx.customer.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.passwordHash).toBeNull();
    expect(arg.data.emailVerifiedAt).toBeNull();
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
  });

  it('scrubs Booking.pickupDetail (placeholder, only where present)', async () => {
    await deleteAccount('c1');
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'c1', pickupDetail: { not: null } },
      data: { pickupDetail: '[removed]' },
    });
  });

  it('scrubs buyer PII + pickupDetail on NON-active holds linked to the customer bookings', async () => {
    await deleteAccount('c1');
    expect(tx.hold.updateMany).toHaveBeenCalledWith({
      where: { booking: { customerId: 'c1' }, status: { not: 'active' } },
      data: {
        customerName: '[deleted]',
        customerPhone: '+8490xxxxxx0',
        customerEmail: null,
      },
    });
    expect(tx.hold.updateMany).toHaveBeenCalledWith({
      where: { booking: { customerId: 'c1' }, status: { not: 'active' }, pickupDetail: { not: null } },
      data: { pickupDetail: '[removed]' },
    });
  });

  it('is a no-op (no scrubs) for an already-deleted customer', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      deletedAt: new Date(),
      anonymizedAt: new Date(),
      phone: null,
    });
    const res = await deleteAccount('c1');
    expect(res.alreadyDeleted).toBe(true);
    expect(tx.hold.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
});
