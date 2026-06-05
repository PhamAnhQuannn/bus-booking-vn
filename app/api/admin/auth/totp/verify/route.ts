/**
 * POST /api/admin/auth/totp/verify (Issue 055)
 *
 * Per-LOGIN TOTP gate. Body: { code }. Accessible to an AUTHENTICATED admin whose
 * session has totpVerified=false (requireTotp:false — this is the step that flips it).
 *
 * Rate-limit + lockout (mirrors Issue 010):
 *  - admin-totp:<adminId>       — general attempt throttle (429 on burst).
 *  - admin-totp-fail:<adminId>  — 5 consecutive bad codes / 15 min → 429 lockout,
 *                                 consumed ONLY on a bad code.
 *
 * Outcomes:
 *  - enrollment_required → 409 { error: 'TOTP_ENROLLMENT_REQUIRED' }
 *  - bad code            → consume the lockout counter; 429 once exhausted, else 401
 *  - valid code          → re-issue session with totpVerified=true + cookies → 200 { role }
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyLoginTotp } from '@/lib/auth';
import { issueAdminSession } from '@/lib/auth';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { adminTotpRatelimit, adminTotpLockout } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 10 * 60; // 600s — matches ADMIN_ACCESS_TTL_SECONDS
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const bodySchema = z.object({ code: z.string().min(1) });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  // General per-admin attempt throttle.
  const rl = await adminTotpRatelimit.limit(`admin-totp:${ctx.adminId}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

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

  const result = await verifyLoginTotp(ctx.adminId, parsed.data.code);

  if (!result.ok && result.reason === 'enrollment_required') {
    return NextResponse.json({ error: 'TOTP_ENROLLMENT_REQUIRED' }, { status: 409 });
  }

  if (!result.ok) {
    // Bad code — consume the consecutive-failure lockout counter.
    const lk = await adminTotpLockout.limit(`admin-totp-fail:${ctx.adminId}`);
    if (!lk.allowed) {
      return NextResponse.json(
        { error: 'LOCKED_OUT' },
        { status: 429, headers: { 'Retry-After': String(lk.retryAfter) } }
      );
    }
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 401 });
  }

  // Valid code — re-issue the session with totpVerified=true.
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
