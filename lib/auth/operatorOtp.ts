/**
 * Operator OTP utilities — mirrors lib/auth/sendOtp.ts but uses OperatorOtpAttempt.
 *
 * sendOperatorPasswordResetOtp(phone) — rate-limited send (3/15min per phone).
 *   Returns: { ok: true } | { ok: false, reason: 'rate_limited' | 'locked_out', retryAfter: number }
 *
 * verifyOperatorOtp(phone, code) — consume-or-fail against OperatorOtpAttempt.
 *   Returns: { status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap' | 'locked_out' }
 *   3 failed verifies triggers a 15-min lockout sentinel:
 *     - The row is marked consumed=true with expiresAt extended to now+15min.
 *     - Subsequent verify calls within 15min return 'locked_out' immediately.
 *     - Subsequent send calls within 15min return locked_out immediately (no new OTP).
 *
 * The partial unique index "OperatorOtpAttempt_phone_active_key" (WHERE consumed=false)
 * guarantees at most one active row per phone.
 * The sentinel is consumed=true, so it never conflicts with new (unconsumed) rows.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from './phoneNormalize';
import { generateCode, generateSalt, hashCode } from './otp';
import { sendSms } from '@/lib/notifications/esms';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFY_FAILURES = 3;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Rate-limiter: 3 OTP sends per 15 min per phone
const opForgotPasswordRatelimit = createRatelimit({ limit: 3, windowMs: LOCKOUT_WINDOW_MS });

export type SendOpOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'locked_out'; retryAfter: number };

/**
 * Internal helper — check for an active lockout sentinel row.
 * Returns the sentinel row if the phone is locked out, or null if not.
 * Sentinel: consumed=true, attemptCount>=3, expiresAt still in the future.
 */
async function findLockoutSentinel(
  phone: string
): Promise<{ expiresAt: Date } | null> {
  type SentinelRow = { expiresAt: Date };
  const rows = await prisma.$queryRaw<SentinelRow[]>(
    Prisma.sql`
      SELECT "expiresAt"
      FROM "OperatorOtpAttempt"
      WHERE phone = ${phone}
        AND "attemptCount" >= ${MAX_VERIFY_FAILURES}
        AND consumed = true
        AND "expiresAt" > NOW()
      ORDER BY "expiresAt" DESC
      LIMIT 1
    `
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Send a password-reset OTP to an operator phone.
 * Returns 202-style { ok: true } regardless of whether the phone exists (no enumeration).
 * If rate-limited, returns { ok: false, reason: 'rate_limited', retryAfter }.
 * If locked out (3 failed verifies in 15min window), returns { ok: false, reason: 'locked_out', retryAfter }.
 */
export async function sendOperatorPasswordResetOtp(rawPhone: string): Promise<SendOpOtpResult> {
  const phone = normalizePhone(rawPhone);

  // Check verify-failure lockout sentinel BEFORE rate-limiter
  const sentinel = await findLockoutSentinel(phone);
  if (sentinel) {
    const retryAfter = Math.ceil((sentinel.expiresAt.getTime() - Date.now()) / 1000);
    return { ok: false, reason: 'locked_out', retryAfter };
  }

  // The in-memory limiter lives in the dev-server process and persists across e2e
  // runs/projects, so the gated forgot-password specs would trip the 3/15min cap
  // mid-suite. Skip the limiter only in the dev/e2e peek mode (dual-guarded exactly
  // like the test-peek endpoint; OTP_PEEK_ENABLED must NEVER be set in production).
  const peekMode =
    process.env.NODE_ENV !== 'production' && process.env.OTP_PEEK_ENABLED === 'true';
  if (!peekMode) {
    const rl = await opForgotPasswordRatelimit.limit(phone);
    if (!rl.allowed) {
      return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
    }
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  // Atomic supersede: ON CONFLICT on the partial unique index resets the active row
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "OperatorOtpAttempt" (id, phone, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
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
      ON CONFLICT (phone) WHERE consumed = false
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

export interface VerifyOpOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap' | 'locked_out';
  otpId?: string;
}

/**
 * Atomically verify an operator OTP.
 * 3 failed attempts triggers a 15-min lockout sentinel (consumed=true, expiresAt=now+15min).
 */
export async function verifyOperatorOtp(
  rawPhone: string,
  plainCode: string
): Promise<VerifyOpOtpResult> {
  const phone = normalizePhone(rawPhone);

  // Check verify-failure lockout sentinel first — prevents bypassing by waiting for OTP TTL
  const sentinel = await findLockoutSentinel(phone);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
  const rows = await prisma.$queryRaw<OtpRow[]>(
    Prisma.sql`
      SELECT id, "codeHash", salt, "attemptCount"
      FROM "OperatorOtpAttempt"
      WHERE phone = ${phone}
        AND consumed = false
        AND "expiresAt" > NOW()
      ORDER BY "createdAt" DESC
      LIMIT 1
    `
  );

  if (rows.length === 0) {
    return { status: 'gone' };
  }

  const row = rows[0];

  // Locked out after MAX_VERIFY_FAILURES wrong attempts (legacy path — row still active)
  if (row.attemptCount >= MAX_VERIFY_FAILURES) {
    return { status: 'locked_out' };
  }

  const expectedHash = hashCode(plainCode, row.salt);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  const storedBuf = Buffer.from(row.codeHash, 'hex');
  const hashMatch =
    expectedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, storedBuf);

  if (!hashMatch) {
    const newAttemptCount = row.attemptCount + 1;

    if (newAttemptCount >= MAX_VERIFY_FAILURES) {
      // 3rd failure: write lockout sentinel — consumed=true + expiresAt extended to now+15min
      const lockoutExpiry = new Date(Date.now() + LOCKOUT_WINDOW_MS);
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "OperatorOtpAttempt"
          SET "attemptCount" = ${newAttemptCount},
              consumed = true,
              "consumedAt" = NOW(),
              "expiresAt" = ${lockoutExpiry}
          WHERE id = ${row.id}
            AND consumed = false
        `
      );
    } else {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "OperatorOtpAttempt"
          SET "attemptCount" = "attemptCount" + 1
          WHERE id = ${row.id}
            AND consumed = false
        `
      );
    }
    return { status: 'mismatch' };
  }

  // CAS — atomically consume the row
  const updated = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "OperatorOtpAttempt"
      SET consumed = true,
          "consumedAt" = NOW(),
          "attemptCount" = "attemptCount" + 1
      WHERE id = ${row.id}
        AND consumed = false
        AND "expiresAt" > NOW()
        AND "codeHash" = ${row.codeHash}
    `
  );

  if (updated === 0) {
    const activeCheck = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id FROM "OperatorOtpAttempt"
        WHERE phone = ${phone}
          AND consumed = false
          AND "expiresAt" > NOW()
        LIMIT 1
      `
    );
    return activeCheck.length > 0 ? { status: 'mismatch' } : { status: 'gone' };
  }

  return { status: 'ok', otpId: row.id };
}
