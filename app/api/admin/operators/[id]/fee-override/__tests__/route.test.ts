/**
 * Issue 067: unit tests for POST /api/admin/operators/[id]/fee-override.
 *
 * Asserts the route is FINANCE/SUPER_ADMIN-gated + step-up composed (AC3/AC4),
 * calls setOperatorFeeOverride with the parsed ratePpm + admin actor, returns 200
 * { feeConfigId }, and 422s a bad body / FeeOverrideError.
 *
 * The role gate itself lives in requireAdminAuth (unit-tested separately, Issue 054).
 * Here we assert the route DECLARED the FINANCE+SUPER_ADMIN role set by capturing
 * the options passed to requireAdminAuth at import time.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSetOverride, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockSetOverride: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/setOperatorFeeOverride', () => ({
  setOperatorFeeOverride: mockSetOverride,
  // Re-declare the error class so the route's `instanceof` check works.
  FeeOverrideError: class FeeOverrideError extends Error {
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
import { FeeOverrideError } from '@/lib/ledger/setOperatorFeeOverride';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/operators/op_1/fee-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetOverride.mockResolvedValue({ feeConfigId: 'fc_new' });
});

describe('POST /api/admin/operators/[id]/fee-override', () => {
  it('composes requireStepUp (privileged action, AC3)', () => {
    expect(stepUpComposed.called).toBe(true);
  });

  it('declares the FINANCE + SUPER_ADMIN role set (AC4)', () => {
    expect(authOptions.value).toMatchObject({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'FINANCE'],
    });
  });

  it('calls setOperatorFeeOverride with the ratePpm + admin actor and returns 200 { feeConfigId }', async () => {
    const res = await POST(makeRequest({ ratePpm: 40000 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feeConfigId: 'fc_new' });
    expect(mockSetOverride).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ operatorId: 'op_1', ratePpm: 40000, actor: 'admin:fin-1' })
    );
  });

  it('returns 422 on a bad body (missing ratePpm)', async () => {
    const res = await POST(makeRequest({ nope: true }));
    expect(res.status).toBe(422);
    expect(mockSetOverride).not.toHaveBeenCalled();
  });

  it('returns 422 when the service rejects an invalid rate', async () => {
    mockSetOverride.mockRejectedValue(new FeeOverrideError('invalid_rate'));
    const res = await POST(makeRequest({ ratePpm: 999999 }));
    expect(res.status).toBe(422);
  });
});
