/**
 * GET /api/auth/google/callback (ADR-021 / DS-033)
 *
 * Completes the Google OAuth handshake:
 *   1. flag-guard + per-IP rate-limit (the callback creates accounts + sessions).
 *   2. read signed `bb_goauth`; the returned `state` MUST match (CSRF).
 *   3. exchange the code (PKCE `code_verifier`) → validate the `id_token`.
 *   4. resolve/link per DS-033 L1–L4 (verified-email-only linking).
 *   5. mint a customer session (same createSession path as password login, L4), set
 *      `bb_rt`, clear `bb_goauth`, and 302 to the validated returnTo (or /account/bookings).
 *
 * Any failure redirects to /auth/login?error=<reason> (never leaks detail). The access
 * token is re-minted via /api/auth/refresh (bb_rt) by SessionBootstrap on landing — a
 * 302 has no body to carry it.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import {
  getGoogleClient,
  readGoauthCookie,
  GOAUTH_COOKIE_NAME,
  verifyGoogleIdToken,
  resolveGoogleLogin,
  createCustomerSession,
  safeReturnTo,
} from '@/lib/auth';
import { customerLoginRatelimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/core/http/clientIp';
import { withErrorHandler } from '@/lib/withErrorHandler';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const isProd = () => process.env.NODE_ENV === 'production';

function originOf(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? req.nextUrl.origin;
}

function clearGoauth(res: NextResponse): NextResponse {
  res.cookies.set(GOAUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

async function handler(req: NextRequest): Promise<Response> {
  if (process.env.GOOGLE_OAUTH_ENABLED !== 'true') {
    return NextResponse.json({ error: 'google_oauth_disabled' }, { status: 404 });
  }

  const origin = originOf(req);
  // FD-012 §2A.4: every callback failure redirects with the SINGLE value `?error=google` (the
  // login page's inline alert keys on it). Never surface the specific reason in the URL —
  // `inactive`/`email_conflict` would leak account state (suspended/deleted vs email-taken).
  const errorRedirect = () =>
    clearGoauth(NextResponse.redirect(new URL('/auth/login?error=google', origin)));

  const rl = await customerLoginRatelimit.limit(`google-callback:${clientIp(req.headers)}`);
  if (!rl.allowed) return errorRedirect();

  const goauth = readGoauthCookie(req.headers.get('cookie'));
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  // CSRF: returned state must match the signed cookie.
  if (!goauth || !code || !state || state !== goauth.state) {
    return errorRedirect();
  }

  let idToken: string;
  try {
    const tokens = await getGoogleClient().validateAuthorizationCode(code, goauth.verifier);
    idToken = tokens.idToken();
  } catch {
    return errorRedirect();
  }

  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) return errorRedirect();

  const resolved = await resolveGoogleLogin({
    sub: identity.sub,
    email: identity.email,
    emailVerified: identity.emailVerified,
  });
  if (!resolved.ok) return errorRedirect();

  const session = await createCustomerSession(resolved.customerId, {
    ip: clientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
  });

  const dest = safeReturnTo(goauth.returnTo, '/account/bookings');
  const res = clearGoauth(NextResponse.redirect(new URL(dest, origin)));
  res.cookies.set('bb_rt', session.refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  return res;
}

export const GET = withErrorHandler(handler);
