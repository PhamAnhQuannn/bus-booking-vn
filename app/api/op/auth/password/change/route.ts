/**
 * POST /api/op/auth/password/change
 * Body: { currentPassword, newPassword }
 *
 * Allowed during requiresPasswordChange=true (allowDuringPasswordChange: true).
 * On success:
 *   - Clears requiresPasswordChange flag
 *   - Revokes all OTHER sessions (keeps current one)
 *   - Issues fresh access + refresh tokens
 * Returns 204 on success.
 *
 * Errors:
 *   400 WEAK_PASSWORD — newPassword fails validation
 *   401 WRONG_CURRENT — currentPassword doesn't match
 *   409 SAME_AS_OLD   — newPassword === currentPassword hash
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/client';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { verify as verifyPassword, hash as hashPassword } from '@/lib/auth/password';
import { revokeAllOperatorSessions, issueOperatorSession, verifyOpRefreshToken } from '@/lib/auth/operatorSession';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { ChangePasswordSchema } from '@/lib/auth/types';

const ACCESS_COOKIE = 'bb_op_access';
const REFRESH_COOKIE = 'bb_op_refresh';
const ACCESS_COOKIE_MAX_AGE = 15 * 60;
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

async function handler(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(ACCESS_COOKIE);

  if (!tokenCookie?.value) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = await verifyOperatorAccess(tokenCookie.value);
  if (!payload) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    // Distinguish WEAK_PASSWORD (newPassword fails schema) from other validation errors
    const newPwdErrors = parsed.error.issues.filter(i => i.path.includes('newPassword'));
    if (newPwdErrors.length > 0) {
      return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, passwordHash: true, disabledAt: true },
  });

  if (!user || user.disabledAt !== null) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const currentValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!currentValid) {
    return NextResponse.json({ error: 'WRONG_CURRENT' }, { status: 401 });
  }

  const sameAsOld = await verifyPassword(user.passwordHash, newPassword);
  if (sameAsOld) {
    return NextResponse.json({ error: 'SAME_AS_OLD' }, { status: 409 });
  }

  const newHash = await hashPassword(newPassword);

  // Get current session's refresh token to find the session ID to exclude
  const refreshCookie = cookieStore.get(REFRESH_COOKIE)?.value;
  let currentSessionId: string | undefined;
  if (refreshCookie) {
    const verified = verifyOpRefreshToken(refreshCookie);
    if (verified) {
      const session = await prisma.operatorSession.findUnique({
        where: { refreshTokenHash: verified.hash },
        select: { id: true },
      });
      currentSessionId = session?.id;
    }
  }

  // Revoke all other sessions + clear flag + update hash
  await Promise.all([
    prisma.operatorUser.update({
      where: { id: user.id },
      data: { passwordHash: newHash, requiresPasswordChange: false },
    }),
    revokeAllOperatorSessions(user.id, currentSessionId),
  ]);

  // Issue fresh tokens — requiresPasswordChange is now false (just cleared above)
  const session = await issueOperatorSession(user.id, false);

  cookieStore.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return new NextResponse(null, { status: 204 });
}

export const POST = withErrorHandler(handler);
