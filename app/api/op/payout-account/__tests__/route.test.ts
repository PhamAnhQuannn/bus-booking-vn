/**
 * Issue 078: unit tests for /api/op/payout-account.
 *
 * Covers:
 *   - 401 without an operator session
 *   - POST 200 happy path → setPayoutAccount called with operatorId (from JWT)
 *   - POST 422 on schema-invalid body
 *   - POST 400 on non-JSON body
 *   - POST ignores any body operatorId (tenant = session)
 *   - GET 200 returns the masked account; GET 404 when none registered
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockSetPayoutAccount,
  mockGetPayoutAccount,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockSetPayoutAccount: vi.fn(),
  mockGetPayoutAccount: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/onboarding/payoutAccount', () => ({
  setPayoutAccount: mockSetPayoutAccount,
  getPayoutAccount: mockGetPayoutAccount,
}));

import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  role: 'admin' as const,
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-A',
  assignedTripId: null,
};

const VALID_BODY = {
  bankName: 'Test Bank',
  accountNumber: '0123456789',
  accountHolderName: 'Acme Buses',
};

function makePost(body: unknown, raw = false): NextRequest {
  return new NextRequest('http://localhost/api/op/payout-account', {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token', 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

function makeGet(): NextRequest {
  return new NextRequest('http://localhost/api/op/payout-account', {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-user-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-A',
    role: 'admin',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  mockSetPayoutAccount.mockResolvedValue(undefined);
  mockGetPayoutAccount.mockResolvedValue(null);
});

describe('POST /api/op/payout-account', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('200 happy path → setPayoutAccount called with operatorId from JWT', async () => {
    const res = await POST(makePost(VALID_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSetPayoutAccount).toHaveBeenCalledWith(expect.anything(), {
      operatorId: 'op-org-A',
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'Acme Buses',
    });
  });

  it('ignores a body operatorId — tenant is always the session', async () => {
    const res = await POST(makePost({ ...VALID_BODY, operatorId: 'op-EVIL' }));
    expect(res.status).toBe(200);
    expect(mockSetPayoutAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operatorId: 'op-org-A' })
    );
  });

  it('422 on schema-invalid body (missing accountNumber)', async () => {
    const res = await POST(makePost({ bankName: 'B', accountHolderName: 'H' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('validation_failed');
    expect(mockSetPayoutAccount).not.toHaveBeenCalled();
  });

  it('400 on non-JSON body', async () => {
    const res = await POST(makePost('not-json{', true));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_body');
  });

  it('does NOT echo the account number in the response', async () => {
    const res = await POST(makePost(VALID_BODY));
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain('0123456789');
  });
});

describe('GET /api/op/payout-account', () => {
  it('404 when the operator has no registered account', async () => {
    mockGetPayoutAccount.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(404);
  });

  it('200 returns the masked account', async () => {
    mockGetPayoutAccount.mockResolvedValue({
      bankName: 'Test Bank',
      accountNumberMasked: '••••6789',
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.account.accountNumberMasked).toBe('••••6789');
    expect(JSON.stringify(json)).not.toContain('0123456789');
  });
});
