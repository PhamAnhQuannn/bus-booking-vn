/**
 * Issue 068: unit tests for POST /api/admin/finance/payouts/[id]/retry.
 *
 * Asserts the finance auth shape (FINANCE+SUPER_ADMIN role set + requireTotp +
 * step-up composed via financeRoute), that retryPayout is called with the resolved
 * operatorId, that a payout-retry audit row is written, and the error mappings
 * (not_found → 404, not_failed → 422).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRetry, mockAudit, mockFindUnique, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockRetry: vi.fn(),
  mockAudit: vi.fn(),
  mockFindUnique: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/retryPayout', () => ({ retryPayout: mockRetry }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/db/client', () => ({
  prisma: { payout: { findUnique: mockFindUnique } },
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    authOptions.value = opts;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'fin-1', role: 'FINANCE', totpVerified: true });
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
  return new NextRequest('http://localhost/api/admin/finance/payouts/po_1/retry', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ operatorId: 'op_1' });
  mockRetry.mockResolvedValue({ ok: true, payout: { status: 'processing' } });
});

describe('POST /api/admin/finance/payouts/[id]/retry', () => {
  it('declares the FINANCE + SUPER_ADMIN role set + TOTP and composes step-up', () => {
    expect(authOptions.value).toMatchObject({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'FINANCE'],
    });
    expect(stepUpComposed.called).toBe(true);
  });

  it('calls retryPayout with the resolved operatorId and audits on success', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockRetry).toHaveBeenCalledWith({ payoutId: 'po_1', operatorId: 'op_1' });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'payout-retry', actor: 'admin:fin-1', target: 'po_1' })
    );
  });

  it('returns 404 when the payout does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it('returns 422 when the payout is not failed', async () => {
    mockRetry.mockResolvedValue({ ok: false, error: 'not_failed' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
