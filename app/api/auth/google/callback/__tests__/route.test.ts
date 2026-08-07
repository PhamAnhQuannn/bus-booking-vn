/**
 * Unit tests for GET /api/auth/google/callback (ADR-021 / DS-033).
 *
 * Covers the security-critical wiring the L1–L4 resolver unit tests do NOT: the flag guard,
 * per-IP rate-limit, CSRF `state` match against the signed bb_goauth cookie, code-exchange /
 * id_token failure handling, the resolver-reason redirect, and the cookie side-effects
 * (bb_rt set, bb_goauth cleared). Every failure must redirect to the SINGLE `?error=google`
 * value (FD-012 §2A.4) — never leak the specific reason.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockReadGoauthCookie,
  mockGetGoogleClient,
  mockVerifyGoogleIdToken,
  mockResolveGoogleLogin,
  mockCreateCustomerSession,
  mockRatelimit,
  mockValidateCode,
} = vi.hoisted(() => ({
  mockReadGoauthCookie: vi.fn(),
  mockGetGoogleClient: vi.fn(),
  mockVerifyGoogleIdToken: vi.fn(),
  mockResolveGoogleLogin: vi.fn(),
  mockCreateCustomerSession: vi.fn(),
  mockRatelimit: { limit: vi.fn() },
  mockValidateCode: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getGoogleClient: mockGetGoogleClient,
  readGoauthCookie: mockReadGoauthCookie,
  GOAUTH_COOKIE_NAME: 'bb_goauth',
  verifyGoogleIdToken: mockVerifyGoogleIdToken,
  resolveGoogleLogin: mockResolveGoogleLogin,
  createCustomerSession: mockCreateCustomerSession,
  // real-ish: only sanitises the target; default is fine for these tests
  safeReturnTo: (to: string | undefined, fallback: string) => to ?? fallback,
}));
vi.mock('@/lib/ratelimit', () => ({ customerLoginRatelimit: mockRatelimit }));
vi.mock('@/lib/core/http/clientIp', () => ({ clientIp: () => '203.0.113.9' }));

import { GET } from '../route';
import { NextRequest, NextResponse } from 'next/server';

// GET is typed as returning Response (withErrorHandler); at runtime it's a NextResponse whose
// `.cookies` carries the Set-Cookie side-effects. Narrow it for the cookie assertions.
const asNext = (res: Response): NextResponse => res as NextResponse;

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/auth/google/callback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET', headers: { cookie: 'bb_goauth=signed' } });
}

const GOAUTH = { state: 'state-123', verifier: 'pkce-verifier', returnTo: '/account/bookings' };
const IDENTITY = { sub: 'google-sub-1', email: 'trip@example.com', emailVerified: true };

function locationOf(res: Response): string {
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_OAUTH_ENABLED = 'true';
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 });
  mockReadGoauthCookie.mockReturnValue(GOAUTH);
  mockGetGoogleClient.mockReturnValue({ validateAuthorizationCode: mockValidateCode });
  mockValidateCode.mockResolvedValue({ idToken: () => 'id-token' });
  mockVerifyGoogleIdToken.mockResolvedValue(IDENTITY);
  mockResolveGoogleLogin.mockResolvedValue({ ok: true, customerId: 'cust-1', created: true });
  mockCreateCustomerSession.mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'refresh-tok',
    refreshHash: 'h',
    csrf: 'c',
  });
});

describe('GET /api/auth/google/callback', () => {
  it('happy path: 302 to returnTo, sets bb_rt, clears bb_goauth', async () => {
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));

    expect([302, 307]).toContain(res.status);
    expect(locationOf(res)).toContain('/account/bookings');
    expect(asNext(res).cookies.get('bb_rt')?.value).toBe('refresh-tok');
    expect(asNext(res).cookies.get('bb_goauth')?.value).toBe('');
    expect(mockCreateCustomerSession).toHaveBeenCalledWith('cust-1');
  });

  it('returns 404 when GOOGLE_OAUTH_ENABLED is not "true"', async () => {
    process.env.GOOGLE_OAUTH_ENABLED = 'false';
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    expect(res.status).toBe(404);
    expect(mockRatelimit.limit).not.toHaveBeenCalled();
  });

  it('rate-limited → error=google, no session', async () => {
    mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 });
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    expect(locationOf(res)).toContain('/auth/login?error=google');
    expect(asNext(res).cookies.get('bb_rt')?.value).toBeUndefined();
    expect(mockCreateCustomerSession).not.toHaveBeenCalled();
  });

  it('CSRF: returned state ≠ cookie state → error=google', async () => {
    const res = await GET(makeRequest({ code: 'auth-code', state: 'WRONG-state' }));
    expect(locationOf(res)).toContain('/auth/login?error=google');
    expect(mockValidateCode).not.toHaveBeenCalled();
  });

  it('missing bb_goauth cookie → error=google', async () => {
    mockReadGoauthCookie.mockReturnValue(null);
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    expect(locationOf(res)).toContain('/auth/login?error=google');
  });

  it('code exchange throws → error=google', async () => {
    mockValidateCode.mockRejectedValue(new Error('token endpoint 400'));
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    expect(locationOf(res)).toContain('/auth/login?error=google');
    expect(mockVerifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it('invalid id_token → error=google', async () => {
    mockVerifyGoogleIdToken.mockResolvedValue(null);
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    expect(locationOf(res)).toContain('/auth/login?error=google');
    expect(mockResolveGoogleLogin).not.toHaveBeenCalled();
  });

  it('resolver rejects (inactive) → error=google, reason NOT leaked in URL', async () => {
    mockResolveGoogleLogin.mockResolvedValue({ ok: false, reason: 'inactive' });
    const res = await GET(makeRequest({ code: 'auth-code', state: 'state-123' }));
    const loc = locationOf(res);
    expect(loc).toContain('/auth/login?error=google');
    expect(loc).not.toContain('inactive');
    expect(mockCreateCustomerSession).not.toHaveBeenCalled();
  });
});
