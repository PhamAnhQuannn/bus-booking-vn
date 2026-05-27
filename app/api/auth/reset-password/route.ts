/**
 * POST /api/auth/reset-password
 * Body: { otpProof, newPassword }
 * Response: 204 on success.
 *
 * Unauthenticated — protected by the one-shot 'reset_password' OTP proof JWT.
 * AC1 status map:
 *   204 — success
 *   401 INVALID_PROOF — proof invalid, expired, already used, or wrong purpose
 *   422 PASSWORD_REUSED — new password equals current
 *   400 WEAK_PASSWORD — password fails validation
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { resetPassword, ResetPasswordError } from '@/lib/account/resetPassword';
import { z } from 'zod';
import { passwordSchema } from '@/lib/auth/types';

const schema = z.object({
  otpProof: z.string().min(1),
  newPassword: passwordSchema,
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
    const newPwdErrors = parsed.error.issues.filter((i) => i.path.includes('newPassword'));
    if (newPwdErrors.length > 0) {
      return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await resetPassword(parsed.data.otpProof, parsed.data.newPassword);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ResetPasswordError) {
      if (err.code === 'INVALID_PROOF' || err.code === 'CUSTOMER_NOT_FOUND') {
        return NextResponse.json({ error: 'INVALID_PROOF' }, { status: 401 });
      }
      if (err.code === 'PASSWORD_REUSED') {
        return NextResponse.json({ error: 'PASSWORD_REUSED' }, { status: 422 });
      }
    }
    throw err;
  }
}

export const POST = withErrorHandler(handler);
