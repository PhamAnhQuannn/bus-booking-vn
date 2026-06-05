/**
 * POST /api/admin/auth/totp/confirm (Issue 055)
 *
 * Phase 2 of TOTP enrollment. Body: { code }. Accessible to any AUTHENTICATED
 * admin (requireTotp:false — they're completing enrollment).
 *
 * On a valid code: totpEnabledAt is set (TOTP active), and the admin session is
 * RE-ISSUED with totpVerified=true so the just-enrolled admin is immediately past
 * the TOTP gate (both bb_admin_access + bb_admin_refresh cookies refreshed). → 200 { role }.
 * On a wrong code (or enrollment not started) → 400 { error: 'INVALID_CODE' }.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { confirmEnrollment } from '@/lib/auth';
import { issueAdminSession } from '@/lib/auth';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 10 * 60; // 600s — matches ADMIN_ACCESS_TTL_SECONDS
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const bodySchema = z.object({ code: z.string().min(1) });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const result = await confirmEnrollment(ctx.adminId, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  // Re-issue the session with totpVerified=true — the freshly-enrolled admin
  // clears the TOTP gate immediately.
  const session = await issueAdminSession(ctx.adminId, ctx.role, /* totpVerified */ true);

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  cookieStore.set('bb_admin_access', session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  cookieStore.set('bb_admin_refresh', session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ role: ctx.role });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: false })(handler) as (req: NextRequest) => Promise<Response>
);
