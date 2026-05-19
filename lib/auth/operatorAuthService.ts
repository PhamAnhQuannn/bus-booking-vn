/**
 * operatorAuthService — operator login.
 *
 * operatorLogin({ phone, password }) — authenticate an operator user.
 *   - Returns OperatorAuthResult on success
 *   - Throws AuthServiceError('INVALID_CREDENTIALS') on failure (no enumeration)
 *   - Throws AuthServiceError('DISABLED') when disabledAt is set
 */

import { prisma } from '@/lib/db/client';
import { normalizePhone } from './phoneNormalize';
import { verify as verifyPassword, dummyVerify } from './password';
import { issueOperatorSession } from './operatorSession';
import { AuthServiceError } from './authService';

export interface OperatorLoginInput {
  phone: string;
  password: string;
}

export interface OperatorAuthResult {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
  operator: {
    id: string;
    phone: string;
    displayName: string;
    requiresPasswordChange: boolean;
  };
  requiresPasswordChange: boolean;
}

export async function operatorLogin(input: OperatorLoginInput): Promise<OperatorAuthResult> {
  const phone = normalizePhone(input.phone);

  const user = await prisma.operatorUser.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      displayName: true,
      passwordHash: true,
      requiresPasswordChange: true,
      disabledAt: true,
    },
  });

  if (!user) {
    await dummyVerify();
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  // Disabled operators cannot log in — use same error to avoid enumeration
  if (user.disabledAt !== null) {
    await dummyVerify();
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const session = await issueOperatorSession(user.id, user.requiresPasswordChange);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshHash: session.refreshHash,
    operator: {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      requiresPasswordChange: user.requiresPasswordChange,
    },
    requiresPasswordChange: user.requiresPasswordChange,
  };
}
