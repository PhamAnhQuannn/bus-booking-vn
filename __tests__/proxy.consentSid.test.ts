/**
 * Edge proxy tests for the cookie-consent gate on the funnel session cookie.
 *
 * bb_sid (anonymous funnel session id) is minted ONLY when the visitor accepted
 * analytics cookies (bb_consent === 'accepted'). Without bb_sid, lib/analytics
 * track() no-ops, so 'necessary' / unanswered consent collects no FunnelEvent.
 * A safe GET to a public path returns the cookie-issuing response.
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function get(consent?: string): NextRequest {
  const req = new NextRequest('https://example.com/', { method: 'GET' });
  // Provide csrf so we exercise the cookie-issuing branch without a redirect.
  req.cookies.set('bb_csrf', 'x'.repeat(32));
  if (consent) req.cookies.set('bb_consent', consent);
  return req;
}

describe('proxy bb_sid consent gate', () => {
  it('mints bb_sid when consent === accepted', async () => {
    const res = await proxy(get('accepted'));
    expect(res.cookies.get('bb_sid')?.value).toBeTruthy();
  });

  it('does NOT mint bb_sid when consent is "necessary"', async () => {
    const res = await proxy(get('necessary'));
    expect(res.cookies.get('bb_sid')).toBeUndefined();
  });

  it('does NOT mint bb_sid when consent is unset', async () => {
    const res = await proxy(get());
    expect(res.cookies.get('bb_sid')).toBeUndefined();
  });
});
