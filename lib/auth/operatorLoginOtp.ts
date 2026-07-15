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
import { sendEmail } from '@/lib/notification';
import { stashTestOtp } from '@/lib/notification';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFY_FAILURES = 3;
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
      DO UPDATE SET
        "codeHash"    = EXCLUDED."codeHash",
        salt          = EXCLUDED.salt,
        "expiresAt"   = EXCLUDED."expiresAt",
        "attemptCount" = 0,
        "createdAt"   = NOW()
    `
  );

  if (peekMode) {
    stashTestOtp(email, code);
  }

  await sendEmail({
    to: email,
    template: 'otpCode',
    payload: { code, expiryMinutes: OTP_EXPIRY_MINUTES },
  });

  return { ok: true };
}

export interface VerifyLoginOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap' | 'locked_out';
}

export async function verifyOperatorLoginOtp(
  email: string,
  plainCode: string
): Promise<VerifyLoginOtpResult> {
  const sentinel = await findLoginLockoutSentinel(email);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
  const rows = await prisma.$queryRaw<OtpRow[]>(
    Prisma.sql`
      SELECT id, "codeHash", salt, "attemptCount"
      FROM "OperatorOtpAttempt"
      WHERE phone = ${email}
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
        WHERE phone = ${email}
          AND consumed = false
          AND "expiresAt" > NOW()
        LIMIT 1
      `
    );
    return activeCheck.length > 0 ? { status: 'mismatch' } : { status: 'gone' };
  }

  return { status: 'ok' };
}
