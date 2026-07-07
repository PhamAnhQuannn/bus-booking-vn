/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Three enforcement layers:
 *
 * 1. Operator forced-redirect guard (AC1 — Gap 3):
 *    For /op/* paths (except /op/login, /op/first-login, /api/op/auth/*):
 *    - No bb_op_access cookie → redirect /op/login
 *    - Invalid/expired token → redirect /op/login
 *    - requiresPasswordChange=true in JWT → redirect /op/first-login
 *    Uses the requiresPasswordChange JWT claim (no DB call needed — token is
 *    rotated on password-change, so stale-claim window = 15-min access TTL).
 *
 * 1.5. Admin forced-redirect guard (Issue 056):
 *    For /admin PAGE routes (/admin and /admin/*, EXCEPT /admin/login):
 *    - No bb_admin_access cookie → redirect /admin/login
 *    - Invalid/expired/cross-realm token → redirect /admin/login
 *    - totpVerified=false in JWT → redirect /admin/login (must clear the TOTP step)
 *    Uses an EXACT-MATCH Set allowlist (Issue 010 rule) — NOT startsWith — so a
 *    sneaky path like /admin/login-bypass is NOT treated as auth-free.
 *    /api/admin/* routes are NOT guarded here; they enforce via requireAdminAuth
 *    in-handler (DB-aware) — this layer only covers the page-redirect UX.
 *    Reads scope/totpVerified from the JWT (no DB call), mirroring Layer 1.
 *
 * 2. Rate-limit + CSRF double-submit enforcement for all state-changing /api/* routes:
 *    Both gates cover every non-safe-method (POST/PUT/PATCH/DELETE) /api/* request —
 *    customer + operator + admin (Issue 096, spec [S14]).
 *
 *    Rate-limit (Issue 096): runs FIRST (cheap reject before CSRF token work).
 *      Keyed on the client IP (x-real-ip preferred, XFF fallback — Issue 174). On breach
 *      returns 429 + Retry-After, body { error: 'TOO_MANY_REQUESTS' } — same shape the
 *      per-route limiters emit so clients see consistent 429s. Uses lib/ratelimit
 *      (`ratelimit.limit(ip)`), Edge-safe: InMemoryRatelimit in dev/CI (no Redis), lazy
 *      Upstash import only when UPSTASH_REDIS_REST_URL is set.
 *      NOTE: this covers the /api/* edge only. The /search RSC path is NOT /api/* and
 *      keeps its per-route protection (Issue 001) — untouched here.
 *
 *    CSRF Exempt:
 *      - GET / HEAD / OPTIONS (safe methods)
 *      - /api/payments/{momo,zalopay,card}/webhook (HMAC body verification used instead)
 *      - /api/op/auth/forgot-password* (pre-auth; no session cookie available)
 *      - /api/op/auth/refresh (uses HttpOnly refresh cookie; no JS-readable CSRF token)
 *      - /api/admin/auth/refresh (Issue 056 — HttpOnly refresh cookie; no JS-readable CSRF token)
 *    Webhooks (the CSRF_EXEMPT exact-match Set) are exempt from BOTH gates — they
 *    authenticate via HMAC and must not be rate-limited at the edge (Issue 096 reuses
 *    that SAME Set, no second exempt list). The CSRF prefix-exempt pre-auth routes are
 *    only CSRF-exempt; they are STILL rate-limited.
 *    Admin login + TOTP POSTs are NOT exempt — they ride the bb_csrf double-submit
 *    like operator login (the /admin/login GET issues bb_csrf via this layer).
 *    On first GET: issues bb_csrf cookie (non-HttpOnly, SameSite=Lax) if absent.
 *    State-changing requests: reads X-CSRF-Token header and bb_csrf cookie,
 *      compares constant-time — rejects 403 if mismatch or missing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { generateToken, compareTokens } from '@/lib/auth/csrf';
import { ratelimit } from '@/lib/ratelimit';
import { REQUEST_ID_HEADER, getOrCreateRequestId } from '@/lib/observability/requestId';
import { clientIp } from '@/lib/core/http/clientIp';

const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const OP_ACCESS_COOKIE = 'bb_op_access';
const ADMIN_ACCESS_COOKIE = 'bb_admin_access';
const SID_COOKIE = 'bb_sid'; // anonymous funnel session id (no PII)
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Exact-path exemptions (CSRF)
const CSRF_EXEMPT = new Set([
  '/api/payments/momo/webhook',
  '/api/payments/zalopay/webhook',
  '/api/payments/card/webhook',
  '/api/payments/vnpay/webhook',
  '/api/payments/bank_transfer/webhook',
]);
// Prefix exemptions (CSRF) — routes where the CSRF cookie is unavailable pre-auth
const CSRF_EXEMPT_PREFIXES = [
  '/api/op/auth/forgot-password',
  '/api/op/auth/refresh',
  '/api/admin/auth/refresh',     // Issue 056: admin refresh (HttpOnly refresh cookie, no JS-readable CSRF)
  '/api/auth/forgot-password',   // Issue 008: customer forgot-password (pre-auth)
  '/api/auth/reset-password',    // Issue 008: customer reset-password (pre-auth, proof-protected)
];

// /op/* paths that do NOT require a valid operator session.
// Exact-match Set (Issue 010) — NOT startsWith, so /op/register-bypass is NOT
// treated as auth-free. Issue 076 adds the public self-serve registration pages.
const OP_AUTH_FREE_PATHS = new Set([
  '/op/login',
  '/op/first-login',
  '/op/forgot-password',
  '/op/register',
  '/op/register/confirmation',
]);
// /op/* path prefixes that are auth-API routes (exempted from page redirect)
const OP_API_AUTH_PREFIX = '/api/op/auth/';

// /admin/* PAGE paths that do NOT require a valid admin session.
// Exact-match (Issue 010) — NOT startsWith, prevents /admin/login-bypass sneak-throughs.
const ADMIN_AUTH_FREE_PATHS = new Set(['/admin/login']);

/** Decode the JWT payload without hitting the DB — used for forced-redirect guard.
 *  Issue 011: operatorId claim is mandatory. Tokens without it are stale (pre-Issue-011
 *  mint) and must force re-login. */
async function decodeOperatorJwt(
  token: string
): Promise<{ sub: string; requiresPasswordChange: boolean; operatorId: string } | null> {
  try {
    const raw =
      process.env.JWT_OPERATOR_SECRET ??
      (process.env.NODE_ENV === 'test' ? 'b'.repeat(32) : null);
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

/** Decode the admin JWT payload without hitting the DB — used for the admin
 *  forced-redirect guard (Issue 056). Cross-realm guard: requires scope==='admin'
 *  so an operator/customer token in bb_admin_access is rejected. role must be a
 *  string; totpVerified is read strictly as === true. */
async function decodeAdminJwt(
  token: string
): Promise<{ sub: string; role: string; totpVerified: boolean } | null> {
  try {
    const raw =
      process.env.JWT_ADMIN_SECRET ??
      (process.env.NODE_ENV === 'test' ? 'c'.repeat(32) : null);
    if (!raw) return null;
    const secret = new TextEncoder().encode(raw);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload['scope'] !== 'admin' || typeof payload.sub !== 'string') return null;
    const role = payload['role'];
    if (typeof role !== 'string') return null;
    return {
      sub: payload.sub,
      role,
      totpVerified: payload['totpVerified'] === true,
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(request.url) as unknown as { pathname: string };
  const requestMethod = request.method;

  // -------------------------------------------------------------------------
  // Request-id propagation (Issue 061, AC2/AC3)
  // Read-or-mint a correlation id, forward it to downstream handlers on the
  // request headers, and echo it on every response. crypto.randomUUID() is
  // Edge-safe. This is threaded into the guard/CSRF responses below WITHOUT
  // altering their control flow — every NextResponse this function returns gets
  // the header stamped, and NextResponse.next() forwards the request header set.
  // -------------------------------------------------------------------------
  const rid = getOrCreateRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, rid);
  const forwarded = { request: { headers: requestHeaders } };

  /** NextResponse.next() that forwards the rid request header + echoes it on the response. */
  const nextWithRid = (): NextResponse => {
    const res = NextResponse.next(forwarded);
    res.headers.set(REQUEST_ID_HEADER, rid);
    return res;
  };
  /** Stamp the rid on an already-built response (redirect / json) and return it. */
  const withRid = (res: NextResponse): NextResponse => {
    res.headers.set(REQUEST_ID_HEADER, rid);
    return res;
  };

  // -------------------------------------------------------------------------
  // Layer 1 — Operator forced-redirect guard
  // -------------------------------------------------------------------------
  if (pathname.startsWith('/op/') && !pathname.startsWith(OP_API_AUTH_PREFIX)) {
    // Allow login and first-login pages through without a token
    if (!OP_AUTH_FREE_PATHS.has(pathname)) {
      const opToken = request.cookies.get(OP_ACCESS_COOKIE)?.value;
      if (!opToken) {
        return withRid(NextResponse.redirect(new URL('/op/login', request.url)));
      }
      const decoded = await decodeOperatorJwt(opToken);
      if (!decoded) {
        return withRid(NextResponse.redirect(new URL('/op/login', request.url)));
      }
      if (decoded.requiresPasswordChange) {
        return withRid(NextResponse.redirect(new URL('/op/first-login', request.url)));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 1.5 — Admin forced-redirect guard (Issue 056)
  // Guards /admin PAGE routes only. /api/admin/* is handled by requireAdminAuth.
  // -------------------------------------------------------------------------
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // Exact-match allowlist (Issue 010) — NOT startsWith.
    if (!ADMIN_AUTH_FREE_PATHS.has(pathname)) {
      const adminToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
      if (!adminToken) {
        return withRid(NextResponse.redirect(new URL('/admin/login', request.url)));
      }
      const decoded = await decodeAdminJwt(adminToken);
      if (!decoded) {
        return withRid(NextResponse.redirect(new URL('/admin/login', request.url)));
      }
      if (!decoded.totpVerified) {
        return withRid(NextResponse.redirect(new URL('/admin/login', request.url)));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2 — Rate-limit (Issue 096) + CSRF double-submit enforcement
  // -------------------------------------------------------------------------

  // Issue CSRF + anonymous-session cookies on any safe method request missing them
  if (SAFE_METHODS.has(requestMethod)) {
    const hasCsrf = request.cookies.get(CSRF_COOKIE)?.value;
    const hasSid = request.cookies.get(SID_COOKIE)?.value;
    if (!hasCsrf || !hasSid) {
      const response = NextResponse.next(forwarded);
      response.headers.set(REQUEST_ID_HEADER, rid);
      const secure = process.env.NODE_ENV === 'production';
      if (!hasCsrf) {
        response.cookies.set(CSRF_COOKIE, generateToken(), {
          httpOnly: false, // Must be readable by JS for double-submit
          sameSite: 'lax',
          path: '/',
          secure,
        });
      }
      if (!hasSid) {
        response.cookies.set(SID_COOKIE, generateToken(), {
          httpOnly: true, // server-only; funnel correlation, never read by JS
          sameSite: 'lax',
          path: '/',
          maxAge: SID_MAX_AGE,
          secure,
        });
      }
      return response;
    }
    return nextWithRid();
  }

  // Exempt HMAC-verified webhook (exact match). This SAME exact-match Set gates
  // BOTH the CSRF exemption AND the rate-limit exemption (Issue 096) — webhooks
  // authenticate via HMAC and must not be edge-rate-limited. No second exempt list.
  if (CSRF_EXEMPT.has(pathname)) {
    return nextWithRid();
  }

  // Both rate-limit and CSRF only apply to /api/* state-changing routes.
  // Non-/api/* non-safe requests (e.g. server actions on app pages) pass through.
  // NOTE: the /search RSC path is NOT /api/* — Issue 096 covers the /api/* edge
  // only; /search keeps its per-route protection (Issue 001).
  if (!pathname.startsWith('/api/')) {
    return nextWithRid();
  }

  // ---- Rate-limit FIRST (cheap reject before CSRF token work) — Issue 096 ----
  // Applies to ALL non-safe /api/* (customer + operator + admin),
  // including the CSRF prefix-exempt pre-auth routes below — those are only
  // CSRF-exempt, never rate-limit-exempt.
  const ip = clientIp(request.headers);
  const rl = await ratelimit.limit(ip);
  if (!rl.allowed) {
    // Match the per-route 429 shape so clients see consistent responses.
    return withRid(
      NextResponse.json(
        { error: 'TOO_MANY_REQUESTS' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    );
  }

  // Exempt pre-auth operator routes from CSRF (prefix match) — still rate-limited above.
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return nextWithRid();
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? '';
  const headerToken = request.headers.get(CSRF_HEADER) ?? '';

  if (!cookieToken || !headerToken || !compareTokens(cookieToken, headerToken)) {
    return withRid(NextResponse.json({ error: 'csrf_invalid' }, { status: 403 }));
  }

  return nextWithRid();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
