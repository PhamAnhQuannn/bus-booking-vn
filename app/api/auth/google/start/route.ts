/**
 * GET /api/auth/google/start (ADR-021 / DS-033)
 *
 * Begins the Google OAuth handshake: generates CSRF `state` + PKCE `code_verifier`,
 * stashes both (plus a validated returnTo) in the signed HttpOnly `bb_goauth` cookie,
 * and 302s to Google's authorization endpoint.
 *
 * Self-gated on GOOGLE_OAUTH_ENABLED (404 when off) — the interim proxy 410 block is
 * removed, so the route is the single gate until creds are provisioned (P6/G-CREDS).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { generateState, generateCodeVerifier } from 'arctic';
import {
  getGoogleClient,
  GOOGLE_OAUTH_SCOPES,
  buildGoauthSetCookieHeader,
  safeReturnTo,
} from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { clientIp } from '@/lib/core/http/clientIp';
import { customerLoginRatelimit } from '@/lib/ratelimit';

async function handler(req: NextRequest): Promise<Response> {
  if (process.env.GOOGLE_OAUTH_ENABLED !== 'true') {
    return NextResponse.json({ error: 'google_oauth_disabled' }, { status: 404 });
  }

  // Route-level throttle (#499): this is a GET, so proxy.ts's SAFE_METHODS short-circuit
  // exempts it from the edge limiter — without this it can be hit unboundedly, minting a
  // signed bb_goauth cookie + redirect each time. Reuse the customer-login per-IP limiter.
  const rl = await customerLoginRatelimit.limit(`google-start:${clientIp(req.headers)}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'), '/account/bookings');
  const state = generateState();
  const verifier = generateCodeVerifier();

  const url = getGoogleClient().createAuthorizationURL(state, verifier, GOOGLE_OAUTH_SCOPES);

  const res = NextResponse.redirect(url);
  res.headers.append('Set-Cookie', buildGoauthSetCookieHeader({ state, verifier, returnTo }));
  return res;
}

export const GET = withErrorHandler(handler);
