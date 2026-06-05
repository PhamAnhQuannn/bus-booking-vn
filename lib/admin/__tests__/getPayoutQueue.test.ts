/**
 * Issue 068: unit tests for getPayoutQueue.
 *
 * Injects a fake prisma.payout.findMany. Asserts the optional status filter, the
 * seek-cursor pagination (take = limit+1, nextCursor = last kept row id on
 * overflow), and that the row shape is surfaced as-is.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { getPayoutQueue } from '../getPayoutQueue';

interface Row {
  id: string;
  operatorId: string;
  net: number;
  status: string;
  scheduledAt: Date;
  settledAt: Date | null;
  failureReason: string | null;
}

function makeRows(n: number, status = 'requested'): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `po_${i}`,
    operatorId: 'op_1',
    net: 100000 + i,
    status,
    scheduledAt: new Date(2026, 0, n - i),
    settledAt: null,
    failureReason: status === 'failed' ? 'bank_error' : null,
  }));
}

function fakePrisma(rows: Row[], capture?: (args: unknown) => void) {
  return {
    payout: {
      findMany: vi.fn(async (args: unknown) => {
        capture?.(args);
        return rows;
      }),
    },
  } as never;
}

describe('getPayoutQueue', () => {
  it('applies the status filter', async () => {
    let captured: { where?: unknown } | undefined;
    const prisma = fakePrisma(makeRows(1, 'failed'), (a) => {
      captured = a as { where?: unknown };
    });
    await getPayoutQueue({ status: 'failed' }, prisma);
    expect(captured?.where).toEqual({ status: 'failed' });
  });

  it('lists every status when no filter is given', async () => {
    let captured: { where?: unknown } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { where?: unknown };
    });
    await getPayoutQueue({}, prisma);
    expect(captured?.where).toEqual({});
  });

  it('paginates with take = limit + 1 and returns nextCursor on overflow', async () => {
    let captured: { take?: number } | undefined;
    const prisma = fakePrisma(makeRows(3), (a) => {
      captured = a as { take?: number };
    });
    const res = await getPayoutQueue({ limit: 2 }, prisma);
    expect(captured?.take).toBe(3);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('po_1');
    expect(res.items[0]).toMatchObject({ id: 'po_0', net: 100000, status: 'requested' });
  });

  it('nextCursor is null with no overflow', async () => {
    const prisma = fakePrisma(makeRows(2));
    const res = await getPayoutQueue({ limit: 5 }, prisma);
    expect(res.nextCursor).toBeNull();
  });
});
