/**
 * Unit tests for POST /api/admin/auth/totp/verify (Issue 055).
 * Mocks the TOTP service, admin session, ratelimit (throttle + lockout),
 * requireAdminAuth (passthrough injecting ctx), and next/headers cookies.
 *
 * Asserts: 409 enrollment-required, 200 success (re-issues session with
 * totpVerified=true), 401 bad code, 429 after the lockout threshold.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyLoginTotp,
  mockIssueAdminSession,
  mockThrottle,
  mockLockout,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyLoginTotp: vi.fn(),
  mockIssueAdminSession: vi.fn(),
  mockThrottle: { limit: vi.fn() },
  mockLockout: { limit: vi.fn() },
  mockCookieStore: { set: vi.fn(), get: vi.fn() },
}));

vi.mock('@/lib/auth/adminTotp', () => ({ verifyLoginTotp: mockVerifyLoginTotp }));
vi.mock('@/lib/auth/adminSession', () => ({ issueAdminSession: mockIssueAdminSession }));
vi.mock('@/lib/ratelimit', () => ({
  adminTotpRatelimit: mockThrottle,
  adminTotpLockout: mockLockout,
}));

// requireAdminAuth passthrough: invoke the handler with a fixed authed ctx.
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: () => (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: unknown) => handler(req, { adminId: 'admin-1', role: 'FINANCE', totpVerified: false }),
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/auth/totp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  mockThrottle.limit.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 });
  mockLockout.limit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockIssueAdminSession.mockResolvedValue(SESSION);
});

describe('POST /api/admin/auth/totp/verify', () => {
  it('returns 409 TOTP_ENROLLMENT_REQUIRED when TOTP not enabled', async () => {
    mockVerifyLoginTotp.mockResolvedValue({ ok: false, reason: 'enrollment_required' });
    const res = await POST(makeRequest({ code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe('TOTP_ENROLLMENT_REQUIRED');
    expect(mockIssueAdminSession).not.toHaveBeenCalled();
  });

  it('returns 200 and re-issues session with totpVerified=true on a valid code', async () => {
    mockVerifyLoginTotp.mockResolvedValue({ ok: true });
    const res = await POST(makeRequest({ code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.role).toBe('FINANCE');
    // The session re-issue MUST pass totpVerified=true (3rd positional arg).
    expect(mockIssueAdminSession).toHaveBeenCalledWith('admin-1', 'FINANCE', true);
    const cookieNames = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
    expect(cookieNames).toContain('bb_admin_access');
    expect(cookieNames).toContain('bb_admin_refresh');
  });

  it('returns 401 INVALID_CODE on a wrong code (lockout not yet exhausted)', async () => {
    mockVerifyLoginTotp.mockResolvedValue({ ok: false, reason: 'bad_code' });
    const res = await POST(makeRequest({ code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_CODE');
    // Lockout counter consumed on the bad code.
    expect(mockLockout.limit).toHaveBeenCalledWith('admin-totp-fail:admin-1');
    expect(mockIssueAdminSession).not.toHaveBeenCalled();
  });

  it('returns 429 LOCKED_OUT once the consecutive-failure threshold is hit', async () => {
    mockVerifyLoginTotp.mockResolvedValue({ ok: false, reason: 'bad_code' });
    mockLockout.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 540 });
    const res = await POST(makeRequest({ code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('LOCKED_OUT');
    expect(res.headers.get('Retry-After')).toBe('540');
  });

  it('returns 429 RATE_LIMITED when the general throttle is exhausted (no verify attempted)', async () => {
    mockThrottle.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 30 });
    const res = await POST(makeRequest({ code: '123456' }));
    expect(res.status).toBe(429);
    expect(mockVerifyLoginTotp).not.toHaveBeenCalled();
  });
});
