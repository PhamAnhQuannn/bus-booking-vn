/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * CSRF double-submit enforcement for all state-changing /api/* routes.
 *
 * Exempt:
 *   - GET / HEAD / OPTIONS (safe methods)
 *   - /api/payments/momo/webhook (HMAC body verification used instead)
 *
 * On first GET: issues bb_csrf cookie (non-HttpOnly, SameSite=Lax) if absent.
 * State-changing requests: reads X-CSRF-Token header and bb_csrf cookie,
 *   compares constant-time — rejects 403 if mismatch or missing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateToken, compareTokens } from '@/lib/auth/csrf';

const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = new Set(['/api/payments/momo/webhook']);

export function proxy(request: NextRequest): NextResponse {
  const { pathname, method } = new URL(request.url) as unknown as { pathname: string; method?: string };
  const requestMethod = request.method;

  // Issue GET csrf cookie on any GET that doesn't already have one
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

  // Exempt HMAC-verified webhook
  if (CSRF_EXEMPT.has(pathname)) {
    return NextResponse.next();
  }

  // Only enforce on /api/* state-changing routes
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
