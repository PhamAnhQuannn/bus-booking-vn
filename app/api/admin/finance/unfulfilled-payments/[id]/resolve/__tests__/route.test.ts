/**
 * #851: unit tests for POST /api/admin/finance/unfulfilled-payments/[id]/resolve.
 *
 * Finance auth shape, id + body validation, result → status mapping (200 / 404
 * PAYMENT_EVENT_NOT_FOUND / 422 NOT_RESOLVABLE / 422 INVALID / 400), audit on success only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResolve, mockAudit, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  mockAudit: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/payment/manualRefund', () => ({ resolveUnfulfilledPayment: mockResolve }));
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

const EVENT_ID = '11111111-2222-4333-8444-555555555555';

function makeRequest(body: unknown, id = EVENT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/admin/finance/unfulfilled-payments/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolve.mockResolvedValue({ ok: true });
});

describe('POST /api/admin/finance/unfulfilled-payments/[id]/resolve', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('resolves the event with the bank ref and audits', async () => {
    const res = await POST(makeRequest({ bankRef: 'FT26287999' }));
    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith({
      paymentEventId: EVENT_ID,
      bankRef: 'FT26287999',
      now: expect.any(Date),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'unfulfilled-payment-resolve', actor: 'admin:fin-1', target: EVENT_ID })
    );
  });

  it('404 PAYMENT_EVENT_NOT_FOUND when the event is absent', async () => {
    mockResolve.mockResolvedValueOnce({ ok: false, error: 'not_found' });
    const res = await POST(makeRequest({ bankRef: 'FT1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'PAYMENT_EVENT_NOT_FOUND' });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('422 NOT_RESOLVABLE when the event is an orphan / not unfulfilled / already resolved', async () => {
    mockResolve.mockResolvedValueOnce({ ok: false, error: 'not_resolvable' });
    const res = await POST(makeRequest({ bankRef: 'FT1' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NOT_RESOLVABLE' });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('400 INVALID on a non-uuid id (would otherwise 500 on the ::uuid cast)', async () => {
    const res = await POST(makeRequest({ bankRef: 'FT1' }, 'not-a-uuid'));
    expect(res.status).toBe(400);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('422 INVALID on a missing bank ref', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
