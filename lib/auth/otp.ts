/**
 * OTP utilities: generation, hashing, and CAS-based consumption.
 *
 * generateCode() — 6 digits via crypto.randomInt
 * generateSalt() — 16-byte random hex
 * hashCode(code, salt) — SHA-256 hex
 * consume(email, plainCode) — atomic UPDATE … WHERE consumed=false … RETURNING id
 *   Returns: { status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap', otpId? }
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashCode(code: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${code}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// consume — CAS via raw SQL
// ---------------------------------------------------------------------------

export const MAX_OTP_ATTEMPTS = 5;

export interface ConsumeResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap';
  otpId?: string;
}

/**
 * Atomically consume an OTP for `email`.
 */
export async function consume(
  email: string,
  plainCode: string
): Promise<ConsumeResult> {
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

  if (row.attemptCount >= MAX_OTP_ATTEMPTS) {
    return { status: 'attempt_cap' };
  }

  const expectedHash = hashCode(plainCode, row.salt);

  const expectedBuf = Buffer.from(expectedHash, 'hex');
  const storedBuf = Buffer.from(row.codeHash, 'hex');
  const hashMatch =
    expectedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, storedBuf);

  if (!hashMatch) {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "OtpAttempt"
        SET "attemptCount" = "attemptCount" + 1
        WHERE id = ${row.id}
          AND consumed = false
      `
    );
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
