/**
 * POST /api/op/auth/forgot-password
 * Body: { phone }
 * Response: 202 (always, no enumeration — same response whether phone exists or not)
 *
 * Sends OTP via eSMS if the operator phone is found.
 * Rate limit: 3 per 15 min per phone (returns 429 RATE_LIMITED if exceeded).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordSchema } from '@/lib/auth';
import { sendOperatorPasswordResetOtp } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { normalizePhone } from '@/lib/core/validation/phone';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const rawPhone = parsed.data.phone;

  // Check if operator exists — but always return 202 regardless to prevent enumeration
  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    // Invalid format — still return 202 to avoid enumeration
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  }

  const operator = await prisma.operatorUser.findUnique({
    where: { phone },
    select: { id: true, disabledAt: true },
  });

  // Only send OTP if operator exists and not disabled
  if (operator && !operator.disabledAt) {
    const result = await sendOperatorPasswordResetOtp(phone);
    if (!result.ok) {
      if (result.reason === 'locked_out') {
        return NextResponse.json(
          { error: 'LOCKED_OUT', retryAfter: result.retryAfter },
          { status: 429 }
        );
      }
      // Rate limited
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: result.retryAfter },
        { status: 429 }
      );
    }
  }

  // Always 202 — no enumeration
  return NextResponse.json({ message: 'accepted' }, { status: 202 });
}

export const POST = withErrorHandler(handler);
