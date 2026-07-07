/**
 * POST /api/auth/login
 * Body: { email, password, scope?: 'operator' }
 *
 * Two branches:
 *   Customer (default / scope absent):
 *     Response: { accessToken, customer }
 *     + Set-Cookie bb_rt (30d, HttpOnly)
 *
 *   Operator (scope='operator'):
 *     Response: { accessToken, operator, requiresPasswordChange }
 *     + Set-Cookie bb_op_access (15min, HttpOnly) + bb_op_refresh (30d, HttpOnly)
 *     Login key is the generated username (BRAND_ACRONYM-last4phone), NOT phone.
 *
 * 401 invalid_credentials on wrong credentials.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginInput, operatorLoginInput } from '@/lib/core/validation/auth';
import { login, AuthServiceError } from '@/lib/auth';
import { operatorLogin } from '@/lib/auth';
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
  const scope = rawScope === 'operator' ? 'operator' : 'customer';

  if (scope === 'operator') {
    // -----------------------------------------------------------------------
    // Operator branch (username + password)
    // -----------------------------------------------------------------------
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
      if (err instanceof AuthServiceError && err.code === 'INVALID_CREDENTIALS') {
        const lk = await opLoginLockout.limit(lockoutKey);
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

  // -------------------------------------------------------------------------
  // Customer branch (email + password)
  // -------------------------------------------------------------------------
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  let result;
  try {
    result = await login(parsed.data);
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'INVALID_CREDENTIALS') {
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

  return NextResponse.json({
    accessToken: result.accessToken,
    customer: result.customer,
  });
}

export const POST = withErrorHandler(handler);
