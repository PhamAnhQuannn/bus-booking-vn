/**
 * SEC-REFUND-DURABILITY (#569) — processRefunds JobCore drives due RefundObligation rows via
 * refundOut, marks done on success, and retries with backoff on failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateMock, updateManyMock, refundOutMock, queryRawMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  updateManyMock: vi.fn(),
  refundOutMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: (fn: (tx: { $queryRaw: typeof queryRawMock }) => unknown) => fn({ $queryRaw: queryRawMock }),
    refundObligation: { update: updateMock, updateMany: updateManyMock },
  },
}));
vi.mock('@/lib/payment', () => ({ refundOut: refundOutMock, MANUAL_REFUND_PENDING: 'manual_pending' }));
vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }));

import { processRefunds, refundBackoff } from '../processRefunds';

const NOW = new Date('2026-08-13T12:00:00.000Z');
const row = {
  id: 'ob-1',
  bookingId: '11111111-1111-1111-1111-111111111111',
  amountMinor: 5000,
  reason: 'overpay_difference',
  idempotencyKey: 'overpay:b1:tx1',
  attemptCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  updateManyMock.mockResolvedValue({ count: 1 });
});

describe('processRefunds', () => {
  it('calls refundOut for each due row and marks it done on success', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockResolvedValueOnce({ refunded: true, alreadyDone: false });

    const result = await processRefunds({} as never, { now: NOW });

    expect(refundOutMock).toHaveBeenCalledWith({
      bookingId: row.bookingId,
      amountMinor: 5000,
      reason: 'overpay_difference',
      idempotencyKey: 'overpay:b1:tx1',
    });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'ob-1', status: { not: 'manual_pending' } },
      data: expect.objectContaining({ status: 'done', nextAttemptAt: null }),
    });
    expect(result).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('#833: a manual refund is NOT finished — status left as manual_pending (set by refundOut), never done', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockResolvedValueOnce({ refunded: true, alreadyDone: false, manualRefundRequired: true });

    const result = await processRefunds({} as never, { now: NOW });

    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'ob-1' },
      data: { attemptCount: 1, lastError: null, nextAttemptAt: null },
    });
    expect(JSON.stringify(updateMock.mock.calls)).not.toContain('"done"');
    expect(result.rowsAffected).toBe(1);
  });

  it('treats an already-done (idempotent) refund as satisfied', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockResolvedValueOnce({ refunded: false, alreadyDone: true });
    const result = await processRefunds({} as never, { now: NOW });
    // Guarded: if another caller's manual refund already set manual_pending, it stays owed.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'ob-1', status: { not: 'manual_pending' } },
      data: expect.objectContaining({ status: 'done' }),
    });
    expect(result.rowsAffected).toBe(1);
  });

  it('marks failed + schedules backoff when refundOut throws', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockRejectedValueOnce(new Error('psp_down'));

    const result = await processRefunds({} as never, { now: NOW });

    // #833: guarded — a row refundOut already flipped to manual_pending (tx committed, only the
    // post-commit bookkeeping threw) must NOT be demoted to failed, or the next tick's
    // alreadyDone path would mark it done with no money sent.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'ob-1', status: { not: 'manual_pending' } },
      data: expect.objectContaining({
        status: 'failed',
        attemptCount: 1,
        lastError: 'psp_down',
        nextAttemptAt: refundBackoff(1, NOW),
      }),
    });
    expect(JSON.stringify(updateMock.mock.calls)).not.toContain('"failed"');
    expect(result.rowsAffected).toBe(0);
  });

  it('no due rows → no refundOut calls', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const result = await processRefunds({} as never, { now: NOW });
    expect(refundOutMock).not.toHaveBeenCalled();
    expect(result).toEqual({ rowsAffected: 0, status: 'success' });
  });
});
