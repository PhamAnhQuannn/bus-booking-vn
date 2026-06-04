/**
 * POST /api/admin/auth/refresh (Issue 054)
 * No body — reads bb_admin_refresh cookie.
 * Response: 200 { role } + rotated Set-Cookie bb_admin_access + bb_admin_refresh.
 *
 * Errors (all clear both cookies):
 *   401 NO_SESSION      — cookie absent
 *   401 SESSION_REUSE   — reuse detected (family revoked)
 *   401 INVALID_SESSION — malformed / session not found / expired
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { rotateAdminRefresh, verifyAdminRefreshToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 10 * 60; // 600s
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function clearCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 0 };
  cookieStore.set('bb_admin_access', '', opts);
  cookieStore.set('bb_admin_refresh', '', opts);
}

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_admin_refresh')?.value;

  if (!rt) {
    return NextResponse.json({ error: 'NO_SESSION' }, { status: 401 });
  }

  const verified = verifyAdminRefreshToken(rt);
  if (!verified) {
    clearCookies(cookieStore);
    return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 401 });
  }

  let result;
  try {
    result = await rotateAdminRefresh(verified.hash);
  } catch {
    // SESSION_NOT_FOUND / ADMIN_USER_NOT_FOUND / DB error
    clearCookies(cookieStore);
    return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 401 });
  }

  if ('reuse' in result) {
    clearCookies(cookieStore);
    return NextResponse.json({ error: 'SESSION_REUSE' }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === 'production';

  cookieStore.set('bb_admin_access', result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set('bb_admin_refresh', result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  // Decode the role from the freshly-minted access token to echo it back.
  const { verifyAdminAccess } = await import('@/lib/auth');
  const payload = await verifyAdminAccess(result.accessToken);
  return NextResponse.json({ role: payload?.role ?? null });
}

export const POST = withErrorHandler(handler);
