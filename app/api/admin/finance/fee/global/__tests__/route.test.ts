/**
 * Issue 068: unit tests for POST /api/admin/finance/fee/global.
 *
 * Asserts the finance auth shape, that setGlobalFee is called with the parsed
 * ratePpm + admin actor, 200 { feeConfigId }, and 422 on a bad body / GlobalFeeError.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSetGlobal, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockSetGlobal: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/setGlobalFee', () => ({
  setGlobalFee: mockSetGlobal,
  GlobalFeeError: class GlobalFeeError extends Error {
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
import { GlobalFeeError } from '@/lib/ledger';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/fee/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetGlobal.mockResolvedValue({ feeConfigId: 'fc_global_new' });
});

describe('POST /api/admin/finance/fee/global', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('calls setGlobalFee with the ratePpm + admin actor and returns 200', async () => {
    const res = await POST(makeRequest({ ratePpm: 70000 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feeConfigId: 'fc_global_new' });
    expect(mockSetGlobal).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ ratePpm: 70000, actor: 'admin:super-1' })
    );
  });

  it('returns 422 on a bad body (missing ratePpm)', async () => {
    const res = await POST(makeRequest({ nope: true }));
    expect(res.status).toBe(422);
    expect(mockSetGlobal).not.toHaveBeenCalled();
  });

  it('returns 422 when the service rejects an invalid rate', async () => {
    mockSetGlobal.mockRejectedValue(new GlobalFeeError('invalid_rate'));
    const res = await POST(makeRequest({ ratePpm: 999999 }));
    expect(res.status).toBe(422);
  });
});
