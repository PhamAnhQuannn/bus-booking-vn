/**
 * Issue 085: unit tests for lib/admin/getCharterDispatchQueue.ts.
 *
 * Injects fake prisma.charterRequest.findMany / findUnique + operator.findMany.
 * Asserts: the dispatch queue filters status=ADMIN_REVIEW oldest-first with
 * seek-cursor pagination; the approved-operators picker filters status=APPROVED;
 * getCharterById maps the full detail incl. assignee/timeouts and returns null when
 * not found.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import {
  getCharterDispatchQueue,
  getApprovedOperatorsForAssign,
  getCharterById,
} from '../getCharterDispatchQueue';

function makeRow(i: number, over: Record<string, unknown> = {}) {
  return {
    id: `ch_${i}`,
    ref: `CH-2026-00000${i}`,
    contactName: `Customer ${i}`,
    contactPhone: '+84901234567',
    contactEmail: `c${i}@example.com`,
    destinations: [{ name: 'Da Lat' }],
    startDate: new Date(2026, 5, 1),
    endDate: null,
    durationDays: null,
    passengers: 16,
    vehicleType: 'coach',
    budgetVnd: null,
    notes: null,
    createdAt: new Date(2026, 0, i),
    assigneeOperatorId: null,
    originPlace: { canonicalName: 'Ha Noi' },
    assigneeOperator: null,
    ...over,
  };
}

describe('getCharterDispatchQueue', () => {
  it('filters status=ADMIN_REVIEW, oldest-first, take=limit+1', async () => {
    let captured: unknown;
    const prisma = {
      charterRequest: {
        findMany: vi.fn(async (args: unknown) => {
          captured = args;
          return [makeRow(1), makeRow(2)];
        }),
      },
      operator: { findMany: vi.fn() },
    } as unknown as Parameters<typeof getCharterDispatchQueue>[0];

    const result = await getCharterDispatchQueue(prisma, { limit: 20 });

    expect(captured).toMatchObject({
      where: { status: 'ADMIN_REVIEW' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 21,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 'ch_1',
      ref: 'CH-2026-000001',
      originName: 'Ha Noi',
      priorAssigneeOperatorId: null,
    });
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when a page overflows the limit', async () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    const prisma = {
      charterRequest: { findMany: vi.fn(async () => rows) },
      operator: { findMany: vi.fn() },
    } as unknown as Parameters<typeof getCharterDispatchQueue>[0];

    const result = await getCharterDispatchQueue(prisma, { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('ch_2');
  });

  it('surfaces prior assignee for reassign context', async () => {
    const prisma = {
      charterRequest: {
        findMany: vi.fn(async () => [
          makeRow(1, {
            assigneeOperatorId: 'op_9',
            assigneeOperator: { legalName: 'Phương Trang' },
          }),
        ]),
      },
      operator: { findMany: vi.fn() },
    } as unknown as Parameters<typeof getCharterDispatchQueue>[0];

    const result = await getCharterDispatchQueue(prisma, {});
    expect(result.items[0]).toMatchObject({
      priorAssigneeOperatorId: 'op_9',
      priorAssigneeName: 'Phương Trang',
    });
  });
});

describe('getApprovedOperatorsForAssign', () => {
  it('filters status=APPROVED and maps { id, legalName }', async () => {
    let captured: unknown;
    const prisma = {
      charterRequest: { findMany: vi.fn() },
      operator: {
        findMany: vi.fn(async (args: unknown) => {
          captured = args;
          return [
            { id: 'op_1', legalName: 'Alpha Lines' },
            { id: 'op_2', legalName: 'Beta Coaches' },
          ];
        }),
      },
    } as unknown as Parameters<typeof getApprovedOperatorsForAssign>[0];

    const result = await getApprovedOperatorsForAssign(prisma);
    expect(captured).toMatchObject({
      where: { status: 'APPROVED' },
      orderBy: [{ legalName: 'asc' }],
    });
    expect(result).toEqual([
      { id: 'op_1', legalName: 'Alpha Lines' },
      { id: 'op_2', legalName: 'Beta Coaches' },
    ]);
  });
});

describe('getCharterById', () => {
  it('maps full detail incl. status / assignee / timeouts', async () => {
    const acceptByAt = new Date(2026, 5, 2);
    const prisma = {
      charterRequest: {
        findUnique: vi.fn(async () =>
          makeRow(1, {
            status: 'ASSIGNED_DIRECT',
            assigneeOperatorId: 'op_5',
            assigneeOperator: { legalName: 'Gamma Bus' },
            publishedAt: null,
            claimByAt: null,
            acceptByAt,
            rejectionReason: null,
          })
        ),
      },
      operator: { findMany: vi.fn() },
    } as unknown as Parameters<typeof getCharterById>[0];

    const detail = await getCharterById(prisma, 'ch_1');
    expect(detail).toMatchObject({
      id: 'ch_1',
      status: 'ASSIGNED_DIRECT',
      assigneeOperatorId: 'op_5',
      assigneeName: 'Gamma Bus',
      acceptByAt,
    });
  });

  it('returns null when the charter is not found', async () => {
    const prisma = {
      charterRequest: { findUnique: vi.fn(async () => null) },
      operator: { findMany: vi.fn() },
    } as unknown as Parameters<typeof getCharterById>[0];

    expect(await getCharterById(prisma, 'nope')).toBeNull();
  });
});
