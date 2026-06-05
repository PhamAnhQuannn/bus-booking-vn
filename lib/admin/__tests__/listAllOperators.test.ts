/**
 * Issue 067: unit tests for listAllOperators.
 *
 * Injects a fake prisma.operator.findMany. Asserts the status filter, the
 * seek-cursor pagination (take = limit + 1, nextCursor = last row id when a page
 * overflows), phone masking, and the no-more-pages case.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { listAllOperators } from '../listAllOperators';

interface Row {
  id: string;
  legalName: string;
  contactPhone: string;
  status: string;
  createdAt: Date;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `op_${i}`,
    legalName: `Operator ${i}`,
    contactPhone: '+84901234567',
    status: 'APPROVED',
    createdAt: new Date(2026, 0, n - i),
  }));
}

function fakePrisma(rows: Row[], capture?: (args: unknown) => void) {
  return {
    operator: {
      findMany: vi.fn(async (args: unknown) => {
        capture?.(args);
        return rows;
      }),
    },
  } as never;
}

describe('listAllOperators', () => {
  it('returns nextCursor = last row id when the page overflows limit', async () => {
    // limit 2 → take 3; return 3 rows → hasMore, drop the extra.
    const prisma = fakePrisma(makeRows(3));
    const res = await listAllOperators({ limit: 2 }, prisma);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('op_1'); // id of the last KEPT row
    expect(res.items[0].contactMasked).toBe('+xxxxxxx4567');
  });

  it('returns nextCursor = null when there is no overflow', async () => {
    const prisma = fakePrisma(makeRows(2));
    const res = await listAllOperators({ limit: 5 }, prisma);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBeNull();
  });

  it('applies the status filter', async () => {
    let captured: { where?: unknown } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { where?: unknown };
    });
    await listAllOperators({ status: 'SUSPENDED' }, prisma);
    expect(captured?.where).toEqual({ status: 'SUSPENDED' });
  });

  it('passes a seek cursor (cursor + skip:1) when a cursor is given', async () => {
    let captured: { cursor?: unknown; skip?: number } | undefined;
    const prisma = fakePrisma(makeRows(1), (a) => {
      captured = a as { cursor?: unknown; skip?: number };
    });
    await listAllOperators({ cursor: 'op_9' }, prisma);
    expect(captured?.cursor).toEqual({ id: 'op_9' });
    expect(captured?.skip).toBe(1);
  });
});
