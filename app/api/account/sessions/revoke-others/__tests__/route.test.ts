/**
 * Unit tests — POST /api/account/sessions/revoke-others (#497).
 * The real requireCustomerAuth HOF runs (verifyAccess + Customer lookup mocked) so the
 * 401 path is the production one, not a stub.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_CID = 'cust-001';

const { mockVerifyAccess, mockCustomerFind, mockFindSession, mockRevokeOthers, mockRlLimit, mockCookieGet } =
  vi.hoisted(() => ({
    mockVerifyAccess: vi.fn(),
    mockCustomerFind: vi.fn(),
    mockFindSession: vi.fn(),
    mockRevokeOthers: vi.fn(),
    mockRlLimit: vi.fn(),
    mockCookieGet: vi.fn(),
  }));

vi.mock('@/lib/auth/jwt', () => ({ verifyAccess: mockVerifyAccess }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { customer: { findUnique: mockCustomerFind } },
}));
vi.mock('@/lib/auth/session', () => ({
  findCustomerSessionIdByRefresh: mockFindSession,
  revokeOtherCustomerSessions: mockRevokeOthers,
}));
vi.mock('@/lib/auth', async () => {
  const { requireCustomerAuth } = await import('@/lib/auth/requireCustomerAuth');
  return {
    requireCustomerAuth,
    findCustomerSessionIdByRefresh: mockFindSession,
    revokeOtherCustomerSessions: mockRevokeOthers,
  };
});
vi.mock('@/lib/ratelimit', () => ({ accountRevokeOthersRatelimit: { limit: mockRlLimit } }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: mockCookieGet })) }));
vi.mock('@/lib/withErrorHandler', () => ({ withErrorHandler: (h: CallableFunction) => h }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(auth = true): NextRequest {
  return new NextRequest('http://localhost/api/account/sessions/revoke-others', {
    method: 'POST',
    headers: auth ? { authorization: 'Bearer good-token' } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAccess.mockResolvedValue({ sub: TEST_CID, role: 'customer' });
  mockCustomerFind.mockResolvedValue({ id: TEST_CID, suspendedAt: null, deletedAt: null });
  mockRlLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockCookieGet.mockReturnValue({ value: 'rt-cookie' });
  mockFindSession.mockResolvedValue('sess-current');
  mockRevokeOthers.mockResolvedValue({ revoked: 3 });
});

describe('POST /api/account/sessions/revoke-others', () => {
  it('200 { revoked } — keeps the cookie-identified session, revokes the rest', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: 3 });
    expect(mockFindSession).toHaveBeenCalledWith('rt-cookie', TEST_CID);
    expect(mockRevokeOthers).toHaveBeenCalledWith(TEST_CID, 'sess-current');
    expect(mockRlLimit).toHaveBeenCalledWith(`account-revoke-others:${TEST_CID}`);
  });

  it('401 UNAUTHORIZED without a Bearer token — nothing revoked', async () => {
    const res = await POST(makeRequest(false));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('UNAUTHORIZED');
    expect(mockRevokeOthers).not.toHaveBeenCalled();
  });

  it('401 UNAUTHORIZED on an invalid access token', async () => {
    mockVerifyAccess.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRevokeOthers).not.toHaveBeenCalled();
  });

  it('429 RATE_LIMITED with Retry-After — nothing revoked', async () => {
    mockRlLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 600 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect((await res.json()).error).toBe('RATE_LIMITED');
    expect(mockRevokeOthers).not.toHaveBeenCalled();
  });

  it('400 SESSION_UNKNOWN when the bb_rt cookie is missing — never revokes blindly', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('SESSION_UNKNOWN');
    expect(mockFindSession).not.toHaveBeenCalled();
    expect(mockRevokeOthers).not.toHaveBeenCalled();
  });

  it('400 SESSION_UNKNOWN when the bb_rt cookie is invalid / not this customer', async () => {
    mockFindSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('SESSION_UNKNOWN');
    expect(mockRevokeOthers).not.toHaveBeenCalled();
  });

  it('400 SESSION_UNKNOWN when the helper cannot find the keep session', async () => {
    mockRevokeOthers.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('SESSION_UNKNOWN');
  });
});
