/**
 * Issue 068: unit tests for POST /api/admin/finance/payouts/[id]/approve.
 *
 * Asserts the finance auth shape, the TOCTOU-guarded requested→processing nudge
 * (SELECT FOR UPDATE in a tx, update only when status='requested'), the audit row,
 * and the error mappings (not_found → 404, not_requested → 422).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAudit, mockTx, mockQueryRaw, mockUpdate, stepUpComposed, authOptions } = vi.hoisted(
  () => ({
    mockAudit: vi.fn(),
    mockTx: vi.fn(),
    mockQueryRaw: vi.fn(),
    mockUpdate: vi.fn(),
    stepUpComposed: { called: false },
    authOptions: { value: undefined as unknown },
  })
);

vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: (fn: (tx: any) => Promise<unknown>) =>
      fn({ $queryRaw: mockQueryRaw, payout: { update: mockUpdate } }),
  },
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    authOptions.value = opts;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true });
  },
}));
vi.mock('@/lib/auth/requireStepUp', () => ({
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => {
    stepUpComposed.called = true;
    return handler;
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/payouts/po_1/approve', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  void mockTx;
  mockUpdate.mockResolvedValue({});
});

describe('POST /api/admin/finance/payouts/[id]/approve', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('advances a requested payout to processing and audits', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'po_1', status: 'requested' }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'po_1' }, data: { status: 'processing' } });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'payout-approve', actor: 'admin:super-1', target: 'po_1' })
    );
  });

  it('returns 404 when the payout row is absent', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 422 when the payout is not in requested state', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'po_1', status: 'paid' }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
