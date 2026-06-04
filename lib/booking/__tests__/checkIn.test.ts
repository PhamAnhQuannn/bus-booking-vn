/**
 * Issue 073 — checkIn service unit tests (mocked Prisma + verifyTicketToken).
 *
 * Covers:
 *   scanTicket: invalid token / wrong-operator / not-paid / ok
 *   checkInBooking: rowcount-1 → checked-in; rowcount-0+set → alreadyCheckedIn;
 *                   rowcount-0+absent → not_found
 *   markNoShow: rowcount-1 → ok (status+noShowAt paired); rowcount-0+checked-in →
 *               already_checked_in; rowcount-0+absent → not_found
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ticketing/ticketToken', () => ({
  verifyTicketToken: vi.fn(),
}));

import { verifyTicketToken } from '@/lib/ticketing';
import {
  scanTicket,
  checkInBooking,
  markNoShow,
} from '../checkIn';

const verify = verifyTicketToken as unknown as ReturnType<typeof vi.fn>;

const REF = 'BB-2026-ab12-cd34';
const CT = 'conf_tok_0123456789abcdef';
const OPERATOR_ID = 'op-org-1';
const BOOKING_ID = '11111111-1111-1111-1111-111111111111';
const TRIP_ID = 'trip-1';

function makeDb(overrides: {
  findUnique?: ReturnType<typeof vi.fn>;
  executeRaw?: ReturnType<typeof vi.fn>;
  queryRaw?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    booking: { findUnique: overrides.findUnique ?? vi.fn() },
    $executeRaw: overrides.executeRaw ?? vi.fn(),
    $queryRaw: overrides.queryRaw ?? vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    bookingRef: REF,
    ticketCount: 2,
    buyerName: 'Nguyen Van A',
    checkedInAt: null,
    noShowAt: null,
    status: 'paid',
    tripId: TRIP_ID,
    trip: { operatorId: OPERATOR_ID },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('scanTicket', () => {
  it('invalid token → { ok:false, reason:invalid_token }, no DB read', async () => {
    verify.mockResolvedValue(null);
    const findUnique = vi.fn();
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 'bad', operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'invalid_token' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('cross-operator booking → { ok:false, reason:wrong_operator }', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    const findUnique = vi.fn().mockResolvedValue(
      bookingRow({ trip: { operatorId: 'other-op' } }),
    );
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 't', operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'wrong_operator' });
  });

  it('unknown booking (null) → wrong_operator (no existence leak)', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 't', operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'wrong_operator' });
  });

  it('ref/ct mismatch → wrong_operator', async () => {
    verify.mockResolvedValue({ ref: 'BB-2026-ZZZZ-ZZZZ', ct: CT });
    const findUnique = vi.fn().mockResolvedValue(bookingRow());
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 't', operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'wrong_operator' });
  });

  it('not paid (awaiting_payment) → not_paid', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    const findUnique = vi.fn().mockResolvedValue(
      bookingRow({ status: 'awaiting_payment' }),
    );
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 't', operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'not_paid' });
  });

  it('paid + same operator → ok with boarding view incl. buyerName + check-in state', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    const checkedInAt = new Date('2026-06-10T22:05:00Z');
    const findUnique = vi.fn().mockResolvedValue(
      bookingRow({ checkedInAt }),
    );
    const db = makeDb({ findUnique });

    const res = await scanTicket(db, { token: 't', operatorId: OPERATOR_ID });
    expect(res).toEqual({
      ok: true,
      booking: {
        id: BOOKING_ID,
        bookingRef: REF,
        ticketCount: 2,
        buyerName: 'Nguyen Van A',
        checkedInAt: '2026-06-10T22:05:00.000Z',
        noShowAt: null,
        status: 'paid',
        tripId: TRIP_ID,
      },
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { confirmationToken: CT } }),
    );
  });
});

describe('checkInBooking', () => {
  it('rowcount 1 → { ok:true, alreadyCheckedIn:false }', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const queryRaw = vi.fn();
    const db = makeDb({ executeRaw, queryRaw });

    const res = await checkInBooking(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: true, alreadyCheckedIn: false });
    // No disambiguation read on the winning path.
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rowcount 0 + checkedInAt set → { ok:true, alreadyCheckedIn:true }', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn().mockResolvedValue([{ checkedInAt: new Date() }]);
    const db = makeDb({ executeRaw, queryRaw });

    const res = await checkInBooking(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: true, alreadyCheckedIn: true });
  });

  it('rowcount 0 + row absent → { ok:false, reason:not_found }', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn().mockResolvedValue([]);
    const db = makeDb({ executeRaw, queryRaw });

    const res = await checkInBooking(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('markNoShow', () => {
  it('rowcount 1 → { ok:true } (status + noShowAt paired in one UPDATE)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const db = makeDb({ executeRaw });

    const res = await markNoShow(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: true });

    // Assert the UPDATE pairs the status enum write with the noShowAt timestamp.
    const sql = executeRaw.mock.calls[0][0];
    const text = sql.strings.join('');
    expect(text).toContain(`status = 'no_show'`);
    expect(text).toContain('"noShowAt" = NOW()');
  });

  it('rowcount 0 + already checked in → { ok:false, reason:already_checked_in }', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn().mockResolvedValue([{ checkedInAt: new Date() }]);
    const db = makeDb({ executeRaw, queryRaw });

    const res = await markNoShow(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'already_checked_in' });
  });

  it('rowcount 0 + row absent → { ok:false, reason:not_found }', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn().mockResolvedValue([]);
    const db = makeDb({ executeRaw, queryRaw });

    const res = await markNoShow(db, { bookingId: BOOKING_ID, operatorId: OPERATOR_ID });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
