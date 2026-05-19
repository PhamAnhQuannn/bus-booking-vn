/**
 * OTP utilities: generation, hashing, and CAS-based consumption.
 *
 * generateCode() — 6 digits via crypto.randomInt
 * generateSalt() — 16-byte random hex
 * hashCode(code, salt) — SHA-256 hex
 * consume(phone, plainCode) — atomic UPDATE … WHERE consumed=false … RETURNING id
 *   Returns: { status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap', otpId? }
 *
 * The CAS pattern mirrors lib/db/bookingRepo.ts: $executeRaw with Prisma.sql
 * template tag for parameterised queries — never $executeRawUnsafe.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Generate a 6-digit OTP code as a zero-padded string.
 */
export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Generate a 16-byte random salt as a lowercase hex string (32 chars).
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash an OTP code with a salt using SHA-256.
 * Returns 64-char lowercase hex digest.
 */
export function hashCode(code: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${code}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// consume — CAS via raw SQL
// ---------------------------------------------------------------------------

/** Maximum wrong-code attempts before the OTP is locked (AC7). */
export const MAX_OTP_ATTEMPTS = 5;

export interface ConsumeResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap';
  otpId?: string;
}

/**
 * Atomically consume an OTP for `phone`.
 *
 * 1. UPDATE OtpAttempt SET consumed=true WHERE phone=$1 AND consumed=false
 *    AND expiresAt > NOW() AND codeHash=$2 RETURNING id
 *    → if 1 row returned: status='ok'
 *    → if 0 rows returned: fall through to mismatch/gone
 *
 * 2. On miss, increment attemptCount on the active row (don't consume it).
 *
 * 3. Lookup active row (consumed=false, expiresAt > NOW()):
 *    → exists → status='mismatch'
 *    → absent → status='gone'
 */
export async function consume(
  phone: string,
  plainCode: string
): Promise<ConsumeResult> {
  // We need the stored salt to verify. Look up the active row first to get salt+codeHash.
  // Then do the CAS update using the stored codeHash.
  //
  // Why not pass plainCode directly to SQL? We store codeHash (SHA-256), not the
  // plain code. The DB has no SHA-256 function in scope here, so we compute the
  // expected hash in application code by fetching the salt from the active row.

  // Step 1: fetch active OTP row for this phone to get salt + attemptCount
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

  // Attempt cap check: if already at MAX wrong attempts, block without incrementing.
  // Semantic: the (MAX_OTP_ATTEMPTS)th wrong code returns 'mismatch' (count becomes MAX),
  // the (MAX_OTP_ATTEMPTS+1)th call sees count >= MAX and returns 'attempt_cap'.
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
    // Wrong code — increment attemptCount but don't consume
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

  // Step 2: CAS — atomically consume the row
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
    // Race: another request consumed it between our read and this update
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
