/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Two enforcement layers:
 *
 * 1. Operator forced-redirect guard (AC1 — Gap 3):
 *    For /op/* paths (except /op/login, /op/first-login, /api/op/auth/*):
 *    - No bb_op_access cookie → redirect /op/login
 *    - Invalid/expired token → redirect /op/login
 *    - requiresPasswordChange=true in JWT → redirect /op/first-login
 *    Uses the requiresPasswordChange JWT claim (no DB call needed — token is
 *    rotated on password-change, so stale-claim window = 15-min access TTL).
 *
 * 2. CSRF double-submit enforcement for all state-changing /api/* routes:
 *    Exempt:
 *      - GET / HEAD / OPTIONS (safe methods)
 *      - /api/payments/momo/webhook (HMAC body verification used instead)
 *      - /api/op/auth/forgot-password* (pre-auth; no session cookie available)
 *      - /api/op/auth/refresh (uses HttpOnly refresh cookie; no JS-readable CSRF token)
 *    On first GET: issues bb_csrf cookie (non-HttpOnly, SameSite=Lax) if absent.
 *    State-changing requests: reads X-CSRF-Token header and bb_csrf cookie,
 *      compares constant-time — rejects 403 if mismatch or missing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { generateToken, compareTokens } from '@/lib/auth/csrf';

const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const OP_ACCESS_COOKIE = 'bb_op_access';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Exact-path exemptions (CSRF)
const CSRF_EXEMPT = new Set(['/api/payments/momo/webhook']);
// Prefix exemptions (CSRF) — routes where the CSRF cookie is unavailable pre-auth
const CSRF_EXEMPT_PREFIXES = [
  '/api/op/auth/forgot-password',
  '/api/op/auth/refresh',
];

// /op/* paths that do NOT require a valid operator session
const OP_AUTH_FREE_PATHS = new Set(['/op/login', '/op/first-login']);
// /op/* path prefixes that are auth-API routes (exempted from page redirect)
const OP_API_AUTH_PREFIX = '/api/op/auth/';

/** Decode the JWT payload without hitting the DB — used for forced-redirect guard.
 *  Issue 011: operatorId claim is mandatory. Tokens without it are stale (pre-Issue-011
 *  mint) and must force re-login. */
async function decodeOperatorJwt(
  token: string
): Promise<{ sub: string; requiresPasswordChange: boolean; operatorId: string } | null> {
  try {
    const raw =
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === 'test' ? 'a'.repeat(32) : null);
    if (!raw) return null;
    const secret = new TextEncoder().encode(raw);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload['scope'] !== 'operator' || typeof payload.sub !== 'string') return null;
    const operatorId = payload['operatorId'];
    // Issue 011: missing operatorId claim → stale token → force re-login
    if (typeof operatorId !== 'string' || operatorId.length === 0) return null;
    return {
      sub: payload.sub,
      requiresPasswordChange: payload['requiresPasswordChange'] === true,
      operatorId,
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(request.url) as unknown as { pathname: string };
  const requestMethod = request.method;

  // -------------------------------------------------------------------------
  // Layer 1 — Operator forced-redirect guard
  // -------------------------------------------------------------------------
  if (pathname.startsWith('/op/') && !pathname.startsWith(OP_API_AUTH_PREFIX)) {
    // Allow login and first-login pages through without a token
    if (!OP_AUTH_FREE_PATHS.has(pathname)) {
      const opToken = request.cookies.get(OP_ACCESS_COOKIE)?.value;
      if (!opToken) {
        return NextResponse.redirect(new URL('/op/login', request.url));
      }
      const decoded = await decodeOperatorJwt(opToken);
      if (!decoded) {
        return NextResponse.redirect(new URL('/op/login', request.url));
      }
      if (decoded.requiresPasswordChange) {
        return NextResponse.redirect(new URL('/op/first-login', request.url));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2 — CSRF double-submit enforcement
  // -------------------------------------------------------------------------

  // Issue CSRF cookie on any safe method request that doesn't already have one
  if (SAFE_METHODS.has(requestMethod)) {
    const existing = request.cookies.get(CSRF_COOKIE)?.value;
    if (!existing) {
      const response = NextResponse.next();
      const token = generateToken();
      response.cookies.set(CSRF_COOKIE, token, {
        httpOnly: false, // Must be readable by JS for double-submit
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
    }
    return NextResponse.next();
  }

  // Exempt HMAC-verified webhook (exact match)
  if (CSRF_EXEMPT.has(pathname)) {
    return NextResponse.next();
  }

  // Exempt pre-auth operator routes (prefix match)
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Only enforce CSRF on /api/* state-changing routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? '';
  const headerToken = request.headers.get(CSRF_HEADER) ?? '';

  if (!cookieToken || !headerToken || !compareTokens(cookieToken, headerToken)) {
    return NextResponse.json({ error: 'csrf_invalid' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
