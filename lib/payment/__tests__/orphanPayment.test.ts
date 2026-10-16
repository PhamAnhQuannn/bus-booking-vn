/**
 * #331: admin reconciliation of orphan PaymentEvents. Proves the FOR UPDATE gate (event,
 * then booking) + every discriminated error variant for linkOrphanPayment and
 * resolveOrphanPayment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryRawMock, eventUpdate } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ $queryRaw: queryRawMock, paymentEvent: { update: eventUpdate } }),
  },
}));

import { linkOrphanPayment, resolveOrphanPayment } from '../orphanPayment';

const NOW = new Date('2026-10-16T03:00:00.000Z');
const EVENT_ID = '11111111-2222-4333-8444-555555555555';
const BOOKING_ID = '99999999-2222-4333-8444-555555555555';
const FARE = 175_000;

function sepay(amount: number, transferType = 'in'): string {
  return JSON.stringify({ transferType, transferAmount: amount });
}

const orphan = {
  bookingId: null as string | null,
  adapter: 'bank_transfer',
  currency: 'VND',
  rawBody: sepay(FARE),
  unmatchedReason: 'no_booking_ref_in_memo' as string | null,
  resolvedAt: null as Date | null,
};
const booking = { id: BOOKING_ID, status: 'awaiting_payment', totalVnd: FARE, paymentMethod: 'bank_transfer' };

function sql(callIndex: number): string {
  return String(queryRawMock.mock.calls[callIndex][0].join('?'));
}

function link() {
  return linkOrphanPayment({ paymentEventId: EVENT_ID, bookingRef: 'BB-1' });
}

beforeEach(() => {
  vi.clearAllMocks();
  eventUpdate.mockResolvedValue({});
});

describe('linkOrphanPayment', () => {
  it('locks event then booking FOR UPDATE and links the orphan (no paid write here)', async () => {
    queryRawMock.mockResolvedValueOnce([orphan]).mockResolvedValueOnce([booking]);
    const res = await link();
    expect(res).toEqual({ ok: true, bookingId: BOOKING_ID, replay: false });
    expect(sql(0)).toContain('"PaymentEvent"');
    expect(sql(0)).toContain('FOR UPDATE');
    expect(sql(1)).toContain('"Booking"');
    expect(sql(1)).toContain('FOR UPDATE');
    expect(eventUpdate).toHaveBeenCalledWith({ where: { id: EVENT_ID }, data: { bookingId: BOOKING_ID } });
  });

  it('replay: already linked to the SAME booking → ok, no write', async () => {
    queryRawMock.mockResolvedValueOnce([{ ...orphan, bookingId: BOOKING_ID }]).mockResolvedValueOnce([booking]);
    expect(await link()).toEqual({ ok: true, bookingId: BOOKING_ID, replay: true });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it('not_found when the event is absent', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    expect(await link()).toEqual({ ok: false, error: 'not_found' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it('booking_not_found when the ref does not resolve', async () => {
    queryRawMock.mockResolvedValueOnce([orphan]).mockResolvedValueOnce([]);
    expect(await link()).toEqual({ ok: false, error: 'booking_not_found' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it('already_linked when linked to a DIFFERENT booking', async () => {
    queryRawMock.mockResolvedValueOnce([{ ...orphan, bookingId: 'other' }]).mockResolvedValueOnce([booking]);
    expect(await link()).toEqual({ ok: false, error: 'already_linked' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['resolved', { resolvedAt: NOW }],
    ['account_mismatch', { unmatchedReason: 'account_mismatch' }],
    ['non-bank-transfer', { adapter: 'vnpay' }],
  ])('not_linkable when %s', async (_label, patch) => {
    queryRawMock.mockResolvedValueOnce([{ ...orphan, ...patch }]).mockResolvedValueOnce([booking]);
    expect(await link()).toEqual({ ok: false, error: 'not_linkable' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it.each(['cash', 'vnpay'])('not_linkable when the booking was created for rail %s', async (paymentMethod) => {
    queryRawMock.mockResolvedValueOnce([orphan]).mockResolvedValueOnce([{ ...booking, paymentMethod }]);
    expect(await link()).toEqual({ ok: false, error: 'not_linkable' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it.each(['paid', 'payment_failed_expired', 'refunded'])(
    'booking_not_awaiting_payment when booking is %s',
    async (status) => {
      queryRawMock.mockResolvedValueOnce([orphan]).mockResolvedValueOnce([{ ...booking, status }]);
      expect(await link()).toEqual({ ok: false, error: 'booking_not_awaiting_payment' });
      expect(eventUpdate).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['underpaid', { rawBody: sepay(FARE - 1) }],
    ['overpaid', { rawBody: sepay(FARE + 1) }],
    ['outbound transfer', { rawBody: sepay(FARE, 'out') }],
    ['unparseable body', { rawBody: 'not-json' }],
    ['non-VND', { currency: 'USD' }],
  ])('amount_mismatch when %s', async (_label, patch) => {
    queryRawMock.mockResolvedValueOnce([{ ...orphan, ...patch }]).mockResolvedValueOnce([booking]);
    expect(await link()).toEqual({ ok: false, error: 'amount_mismatch' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });
});

describe('resolveOrphanPayment', () => {
  function resolve() {
    return resolveOrphanPayment({ paymentEventId: EVENT_ID, bankRef: 'FT9', now: NOW });
  }

  it('locks the event and stamps resolvedAt + bank ref', async () => {
    queryRawMock.mockResolvedValueOnce([{ bookingId: null, resolvedAt: null }]);
    expect(await resolve()).toEqual({ ok: true });
    expect(sql(0)).toContain('FOR UPDATE');
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { resolvedAt: NOW, resolvedBankRef: 'FT9' },
    });
  });

  it('not_found when the event is absent', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    expect(await resolve()).toEqual({ ok: false, error: 'not_found' });
  });

  it.each([
    ['linked', { bookingId: BOOKING_ID, resolvedAt: null }],
    ['already resolved', { bookingId: null, resolvedAt: NOW }],
  ])('not_resolvable when %s', async (_label, row) => {
    queryRawMock.mockResolvedValueOnce([row]);
    expect(await resolve()).toEqual({ ok: false, error: 'not_resolvable' });
    expect(eventUpdate).not.toHaveBeenCalled();
  });
});
