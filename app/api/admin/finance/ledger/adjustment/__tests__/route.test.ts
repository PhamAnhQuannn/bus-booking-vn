/**
 * Issue 068: unit tests for POST /api/admin/finance/ledger/adjustment.
 *
 * Asserts the finance auth shape, that addManualAdjustment is called with the
 * parsed body + admin actor, 200 { ledgerEntryId }, and 422 on a missing reason /
 * non-integer amount (zod) AND on a ManualAdjustmentError from the service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAdjust, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockAdjust: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/addManualAdjustment', () => ({
  addManualAdjustment: mockAdjust,
  ManualAdjustmentError: class ManualAdjustmentError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
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
import { ManualAdjustmentError } from '@/lib/ledger';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/ledger/adjustment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdjust.mockResolvedValue({ ledgerEntryId: 'le_1' });
});

describe('POST /api/admin/finance/ledger/adjustment', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('calls addManualAdjustment with the body + admin actor and returns 200', async () => {
    const res = await POST(makeRequest({ operatorId: 'op_1', amountMinor: -50000, reason: 'fix' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ledgerEntryId: 'le_1' });
    expect(mockAdjust).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ operatorId: 'op_1', amountMinor: -50000, reason: 'fix', actor: 'admin:fin-1' })
    );
  });

  it('returns 422 on a missing reason (zod)', async () => {
    const res = await POST(makeRequest({ operatorId: 'op_1', amountMinor: 1000 }));
    expect(res.status).toBe(422);
    expect(mockAdjust).not.toHaveBeenCalled();
  });

  it('returns 422 on a non-integer amount (zod)', async () => {
    const res = await POST(makeRequest({ operatorId: 'op_1', amountMinor: 1.5, reason: 'x' }));
    expect(res.status).toBe(422);
  });

  it('returns 422 when the service rejects', async () => {
    mockAdjust.mockRejectedValue(new ManualAdjustmentError('invalid_amount'));
    const res = await POST(makeRequest({ operatorId: 'op_1', amountMinor: 1000, reason: 'x' }));
    expect(res.status).toBe(422);
  });
});
