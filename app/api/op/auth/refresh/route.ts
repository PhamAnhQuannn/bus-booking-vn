/**
 * POST /api/op/auth/refresh
 * No body — reads bb_op_refresh cookie.
 * Response: 200 { accessToken } + rotated Set-Cookie bb_op_access + bb_op_refresh.
 *
 * Errors:
 *   401 NO_SESSION  — cookie absent
 *   401 SESSION_REUSE — reuse detected (family revoked, cookies cleared)
 *   401 INVALID_SESSION — session not found / expired
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { rotateOperatorRefresh, verifyOpRefreshToken } from '@/lib/auth/operatorSession';
import { prisma } from '@/lib/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 15 * 60;          // 15 min
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_op_refresh')?.value;

  if (!rt) {
    return NextResponse.json({ error: 'NO_SESSION' }, { status: 401 });
  }

  const verified = verifyOpRefreshToken(rt);
  if (!verified) {
    // Malformed / tampered token — clear cookies
    cookieStore.set('bb_op_access', '', { maxAge: 0, path: '/' });
    cookieStore.set('bb_op_refresh', '', { maxAge: 0, path: '/' });
    return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 401 });
  }

  // Look up requiresPasswordChange + operatorId so the new access token carries
  // both claims (Issue 011 — operatorId in JWT for Edge-runtime read).
  const operator = await prisma.operatorUser.findUnique({
    where: { id: verified.payload.operatorUserId },
    select: { requiresPasswordChange: true, operatorId: true },
  });
  const requiresPasswordChange = operator?.requiresPasswordChange ?? false;
  const operatorId = operator?.operatorId;

  let result;
  try {
    result = await rotateOperatorRefresh(verified.hash, requiresPasswordChange, operatorId);
  } catch {
    // SESSION_NOT_FOUND or other DB error
    cookieStore.set('bb_op_access', '', { maxAge: 0, path: '/' });
    cookieStore.set('bb_op_refresh', '', { maxAge: 0, path: '/' });
    return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 401 });
  }

  if ('reuse' in result) {
    // Family already revoked inside rotateOperatorRefresh — clear cookies
    cookieStore.set('bb_op_access', '', { maxAge: 0, path: '/' });
    cookieStore.set('bb_op_refresh', '', { maxAge: 0, path: '/' });
    return NextResponse.json({ error: 'SESSION_REUSE' }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === 'production';

  cookieStore.set('bb_op_access', result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set('bb_op_refresh', result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ accessToken: result.accessToken });
}

export const POST = withErrorHandler(handler);
