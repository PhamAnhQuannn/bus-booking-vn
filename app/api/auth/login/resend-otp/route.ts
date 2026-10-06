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
 * The challenge TTL (5min) equals the OTP TTL, so by the time a code has "expired" the
 * challenge is too. To actually serve the expired-code case (#457's whole point), resend
 * decodes with a bounded clockTolerance (10min) → a challenge up to ~15min old still
 * resolves the operator. This never lets an expired challenge COMPLETE login (verify-otp
 * omits the tolerance, so jose rejects it); resend only mints a fresh code + challenge,
 * gated by the per-IP + per-email caps.
 *
 * 200 → { ok: true, loginChallenge }
 * 400 → INVALID (bad body) / invalid_challenge (bad/too-old challenge, or disabled operator)
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

  // Decode WITHOUT consuming (verify-otp stays the single jti consumer) and WITH a bounded
  // expiry tolerance so a just-expired code can still be resent (#457).
  const proof = await verifyOtpProof(parsed.data.loginChallenge, 'op_login', {
    consume: false,
    clockTolerance: '10 minutes',
  });
  const operatorUserId = proof?.email;
  if (!operatorUserId) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  const { prisma } = await import('@/lib/core/db/client');
  const user = await prisma.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { email: true, disabledAt: true },
  });
  // Uniform invalid_challenge (anti-enumeration) if the operator is gone, has no email, or
  // was disabled mid-flow — don't email OTPs to a deactivated account.
  if (!user?.email || user.disabledAt !== null) {
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
