/**
 * POST /api/admin/auth/step-up (Issue 055)
 *
 * Re-auth (step-up) for high-sensitivity finance/approval actions. Body: { code }.
 * Requires an AUTHENTICATED + TOTP-verified admin (requireTotp:true → 403 TOTP_REQUIRED
 * if the session never cleared TOTP).
 *
 * On a FRESH TOTP verify → mint a 300s step-up token, set as bb_admin_stepup cookie
 * (HttpOnly, sameSite strict, 300s) → 200 { ok: true }. Wave-3 routes then enforce
 * presence of this cookie via requireStepUp. On a wrong code → 401 { error: 'INVALID_CODE' }.
 *
 * Rate-limit + lockout mirror the verify route (admin-totp / admin-totp-fail keys).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyLoginTotp } from '@/lib/auth/adminTotp';
import { signAdminStepUp } from '@/lib/auth/jwt';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { adminTotpRatelimit, adminTotpLockout } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const STEPUP_COOKIE_MAX_AGE = 300; // 5 minutes — matches the step-up token TTL

const bodySchema = z.object({ code: z.string().min(1) });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
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

  // A fresh TOTP verify against the active secret. enrollment_required shouldn't
  // happen here (requireTotp:true implies an enrolled+verified session) but is
  // still handled as a failure rather than a 500.
  const result = await verifyLoginTotp(ctx.adminId, parsed.data.code);
  if (!result.ok) {
    const lk = await adminTotpLockout.limit(`admin-totp-fail:${ctx.adminId}`);
    if (!lk.allowed) {
      return NextResponse.json(
        { error: 'LOCKED_OUT' },
        { status: 429, headers: { 'Retry-After': String(lk.retryAfter) } }
      );
    }
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 401 });
  }

  const stepUpToken = await signAdminStepUp(ctx.adminId);

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  cookieStore.set('bb_admin_stepup', stepUpToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: STEPUP_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true })(handler) as (req: NextRequest) => Promise<Response>
);
