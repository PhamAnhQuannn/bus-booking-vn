/**
 * Operator login OTP — email-based 2FA for operator login.
 *
 * sendOperatorLoginOtp(email) — send a 6-digit OTP to operator's email.
 * verifyOperatorLoginOtp(email, code) — verify OTP code against OperatorOtpAttempt.
 *
 * Reuses the OperatorOtpAttempt table with email as the identifier (stored in
 * the `phone` column). Since forgot-password OTP uses phone numbers and login
 * OTP uses email addresses, the two flows never collide on the partial unique
 * index (phone WHERE consumed = false).
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { generateCode, generateSalt, hashCode } from './otp';
import { sendEmail, logNotificationDispatchFailure } from '@/lib/notification';
import { stashTestOtp } from '@/lib/notification';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_EXPIRY_MINUTES = 5;
export const MAX_VERIFY_FAILURES = 3;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const opLoginOtpRatelimit = createRatelimit({ limit: 5, windowMs: LOCKOUT_WINDOW_MS });

export type SendLoginOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'locked_out'; retryAfter: number };

async function findLoginLockoutSentinel(
  email: string
): Promise<{ expiresAt: Date } | null> {
  type SentinelRow = { expiresAt: Date };
  const rows = await prisma.$queryRaw<SentinelRow[]>(
    Prisma.sql`
      SELECT "expiresAt"
      FROM "OperatorOtpAttempt"
      WHERE phone = ${email}
        AND "attemptCount" >= ${MAX_VERIFY_FAILURES}
        AND consumed = true
        AND "expiresAt" > NOW()
      ORDER BY "expiresAt" DESC
      LIMIT 1
    `
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function sendOperatorLoginOtp(email: string): Promise<SendLoginOtpResult> {
  const sentinel = await findLoginLockoutSentinel(email);
  if (sentinel) {
    const retryAfter = Math.ceil((sentinel.expiresAt.getTime() - Date.now()) / 1000);
    return { ok: false, reason: 'locked_out', retryAfter };
  }

  const peekMode =
    process.env.NODE_ENV !== 'production' && process.env.OTP_PEEK_ENABLED === 'true';
  if (!peekMode) {
    const rl = await opLoginOtpRatelimit.limit(`op-login-otp:${email}`);
    if (!rl.allowed) {
      return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
    }
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "OperatorOtpAttempt" (id, phone, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
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
      ON CONFLICT (phone) WHERE consumed = false
      -- #792: the SET list deliberately does NOT zero attemptCount on resend. Resetting it
      -- made the 3-wrong-guess cap per-OTP-instance instead of per-account (guess 2x,
      -- re-request, repeat). The active unconsumed row carries its prior count across
      -- resends so the cap is per-account; a fresh insert still starts at zero via default.
      DO UPDATE SET
        "codeHash"    = EXCLUDED."codeHash",
        salt          = EXCLUDED.salt,
        "expiresAt"   = EXCLUDED."expiresAt",
        "createdAt"   = NOW()
    `
  );

  if (peekMode) {
    stashTestOtp(email, code);
  }

  // #442: surface a definitive send failure to logs + Sentry; outward result unchanged.
  const result = await sendEmail({
    to: email,
    template: 'otpCode',
    payload: { code, expiryMinutes: OTP_EXPIRY_MINUTES },
  });
  logNotificationDispatchFailure('operator_login_otp_email', result);

  return { ok: true };
}

export interface VerifyLoginOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'locked_out';
}

export async function verifyOperatorLoginOtp(
  email: string,
  plainCode: string
): Promise<VerifyLoginOtpResult> {
  const sentinel = await findLoginLockoutSentinel(email);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  // #792: read → lockout gate-check → increment/consume MUST be one transaction with the
  // active OTP row locked FOR UPDATE. As three separate statements (TOCTOU), concurrent
  // guesses all read the same pre-increment attemptCount and overshoot MAX_VERIFY_FAILURES.
  // Callback-form tx + FOR UPDATE on the gating row — CLAUDE.md concurrency rule, mirrors
  // app/api/op/trips/[id]/route.ts and trip-planner/lib/planner/conversationRepo.ts.
  return prisma.$transaction(async (tx): Promise<VerifyLoginOtpResult> => {
    type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
    const rows = await tx.$queryRaw<OtpRow[]>(
      Prisma.sql`
        SELECT id, "codeHash", salt, "attemptCount"
        FROM "OperatorOtpAttempt"
        WHERE phone = ${email}
          AND consumed = false
          AND "expiresAt" > NOW()
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `
    );

    if (rows.length === 0) {
      return { status: 'gone' };
    }

    const row = rows[0];

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
        const lockoutExpiry = new Date(Date.now() + LOCKOUT_WINDOW_MS);
        await tx.$executeRaw(
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
        await tx.$executeRaw(
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

    // #792: success does NOT increment attemptCount. A correct code on the 3rd try would
    // otherwise take count 2→3 alongside consumed=true — exactly the lockout sentinel shape
    // findLoginLockoutSentinel matches — locking the operator who just logged in out for the TTL.
    const updated = await tx.$executeRaw(
      Prisma.sql`
        UPDATE "OperatorOtpAttempt"
        SET consumed = true,
            "consumedAt" = NOW()
        WHERE id = ${row.id}
          AND consumed = false
          AND "expiresAt" > NOW()
          AND "codeHash" = ${row.codeHash}
      `
    );

    if (updated === 0) {
      const activeCheck = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT id FROM "OperatorOtpAttempt"
          WHERE phone = ${email}
            AND consumed = false
            AND "expiresAt" > NOW()
          LIMIT 1
        `
      );
      return activeCheck.length > 0 ? { status: 'mismatch' } : { status: 'gone' };
    }

    return { status: 'ok' };
  });
}
