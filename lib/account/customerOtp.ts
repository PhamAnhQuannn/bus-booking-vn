/**
 * Customer OTP utilities for account-management flows (Issue 008).
 *
 * sendCustomerAccountOtp(email) — send OTP for reset-password.
 *   Rate-limited: 3 sends per 15 min per email.
 *   Lockout check (3 failed verifies → 15-min lockout sentinel) PRECEDES the rate check.
 *
 * verifyCustomerAccountOtp(email, code) — consume-or-fail with 15-min lockout.
 *   3 failed verifies → extends OtpAttempt row as lockout sentinel.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { generateCode, generateSalt, hashCode } from '@/lib/auth';
import { sendEmail, stashTestOtp } from '@/lib/notification';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_EXPIRY_MINUTES = 5;
export const MAX_VERIFY_FAILURES = 3;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const customerAccountOtpRatelimit = createRatelimit({ limit: 3, windowMs: LOCKOUT_WINDOW_MS });

// ---------------------------------------------------------------------------
// Lockout sentinel helper
// ---------------------------------------------------------------------------

export async function findCustomerLockoutSentinel(
  email: string
): Promise<{ expiresAt: Date } | null> {
  type SentinelRow = { expiresAt: Date };
  const rows = await prisma.$queryRaw<SentinelRow[]>(
    Prisma.sql`
      SELECT "expiresAt"
      FROM "OtpAttempt"
      WHERE email = ${email}
        AND "attemptCount" >= ${MAX_VERIFY_FAILURES}
        AND consumed = true
        AND "expiresAt" > NOW()
      ORDER BY "expiresAt" DESC
      LIMIT 1
    `
  );
  return rows.length > 0 ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export type SendCustomerOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'locked_out'; retryAfter: number };

export async function sendCustomerAccountOtp(rawEmail: string): Promise<SendCustomerOtpResult> {
  const email = rawEmail.trim().toLowerCase();

  const sentinel = await findCustomerLockoutSentinel(email);
  if (sentinel) {
    const retryAfter = Math.ceil((sentinel.expiresAt.getTime() - Date.now()) / 1000);
    return { ok: false, reason: 'locked_out', retryAfter };
  }

  const rl = await customerAccountOtpRatelimit.limit(email);
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
        "codeHash"     = EXCLUDED."codeHash",
        salt           = EXCLUDED.salt,
        "expiresAt"    = EXCLUDED."expiresAt",
        "attemptCount" = 0,
        "createdAt"    = NOW()
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

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export interface VerifyCustomerOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap' | 'locked_out';
  otpId?: string;
}

export async function verifyCustomerAccountOtp(
  rawEmail: string,
  plainCode: string
): Promise<VerifyCustomerOtpResult> {
  const email = rawEmail.trim().toLowerCase();

  const sentinel = await findCustomerLockoutSentinel(email);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
  const rows = await prisma.$queryRaw<OtpRow[]>(
    Prisma.sql`
      SELECT id, "codeHash", salt, "attemptCount"
      FROM "OtpAttempt"
      WHERE email = ${email}
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
          UPDATE "OtpAttempt"
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
          UPDATE "OtpAttempt"
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
      UPDATE "OtpAttempt"
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
        SELECT id FROM "OtpAttempt"
        WHERE email = ${email}
          AND consumed = false
          AND "expiresAt" > NOW()
        LIMIT 1
      `
    );
    return activeCheck.length > 0 ? { status: 'mismatch' } : { status: 'gone' };
  }

  return { status: 'ok', otpId: row.id };
}
