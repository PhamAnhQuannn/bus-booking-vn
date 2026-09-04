/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Composes next-intl locale routing with three enforcement layers. After the P0
 * i18n restructure EVERY customer/planner page — and the staff consoles — live under
 * `app/[locale]`, so the locale segment is unprefixed for `vi` (default) and `/en/…`
 * for English. Route handlers under `/api` stay OUTSIDE `app/[locale]` and bypass
 * next-intl entirely.
 *
 * CRITICAL (SEC-CSRF #561 / Issue 010): every path comparison in the guards runs on
 * the LOCALE-STRIPPED pathname (`stripLocale`). A raw match would let a crafted
 * `/en/op/login` or `/en/api/*` slip past the auth/CSRF gates.
 *
 * Enforcement layers (unchanged semantics, now locale-aware):
 *   1.  Operator forced-redirect guard for /op/* (except the auth-free pages).
 *   1.5 Admin forced-redirect guard for /admin PAGE routes (except /admin/login,
 *       /admin/enroll-totp). /api/admin/* enforces via requireAdminAuth in-handler.
 *   2.  Rate-limit + CSRF double-submit for state-changing /api/* routes.
 *
 * Staff surfaces (/op, /admin, /dev) and /api are never translated: an /en variant is
 * 308-redirected to the canonical unprefixed path before the guards run.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { generateToken, compareTokens } from '@/lib/auth/csrf';
import { ratelimit } from '@/lib/ratelimit';
import { REQUEST_ID_HEADER, getOrCreateRequestId } from '@/lib/observability/requestId';
import { clientIp } from '@/lib/core/http/clientIp';

// next-intl locale router. Invoked for every page route (customer, planner AND the
// staff consoles, which live under app/[locale] but only ever render the default
// locale). /api/* is handled separately and never reaches this.
const handleI18nRouting = createMiddleware(routing);

const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const OP_ACCESS_COOKIE = 'bb_op_access';
const ADMIN_ACCESS_COOKIE = 'bb_admin_access';
const SID_COOKIE = 'bb_sid'; // anonymous funnel session id (no PII)
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const CONSENT_COOKIE = 'bb_consent'; // cookie-consent choice; 'accepted' unlocks analytics

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Exact-path exemptions (CSRF) — bank_transfer (SePay) sends no bb_csrf cookie.
//
// This Set has exactly ONE PSP entry on purpose. The momo/zalopay/card/vnpay webhook
// routes were DELETED: none was ever reachable by a real PSP (no credentials are
// configured and none will be), yet all four resolved a gateway whose signing key
// defaults to a literal published in this repo — so any reader could forge a signed
// "paid" IPN. Adding a path back re-opens that surface; do not, without a real PSP.
// EXACT-match Set only (SEC-CSRF-EXACT #561): a prior `startsWith` prefix-match silently
// exempted any FUTURE route under these trees, so a new state-changing route could
// inherit the exemption with zero review signal. Exact membership forces one entry per
// route — mirroring the OP_AUTH_FREE_PATHS / ADMIN_AUTH_FREE_PATHS discipline (Issue 010).
const CSRF_EXEMPT = new Set([
  '/api/payments/bank_transfer/webhook', // SePay webhook — static Apikey, no bb_csrf cookie
  '/api/op/auth/refresh',                // pre-auth operator refresh (HttpOnly cookie, no JS CSRF)
  '/api/admin/auth/refresh',             // Issue 056: admin refresh (HttpOnly cookie)
  '/api/auth/forgot-password',           // Issue 008: customer forgot-password (pre-auth)
  '/api/auth/forgot-password/verify',    // Issue 008: forgot-password OTP verify (pre-auth)
  '/api/auth/reset-password',            // Issue 008: customer reset-password (pre-auth, proof-protected)
]);
// There is deliberately NO rate-limit exemption list. SePay (the only webhook left)
// authenticates with a STATIC Apikey and is NOT HMAC-signed, so it stays rate-limited
// to blunt an unauthenticated flood; SePay treats 429 as a retryable delivery.

// /op/* paths that do NOT require a valid operator session.
// Exact-match Set (Issue 010) — NOT startsWith, so /op/register-bypass is NOT auth-free.
const OP_AUTH_FREE_PATHS = new Set([
  '/op/login',
  '/op/first-login',
  '/op/forgot-password',
  '/op/register',
  '/op/register/confirmation',
]);
// /op/* path prefix for auth-API routes (exempted from the page redirect).
const OP_API_AUTH_PREFIX = '/api/op/auth/';

// /admin/* PAGE paths that do NOT require a valid admin session (exact-match, Issue 010).
const ADMIN_AUTH_FREE_PATHS = new Set(['/admin/login', '/admin/enroll-totp']);

// Non-localized surfaces: staff consoles + API. These live outside app/[locale] and
// must never carry a locale prefix. Matched (prefix) on the locale-stripped path.
const NON_LOCALIZED_PREFIXES = ['/op', '/admin', '/dev', '/api'];

/** Remove the `/en` locale prefix (vi is the unprefixed default). Returns the
 *  canonical, locale-free pathname used for every guard comparison. */
function stripLocale(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

/** True when the (locale-stripped) path targets a non-localized surface. */
function isNonLocalized(stripped: string): boolean {
  return NON_LOCALIZED_PREFIXES.some((p) => stripped === p || stripped.startsWith(`${p}/`));
}

/** Issue the CSRF double-submit + anonymous-session cookies on a response if the
 *  request is missing them. Mutates `res` in place. */
function setSessionCookies(res: NextResponse, request: NextRequest): void {
  const secure = process.env.NODE_ENV === 'production';
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    res.cookies.set(CSRF_COOKIE, generateToken(), {
      httpOnly: false, // must be readable by JS for double-submit
      sameSite: 'lax',
      path: '/',
      secure,
    });
  }
  // Mint the funnel session id ONLY when the visitor accepted analytics cookies
  // (PDPD opt-in). Without bb_sid, lib/analytics/track() no-ops, so 'necessary'
  // / unanswered consent collects no FunnelEvent. See components/CookieConsent.tsx.
  if (
    request.cookies.get(CONSENT_COOKIE)?.value === 'accepted' &&
    !request.cookies.get(SID_COOKIE)?.value
  ) {
    res.cookies.set(SID_COOKIE, generateToken(), {
      httpOnly: true, // server-only; funnel correlation, never read by JS
      sameSite: 'lax',
      path: '/',
      maxAge: SID_MAX_AGE,
      secure,
    });
  }
}

/** Decode the operator JWT without a DB call — forced-redirect guard (Issue 011). */
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

/** Decode the admin JWT without a DB call — admin forced-redirect guard (Issue 056). */
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

  // Request-id propagation (Issue 061): read-or-mint a correlation id, forward it to
  // downstream handlers on the request headers, and echo it on every response.
  const rid = getOrCreateRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, rid);
  const forwarded = { request: { headers: requestHeaders } };

  const nextWithRid = (): NextResponse => {
    const res = NextResponse.next(forwarded);
    res.headers.set(REQUEST_ID_HEADER, rid);
    return res;
  };
  const withRid = (res: NextResponse): NextResponse => {
    res.headers.set(REQUEST_ID_HEADER, rid);
    return res;
  };

  // Every guard comparison runs on the locale-stripped path (SEC-CSRF #561).
  const stripped = stripLocale(pathname);
  const localized = stripped !== pathname; // request carried an /en prefix

  // -------------------------------------------------------------------------
  // Non-localized surfaces (/op, /admin, /dev, /api) must never carry a locale.
  // 308-redirect an /en variant to the canonical path before the guards run.
  // -------------------------------------------------------------------------
  if (localized && isNonLocalized(stripped)) {
    const url = new URL(request.url);
    url.pathname = stripped;
    return withRid(NextResponse.redirect(url, 308));
  }

  // -------------------------------------------------------------------------
  // Layer 1 — Operator forced-redirect guard (on locale-stripped path)
  // -------------------------------------------------------------------------
  if (stripped.startsWith('/op/') && !stripped.startsWith(OP_API_AUTH_PREFIX)) {
    if (!OP_AUTH_FREE_PATHS.has(stripped)) {
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
  // Layer 1.5 — Admin forced-redirect guard (Issue 056) — /admin PAGE routes only.
  // -------------------------------------------------------------------------
  if (stripped === '/admin' || stripped.startsWith('/admin/')) {
    if (!ADMIN_AUTH_FREE_PATHS.has(stripped)) {
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
  // Layer 2 — /api/* rate-limit + CSRF (Issue 096). /api is NOT under app/[locale],
  // so it bypasses next-intl. Every other path is a page route handed to next-intl.
  // -------------------------------------------------------------------------
  if (stripped.startsWith('/api/')) {
    // Safe methods: issue CSRF + anonymous-session cookies if missing, then pass through.
    if (SAFE_METHODS.has(requestMethod)) {
      const res = nextWithRid();
      setSessionCookies(res, request);
      return res;
    }

    // Rate-limit FIRST (cheap reject before CSRF token work) — covers ALL non-safe
    // /api/*, including the CSRF-exempt pre-auth routes below.
    const ip = clientIp(request.headers);
    const rl = await ratelimit.limit(ip);
    if (!rl.allowed) {
      return withRid(
        NextResponse.json(
          { error: 'TOO_MANY_REQUESTS' },
          {
            status: 429,
            headers: { 'Retry-After': String(rl.retryAfter), 'X-RateLimit-Remaining': '0' },
          }
        )
      );
    }

    // Exact CSRF-exempt routes (webhook + pre-auth refresh/reset flows).
    if (CSRF_EXEMPT.has(stripped)) {
      return nextWithRid();
    }

    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? '';
    const headerToken = request.headers.get(CSRF_HEADER) ?? '';
    if (!cookieToken || !headerToken || !compareTokens(cookieToken, headerToken)) {
      return withRid(NextResponse.json({ error: 'csrf_invalid' }, { status: 403 }));
    }
    return nextWithRid();
  }

  // -------------------------------------------------------------------------
  // Page route under app/[locale] — next-intl injects the locale segment (vi for
  // unprefixed paths, en for /en/…). Attach the rid + issue session cookies on safe
  // requests. Non-safe page requests (server actions) are not CSRF-gated here — Issue
  // 096 covers the /api/* edge only (the /search RSC keeps its per-route protection).
  // -------------------------------------------------------------------------
  const i18nResponse = handleI18nRouting(request);
  i18nResponse.headers.set(REQUEST_ID_HEADER, rid);
  if (SAFE_METHODS.has(requestMethod)) {
    setSessionCookies(i18nResponse, request);
  }
  return i18nResponse;
}

export const config = {
  matcher: [
    // /api/* is always gated (rate-limit + CSRF) — even paths with a dotted final
    // segment like /api/op/reports/revenue.csv, which the page matcher below excludes.
    '/api/:path*',
    // Page routes only. EXCLUDE every static asset + file-metadata route: anything whose
    // final segment has an extension (`/brand/logo.png`, `/destinations/da-lat.jpg`,
    // `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/favicon.ico`, `/icon.png`)
    // plus the extensionless metadata route `/opengraph-image`. Without this the proxy
    // hands these to next-intl (handleI18nRouting), which rewrites them as page routes and
    // 404s them — the whole class of /public + metadata assets went dark after the i18n
    // (#640) restructure. next-intl's own recommended matcher excludes dotted paths too.
    '/((?!_next/static|_next/image|opengraph-image|.*\\.[^/]+$).*)',
  ],
};
