/**
 * Issue 072 — getTicketVerification unit tests.
 *
 * verifyTicketToken (Issue 071) + prisma.booking.findUnique are mocked so this
 * stays a non-integration unit test. Covers:
 *   - valid token + matching row → PII-free live view
 *   - invalid/tampered token (verify returns null) → null
 *   - ref/ct mismatch (token ref != row bookingRef) → null
 *   - booking-not-found → null
 *   - the returned shape carries NO buyer PII (name/phone/email)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/ticketing/ticketToken', () => ({
  verifyTicketToken: vi.fn(),
}));

import { prisma } from '@/lib/db/client';
import { verifyTicketToken } from '@/lib/ticketing/ticketToken';
import { getTicketVerification } from '../getTicketVerification';

const findUnique = prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>;
const verify = verifyTicketToken as unknown as ReturnType<typeof vi.fn>;

const REF = 'BB-2026-ab12-cd34';
const CT = 'conf_tok_0123456789abcdef';

function rawBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingRef: REF,
    status: 'paid_operator_notified',
    ticketCount: 2,
    paymentExternalRef: 'momo-txn-998877',
    checkedInAt: null,
    noShowAt: null,
    trip: {
      departureAt: new Date('2026-06-10T22:00:00Z'),
      route: { origin: 'Hanoi', destination: 'Hue' },
      bus: {
        licensePlate: '29B-12345',
        busType: 'sleeper',
        operator: { legalName: 'Phuong Trang' },
      },
    },
    ...overrides,
  };
}

describe('getTicketVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valid token + matching row → live PII-free view', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    findUnique.mockResolvedValue(rawBooking());

    const result = await getTicketVerification('a.valid.token');

    expect(verify).toHaveBeenCalledWith('a.valid.token');
    // Looked up by the ct claim (== confirmationToken).
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { confirmationToken: CT } }),
    );
    expect(result).toEqual({
      bookingRef: REF,
      status: 'paid_operator_notified',
      isPaid: true,
      ticketCount: 2,
      providerTxnId: 'momo-txn-998877',
      operatorName: 'Phuong Trang',
      route: { origin: 'Hanoi', destination: 'Hue' },
      departureAt: '2026-06-10T22:00:00.000Z',
      busPlate: '29B-12345',
      busType: 'sleeper',
      checkIn: { checkedInAt: null, noShowAt: null },
    });
  });

  it('checked-in booking → checkIn.checkedInAt populated (Issue 073)', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    findUnique.mockResolvedValue(
      rawBooking({ checkedInAt: new Date('2026-06-10T22:05:00Z') }),
    );

    const result = await getTicketVerification('t');
    expect(result?.checkIn).toEqual({
      checkedInAt: '2026-06-10T22:05:00.000Z',
      noShowAt: null,
    });
  });

  it('unpaid (awaiting_payment) → isPaid false, providerTxnId null', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    findUnique.mockResolvedValue(
      rawBooking({ status: 'awaiting_payment', paymentExternalRef: null }),
    );

    const result = await getTicketVerification('t');
    expect(result?.isPaid).toBe(false);
    expect(result?.providerTxnId).toBeNull();
  });

  it('invalid/tampered token (verify → null) → null, no DB read', async () => {
    verify.mockResolvedValue(null);

    const result = await getTicketVerification('tampered');
    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('ref/ct mismatch (token ref != row bookingRef) → null', async () => {
    verify.mockResolvedValue({ ref: 'BB-2026-ZZZZ-ZZZZ', ct: CT });
    findUnique.mockResolvedValue(rawBooking()); // row.bookingRef === REF, differs

    const result = await getTicketVerification('t');
    expect(result).toBeNull();
  });

  it('booking not found → null', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    findUnique.mockResolvedValue(null);

    const result = await getTicketVerification('t');
    expect(result).toBeNull();
  });

  it('returned shape carries NO buyer PII', async () => {
    verify.mockResolvedValue({ ref: REF, ct: CT });
    findUnique.mockResolvedValue(rawBooking());

    const result = await getTicketVerification('t');
    const keys = new Set(Object.keys(result ?? {}));
    expect(keys.has('buyerName')).toBe(false);
    expect(keys.has('buyerPhone')).toBe(false);
    expect(keys.has('buyerEmail')).toBe(false);

    // The select must not even request the buyer columns.
    const selectArg = findUnique.mock.calls[0][0].select;
    expect(selectArg.buyerName).toBeUndefined();
    expect(selectArg.buyerPhone).toBeUndefined();
    expect(selectArg.buyerEmail).toBeUndefined();
  });
});
