/**
 * SEC-REFUND-DURABILITY (#569) — processRefunds JobCore drives due RefundObligation rows via
 * refundOut, marks done on success, and retries with backoff on failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { claimTxMock, updateMock, refundOutMock, queryRawMock } = vi.hoisted(() => ({
  claimTxMock: vi.fn(),
  updateMock: vi.fn(),
  refundOutMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: (fn: (tx: { $queryRaw: typeof queryRawMock }) => unknown) => fn({ $queryRaw: queryRawMock }),
    refundObligation: { update: updateMock },
  },
}));
vi.mock('@/lib/payment', () => ({ refundOut: refundOutMock }));
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
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ob-1' }, data: expect.objectContaining({ status: 'done', nextAttemptAt: null }) }),
    );
    expect(result).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('treats an already-done (idempotent) refund as satisfied', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockResolvedValueOnce({ refunded: false, alreadyDone: true });
    const result = await processRefunds({} as never, { now: NOW });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'done' }) }));
    expect(result.rowsAffected).toBe(1);
  });

  it('marks failed + schedules backoff when refundOut throws', async () => {
    queryRawMock.mockResolvedValueOnce([row]);
    refundOutMock.mockRejectedValueOnce(new Error('psp_down'));

    const result = await processRefunds({} as never, { now: NOW });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          attemptCount: 1,
          lastError: 'psp_down',
          nextAttemptAt: refundBackoff(1, NOW),
        }),
      }),
    );
    expect(result.rowsAffected).toBe(0);
  });

  it('no due rows → no refundOut calls', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const result = await processRefunds({} as never, { now: NOW });
    expect(refundOutMock).not.toHaveBeenCalled();
    expect(result).toEqual({ rowsAffected: 0, status: 'success' });
  });
});
