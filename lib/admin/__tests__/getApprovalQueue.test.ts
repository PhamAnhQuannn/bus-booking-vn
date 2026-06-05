/**
 * Issue 065: unit tests for getApprovalQueue. Prisma is injected as a stub.
 */

import { describe, it, expect, vi } from 'vitest';

// getApprovalQueue imports the prisma singleton at module load; stub it so the
// real client (which needs DATABASE_URL) is never constructed. Each test injects
// its own prisma-like stub anyway.
vi.mock('@/lib/core/db/client', () => ({ prisma: { operator: { findMany: vi.fn() } } }));

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

  it('masks the contact phone and maps an empty kybDocuments list to docs', async () => {
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
        kybDocuments: [],
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

  it('selects kybDocuments (oldest first) and maps them into docs (Issue 077)', async () => {
    const uploadedAt = new Date('2026-05-02T00:00:00.000Z');
    const { prisma, findMany } = makePrisma([
      {
        id: 'op_3',
        legalName: 'Gamma Coaches',
        contactEmail: 'g@gamma.test',
        contactPhone: '+84905555555',
        status: 'UNDER_REVIEW',
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        rejectionReason: null,
        kybDocuments: [
          { id: 'kyb_1', type: 'business_license', status: 'submitted', uploadedAt },
        ],
      },
    ]);

    const queue = await getApprovalQueue(prisma);
    // The query selects the related KYB docs, oldest first.
    const arg = findMany.mock.calls[0][0];
    expect(arg.select.kybDocuments).toEqual({
      select: { id: true, type: true, status: true, uploadedAt: true },
      orderBy: { uploadedAt: 'asc' },
    });
    expect(queue[0].docs).toEqual([
      { id: 'kyb_1', type: 'business_license', status: 'submitted', uploadedAt },
    ]);
  });

  it('surfaces the payout account (number masked) + name-match signal (Issue 078)', async () => {
    const { prisma, findMany } = makePrisma([
      {
        id: 'op_4',
        legalName: 'Acme Buses',
        contactEmail: 'a@acme.test',
        contactPhone: '+84901112222',
        status: 'UNDER_REVIEW',
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        rejectionReason: null,
        kybDocuments: [],
        payoutAccount: {
          bankName: 'Test Bank',
          accountNumber: '0123456789',
          accountHolderName: 'Acme Buses',
          verifiedAt: null,
          verifyMethod: null,
        },
      },
    ]);

    const queue = await getApprovalQueue(prisma);
    // The query selects the related payout account.
    const arg = findMany.mock.calls[0][0];
    expect(arg.select.payoutAccount).toEqual({
      select: {
        bankName: true,
        accountNumber: true,
        accountHolderName: true,
        verifiedAt: true,
        verifyMethod: true,
      },
    });
    const pa = queue[0].payoutAccount!;
    expect(pa.bankName).toBe('Test Bank');
    expect(pa.accountNumberMasked).toBe('••••6789');
    // raw number never leaks
    expect(JSON.stringify(queue[0])).not.toContain('0123456789');
    // holder == legalName → name-match score 1, suggests verify
    expect(pa.nameMatchScore).toBe(1);
    expect(pa.suggestVerified).toBe(true);
    expect(pa.verifiedAt).toBeNull();
  });

  it('payoutAccount is null when the operator has not registered one (Issue 078)', async () => {
    const { prisma } = makePrisma([
      {
        id: 'op_5',
        legalName: 'No Account Co',
        contactEmail: 'n@noacc.test',
        contactPhone: '+84903334444',
        status: 'PENDING_REVIEW',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        rejectionReason: null,
        kybDocuments: [],
        payoutAccount: null,
      },
    ]);
    const queue = await getApprovalQueue(prisma);
    expect(queue[0].payoutAccount).toBeNull();
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
        kybDocuments: [],
      },
    ]);

    const queue = await getApprovalQueue(prisma);
    expect(queue[0].rejectionReason).toBe('missing license');
    expect(queue[0].status).toBe('UNDER_REVIEW');
  });
});
