/**
 * Unit tests for lib/ledger/balance.ts (Issue 050 Part B).
 *
 * prisma.$queryRaw is mocked to return the single aggregate row the bucket SQL
 * produces. These tests prove the JS-side bucket math + BigInt parsing:
 *
 *   - available = settledEligible − paidOut
 *   - all three values are bigint (never JS number — no float drift, Issue 016)
 *   - a pending-only credit (not-yet-completed trip) → pending, available 0
 *   - a settled-eligible credit (completed + T+1) → available, pending 0
 *   - after a payout_debit → paidOut > 0 and available drops by that amount
 *   - large VND magnitudes survive without precision loss
 *
 * The trip-completion + T+1 windowing itself is SQL (a CASE in the aggregate)
 * and is exercised by the DB-gated integration test; here we feed the post-SQL
 * bucket sums and assert the deterministic JS arithmetic on top of them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from '@/lib/db/client';
import { getOperatorBalance } from '../balance';

const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

/** Mock the aggregate row the bucket SQL returns (Postgres ::text columns). */
function mockRow(settledEligible: string, pendingSum: string, paidOut: string) {
  queryRaw.mockResolvedValueOnce([
    { settled_eligible: settledEligible, pending_sum: pendingSum, paid_out: paidOut },
  ]);
}

describe('getOperatorBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('credit on a not-yet-eligible trip → pending; available 0', async () => {
    // 1,410,000 VND earned but the trip is not completed+T+1 yet.
    mockRow('0', '1410000', '0');
    const bal = await getOperatorBalance('op-1');
    expect(bal.pending).toBe(BigInt(1_410_000));
    expect(bal.available).toBe(BigInt(0));
    expect(bal.paidOut).toBe(BigInt(0));
  });

  it('credit on a completed+T+1 trip → available; pending 0', async () => {
    mockRow('1410000', '0', '0');
    const bal = await getOperatorBalance('op-1');
    expect(bal.pending).toBe(BigInt(0));
    expect(bal.available).toBe(BigInt(1_410_000));
    expect(bal.paidOut).toBe(BigInt(0));
  });

  it('after a payout_debit → paidOut increases and available drops by it', async () => {
    // settlement-eligible 1,410,000; already paid out 1,000,000.
    mockRow('1410000', '0', '1000000');
    const bal = await getOperatorBalance('op-1');
    expect(bal.paidOut).toBe(BigInt(1_000_000));
    // available = settledEligible − paidOut = 1,410,000 − 1,000,000.
    expect(bal.available).toBe(BigInt(410_000));
    expect(bal.pending).toBe(BigInt(0));
  });

  it('available = settledEligible − paidOut even when fully paid out', async () => {
    mockRow('1410000', '500000', '1410000');
    const bal = await getOperatorBalance('op-1');
    expect(bal.available).toBe(BigInt(0));
    expect(bal.pending).toBe(BigInt(500_000));
    expect(bal.paidOut).toBe(BigInt(1_410_000));
  });

  it('returns all three values as bigint (no float drift)', async () => {
    mockRow('5', '7', '3');
    const bal = await getOperatorBalance('op-1');
    expect(typeof bal.pending).toBe('bigint');
    expect(typeof bal.available).toBe('bigint');
    expect(typeof bal.paidOut).toBe('bigint');
  });

  it('preserves large VND magnitudes past the 2^53 safe-integer ceiling', async () => {
    // A full fleet's lifetime revenue can exceed Number.MAX_SAFE_INTEGER.
    const big = '9007199254740993'; // 2^53 + 1, not representable as a JS number
    mockRow(big, '0', '0');
    const bal = await getOperatorBalance('op-1');
    expect(bal.available).toBe(BigInt(big));
    expect(bal.available).not.toBe(BigInt(Number(big))); // proves no float coercion
  });

  it('empty ledger (no rows) → all zero', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const bal = await getOperatorBalance('op-1');
    expect(bal.pending).toBe(BigInt(0));
    expect(bal.available).toBe(BigInt(0));
    expect(bal.paidOut).toBe(BigInt(0));
  });
});
