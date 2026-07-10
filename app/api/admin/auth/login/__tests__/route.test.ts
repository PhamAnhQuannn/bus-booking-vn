/**
 * Unit tests for POST /api/admin/auth/login (Issue 054).
 * Mocks adminAuthService, adminSession, ratelimit, and next/headers cookies.
 *
 * Asserts: 200 valid (NO token in body, both admin cookies set),
 *          401 invalid credentials, 429 when ratelimit !allowed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAdminLogin, mockIssueAdminSession, mockAdminLoginRatelimit, mockAdminLoginLockout, mockCookieStore } = vi.hoisted(() => ({
  mockAdminLogin: vi.fn(),
  mockIssueAdminSession: vi.fn(),
  mockAdminLoginRatelimit: { limit: vi.fn() },
  mockAdminLoginLockout: { limit: vi.fn() },
  mockCookieStore: { set: vi.fn(), get: vi.fn() },
}));

vi.mock('@/lib/auth/adminAuthService', () => ({ adminLogin: mockAdminLogin }));
vi.mock('@/lib/auth/adminSession', () => ({ issueAdminSession: mockIssueAdminSession }));
vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal()),
  adminLoginRatelimit: mockAdminLoginRatelimit,
  adminLoginLockout: mockAdminLoginLockout,
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.5' },
    body: JSON.stringify(body),
  });
}

const SESSION = {
  accessToken: 'admin-access-token',
  refreshToken: 'admin-refresh-token',
  refreshHash: 'admin-hash',
  family: 'fam-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminLoginRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 });
  mockAdminLoginLockout.limit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockAdminLogin.mockResolvedValue({ ok: true, adminUserId: 'admin-1', role: 'FINANCE' });
  mockIssueAdminSession.mockResolvedValue(SESSION);
});

describe('POST /api/admin/auth/login', () => {
  it('returns 200 with { role } and NO tokens in body on valid credentials', async () => {
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'CorrectPassword1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.role).toBe('FINANCE');
    // SECURITY: tokens must NOT appear in the response body.
    expect(json.accessToken).toBeUndefined();
    expect(json.refreshToken).toBeUndefined();
  });

  it('sets bb_admin_access and bb_admin_refresh cookies on success', async () => {
    await POST(makeRequest({ email: 'admin@example.com', password: 'CorrectPassword1' }));
    const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
    expect(calls).toContain('bb_admin_access');
    expect(calls).toContain('bb_admin_refresh');
    // Both cookies must be HttpOnly + sameSite strict.
    for (const call of mockCookieStore.set.mock.calls) {
      expect(call[2]).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/' });
    }
  });

  it('returns 401 INVALID_CREDENTIALS on failed login', async () => {
    mockAdminLogin.mockResolvedValue({ ok: false });
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'wrong' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_CREDENTIALS');
    // No session issued, no cookies set.
    expect(mockIssueAdminSession).not.toHaveBeenCalled();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-IP rate limit is exhausted', async () => {
    mockAdminLoginRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 42 });
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'CorrectPassword1' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockAdminLogin).not.toHaveBeenCalled();
  });

  it('returns 429 LOCKED_OUT when per-email lockout is exhausted on invalid credentials', async () => {
    mockAdminLogin.mockResolvedValue({ ok: false });
    mockAdminLoginLockout.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 });
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'wrong' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('LOCKED_OUT');
    expect(res.headers.get('Retry-After')).toBe('900');
  });

  it('consumes lockout counter on invalid credentials but returns 401 when still within limit', async () => {
    mockAdminLogin.mockResolvedValue({ ok: false });
    mockAdminLoginLockout.limit.mockResolvedValue({ allowed: true, remaining: 3, retryAfter: 0 });
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'wrong' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_CREDENTIALS');
    expect(mockAdminLoginLockout.limit).toHaveBeenCalledWith('admin-login-fail:admin@example.com');
  });

  it('does not consume lockout counter on successful login', async () => {
    await POST(makeRequest({ email: 'admin@example.com', password: 'CorrectPassword1' }));
    expect(mockAdminLoginLockout.limit).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed body (missing email)', async () => {
    const res = await POST(makeRequest({ password: 'CorrectPassword1' }));
    expect(res.status).toBe(400);
  });
});
