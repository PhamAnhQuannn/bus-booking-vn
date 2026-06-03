/**
 * Issue 065: unit tests for getApprovalQueue. Prisma is injected as a stub.
 */

import { describe, it, expect, vi } from 'vitest';

// getApprovalQueue imports the prisma singleton at module load; stub it so the
// real client (which needs DATABASE_URL) is never constructed. Each test injects
// its own prisma-like stub anyway.
vi.mock('@/lib/db/client', () => ({ prisma: { operator: { findMany: vi.fn() } } }));

import { getApprovalQueue } from '../getApprovalQueue';

function makePrisma(rows: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { prisma: { operator: { findMany } } as never, findMany };
}

describe('getApprovalQueue', () => {
  it('queries only PENDING_REVIEW + UNDER_REVIEW operators, oldest first', async () => {
    const { prisma, findMany } = makePrisma([]);
    await getApprovalQueue(prisma);

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } });
    expect(arg.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('masks the contact phone and includes an empty docs placeholder (Wave 5)', async () => {
    const createdAt = new Date('2026-05-01T00:00:00.000Z');
    const { prisma } = makePrisma([
      {
        id: 'op_1',
        legalName: 'Acme Buses',
        contactEmail: 'ops@acme.test',
        contactPhone: '+84901234567',
        status: 'PENDING_REVIEW',
        createdAt,
        rejectionReason: null,
      },
    ]);

    const queue = await getApprovalQueue(prisma);
    expect(queue).toHaveLength(1);
    const op = queue[0];
    expect(op.id).toBe('op_1');
    expect(op.legalName).toBe('Acme Buses');
    expect(op.contactEmail).toBe('ops@acme.test');
    // redactPhone keeps the last 4 digits, masks the rest with literal 'x'.
    expect(op.contactPhone).toBe('+xxxxxxx4567');
    expect(op.contactPhone).not.toContain('90123');
    expect(op.status).toBe('PENDING_REVIEW');
    expect(op.createdAt).toEqual(createdAt);
    expect(op.docs).toEqual([]);
  });

  it('passes through a prior rejection reason for resubmitted (UNDER_REVIEW) operators', async () => {
    const { prisma } = makePrisma([
      {
        id: 'op_2',
        legalName: 'Beta Lines',
        contactEmail: 'hi@beta.test',
        contactPhone: '+84907654321',
        status: 'UNDER_REVIEW',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        rejectionReason: 'missing license',
      },
    ]);

    const queue = await getApprovalQueue(prisma);
    expect(queue[0].rejectionReason).toBe('missing license');
    expect(queue[0].status).toBe('UNDER_REVIEW');
  });
});
