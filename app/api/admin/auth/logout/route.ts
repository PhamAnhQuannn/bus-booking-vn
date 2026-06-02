/**
 * POST /api/admin/auth/logout (Issue 054)
 * No body — reads bb_admin_refresh cookie.
 * Revokes the session row, clears both admin cookies, returns 200.
 *
 * Idempotent: if cookies are absent the route still returns 200 (already logged out).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminRefreshToken, revokeAdminSession } from '@/lib/auth/adminSession';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_admin_refresh')?.value;

  if (rt) {
    const verified = verifyAdminRefreshToken(rt);
    if (verified) {
      // Best-effort — revokeAdminSession is idempotent.
      await revokeAdminSession(verified.hash).catch(() => undefined);
    }
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0,
  };

  cookieStore.set('bb_admin_access', '', cookieOpts);
  cookieStore.set('bb_admin_refresh', '', cookieOpts);

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(handler);
