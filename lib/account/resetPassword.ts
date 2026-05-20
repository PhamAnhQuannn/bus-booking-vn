/**
 * Reset password via OTP proof (Issue 008 AC1 — forgot-password reset path).
 *
 * Verifies the 'reset_password' OTP proof JWT (one-shot jti),
 * checks the new password is not reused (verify(oldHash, newPlain) must be false),
 * hashes the new password, and revokes all sessions.
 */

import { prisma } from '@/lib/db/client';
import { verifyOtpProof } from '@/lib/auth/otpProof';
import { verify as verifyPassword, hash as hashPassword } from '@/lib/auth/password';

export type ResetPasswordErrorCode =
  | 'INVALID_PROOF'
  | 'CUSTOMER_NOT_FOUND'
  | 'PASSWORD_REUSED';

export class ResetPasswordError extends Error {
  constructor(public readonly code: ResetPasswordErrorCode) {
    super(code);
    this.name = 'ResetPasswordError';
  }
}

export async function resetPassword(
  otpProof: string,
  newPassword: string
): Promise<void> {
  const proof = await verifyOtpProof(otpProof, 'reset_password');
  if (!proof) throw new ResetPasswordError('INVALID_PROOF');

  const customer = await prisma.customer.findFirst({
    where: { phone: proof.phone, deletedAt: null },
    select: { id: true, passwordHash: true },
  });

  if (!customer) throw new ResetPasswordError('CUSTOMER_NOT_FOUND');

  // Reuse check: verify(oldHash, newPlain) returning true means same password
  if (customer.passwordHash) {
    const sameAsOld = await verifyPassword(customer.passwordHash, newPassword);
    if (sameAsOld) throw new ResetPasswordError('PASSWORD_REUSED');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { passwordHash: newHash },
    });
    // Revoke all sessions
    await tx.session.updateMany({
      where: { customerId: customer.id },
      data: { revokedAt: new Date() },
    });
  });
}
