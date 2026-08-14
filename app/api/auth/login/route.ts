/**
 * POST /api/auth/login
 *
 * Dispatches on `scope`:
 *   - scope === 'operator' → operator login (username+password, optional email 2FA).
 *       Response: { accessToken, operator, requiresPasswordChange } + bb_op_access (15m)
 *       + bb_op_refresh (30d); OR { otpRequired, loginChallenge, maskedEmail } when 2FA.
 *   - otherwise → customer login (email+password, P1/ADR-021).
 *       Response: { accessToken, customer } + bb_rt (30d). Access token is a Bearer held
 *       in client memory (clientSession), refresh lives in the bb_rt HttpOnly cookie.
 *
 * 401 invalid_credentials on wrong credentials (uniform, anti-enumeration — a suspended
 * or unknown customer looks identical). 429 RATE_LIMITED / LOCKED_OUT under the limiters.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { operatorLoginInput, loginInput } from '@/lib/core/validation/auth';
import { operatorLogin, login, AuthServiceError, generateCsrfToken } from '@/lib/auth';
import { clientIp } from '@/lib/core/http/clientIp';
import {
  opLoginRatelimit,
  opLoginLockout,
  customerLoginRatelimit,
  customerLoginLockout,
} from '@/lib/ratelimit';
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
  return rawScope === 'operator'
    ? handleOperatorLogin(req, body)
    : handleCustomerLogin(req, body);
}

async function handleCustomerLogin(req: NextRequest, body: unknown): Promise<Response> {
  const ipRl = await customerLoginRatelimit.limit(`customer-login:${clientIp(req.headers)}`);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(ipRl.retryAfter) } }
    );
  }

  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const lockoutKey = `customer-login-fail:${parsed.data.email.trim().toLowerCase()}`;

  let result;
  try {
    result = await login(parsed.data, {
      ip: clientIp(req.headers),
      userAgent: req.headers.get('user-agent'),
    });
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'INVALID_CREDENTIALS') {
      const lk = await customerLoginLockout.limit(lockoutKey);
      if (!lk.allowed) {
        return NextResponse.json(
          { error: 'LOCKED_OUT' },
          { status: 429, headers: { 'Retry-After': String(lk.retryAfter) } }
        );
      }
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    throw err;
  }

  const cookieStore = await cookies();
  cookieStore.set('bb_rt', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  rotateCsrf(cookieStore);

  return NextResponse.json({ accessToken: result.accessToken, customer: result.customer });
}

/**
 * #493: re-mint the bb_csrf double-submit token on an auth-state change (login/logout).
 * The token is otherwise minted once (proxy.ts, first safe GET) and never rotated, so a
 * fixed pre-login value would survive into the authenticated session. Attributes mirror
 * proxy.ts (non-HttpOnly so JS can echo it; session cookie; SameSite=Lax).
 */
function rotateCsrf(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set('bb_csrf', generateCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

async function handleOperatorLogin(req: NextRequest, body: unknown): Promise<Response> {
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
  rotateCsrf(cookieStore);

  return NextResponse.json({
    accessToken: result.accessToken,
    operator: result.operator,
    requiresPasswordChange: result.requiresPasswordChange,
  });
}

export const POST = withErrorHandler(handler);
