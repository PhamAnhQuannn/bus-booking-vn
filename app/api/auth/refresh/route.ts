/**
 * POST /api/auth/refresh
 * No body — reads bb_rt cookie.
 * Response: { accessToken, displayName, email } + new Set-Cookie bb_rt on rotation.
 * (displayName/email let SessionBootstrap rehydrate the account menu on a full reload — QA F1.)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refresh, AuthServiceError } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { clientIp } from '@/lib/core/http/clientIp';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

async function handler(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_rt')?.value;

  if (!rt) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  let result;
  try {
    // Refresh the stored IP/UA to the client's current values (#477) so active-devices
    // reflects where the session is being used now, not only where it was first minted.
    result = await refresh(rt, { ip: clientIp(req.headers), userAgent: req.headers.get('user-agent') });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      if (err.code === 'SESSION_REUSE') {
        // Cascade revoke already happened inside rotateRefresh — clear cookie
        cookieStore.set('bb_rt', '', { maxAge: 0, path: '/' });
        return NextResponse.json({ error: 'session_reuse' }, { status: 401 });
      }
      return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
    }
    throw err;
  }

  cookieStore.set('bb_rt', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json({
    accessToken: result.accessToken,
    displayName: result.displayName,
    email: result.email,
  });
}

export const POST = withErrorHandler(handler);
