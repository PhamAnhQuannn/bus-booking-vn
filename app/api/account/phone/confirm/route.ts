/**
 * POST /api/account/phone/confirm
 * Body: { newPhone, code }
 * Bearer auth required.
 *
 * Verifies OTP for the newPhone, issues a 'phone_change' OTP proof, then
 * immediately changes the phone (single-step for simplicity; proof is one-shot).
 *
 * AC3 status map:
 *   200 { phone } — success
 *   422 PHONE_TAKEN — newPhone already registered
 *   400 OTP_INVALID | OTP_EXPIRED | OTP_LOCKED_OUT
 *   401 UNAUTHORIZED
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth/requireCustomerAuth';
import { verifyCustomerAccountOtp } from '@/lib/account/customerOtp';
import { changePhone, ChangePhoneError } from '@/lib/account/changePhone';
import { z } from 'zod';
import { phoneSchema } from '@/lib/auth/types';

const schema = z.object({
  newPhone: phoneSchema,
  code: z.string().length(6).regex(/^[0-9]{6}$/),
});

async function handler(req: NextRequest, { customerId }: { customerId: string }): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { newPhone, code } = parsed.data;

  // Verify OTP for the new phone number
  const otpResult = await verifyCustomerAccountOtp(newPhone, code);

  if (otpResult.status === 'locked_out') {
    return NextResponse.json({ error: 'OTP_LOCKED_OUT' }, { status: 429 });
  }
  if (otpResult.status === 'gone') {
    return NextResponse.json({ error: 'OTP_EXPIRED' }, { status: 400 });
  }
  if (otpResult.status === 'mismatch' || otpResult.status === 'attempt_cap') {
    return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 });
  }

  // OTP valid — change phone
  try {
    const result = await changePhone(customerId, newPhone);
    return NextResponse.json({ phone: result.phone });
  } catch (err) {
    if (err instanceof ChangePhoneError) {
      if (err.code === 'PHONE_TAKEN') {
        return NextResponse.json({ error: 'PHONE_TAKEN' }, { status: 422 });
      }
      if (err.code === 'CUSTOMER_NOT_FOUND') {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }
    throw err;
  }
}

export const POST = withErrorHandler(requireCustomerAuth()(handler));
