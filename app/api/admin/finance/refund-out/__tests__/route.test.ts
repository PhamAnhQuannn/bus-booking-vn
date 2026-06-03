/**
 * Issue 068: unit tests for POST /api/admin/finance/refund-out.
 *
 * Asserts the finance auth shape, that refundOut is called with the body + an
 * `admin-refund:` idempotencyKey + the operator_cancel RefundReason, that an
 * admin-refund-out audit row is written, 200 mapping of refunded/alreadyDone, and
 * 422 on a bad body / non-refundable + 404 on booking_not_found.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRefund, mockAudit, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockRefund: vi.fn(),
  mockAudit: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/refund', () => ({
  refundOut: mockRefund,
  RefundOutError: class RefundOutError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/db/client', () => ({ prisma: {} }));
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
import { RefundOutError } from '@/lib/ledger/refund';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/refund-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRefund.mockResolvedValue({ refunded: true, alreadyDone: false });
});

describe('POST /api/admin/finance/refund-out', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('calls refundOut with the body + an admin-refund idempotencyKey and audits', async () => {
    const res = await POST(makeRequest({ bookingId: 'bk_1', amountMinor: 50000, reason: 'goodwill' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ refunded: true, alreadyDone: false });
    const call = mockRefund.mock.calls[0][0];
    expect(call).toMatchObject({ bookingId: 'bk_1', amountMinor: 50000, reason: 'operator_cancel' });
    expect(call.idempotencyKey).toMatch(/^admin-refund:/);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'admin-refund-out', actor: 'admin:fin-1', target: 'bk_1' })
    );
  });

  it('returns 422 on a bad body (missing amount)', async () => {
    const res = await POST(makeRequest({ bookingId: 'bk_1', reason: 'x' }));
    expect(res.status).toBe(422);
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('returns 404 on booking_not_found', async () => {
    mockRefund.mockRejectedValue(new RefundOutError('booking_not_found'));
    const res = await POST(makeRequest({ bookingId: 'bk_x', amountMinor: 1000, reason: 'x' }));
    expect(res.status).toBe(404);
  });

  it('returns 422 on not_refundable', async () => {
    mockRefund.mockRejectedValue(new RefundOutError('not_refundable'));
    const res = await POST(makeRequest({ bookingId: 'bk_1', amountMinor: 1000, reason: 'x' }));
    expect(res.status).toBe(422);
  });
});
