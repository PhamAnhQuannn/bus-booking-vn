/**
 * Edge proxy tests for the per-request CSP nonce (#560).
 *
 * Proves: page responses carry a Content-Security-Policy whose script-src uses a
 * per-request `'nonce-…' 'strict-dynamic'` (never `'unsafe-inline'`), the nonce differs
 * between requests, style-src keeps `'unsafe-inline'`, and /api responses are NOT given
 * the page CSP (the matcher/handler leaves the JSON API alone).
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, buildCsp } from '@/proxy';

const CSP_HEADER = 'content-security-policy';
const NONCE_RE = /'nonce-([^']+)'/;

function page(path: string): NextRequest {
  const req = new NextRequest(`https://example.com${path}`, { method: 'GET' });
  req.cookies.set('bb_csrf', 'x'.repeat(32));
  req.cookies.set('bb_sid', 'y'.repeat(32));
  return req;
}

/** Pull one directive's value out of a CSP string. */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
}

describe('proxy CSP nonce (#560)', () => {
  it('sets a nonce-based script-src with strict-dynamic on a page response', async () => {
    const res = await proxy(page('/'));
    const csp = res.headers.get(CSP_HEADER);
    expect(csp).toBeTruthy();
    const scriptSrc = directive(csp!, 'script-src')!;
    expect(scriptSrc).toMatch(/'nonce-[^']+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('keeps style-src unsafe-inline (Next/styled-jsx inline styles)', async () => {
    const res = await proxy(page('/'));
    const csp = res.headers.get(CSP_HEADER)!;
    expect(directive(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('mints a different nonce on each request', async () => {
    const extract = (csp: string) => directive(csp, 'script-src')!.match(/'nonce-([^']+)'/)![1];
    const a = extract((await proxy(page('/'))).headers.get(CSP_HEADER)!);
    const b = extract((await proxy(page('/'))).headers.get(CSP_HEADER)!);
    expect(a).not.toBe(b);
  });

  it('does NOT attach the page CSP to /api responses', async () => {
    const req = new NextRequest('https://example.com/api/trips/search', { method: 'GET' });
    req.cookies.set('bb_csrf', 'x'.repeat(32));
    req.cookies.set('bb_sid', 'y'.repeat(32));
    const res = await proxy(req);
    expect(res.headers.get(CSP_HEADER)).toBeNull();
  });

  // The hydration-critical path: the nonce must be FORWARDED on the request to the render
  // (Next reads it from the request CSP header), not just set on the response. A regression
  // in requestHeaders.set / the NextRequest reconstruction would pass every response-only
  // assertion above while breaking prod — so assert the forwarded headers explicitly.
  it('forwards x-nonce + CSP on the request, with the nonce matching the response CSP', async () => {
    const res = await proxy(page('/'));
    const responseNonce = res.headers.get(CSP_HEADER)!.match(NONCE_RE)![1];

    const overridden = (res.headers.get('x-middleware-override-headers') ?? '').toLowerCase();
    expect(overridden).toContain('x-nonce');
    expect(overridden).toContain('content-security-policy');

    // Request nonce (forwarded to the RSC render) must equal the response-enforced nonce.
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(responseNonce);
    const reqCsp = res.headers.get('x-middleware-request-content-security-policy')!;
    expect(reqCsp.match(NONCE_RE)![1]).toBe(responseNonce);
  });
});

describe('buildCsp (#560) — prod branch', () => {
  const nonce = 'TESTNONCE123';

  it('prod script-src has the nonce + strict-dynamic and NO unsafe-inline / unsafe-eval', () => {
    const scriptSrc = buildCsp(nonce, true, false)
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('dev keeps unsafe-eval (React refresh); prod drops it', () => {
    expect(buildCsp(nonce, false, false)).toContain("'unsafe-eval'");
    expect(buildCsp(nonce, true, false)).not.toContain("'unsafe-eval'");
  });

  it('adds the Sentry connect-src only when a DSN is configured', () => {
    expect(buildCsp(nonce, true, true)).toContain('https://*.sentry.io');
    expect(buildCsp(nonce, true, false)).not.toContain('sentry.io');
  });
});
