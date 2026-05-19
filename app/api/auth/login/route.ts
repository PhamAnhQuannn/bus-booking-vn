/**
 * POST /api/auth/login
 * Body: { phone, password }
 * Response: { accessToken, customer } + Set-Cookie bb_rt
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginInput } from '@/lib/validation/auth';
import { login, AuthServiceError } from '@/lib/auth/authService';
import { withErrorHandler } from '@/lib/withErrorHandler';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

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
