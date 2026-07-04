/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Response: 200 { ok: true, retryAfter?: number } always (no email enumeration).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { forgotPassword } from '@/lib/account';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email().max(254),
});

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const result = await forgotPassword(parsed.data.email);
  return NextResponse.json({ ok: true, ...(result.retryAfter != null && { retryAfter: result.retryAfter }) });
}

export const POST = withErrorHandler(handler);
