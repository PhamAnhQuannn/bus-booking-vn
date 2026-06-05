/**
 * Issue 068: unit tests for getLedgerView.
 *
 * Injects a fake prisma.ledgerEntry.findMany + a stub balance fn. Asserts:
 *   - amountMinor is returned as a STRING (BigInt not JSON-serializable, Issue 016);
 *   - the operatorId filter + the seek-cursor pagination (take = limit+1, nextCursor
 *     = last kept row id on overflow);
 *   - the balance summary is surfaced as strings.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { getLedgerView } from '../getLedgerView';

interface Row {
  id: string;
  type: string;
  amount: bigint;
  currency: string;
  bookingId: string | null;
  payoutId: string | null;
  sourceEventId: string;
  createdAt: Date;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `le_${i}`,
    type: 'booking_credit',
    amount: BigInt(100000 + i),
    currency: 'VND',
    bookingId: null,
    payoutId: null,
    sourceEventId: `src_${i}`,
    createdAt: new Date(2026, 0, n - i),
  }));
}

function fakePrisma(rows: Row[], capture?: (args: unknown) => void) {
  return {
    ledgerEntry: {
      findMany: vi.fn(async (args: unknown) => {
        capture?.(args);
        return rows;
      }),
    },
  } as never;
}

const stubBalance = async () => ({
  pending: BigInt(1000),
  available: BigInt(2000),
  paidOut: BigInt(3000),
});

describe('getLedgerView', () => {
  it('returns amountMinor as a string and the balance as strings', async () => {
    const prisma = fakePrisma(makeRows(1));
    const res = await getLedgerView({ operatorId: 'op_1' }, prisma, stubBalance);
    expect(res.items[0].amountMinor).toBe('100000');
    expect(typeof res.items[0].amountMinor).toBe('string');
    expect(res.balance).toEqual({ pending: '1000', available: '2000', paidOut: '3000' });
  });

  it('filters by operatorId and paginates with take = limit + 1', async () => {
    let captured: { where?: unknown; take?: number } | undefined;
    const prisma = fakePrisma(makeRows(3), (a) => {
      captured = a as { where?: unknown; take?: number };
    });
    const res = await getLedgerView({ operatorId: 'op_1', limit: 2 }, prisma, stubBalance);
    expect(captured?.where).toEqual({ operatorId: 'op_1' });
    expect(captured?.take).toBe(3);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('le_1');
  });

  it('nextCursor is null with no overflow', async () => {
    const prisma = fakePrisma(makeRows(2));
    const res = await getLedgerView({ operatorId: 'op_1', limit: 5 }, prisma, stubBalance);
    expect(res.nextCursor).toBeNull();
  });

  it('passes a seek cursor (cursor + skip:1) when a cursor is given', async () => {
    let captured: { cursor?: unknown; skip?: number } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { cursor?: unknown; skip?: number };
    });
    await getLedgerView({ operatorId: 'op_1', cursor: 'le_9' }, prisma, stubBalance);
    expect(captured?.cursor).toEqual({ id: 'le_9' });
    expect(captured?.skip).toBe(1);
  });
});
