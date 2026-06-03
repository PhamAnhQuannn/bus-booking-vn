/**
 * Unit tests for lib/ledger/withdrawal.ts — on-demand withdrawal (Issue 053).
 *
 * Mocks the Prisma client, appendLedgerEntry, and the logger. The available-
 * balance recompute (availableUnderLock) is a tx.$queryRaw call we stub directly.
 *
 * Proves:
 *   - below_min reject (amount < MIN_WITHDRAW_THRESHOLD_VND) — no tx opened.
 *   - invalid_amount reject (0, negative, non-integer) — no tx opened.
 *   - insufficient reject (available < amount) — tx opens, but NO Payout/ledger writes.
 *   - happy path → creates a (requested, tripId:null) Payout + a payout_debit keyed
 *     `payout_debit:<payoutId>` (sweep-aligned) + a withdraw-key marker.
 *   - idempotent replay (marker exists pre-tx) → same payoutId, NO tx, no 2nd payout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { MIN_WITHDRAW_THRESHOLD_VND } from '../constants';

// tx handle the mocked $transaction passes to the callback.
const txMock = {
  $queryRaw: vi.fn(),
  ledgerEntry: { findUnique: vi.fn() },
  payout: { create: vi.fn() },
  // Issue 078: the verified-account guard reads payoutAccount under the lock.
  payoutAccount: { findUnique: vi.fn() },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ledgerEntry: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  },
}));

vi.mock('../ledgerRepo', () => ({
  appendLedgerEntry: vi.fn().mockResolvedValue({ id: 'le-1', created: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '@/lib/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { requestWithdrawal } from '../withdrawal';

const prismaLedgerFind = prisma.ledgerEntry.findUnique as unknown as Mock;
const txQueryRaw = txMock.$queryRaw as unknown as Mock;
const txLedgerFind = txMock.ledgerEntry.findUnique as unknown as Mock;
const payoutCreate = txMock.payout.create as unknown as Mock;
const txPayoutAccountFind = txMock.payoutAccount.findUnique as unknown as Mock;
const append = appendLedgerEntry as unknown as Mock;

const OP = 'op-1';
const KEY = 'idem-key-1';

/** Pull the single appendLedgerEntry call for a given entry type, if any. */
function callFor(type: string) {
  return append.mock.calls.find((c) => c[0].type === type)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no prior marker (fresh request), no in-lock marker.
  prismaLedgerFind.mockResolvedValue(null);
  txLedgerFind.mockResolvedValue(null);
  payoutCreate.mockResolvedValue({ id: 'payout-1' });
  // Default: the operator HAS a verified payout account (Issue 078 guard passes).
  txPayoutAccountFind.mockResolvedValue({ verifiedAt: new Date('2026-05-01T00:00:00Z') });
  // The FOR UPDATE select + the availableUnderLock SUM both go through tx.$queryRaw.
  // First call (lock) returns nothing meaningful; we override per-test for available.
  txQueryRaw.mockResolvedValue([{ available: '500000' }]);
});

describe('requestWithdrawal — validation', () => {
  it('rejects below_min when amount < MIN_WITHDRAW_THRESHOLD_VND', async () => {
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: MIN_WITHDRAW_THRESHOLD_VND - 1,
      idempotencyKey: KEY,
    });
    expect(res).toEqual({ ok: false, reason: 'below_min' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid_amount for zero / negative / non-integer', async () => {
    for (const bad of [0, -100, 100.5]) {
      const res = await requestWithdrawal({ operatorId: OP, amountMinor: bad, idempotencyKey: KEY });
      expect(res).toEqual({ ok: false, reason: 'invalid_amount' });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('requestWithdrawal — insufficient', () => {
  it('rejects insufficient_available and writes NOTHING when available < amount', async () => {
    // lock select (1st queryRaw) then available recompute (2nd) → 90_000 < 200_000.
    txQueryRaw.mockResolvedValueOnce([]); // FOR UPDATE lock row
    txQueryRaw.mockResolvedValueOnce([{ available: '90000' }]); // availableUnderLock
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: 200_000,
      idempotencyKey: KEY,
    });
    expect(res).toEqual({ ok: false, reason: 'insufficient_available' });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
});

describe('requestWithdrawal — payout-account guard (Issue 078)', () => {
  it('rejects payout_account_unverified when no payout account exists — no writes', async () => {
    txQueryRaw.mockResolvedValueOnce([]); // lock select
    txPayoutAccountFind.mockResolvedValueOnce(null); // no account
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: 200_000,
      idempotencyKey: KEY,
    });
    expect(res).toEqual({ ok: false, reason: 'payout_account_unverified' });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('rejects payout_account_unverified when the account exists but verifiedAt is null', async () => {
    txQueryRaw.mockResolvedValueOnce([]); // lock select
    txPayoutAccountFind.mockResolvedValueOnce({ verifiedAt: null }); // registered, unverified
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: 200_000,
      idempotencyKey: KEY,
    });
    expect(res).toEqual({ ok: false, reason: 'payout_account_unverified' });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
});

describe('requestWithdrawal — happy path', () => {
  it('creates a requested tripId:null Payout + sweep-aligned payout_debit + marker', async () => {
    txQueryRaw.mockResolvedValueOnce([]); // lock
    txQueryRaw.mockResolvedValueOnce([{ available: '500000' }]); // available
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: 200_000,
      idempotencyKey: KEY,
    });

    expect(res).toEqual({ ok: true, payoutId: 'payout-1' });

    // Payout: requested, tripId null, no fee, net == gross == amount.
    expect(payoutCreate).toHaveBeenCalledTimes(1);
    const payoutData = payoutCreate.mock.calls[0][0].data;
    expect(payoutData).toMatchObject({
      tripId: null,
      operatorId: OP,
      gross: 200_000,
      platformFee: 0,
      net: 200_000,
      status: 'requested',
    });

    // payout_debit keyed `payout_debit:<payoutId>` (sweep-aligned — prevents double debit).
    const debit = callFor('payout_debit');
    expect(debit).toBeDefined();
    expect(debit.sourceEventId).toBe('payout_debit:payout-1');
    expect(debit.amountMinor).toBe(BigInt(-200_000));
    expect(debit.payoutId).toBe('payout-1');

    // marker keyed by the idempotencyKey, zero-amount, carries the payoutId.
    const marker = callFor('adjustment');
    expect(marker).toBeDefined();
    expect(marker.sourceEventId).toBe(`withdraw-key:${KEY}`);
    expect(marker.amountMinor).toBe(BigInt(0));
    expect(marker.payoutId).toBe('payout-1');
  });
});

describe('requestWithdrawal — idempotent replay', () => {
  it('returns the prior payoutId and writes nothing when the marker already exists', async () => {
    prismaLedgerFind.mockResolvedValue({ payoutId: 'payout-prior' });
    const res = await requestWithdrawal({
      operatorId: OP,
      amountMinor: 200_000,
      idempotencyKey: KEY,
    });
    expect(res).toEqual({ ok: true, payoutId: 'payout-prior' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
});
