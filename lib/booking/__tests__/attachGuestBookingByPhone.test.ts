/**
 * Unit tests for lib/booking/attachGuestBookingByPhone.ts
 * tx is mocked; normalizePhone runs for real (E.164 conversion).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  attachGuestBookingByPhone,
  backfillGuestBookingsForCustomer,
} from '../attachGuestBookingByPhone';
import type { Prisma } from '@prisma/client';

function makeTx(opts: {
  customer?: { id: string } | null;
  updateCount?: number;
}) {
  const findUnique = vi.fn().mockResolvedValue(opts.customer ?? null);
  const updateMany = vi.fn().mockResolvedValue({ count: opts.updateCount ?? 0 });
  const tx = {
    customer: { findUnique },
    booking: { updateMany },
  } as unknown as Prisma.TransactionClient;
  return { tx, findUnique, updateMany };
}

describe('attachGuestBookingByPhone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attaches a matching customer, scoped to unowned bookings', async () => {
    const { tx, findUnique, updateMany } = makeTx({
      customer: { id: 'cust-1' },
      updateCount: 1,
    });

    await attachGuestBookingByPhone(tx, 'bk-1', '0901234567');

    expect(findUnique).toHaveBeenCalledWith({
      where: { phone: '+84901234567' },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'bk-1', customerId: null },
      data: { customerId: 'cust-1' },
    });
  });

  it('skips silently when buyerPhone fails normalisation', async () => {
    const { tx, findUnique, updateMany } = makeTx({});
    await attachGuestBookingByPhone(tx, 'bk-1', 'not-a-phone');
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('no-ops when no customer matches the phone', async () => {
    const { tx, updateMany } = makeTx({ customer: null });
    await attachGuestBookingByPhone(tx, 'bk-1', '0901234567');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent — already-attached booking yields count 0, no throw', async () => {
    const { tx, updateMany } = makeTx({
      customer: { id: 'cust-1' },
      updateCount: 0,
    });
    await expect(
      attachGuestBookingByPhone(tx, 'bk-1', '0901234567')
    ).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledOnce();
  });
});

describe('backfillGuestBookingsForCustomer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('matches every raw form that normalises to the E.164 phone', async () => {
    const { tx, updateMany } = makeTx({ updateCount: 2 });
    const count = await backfillGuestBookingsForCustomer(tx, 'cust-1', '+84901234567');

    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        buyerPhone: { in: ['+84901234567', '84901234567', '0901234567'] },
        customerId: null,
      },
      data: { customerId: 'cust-1' },
    });
  });

  it('returns 0 when no guest bookings match', async () => {
    const { tx } = makeTx({ updateCount: 0 });
    const count = await backfillGuestBookingsForCustomer(tx, 'cust-1', '+84901234567');
    expect(count).toBe(0);
  });
});
