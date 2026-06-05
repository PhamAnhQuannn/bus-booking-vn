/**
 * Change password for authenticated customer (Issue 008 AC2).
 *
 * Requires current password (verified via argon2/scrypt).
 * New password must differ from old (verify(oldHash, newPlain) must return false).
 * On success: hashes new password, revokes ALL sessions (updateMany revokedAt).
 */

import { prisma } from '@/lib/core/db/client';
import { verify as verifyPassword, hash as hashPassword } from '@/lib/auth';

export type ChangePasswordErrorCode =
  | 'CURRENT_PASSWORD_WRONG'
  | 'PASSWORD_REUSED'
  | 'CUSTOMER_NOT_FOUND';

export class ChangePasswordError extends Error {
  constructor(public readonly code: ChangePasswordErrorCode) {
    super(code);
    this.name = 'ChangePasswordError';
  }
}

export async function changePassword(
  customerId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, passwordHash: true },
  });

  if (!customer || !customer.passwordHash) {
    throw new ChangePasswordError('CUSTOMER_NOT_FOUND');
  }

  // Verify current password
  const currentValid = await verifyPassword(customer.passwordHash, currentPassword);
  if (!currentValid) {
    throw new ChangePasswordError('CURRENT_PASSWORD_WRONG');
  }

  // Reuse check: verify(oldHash, newPlain) returning true means same password
  const sameAsOld = await verifyPassword(customer.passwordHash, newPassword);
  if (sameAsOld) {
    throw new ChangePasswordError('PASSWORD_REUSED');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { passwordHash: newHash },
    });
    // Revoke ALL sessions (design decision #2)
    await tx.session.updateMany({
      where: { customerId: customer.id },
      data: { revokedAt: new Date() },
    });
  });
}
