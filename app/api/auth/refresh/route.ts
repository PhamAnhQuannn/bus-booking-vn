/**
 * POST /api/auth/refresh
 * No body — reads bb_rt cookie.
 * Response: { accessToken } + new Set-Cookie bb_rt on rotation.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refresh, AuthServiceError } from '@/lib/auth/authService';
import { withErrorHandler } from '@/lib/withErrorHandler';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_rt')?.value;

  if (!rt) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  let result;
  try {
    result = await refresh(rt);
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

  return NextResponse.json({ accessToken: result.accessToken });
}

export const POST = withErrorHandler(handler);
