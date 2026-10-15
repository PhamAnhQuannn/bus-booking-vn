/**
 * #833: unit tests for POST /api/admin/finance/refunds/[id]/mark-paid.
 *
 * Finance auth shape, body validation, result → status mapping (200 / 404 REFUND_NOT_FOUND /
 * 422 NOT_OWED / 422 INVALID / 400), and the audit row on success only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMark, mockAudit, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockMark: vi.fn(),
  mockAudit: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/payment/manualRefund', () => ({ markManualRefundPaid: mockMark }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
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

function makeRequest(body: unknown, id = 'ob_1'): NextRequest {
  return new NextRequest(`http://localhost/api/admin/finance/refunds/${id}/mark-paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMark.mockResolvedValue({ ok: true });
});

describe('POST /api/admin/finance/refunds/[id]/mark-paid', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('marks the obligation paid with the trimmed bank ref and audits', async () => {
    const res = await POST(makeRequest({ bankRef: '  FT26287123  ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockMark).toHaveBeenCalledWith({
      obligationId: 'ob_1',
      bankRef: 'FT26287123',
      now: expect.any(Date),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'manual-refund-mark-paid', actor: 'admin:fin-1', target: 'ob_1' })
    );
  });

  it('404 REFUND_NOT_FOUND when the obligation is absent', async () => {
    mockMark.mockResolvedValueOnce({ ok: false, error: 'not_found' });
    const res = await POST(makeRequest({ bankRef: 'FT1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'REFUND_NOT_FOUND' });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('422 NOT_OWED when the obligation is not manual_pending', async () => {
    mockMark.mockResolvedValueOnce({ ok: false, error: 'not_owed' });
    const res = await POST(makeRequest({ bankRef: 'FT1' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NOT_OWED' });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('422 INVALID on a blank bank ref', async () => {
    const res = await POST(makeRequest({ bankRef: '   ' }));
    expect(res.status).toBe(422);
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('400 INVALID on an un-parseable body', async () => {
    const req = new NextRequest('http://localhost/api/admin/finance/refunds/ob_1/mark-paid', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockMark).not.toHaveBeenCalled();
  });
});
