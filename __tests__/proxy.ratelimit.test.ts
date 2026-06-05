/**
 * Edge proxy tests for the IP rate-limit layer (Issue 096, spec [S14]).
 *
 * Proves:
 *  - Excess non-safe api requests from one IP → 429 + Retry-After at the edge.
 *  - Webhook routes (the momo/zalopay/card webhook paths) reuse the CSRF_EXEMPT
 *    Set and are exempt from BOTH rate-limit and CSRF — a flood passes through
 *    (HMAC-authed).
 *  - Safe GET api requests are not rate-limited.
 *  - Rate-limit runs BEFORE CSRF: a breaching request 429s even with a valid
 *    CSRF double-submit pair (the cheap reject fires first).
 *  - When the limiter allows, the existing CSRF double-submit behavior is intact
 *    (missing/invalid token → 403; valid pair → passes).
 *
 * ratelimit.limit is mocked so the tests are deterministic and isolated from the
 * shared in-memory window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the limiter BEFORE importing the proxy so the proxy picks up the mock.
const limitMock = vi.fn();
vi.mock('@/lib/ratelimit', () => ({
  ratelimit: { limit: (id: string) => limitMock(id) },
}));

import { proxy } from '@/proxy';
import { generateToken } from '@/lib/auth/csrf';

const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

function allow() {
  limitMock.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });
}
function deny(retryAfter = 42) {
  limitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfter });
}

/** Build a non-safe (POST) request, optionally with a valid CSRF double-submit pair. */
function post(
  path: string,
  opts: { csrf?: boolean; ip?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.ip) headers['x-forwarded-for'] = opts.ip;
  const token = generateToken();
  if (opts.csrf) headers[CSRF_HEADER] = token;
  const req = new NextRequest(`https://example.com${path}`, { method: 'POST', headers });
  if (opts.csrf) req.cookies.set(CSRF_COOKIE, token);
  return req;
}

function getReq(path: string): NextRequest {
  const req = new NextRequest(`https://example.com${path}`, { method: 'GET' });
  req.cookies.set(CSRF_COOKIE, 'x'.repeat(32));
  req.cookies.set('bb_sid', 'y'.repeat(32));
  return req;
}

beforeEach(() => {
  limitMock.mockReset();
});

describe('proxy rate-limit — Issue 096', () => {
  it('non-safe /api/* over the limit → 429 + Retry-After at the edge', async () => {
    deny(42);
    const res = await proxy(post('/api/holds', { csrf: true, ip: '203.0.113.7' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    const body = await res.json();
    expect(body).toEqual({ error: 'TOO_MANY_REQUESTS' });
  });

  it('keys the limiter on the x-forwarded-for first hop', async () => {
    allow();
    await proxy(post('/api/holds', { csrf: true, ip: '198.51.100.9, 10.0.0.1' }));
    expect(limitMock).toHaveBeenCalledWith('198.51.100.9');
  });

  it('runs BEFORE CSRF: breach 429s even with a valid CSRF pair', async () => {
    deny(10);
    const res = await proxy(post('/api/op/trips', { csrf: true, ip: '203.0.113.7' }));
    expect(res.status).toBe(429);
  });

  it('webhook route (CSRF_EXEMPT Set) is NOT rate-limited — flood passes through', async () => {
    deny(99);
    const res = await proxy(post('/api/payments/momo/webhook', { ip: '203.0.113.7' }));
    // Exempt: the limiter is never even consulted, and it is not a 429.
    expect(limitMock).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });

  it('safe GET /api/* is not rate-limited', async () => {
    deny(99);
    const res = await proxy(getReq('/api/trips/search'));
    expect(limitMock).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });

  it('non-/api/* non-safe request is not rate-limited', async () => {
    deny(99);
    const res = await proxy(post('/op/some-action', { ip: '203.0.113.7' }));
    expect(limitMock).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });
});

describe('proxy CSRF still enforced when the limiter allows', () => {
  it('valid CSRF double-submit pair on /api/* passes (not 403/429)', async () => {
    allow();
    const res = await proxy(post('/api/holds', { csrf: true, ip: '203.0.113.7' }));
    expect(res.status).not.toBe(429);
    expect(res.status).not.toBe(403);
  });

  it('missing CSRF token on /api/* → 403 (CSRF gate intact behind rate-limit)', async () => {
    allow();
    const res = await proxy(post('/api/holds', { ip: '203.0.113.7' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'csrf_invalid' });
  });
});
