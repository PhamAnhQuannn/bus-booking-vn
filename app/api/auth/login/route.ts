/**
 * POST /api/auth/login
 * Body: { username, password, scope: 'operator' }
 *
 * 2026-06-06: customer accounts PAUSED (guest-only). Only the operator branch is live;
 * any non-operator scope returns 410 customer_login_disabled. Re-enable = restore the
 * customer branch (git history) + the customer auth UI (S04).
 *
 * Operator (scope='operator'):
 *   Response: { accessToken, operator, requiresPasswordChange }
 *   + Set-Cookie bb_op_access (15min, HttpOnly) + bb_op_refresh (30d, HttpOnly)
 *   Login key is the generated username (BRAND_ACRONYM-last4phone), NOT phone.
 *
 * 401 invalid_credentials on wrong username/password.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { operatorLoginInput } from '@/lib/core/validation/auth';
import { AuthServiceError } from '@/lib/auth';
import { operatorLogin } from '@/lib/auth';
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

  // 2026-06-06: customer accounts paused (guest-only). Only the operator branch is live.
  if (scope !== 'operator') {
    return NextResponse.json({ error: 'customer_login_disabled' }, { status: 410 });
  }

  {
    // -----------------------------------------------------------------------
    // Operator branch (username + password)
    // -----------------------------------------------------------------------
    const parsed = operatorLoginInput.safeParse(body);
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
}

export const POST = withErrorHandler(handler);
