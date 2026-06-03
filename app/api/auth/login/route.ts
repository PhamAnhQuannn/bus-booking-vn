/**
 * POST /api/auth/login
 * Body: { phone, password, scope?: 'customer' | 'operator' }
 *
 * Customer (no scope or scope='customer'):
 *   Response: { accessToken, customer } + Set-Cookie bb_rt
 *
 * Operator (scope='operator'):
 *   Response: { accessToken, operator, requiresPasswordChange }
 *   + Set-Cookie bb_op_access (15min, HttpOnly) + bb_op_refresh (30d, HttpOnly)
 *
 * 401 INVALID_CREDENTIALS on wrong phone/password.
 * 403 SCOPE_MISMATCH not used here (scope is a discriminant for two separate flows,
 *     not a cross-flow guard — wrong-scope creds just return 401).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginInput } from '@/lib/core/validation/auth';
import { login, AuthServiceError } from '@/lib/auth/authService';
import { operatorLogin } from '@/lib/auth/operatorAuthService';
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

  // Parse scope from body (default to 'customer' when absent)
  const rawScope = (body as Record<string, unknown>)?.scope;
  const scope = rawScope === 'operator' ? 'operator' : 'customer';

  if (scope === 'operator') {
    // -----------------------------------------------------------------------
    // Operator branch
    // -----------------------------------------------------------------------
    const parsed = loginInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    }

    let result;
    try {
      result = await operatorLogin(parsed.data);
    } catch (err) {
      if (err instanceof AuthServiceError && err.code === 'INVALID_CREDENTIALS') {
        return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
      }
      throw err;
    }

    const cookieStore = await cookies();

    // bb_op_access — short-lived, HttpOnly
    cookieStore.set('bb_op_access', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    // bb_op_refresh — long-lived, HttpOnly
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
  // Customer branch (default)
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
