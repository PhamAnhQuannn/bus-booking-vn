/**
 * POST /api/op/auth/logout
 * No body — reads bb_op_refresh cookie.
 * Response: 204 — revokes session row, clears bb_op_access + bb_op_refresh cookies.
 *
 * Idempotent: if cookies are absent the route still returns 204 (already logged out).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyOpRefreshToken, revokeOperatorSession, rotateCsrf } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_op_refresh')?.value;

  if (rt) {
    const verified = verifyOpRefreshToken(rt);
    if (verified) {
      // Best-effort — ignore errors (already revoked, etc.)
      await revokeOperatorSession(verified.hash).catch(() => undefined);
    }
  }

  // Clear both cookies regardless
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };

  cookieStore.set('bb_op_access', '', cookieOpts);
  cookieStore.set('bb_op_refresh', '', cookieOpts);
  // #584: re-mint the bb_csrf double-submit token on logout (auth-state change), matching
  // the customer logout route, so a pre-logout token can't be replayed against a new session.
  rotateCsrf(cookieStore);

  return new NextResponse(null, { status: 204 });
}

export const POST = withErrorHandler(handler);
