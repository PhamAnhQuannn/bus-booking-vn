/**
 * #833 / #851: admin close-out of owed money. Proves the FOR UPDATE gate + every
 * discriminated error variant for markManualRefundPaid and resolveUnfulfilledPayment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryRawMock, obligationUpdate, eventUpdate } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  obligationUpdate: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: queryRawMock,
        refundObligation: { update: obligationUpdate },
        paymentEvent: { update: eventUpdate },
      }),
  },
}));

import { markManualRefundPaid, resolveUnfulfilledPayment } from '../manualRefund';

const NOW = new Date('2026-10-14T03:00:00.000Z');
const EVENT_ID = '11111111-2222-4333-8444-555555555555';

beforeEach(() => {
  vi.clearAllMocks();
  obligationUpdate.mockResolvedValue({});
  eventUpdate.mockResolvedValue({});
});

describe('markManualRefundPaid', () => {
  it('locks the row FOR UPDATE and moves manual_pending → done with paidAt + bank ref', async () => {
    queryRawMock.mockResolvedValueOnce([{ status: 'manual_pending' }]);
    const res = await markManualRefundPaid({ obligationId: 'ob-1', bankRef: 'FT1', now: NOW });
    expect(res).toEqual({ ok: true });
    expect(String(queryRawMock.mock.calls[0][0].join('?'))).toContain('FOR UPDATE');
    expect(obligationUpdate).toHaveBeenCalledWith({
      where: { id: 'ob-1' },
      data: { status: 'done', manualPaidAt: NOW, manualBankRef: 'FT1' },
    });
  });

  it('not_found when the row is absent', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const res = await markManualRefundPaid({ obligationId: 'x', bankRef: 'FT1', now: NOW });
    expect(res).toEqual({ ok: false, error: 'not_found' });
    expect(obligationUpdate).not.toHaveBeenCalled();
  });

  it.each(['done', 'pending', 'failed'])('not_owed when status is %s (no double "paid")', async (status) => {
    queryRawMock.mockResolvedValueOnce([{ status }]);
    const res = await markManualRefundPaid({ obligationId: 'ob-1', bankRef: 'FT1', now: NOW });
    expect(res).toEqual({ ok: false, error: 'not_owed' });
    expect(obligationUpdate).not.toHaveBeenCalled();
  });
});

describe('resolveUnfulfilledPayment', () => {
  const open = { bookingId: 'bk-1', unmatchedReason: 'late_booking_terminal', resolvedAt: null };

  it('locks the event and stamps resolvedAt + bank ref', async () => {
    queryRawMock.mockResolvedValueOnce([open]);
    const res = await resolveUnfulfilledPayment({ paymentEventId: EVENT_ID, bankRef: 'FT2', now: NOW });
    expect(res).toEqual({ ok: true });
    expect(String(queryRawMock.mock.calls[0][0].join('?'))).toContain('FOR UPDATE');
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { resolvedAt: NOW, resolvedBankRef: 'FT2' },
    });
  });

  it('not_found when the event is absent', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const res = await resolveUnfulfilledPayment({ paymentEventId: EVENT_ID, bankRef: 'FT2', now: NOW });
    expect(res).toEqual({ ok: false, error: 'not_found' });
  });

  it.each([
    ['orphan (bookingId NULL)', { ...open, bookingId: null }],
    ['no reason (normal paid event)', { ...open, unmatchedReason: null }],
    ['orphan reason on a linked row', { ...open, unmatchedReason: 'account_mismatch' }],
    ['already resolved', { ...open, resolvedAt: NOW }],
  ])('not_resolvable when %s', async (_label, row) => {
    queryRawMock.mockResolvedValueOnce([row]);
    const res = await resolveUnfulfilledPayment({ paymentEventId: EVENT_ID, bankRef: 'FT2', now: NOW });
    expect(res).toEqual({ ok: false, error: 'not_resolvable' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });
});
