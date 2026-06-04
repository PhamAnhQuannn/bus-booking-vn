/**
 * POST /api/auth/logout
 * No body — reads bb_rt cookie.
 * Response: { success: true } — clears bb_rt cookie.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logout } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(_req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_rt')?.value;

  if (rt) {
    await logout(rt);
  }

  // Clear cookie regardless of whether token was valid
  cookieStore.set('bb_rt', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}

export const POST = withErrorHandler(handler);
