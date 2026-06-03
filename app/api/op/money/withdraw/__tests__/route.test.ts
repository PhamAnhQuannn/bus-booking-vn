/**
 * Unit tests for POST /api/op/money/withdraw (Issue 053).
 *
 * Coverage:
 *   - 401 when no operator session cookie.
 *   - 422 below_min (requestWithdrawal returns below_min).
 *   - 422 validation_failed for a non-positive / missing amount.
 *   - 200 { payoutId } on success.
 *   - body operatorId is IGNORED — requestWithdrawal is called with the SESSION
 *     operatorId, never the body's.
 *
 * requireOperatorAuth is exercised via its real impl with the jwt + cookies +
 * prisma.operatorUser.findUnique mocked (same pattern as /api/op/buses tests).
 * requestWithdrawal itself is mocked — its behaviour is covered by withdrawal.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockRequestWithdrawal,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockRequestWithdrawal: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/ledger/withdrawal', () => ({ requestWithdrawal: mockRequestWithdrawal }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makePost(body: unknown, withCookie = true): NextRequest {
  return new NextRequest('http://localhost/api/op/money/withdraw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { Cookie: 'bb_op_access=valid-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const OPERATOR_USER = {
  id: 'opu-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
  role: 'admin',
  assignedTripId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'opu-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  mockRequestWithdrawal.mockResolvedValue({ ok: true, payoutId: 'payout-xyz' });
});

describe('POST /api/op/money/withdraw', () => {
  it('returns 401 without a session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost({ amountMinor: 200_000 }, false));
    expect(res.status).toBe(401);
    expect(mockRequestWithdrawal).not.toHaveBeenCalled();
  });

  it('returns 422 validation_failed for a non-positive / missing amount', async () => {
    const res = await POST(makePost({ amountMinor: 0 }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('validation_failed');
    expect(mockRequestWithdrawal).not.toHaveBeenCalled();
  });

  it('returns 422 below_min when requestWithdrawal rejects below_min', async () => {
    mockRequestWithdrawal.mockResolvedValue({ ok: false, reason: 'below_min' });
    const res = await POST(makePost({ amountMinor: 50_000 }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('below_min');
  });

  it('returns 422 insufficient_available', async () => {
    mockRequestWithdrawal.mockResolvedValue({ ok: false, reason: 'insufficient_available' });
    const res = await POST(makePost({ amountMinor: 9_000_000 }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('insufficient_available');
  });

  it('returns 200 { payoutId } on success', async () => {
    const res = await POST(makePost({ amountMinor: 200_000 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.payoutId).toBe('payout-xyz');
  });

  it('IGNORES a body operatorId — calls requestWithdrawal with the SESSION operatorId', async () => {
    const res = await POST(makePost({ amountMinor: 200_000, operatorId: 'attacker-op' }));
    expect(res.status).toBe(200);
    expect(mockRequestWithdrawal).toHaveBeenCalledTimes(1);
    const arg = mockRequestWithdrawal.mock.calls[0][0];
    expect(arg.operatorId).toBe('op-org-1'); // session, NOT 'attacker-op'
    expect(arg.amountMinor).toBe(200_000);
  });
});
