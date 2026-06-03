/**
 * Edge proxy tests for request-id propagation (Issue 061, AC2/AC3).
 *
 * Proves: a request with no x-request-id gets one minted on the response; a
 * provided x-request-id is echoed verbatim. Uses a safe GET to a public path so
 * the proxy returns a NextResponse.next()-derived response (no auth redirect).
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { REQUEST_ID_HEADER } from '@/lib/observability/requestId';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function get(path: string, headers?: Record<string, string>): NextRequest {
  // Provide both csrf + sid cookies so the safe-method branch returns
  // nextWithRid() rather than the cookie-issuing response (either way the rid is
  // stamped, but this keeps the assertion path simple).
  const req = new NextRequest(`https://example.com${path}`, { method: 'GET', headers });
  req.cookies.set('bb_csrf', 'x'.repeat(32));
  req.cookies.set('bb_sid', 'y'.repeat(32));
  return req;
}

describe('proxy request-id propagation', () => {
  it('mints an x-request-id on the response when none is provided', async () => {
    const res = await proxy(get('/'));
    const rid = res.headers.get(REQUEST_ID_HEADER);
    expect(rid).toBeTruthy();
    expect(rid).toMatch(UUID_RE);
  });

  it('echoes a provided x-request-id verbatim', async () => {
    const res = await proxy(get('/', { [REQUEST_ID_HEADER]: 'rid-provided-123' }));
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('rid-provided-123');
  });

  it('stamps the rid on the cookie-issuing response (no csrf/sid cookies)', async () => {
    const req = new NextRequest('https://example.com/', {
      method: 'GET',
      headers: { [REQUEST_ID_HEADER]: 'rid-cookie-issue' },
    });
    const res = await proxy(req);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('rid-cookie-issue');
  });
});
