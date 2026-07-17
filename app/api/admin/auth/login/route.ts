/**
 * POST /api/admin/auth/login (Issue 054)
 *
 * invite-only (issue 057); no registration route.
 *
 * Body: { email, password }
 * Strict per-IP rate-limit (429 on exhaustion).
 * On success: 200 { role } + Set-Cookie bb_admin_access (600s) + bb_admin_refresh (30d).
 *   NO tokens in the response body — they live only in HttpOnly cookies.
 * On failure: 401 { error: 'INVALID_CREDENTIALS' } (uniform, no enumeration).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { adminLogin, issueAdminSession } from '@/lib/auth';
import { adminLoginRatelimit, adminLoginLockout } from '@/lib/ratelimit';
import { clientIp } from '@/lib/core/http/clientIp';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 10 * 60; // 600s — matches ADMIN_ACCESS_TTL_SECONDS
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function handler(req: NextRequest): Promise<Response> {
  const ip = clientIp(req.headers);
  const rl = await adminLoginRatelimit.limit(`admin-login:${ip}`);
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const result = await adminLogin(email, password);
  if (!result.ok) {
    // Audit the failed attempt server-side (best-effort — never break auth on an
    // audit write hiccup). The RESPONSE stays uniform (no enumeration); recording
    // the attempted email in the internal audit trail does not leak to the client.
    await writeAdminAuditLog(prisma, {
      actor: `ip:${ip}`,
      action: 'admin_login_failure',
      target: email.toLowerCase(),
      argsRedacted: JSON.stringify({ ip }),
    }).catch(() => undefined);

    const lk = await adminLoginLockout.limit(`admin-login-fail:${email.toLowerCase()}`);
    if (!lk.allowed) {
      return NextResponse.json(
        { error: 'LOCKED_OUT' },
        { status: 429, headers: { 'Retry-After': String(lk.retryAfter) } }
      );
    }
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  await writeAdminAuditLog(prisma, {
    actor: `admin:${result.adminUserId}`,
    action: 'admin_login_success',
    target: result.adminUserId,
    argsRedacted: JSON.stringify({ ip }),
  }).catch(() => undefined);

  const session = await issueAdminSession(result.adminUserId, result.role, false);

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

  return NextResponse.json({ role: result.role, totpDisabled: false });
}

export const POST = withErrorHandler(handler);
