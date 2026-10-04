/**
 * POST /api/auth/login/resend-otp
 * Body: { loginChallenge }
 *
 * Operator 2FA step-1.5 (#457): re-send the email OTP when the first code expired or
 * never arrived, WITHOUT making the operator re-enter username/password.
 *
 * The incoming loginChallenge is decoded WITHOUT consuming its one-shot jti
 * (verifyOtpProof consume:false) — it only identifies the operator. A fresh OTP is sent
 * (superseding the active code) and a NEW loginChallenge is issued and returned, so the
 * challenge window is refreshed in lockstep with the new code. The eventual verify-otp
 * call remains the single jti consumer.
 *
 * 200 → { ok: true, loginChallenge }
 * 400 → INVALID (bad body) / invalid_challenge (bad or expired challenge)
 * 429 → RATE_LIMITED (per-IP) / OTP_LOCKED_OUT / OTP_RATE_LIMITED (per-email)
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyOtpProof,
  issueOtpProof,
  sendOperatorLoginOtp,
} from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { opLoginResendOtpRatelimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/core/http/clientIp';

const resendInput = z.object({ loginChallenge: z.string().min(1) });

async function handler(req: Request): Promise<Response> {
  // Per-IP anti-flood before any OTP work (per-email cap is authoritative downstream).
  const ipRl = await opLoginResendOtpRatelimit.limit(`op-login-resend-otp:${clientIp(req.headers)}`);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(ipRl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = resendInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Decode WITHOUT consuming — the verify-otp step stays the single jti consumer.
  const proof = await verifyOtpProof(parsed.data.loginChallenge, 'op_login', { consume: false });
  const operatorUserId = proof?.email;
  if (!operatorUserId) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  const { prisma } = await import('@/lib/core/db/client');
  const user = await prisma.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  const otpResult = await sendOperatorLoginOtp(user.email);
  if (!otpResult.ok) {
    return NextResponse.json(
      { error: otpResult.reason === 'locked_out' ? 'OTP_LOCKED_OUT' : 'OTP_RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(otpResult.retryAfter) } }
    );
  }

  // Fresh challenge so the proof window tracks the new code's TTL.
  const loginChallenge = await issueOtpProof(operatorUserId, 'op_login');
  return NextResponse.json({ ok: true, loginChallenge });
}

export const POST = withErrorHandler(handler);
