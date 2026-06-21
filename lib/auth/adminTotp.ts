/**
 * adminTotp — TOTP enrollment + login/step-up verification for the admin realm
 * (Issue 055). Builds on the RFC-validated primitive in lib/auth/totp.ts.
 *
 * Enrollment is two-phase so a mis-scanned QR can't lock an admin out:
 *   beginEnrollment   — generate + persist a secret (totpSecret set, totpEnabledAt NULL).
 *   confirmEnrollment — verify the admin's first code against the stored secret,
 *                       and ONLY THEN set totpEnabledAt (TOTP becomes active).
 *
 * verifyLoginTotp is the per-login (and step-up) gate against the active secret.
 *
 * SECURITY:
 *  - beginEnrollment refuses to silently rotate an already-enabled secret
 *    (throws 'already_enrolled'); re-enrollment is a step-up-gated flow, not a
 *    side effect of hitting the enroll endpoint again.
 *  - The plaintext secret leaves this module ONLY from beginEnrollment (the admin
 *    must see it once to add it to their authenticator). All other paths read the
 *    secret internally and never return it. `totpSecret` is in the logger redact list.
 */

import { prisma } from '@/lib/core/db/client';
import { generateTotpSecret, totpAuthUri, verifyTotp } from './totp';
import { encryptTotpSecret, decryptTotpSecret } from './totpCrypto';
import { consumeJti } from './otpProof';

export interface BeginEnrollmentResult {
  secret: string;
  otpauthUri: string;
}

export type ConfirmEnrollmentResult =
  | { ok: true }
  | { ok: false; reason: 'not_started' | 'bad_code' };

export type VerifyLoginTotpResult =
  | { ok: true }
  | { ok: false; reason: 'enrollment_required' | 'bad_code' | 'code_already_used' };

/**
 * Phase 1 of enrollment: generate a fresh secret, persist it WITHOUT enabling TOTP,
 * and return the secret + otpauth URI for the authenticator app.
 *
 * Throws 'already_enrolled' if TOTP is already active (totpEnabledAt set) — we do
 * NOT silently rotate an active secret; re-enrollment is a separate step-up-gated
 * flow (a stray re-POST to enroll must never invalidate a working authenticator).
 */
export async function beginEnrollment(adminId: string): Promise<BeginEnrollmentResult> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { email: true, totpEnabledAt: true },
  });
  if (!admin) throw new Error('admin_not_found');
  if (admin.totpEnabledAt !== null) throw new Error('already_enrolled');

  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpSecret: encryptTotpSecret(secret) },
  });

  return { secret, otpauthUri: totpAuthUri(secret, admin.email) };
}

/**
 * Phase 2 of enrollment: verify the admin's first code against the stored secret.
 * On success, set totpEnabledAt=now() (TOTP is now active for login). On a wrong
 * code, leave totpEnabledAt NULL so the admin can retry without re-scanning.
 */
export async function confirmEnrollment(
  adminId: string,
  code: string
): Promise<ConfirmEnrollmentResult> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { totpSecret: true },
  });
  if (!admin || !admin.totpSecret) {
    return { ok: false, reason: 'not_started' };
  }

  const plainSecret = decryptTotpSecret(admin.totpSecret);
  if (!verifyTotp(plainSecret, code)) {
    return { ok: false, reason: 'bad_code' };
  }

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpEnabledAt: new Date() },
  });

  return { ok: true };
}

/**
 * Verify a TOTP code for login or step-up against the admin's ACTIVE secret.
 * If TOTP is not yet enabled (totpEnabledAt NULL) the caller must route the admin
 * through enrollment first → { ok: false, reason: 'enrollment_required' }.
 */
export async function verifyLoginTotp(
  adminId: string,
  code: string
): Promise<VerifyLoginTotpResult> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { totpSecret: true, totpEnabledAt: true },
  });

  if (!admin || admin.totpEnabledAt === null || !admin.totpSecret) {
    return { ok: false, reason: 'enrollment_required' };
  }

  const plainSecret = decryptTotpSecret(admin.totpSecret);
  if (!verifyTotp(plainSecret, code)) {
    return { ok: false, reason: 'bad_code' };
  }

  // HD-012: TOTP replay protection — SETNX prevents same code reuse within ±1 window (90s)
  const consumed = await consumeJti(`totp-replay:${adminId}:${code}`, 90);
  if (!consumed) {
    return { ok: false, reason: 'code_already_used' };
  }

  return { ok: true };
}
