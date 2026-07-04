/**
 * sendOtp — orchestrates OTP generation, rate-limiting, DB supersede, and email dispatch.
 *
 * Rate-limit key: normalized email (max 3 sends / 15 min per email).
 * Atomic supersede: raw $executeRaw with ON CONFLICT on the partial unique index
 * "OtpAttempt_email_active_key" (WHERE consumed=false AND email IS NOT NULL),
 * resetting the active row in-place so the constraint is never violated.
 *
 * Returns: { ok: true } | { ok: false, reason: 'rate_limited', retryAfter: number }
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { generateCode, generateSalt, hashCode } from './otp';
import { sendEmail, stashTestOtp } from '@/lib/notification';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_EXPIRY_MINUTES = 5;

const otpRatelimit = createRatelimit({ limit: 3, windowMs: 15 * 60 * 1000 });

export type SendOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited'; retryAfter: number };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function sendOtp(rawEmail: string): Promise<SendOtpResult> {
  const email = normalizeEmail(rawEmail);

  const rl = await otpRatelimit.limit(email);
  if (!rl.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "OtpAttempt" (id, email, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
      VALUES (
        ${id},
        ${email},
        ${codeHash},
        ${salt},
        ${expiresAt},
        false,
        0,
        NOW()
      )
      ON CONFLICT (email) WHERE consumed = false AND email IS NOT NULL
      DO UPDATE SET
        "codeHash"    = EXCLUDED."codeHash",
        salt          = EXCLUDED.salt,
        "expiresAt"   = EXCLUDED."expiresAt",
        "attemptCount" = 0,
        "createdAt"   = NOW()
    `
  );

  stashTestOtp(email, code);

  await sendEmail({
    to: email,
    template: 'otpCode',
    payload: `BusBookVN: Ma xac thuc cua ban la ${code}. Ma co hieu luc trong ${OTP_EXPIRY_MINUTES} phut.`,
  });

  return { ok: true };
}
