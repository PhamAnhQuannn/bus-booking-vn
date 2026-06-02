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
import { adminLogin } from '@/lib/auth/adminAuthService';
import { issueAdminSession } from '@/lib/auth/adminSession';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const ACCESS_COOKIE_MAX_AGE = 10 * 60; // 600s — matches ADMIN_ACCESS_TTL_SECONDS
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function handler(req: NextRequest): Promise<Response> {
  // Strict per-IP rate-limit on the admin login surface.
  const ip = clientIp(req);
  const rl = await ratelimit.limit(`admin-login:${ip}`);
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

  const result = await adminLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  // totpVerified=false at password-login time — the TOTP step (issue 055+) flips it.
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

  return NextResponse.json({ role: result.role });
}

export const POST = withErrorHandler(handler);
