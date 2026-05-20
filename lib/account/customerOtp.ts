/**
 * Customer OTP utilities for account-management flows (Issue 008).
 *
 * sendCustomerAccountOtp(phone, purpose) — send OTP for reset-password or phone-change.
 *   Rate-limited: 3 sends per 15 min per phone.
 *   Lockout check (3 failed verifies → 15-min lockout sentinel) PRECEDES the rate check.
 *   Always returns ok=true (no phone enumeration) even when no row exists.
 *
 * verifyCustomerAccountOtp(phone, code) — consume-or-fail with 15-min lockout.
 *   3 failed verifies → extends OtpAttempt row as lockout sentinel (consumed=true,
 *   expiresAt = now+15min). Mirrors verifyOperatorOtp pattern from lib/auth/operatorOtp.ts.
 *   Uses the shared OtpAttempt table (NOT a separate table).
 *
 * NOTE: The existing lib/auth/otp.ts consume() caps at 5 with NO lockout.
 * This module provides a SEPARATE verify path that enforces the 3-failure/15-min AC.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { generateCode, generateSalt, hashCode } from '@/lib/auth/otp';
import { sendSms } from '@/lib/notifications/esms';
import { createRatelimit } from '@/lib/ratelimit';

const OTP_TTL_SECONDS = 5 * 60;    // 5 minutes
const OTP_EXPIRY_MINUTES = 5;
export const MAX_VERIFY_FAILURES = 3;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Rate-limiter: 3 OTP sends per 15 min per phone
const customerAccountOtpRatelimit = createRatelimit({ limit: 3, windowMs: LOCKOUT_WINDOW_MS });

// ---------------------------------------------------------------------------
// Lockout sentinel helper
// ---------------------------------------------------------------------------

/**
 * Check for an active lockout sentinel row in the OtpAttempt table.
 * Sentinel: consumed=true, attemptCount >= 3, expiresAt still in the future.
 * Returns { expiresAt } if locked out, or null.
 */
export async function findCustomerLockoutSentinel(
  phone: string
): Promise<{ expiresAt: Date } | null> {
  type SentinelRow = { expiresAt: Date };
  const rows = await prisma.$queryRaw<SentinelRow[]>(
    Prisma.sql`
      SELECT "expiresAt"
      FROM "OtpAttempt"
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

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export type SendCustomerOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'locked_out'; retryAfter: number };

/**
 * Send an account-management OTP to a customer phone.
 * Always returns { ok: true } when phone has no customer row (no enumeration).
 * Lockout sentinel check precedes rate-limiter check (per AC6).
 */
export async function sendCustomerAccountOtp(rawPhone: string): Promise<SendCustomerOtpResult> {
  const phone = normalizePhone(rawPhone);

  // Check lockout sentinel first
  const sentinel = await findCustomerLockoutSentinel(phone);
  if (sentinel) {
    const retryAfter = Math.ceil((sentinel.expiresAt.getTime() - Date.now()) / 1000);
    return { ok: false, reason: 'locked_out', retryAfter };
  }

  const rl = await customerAccountOtpRatelimit.limit(phone);
  if (!rl.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  // Supersede: ON CONFLICT on partial unique index resets the active row.
  // The OtpAttempt table has a partial unique index on (phone) WHERE consumed=false
  // named "OtpAttempt_phone_active_key".
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
      ON CONFLICT (phone) WHERE consumed = false
      DO UPDATE SET
        "codeHash"     = EXCLUDED."codeHash",
        salt           = EXCLUDED.salt,
        "expiresAt"    = EXCLUDED."expiresAt",
        "attemptCount" = 0,
        "createdAt"    = NOW()
    `
  );

  await sendSms({
    to: phone,
    template: 'otpCode',
    payload: { code, expiryMinutes: OTP_EXPIRY_MINUTES },
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

/**
 * Atomically verify a customer account OTP.
 * 3 failed attempts → 15-min lockout sentinel (consumed=true, expiresAt=now+15min).
 */
export async function verifyCustomerAccountOtp(
  rawPhone: string,
  plainCode: string
): Promise<VerifyCustomerOtpResult> {
  const phone = normalizePhone(rawPhone);

  // Check lockout sentinel first
  const sentinel = await findCustomerLockoutSentinel(phone);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
  const rows = await prisma.$queryRaw<OtpRow[]>(
    Prisma.sql`
      SELECT id, "codeHash", salt, "attemptCount"
      FROM "OtpAttempt"
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
      // 3rd failure: write lockout sentinel
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

  // CAS — atomically consume the row
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
