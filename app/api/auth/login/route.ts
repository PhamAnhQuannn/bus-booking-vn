/**
 * POST /api/auth/login
 * Body: { username, password, scope: 'operator' }
 *
 * Phase 1: Only operator login is active.
 * Customer auth is 410-gated (guest-only booking).
 *
 * Operator (scope='operator'):
 *   Step 1 (password only, operator has no email):
 *     Response: { accessToken, operator, requiresPasswordChange }
 *     + Set-Cookie bb_op_access (15min) + bb_op_refresh (30d)
 *
 *   Step 1 (password OK, operator has email → 2FA):
 *     Response: { otpRequired: true, loginChallenge, maskedEmail }
 *     No cookies set. Client must POST /api/auth/login/verify-otp next.
 *
 * 401 invalid_credentials on wrong credentials.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { operatorLoginInput } from '@/lib/core/validation/auth';
import { operatorLogin, AuthServiceError } from '@/lib/auth';
import { clientIp } from '@/lib/core/http/clientIp';
import { opLoginRatelimit, opLoginLockout } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 minutes in seconds

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const rawScope = (body as Record<string, unknown>)?.scope;

  // Phase 1: customer auth is 410-gated (guest-only booking)
  if (rawScope !== 'operator') {
    return NextResponse.json(
      { error: 'customer_accounts_disabled' },
      { status: 410 }
    );
  }

  const ipRl = await opLoginRatelimit.limit(`op-login:${clientIp(req.headers)}`);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(ipRl.retryAfter) } }
    );
  }

  const parsed = operatorLoginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const lockoutKey = `op-login-fail:${parsed.data.username.trim().toLowerCase()}`;

  let result;
  try {
    result = await operatorLogin(parsed.data);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      if (err.code === 'INVALID_CREDENTIALS') {
        const lk = await opLoginLockout.limit(lockoutKey);
        if (!lk.allowed) {
          return NextResponse.json(
            { error: 'LOCKED_OUT' },
            { status: 429, headers: { 'Retry-After': String(lk.retryAfter) } }
          );
        }
        return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
      }
      if (err.code === 'OTP_LOCKED_OUT') {
        return NextResponse.json({ error: 'OTP_LOCKED_OUT' }, { status: 429 });
      }
      if (err.code === 'OTP_RATE_LIMITED') {
        return NextResponse.json({ error: 'OTP_RATE_LIMITED' }, { status: 429 });
      }
    }
    throw err;
  }

  // 2FA required — return challenge, no session cookies
  if (result.otpRequired) {
    return NextResponse.json({
      otpRequired: true,
      loginChallenge: result.loginChallenge,
      maskedEmail: result.maskedEmail,
    });
  }

  // Direct login (no email → password-only)
  const cookieStore = await cookies();

  cookieStore.set('bb_op_access', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set('bb_op_refresh', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json({
    accessToken: result.accessToken,
    operator: result.operator,
    requiresPasswordChange: result.requiresPasswordChange,
  });
}

export const POST = withErrorHandler(handler);
