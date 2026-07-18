/**
 * Unit tests for lib/ledger/chargeback.ts — bank-dispute reversal (Issue 052).
 *
 * Mocks the Prisma client, appendLedgerEntry, getOperatorBalance, and the logger.
 * Proves the exact entry SIGNS + idempotency keys + backstop math:
 *
 *   - PRE-PAYOUT  → one `chargeback` entry of −amount, NO payout_reversal.
 *   - POST-PAYOUT → `payout_reversal` +amount AND `chargeback` −2·amount; the
 *     SIGNED SUM of the two is exactly −amount (NOT −2·amount), and the case is
 *     distinguishable from pre-payout by the presence of the payout_reversal row.
 *   - INSUFFICIENT balance → a `chargeback_backstop:<key>` `adjustment` of
 *     +shortfall is written; `backstopped` == the platform bad-debt amount.
 *   - IDEMPOTENT replay (chargeback:<key> exists) → no new entries, alreadyDone.
 *   - keys are DERIVED from the passed sourceEventId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/core/db/client', () => {
  const txMock = { ledgerEntry: {} };
  return {
    prisma: {
      booking: { findUnique: vi.fn() },
      ledgerEntry: { findUnique: vi.fn(), findFirst: vi.fn() },
      payout: { findFirst: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    },
  };
});

vi.mock('../ledgerRepo', () => ({
  appendLedgerEntry: vi.fn().mockResolvedValue({ id: 'le-1', created: true }),
}));

vi.mock('../balance', () => ({
  getOperatorBalance: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { recordChargeback, ChargebackError } from '../chargeback';

const bookingFind = prisma.booking.findUnique as unknown as Mock;
const ledgerFind = prisma.ledgerEntry.findUnique as unknown as Mock;
const ledgerFindFirst = prisma.ledgerEntry.findFirst as unknown as Mock;
const payoutFindFirst = prisma.payout.findFirst as unknown as Mock;
const payoutFindMany = prisma.payout.findMany as unknown as Mock;
const append = appendLedgerEntry as unknown as Mock;
const balance = getOperatorBalance as unknown as Mock;

const BOOKING = {
  id: 'bk-1',
  tripId: 'trip-1',
  trip: { bus: { operatorId: 'op-1' } },
};

/** Pull the single appendLedgerEntry call for a given entry type, if any. */
function callFor(type: string) {
  return append.mock.calls.find((c) => c[0].type === type)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  bookingFind.mockResolvedValue(BOOKING);
  ledgerFind.mockResolvedValue(null); // layer-1: no prior chargeback
  ledgerFindFirst.mockResolvedValue(null); // no payout_debit cross-check hit
  payoutFindFirst.mockResolvedValue(null); // no paid payout → pre-payout default
  payoutFindMany.mockResolvedValue([]); // no payouts for the trip
  append.mockResolvedValue({ id: 'le-1', created: true });
  // Plenty of available balance unless a test overrides it.
  balance.mockResolvedValue({
    pending: BigInt(0),
    available: BigInt(10_000_000),
    paidOut: BigInt(0),
  });
});

describe('recordChargeback — pre-payout', () => {
  it('writes a single chargeback −amount entry, NO payout_reversal', async () => {
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-abc',
    });

    expect(res).toEqual({ recorded: true, alreadyDone: false, backstopped: 0, platformAbsorbed: 0 });

    const cb = callFor('chargeback');
    expect(cb).toMatchObject({
      operatorId: 'op-1',
      bookingId: 'bk-1',
      type: 'chargeback',
      amountMinor: BigInt(-200_000),
      sourceEventId: 'chargeback:dispute-abc',
    });
    // No payout_reversal in the pre-payout case → distinguishable from post-payout.
    expect(callFor('payout_reversal')).toBeUndefined();
    // No backstop (ample balance).
    expect(callFor('adjustment')).toBeUndefined();
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('net operator-balance delta = −amount (single −amount entry)', async () => {
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-abc',
    });
    const net = append.mock.calls.reduce(
      (acc, c) => acc + (c[0].amountMinor as bigint),
      BigInt(0)
    );
    expect(net).toBe(BigInt(-200_000));
  });
});

describe('recordChargeback — post-payout', () => {
  beforeEach(() => {
    // A paid Payout exists for the booking's trip → post-payout.
    payoutFindFirst.mockResolvedValue({ id: 'payout-1' });
  });

  it('writes payout_reversal +amount AND chargeback −2·amount', async () => {
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-xyz',
    });
    expect(res).toEqual({ recorded: true, alreadyDone: false, backstopped: 0, platformAbsorbed: 0 });

    const pr = callFor('payout_reversal');
    const cb = callFor('chargeback');
    expect(pr).toMatchObject({
      type: 'payout_reversal',
      amountMinor: BigInt(200_000), // +amount — completed payout reversed
      sourceEventId: 'payout_reversal:dispute-xyz',
    });
    expect(cb).toMatchObject({
      type: 'chargeback',
      amountMinor: BigInt(-400_000), // −2·amount — revenue + reclaimed cash
      sourceEventId: 'chargeback:dispute-xyz',
    });
  });

  it('NET of the two entries is −amount, NOT −2·amount', async () => {
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-xyz',
    });
    const pr = callFor('payout_reversal')!.amountMinor as bigint;
    const cb = callFor('chargeback')!.amountMinor as bigint;
    expect(pr + cb).toBe(BigInt(-200_000)); // exactly −amount
    expect(pr + cb).not.toBe(BigInt(-400_000)); // proves no −2·amount double-count
  });

  it('is distinguishable from pre-payout (payout_reversal row present)', async () => {
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 50_000,
      sourceEventId: 'd',
    });
    expect(callFor('payout_reversal')).toBeDefined();
  });

  it('detects post-payout via the payout_debit ledger cross-check when no paid Payout row', async () => {
    payoutFindFirst.mockResolvedValueOnce(null); // no paid payout row…
    payoutFindMany.mockResolvedValueOnce([{ id: 'payout-1' }]); // …but a payout exists
    ledgerFindFirst.mockResolvedValueOnce({ id: 'debit-1' }); // …with a payout_debit
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 100_000,
      sourceEventId: 'd2',
    });
    // Treated as post-payout → payout_reversal written.
    expect(callFor('payout_reversal')).toBeDefined();
    expect(callFor('chargeback')!.amountMinor).toBe(BigInt(-200_000));
  });
});

describe('recordChargeback — insufficient-balance backstop (S15#7)', () => {
  it('records a chargeback_backstop adjustment of +shortfall; backstopped = shortfall', async () => {
    // Operator can only cover 120k of a 200k pre-payout clawback → 80k shortfall.
    balance.mockResolvedValue({
      pending: BigInt(0),
      available: BigInt(120_000),
      paidOut: BigInt(0),
    });

    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-short',
    });

    expect(res.backstopped).toBe(80_000);

    const adj = callFor('adjustment');
    expect(adj).toMatchObject({
      type: 'adjustment',
      amountMinor: BigInt(80_000), // +shortfall — platform absorbs it
      sourceEventId: 'chargeback_backstop:dispute-short',
    });
  });

  it('treats a NEGATIVE available balance as zero cover (full amount is shortfall)', async () => {
    balance.mockResolvedValue({
      pending: BigInt(0),
      available: BigInt(-30_000), // already in the red
      paidOut: BigInt(0),
    });
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 100_000,
      sourceEventId: 'd',
    });
    // max(available,0)=0 → shortfall = full amount.
    expect(res.backstopped).toBe(100_000);
    expect(callFor('adjustment')!.amountMinor).toBe(BigInt(100_000));
  });

  it('no backstop entry when available ≥ amount', async () => {
    balance.mockResolvedValue({
      pending: BigInt(0),
      available: BigInt(200_000),
      paidOut: BigInt(0),
    });
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'd',
    });
    expect(res.backstopped).toBe(0);
    expect(callFor('adjustment')).toBeUndefined();
  });

  it('backstop net flooring: operator B nets to −available (post-payout + shortfall)', async () => {
    // Post-payout, available only covers 120k of a 200k clawback.
    payoutFindFirst.mockResolvedValue({ id: 'payout-1' });
    balance.mockResolvedValue({
      pending: BigInt(0),
      available: BigInt(120_000),
      paidOut: BigInt(0),
    });
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'd',
    });
    // payout_reversal +200k, chargeback −400k, backstop +80k → net −120k = −available.
    const net = append.mock.calls.reduce(
      (acc, c) => acc + (c[0].amountMinor as bigint),
      BigInt(0)
    );
    expect(net).toBe(BigInt(-120_000));
  });
});

describe('recordChargeback — idempotency', () => {
  it('replay (chargeback:<key> exists) → no new entries, alreadyDone, backstopped 0', async () => {
    ledgerFind.mockResolvedValueOnce({ id: 'existing-cb' });
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-replay',
    });
    expect(res).toEqual({ recorded: false, alreadyDone: true, backstopped: 0, platformAbsorbed: 0 });
    expect(append).not.toHaveBeenCalled();
  });

  it('layer-1 probe checks the chargeback:<key> sourceEventId', async () => {
    await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'dispute-k',
    });
    expect(ledgerFind).toHaveBeenCalledWith({
      where: { sourceEventId: 'chargeback:dispute-k' },
      select: { id: true },
    });
  });
});

describe('recordChargeback — validation', () => {
  it('throws booking_not_found for a missing booking', async () => {
    bookingFind.mockResolvedValueOnce(null);
    await expect(
      recordChargeback({ bookingId: 'nope', amountMinor: 1000, sourceEventId: 'k' })
    ).rejects.toBeInstanceOf(ChargebackError);
  });

  it('throws invalid_amount for a non-positive amount', async () => {
    await expect(
      recordChargeback({ bookingId: 'bk-1', amountMinor: 0, sourceEventId: 'k' })
    ).rejects.toMatchObject({ code: 'invalid_amount' });
  });

  it('throws invalid_amount for a non-integer amount', async () => {
    await expect(
      recordChargeback({ bookingId: 'bk-1', amountMinor: 1.5, sourceEventId: 'k' })
    ).rejects.toMatchObject({ code: 'invalid_amount' });
  });
});

describe('recordChargeback — platform-absorb (Issue 124)', () => {
  const VNPAY_BOOKING = { ...BOOKING, paymentMethod: 'vnpay' };

  it('writes chargeback −amount + chargeback_platform_absorb +amount (net 0), platformAbsorbed=amount', async () => {
    bookingFind.mockResolvedValueOnce(VNPAY_BOOKING);
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'vnpay-dispute-1',
      liability: 'platform',
    });

    expect(res).toEqual({ recorded: true, alreadyDone: false, backstopped: 0, platformAbsorbed: 200_000 });

    const cb = callFor('chargeback');
    const absorb = append.mock.calls.find(
      (c) => c[0].sourceEventId === 'chargeback_platform_absorb:vnpay-dispute-1'
    )?.[0];
    expect(cb?.amountMinor).toBe(BigInt(-200_000));
    expect(cb?.sourceEventId).toBe('chargeback:vnpay-dispute-1');
    expect(absorb?.type).toBe('adjustment');
    expect(absorb?.amountMinor).toBe(BigInt(200_000));

    // Net zero across the two legs → operator held harmless.
    const net = append.mock.calls.reduce((acc, c) => acc + (c[0].amountMinor as bigint), BigInt(0));
    expect(net).toBe(BigInt(0));

    // Platform path skips operator-liable machinery entirely.
    expect(callFor('payout_reversal')).toBeUndefined();
    expect(balance).not.toHaveBeenCalled(); // no backstop sizing
    expect(payoutFindFirst).not.toHaveBeenCalled(); // no post-payout detection
  });

  it('rejects platform-absorb for a non-card (bank_transfer) booking', async () => {
    bookingFind.mockResolvedValueOnce({ ...BOOKING, paymentMethod: 'bank_transfer' });
    await expect(
      recordChargeback({
        bookingId: 'bk-1',
        amountMinor: 200_000,
        sourceEventId: 'bt-dispute',
        liability: 'platform',
      })
    ).rejects.toMatchObject({ code: 'platform_absorb_requires_card' });
    expect(append).not.toHaveBeenCalled();
  });

  it('replay of a platform chargeback → alreadyDone, no new entries', async () => {
    bookingFind.mockResolvedValueOnce(VNPAY_BOOKING);
    ledgerFind.mockResolvedValueOnce({ id: 'existing-cb' });
    const res = await recordChargeback({
      bookingId: 'bk-1',
      amountMinor: 200_000,
      sourceEventId: 'vnpay-dispute-1',
      liability: 'platform',
    });
    expect(res).toEqual({ recorded: false, alreadyDone: true, backstopped: 0, platformAbsorbed: 0 });
    expect(append).not.toHaveBeenCalled();
  });
});
