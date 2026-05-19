/**
 * sendOtp — orchestrates OTP generation, rate-limiting, DB supersede, and SMS dispatch.
 *
 * Rate-limit key: normalized phone (AC 2 — max 3 sends / 15 min per phone).
 * Atomic supersede: raw $executeRaw with ON CONFLICT on the partial unique index
 * "OtpAttempt_phone_active_key" (WHERE consumed=false), resetting the active row
 * in-place so the constraint is never violated across two active rows.
 *
 * Returns: { ok: true } | { ok: false, reason: 'rate_limited', retryAfter: number }
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from './phoneNormalize';
import { generateCode, generateSalt, hashCode } from './otp';
import { sendSms } from '@/lib/notifications/esms';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_EXPIRY_MINUTES = 5;

const otpRatelimit = createRatelimit({ limit: 3, windowMs: 15 * 60 * 1000 });

export type SendOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited'; retryAfter: number };

export async function sendOtp(rawPhone: string): Promise<SendOtpResult> {
  const phone = normalizePhone(rawPhone);

  const rl = await otpRatelimit.limit(phone);
  if (!rl.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  // Atomic supersede: insert new row or update the existing unconsumed row in-place.
  // The partial unique index "OtpAttempt_phone_active_key" covers (phone) WHERE consumed=false,
  // so ON CONFLICT targets exactly one active row and resets it.
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "OtpAttempt" (id, phone, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
      VALUES (
        ${id},
        ${phone},
        ${codeHash},
        ${salt},
        ${expiresAt},
        false,
        0,
        NOW()
      )
      ON CONFLICT ON CONSTRAINT "OtpAttempt_phone_active_key"
      DO UPDATE SET
        "codeHash"    = EXCLUDED."codeHash",
        salt          = EXCLUDED.salt,
        "expiresAt"   = EXCLUDED."expiresAt",
        "attemptCount" = 0,
        "createdAt"   = NOW()
    `
  );

  await sendSms({
    to: phone,
    template: 'otpCode',
    payload: { code, expiryMinutes: OTP_EXPIRY_MINUTES },
  });

  return { ok: true };
}
