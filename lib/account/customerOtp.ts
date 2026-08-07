/**
 * Customer OTP utilities for account-management flows (Issue 008).
 *
 * Two channels (P16):
 *   - 'email' (default) — reset-password / forgot-password. Stored in OtpAttempt.email,
 *     delivered via sendEmail.
 *   - 'phone' — phone-change (app/api/account/phone/*). Stored in OtpAttempt.phone,
 *     delivered via sendSms. Previously this path mis-routed a phone number through the
 *     email sender and never delivered anything in production.
 *
 * sendCustomerAccountOtp(identifier, channel) — send OTP. Rate-limited 3/15min per
 *   identifier; lockout check (3 failed verifies → 15-min sentinel) precedes it.
 * verifyCustomerAccountOtp(identifier, code, channel) — consume-or-fail with lockout.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { generateCode, generateSalt, hashCode } from '@/lib/auth';
import { sendEmail, sendSms, stashTestOtp, logNotificationDispatchFailure } from '@/lib/notification';
import { normalizePhone } from '@/lib/core/validation/phone';
import { createRatelimit } from '@/lib/ratelimit';

export type OtpChannel = 'email' | 'phone';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_EXPIRY_MINUTES = 5;
export const MAX_VERIFY_FAILURES = 3;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const customerAccountOtpRatelimit = createRatelimit({ limit: 3, windowMs: LOCKOUT_WINDOW_MS });

/** Normalise an identifier for its channel (email: lowercase/trim; phone: E.164). */
function normalizeIdentifier(raw: string, channel: OtpChannel): string {
  return channel === 'phone' ? normalizePhone(raw) : raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Lockout sentinel helper
// ---------------------------------------------------------------------------

/** `identifier` must already be normalised for `channel`. */
export async function findCustomerLockoutSentinel(
  identifier: string,
  channel: OtpChannel = 'email'
): Promise<{ expiresAt: Date } | null> {
  type SentinelRow = { expiresAt: Date };
  // Column-specific raw SQL (no dynamic column interpolation).
  const rows =
    channel === 'phone'
      ? await prisma.$queryRaw<SentinelRow[]>(Prisma.sql`
          SELECT "expiresAt" FROM "OtpAttempt"
          WHERE phone = ${identifier}
            AND "attemptCount" >= ${MAX_VERIFY_FAILURES}
            AND consumed = true
            AND "expiresAt" > NOW()
          ORDER BY "expiresAt" DESC LIMIT 1`)
      : await prisma.$queryRaw<SentinelRow[]>(Prisma.sql`
          SELECT "expiresAt" FROM "OtpAttempt"
          WHERE email = ${identifier}
            AND "attemptCount" >= ${MAX_VERIFY_FAILURES}
            AND consumed = true
            AND "expiresAt" > NOW()
          ORDER BY "expiresAt" DESC LIMIT 1`);
  return rows.length > 0 ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export type SendCustomerOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'locked_out'; retryAfter: number };

export async function sendCustomerAccountOtp(
  rawIdentifier: string,
  channel: OtpChannel = 'email'
): Promise<SendCustomerOtpResult> {
  const identifier = normalizeIdentifier(rawIdentifier, channel);

  const sentinel = await findCustomerLockoutSentinel(identifier, channel);
  if (sentinel) {
    const retryAfter = Math.ceil((sentinel.expiresAt.getTime() - Date.now()) / 1000);
    return { ok: false, reason: 'locked_out', retryAfter };
  }

  const rl = await customerAccountOtpRatelimit.limit(identifier);
  if (!rl.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfter: rl.retryAfter };
  }

  const code = generateCode();
  const salt = generateSalt();
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  if (channel === 'phone') {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "OtpAttempt" (id, phone, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
      VALUES (${id}, ${identifier}, ${codeHash}, ${salt}, ${expiresAt}, false, 0, NOW())
      ON CONFLICT (phone) WHERE consumed = false
      DO UPDATE SET "codeHash" = EXCLUDED."codeHash", salt = EXCLUDED.salt,
        "expiresAt" = EXCLUDED."expiresAt", "attemptCount" = 0, "createdAt" = NOW()`);
  } else {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "OtpAttempt" (id, email, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
      VALUES (${id}, ${identifier}, ${codeHash}, ${salt}, ${expiresAt}, false, 0, NOW())
      ON CONFLICT (email) WHERE consumed = false AND email IS NOT NULL
      DO UPDATE SET "codeHash" = EXCLUDED."codeHash", salt = EXCLUDED.salt,
        "expiresAt" = EXCLUDED."expiresAt", "attemptCount" = 0, "createdAt" = NOW()`);
  }

  stashTestOtp(identifier, code);

  if (channel === 'phone') {
    const result = await sendSms({
      to: identifier,
      template: 'otpCode',
      payload: { code, expiryMinutes: OTP_EXPIRY_MINUTES },
    });
    logNotificationDispatchFailure('customer_otp_phone', result);
  } else {
    const result = await sendEmail({
      to: identifier,
      template: 'otpCode',
      payload: `BusBookVN: Ma xac thuc cua ban la ${code}. Ma co hieu luc trong ${OTP_EXPIRY_MINUTES} phut.`,
    });
    logNotificationDispatchFailure('customer_otp_email', result);
  }

  // Outward result stays {ok:true} regardless of delivery outcome (enumeration-safety:
  // never let a send failure become distinguishable from an unknown recipient).
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
  rawIdentifier: string,
  plainCode: string,
  channel: OtpChannel = 'email'
): Promise<VerifyCustomerOtpResult> {
  const identifier = normalizeIdentifier(rawIdentifier, channel);

  const sentinel = await findCustomerLockoutSentinel(identifier, channel);
  if (sentinel) {
    return { status: 'locked_out' };
  }

  type OtpRow = { id: string; codeHash: string; salt: string; attemptCount: number };
  const rows =
    channel === 'phone'
      ? await prisma.$queryRaw<OtpRow[]>(Prisma.sql`
          SELECT id, "codeHash", salt, "attemptCount" FROM "OtpAttempt"
          WHERE phone = ${identifier} AND consumed = false AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1`)
      : await prisma.$queryRaw<OtpRow[]>(Prisma.sql`
          SELECT id, "codeHash", salt, "attemptCount" FROM "OtpAttempt"
          WHERE email = ${identifier} AND consumed = false AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1`);

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
    const activeCheck =
      channel === 'phone'
        ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "OtpAttempt"
            WHERE phone = ${identifier} AND consumed = false AND "expiresAt" > NOW() LIMIT 1`)
        : await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "OtpAttempt"
            WHERE email = ${identifier} AND consumed = false AND "expiresAt" > NOW() LIMIT 1`);
    return activeCheck.length > 0 ? { status: 'mismatch' } : { status: 'gone' };
  }

  return { status: 'ok', otpId: row.id };
}
