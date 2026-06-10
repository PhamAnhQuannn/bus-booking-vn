/**
 * operatorAuthService — operator login.
 *
 * operatorLogin({ username, password }) — authenticate an operator user.
 *   - 2026-06-06: login key is the generated username (BRAND_ACRONYM-last4phone),
 *     NOT phone. Phone is contact-only.
 *   - Returns OperatorAuthResult on success
 *   - Throws AuthServiceError('INVALID_CREDENTIALS') on failure (no enumeration)
 *   - Throws AuthServiceError('DISABLED') when disabledAt is set
 */

import { prisma } from '@/lib/core/db/client';
import { verify as verifyPassword, dummyVerify } from './password';
import { issueOperatorSession } from './operatorSession';
import { AuthServiceError } from './authService';

export interface OperatorLoginInput {
  username: string;
  password: string;
}

export interface OperatorAuthResult {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
  operator: {
    id: string;
    username: string;
    displayName: string;
    requiresPasswordChange: boolean;
  };
  requiresPasswordChange: boolean;
}

export async function operatorLogin(input: OperatorLoginInput): Promise<OperatorAuthResult> {
  const username = input.username.trim();

  const user = await prisma.operatorUser.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      passwordHash: true,
      requiresPasswordChange: true,
      disabledAt: true,
      operatorId: true,
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

  const session = await issueOperatorSession(user.id, user.requiresPasswordChange, user.operatorId);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshHash: session.refreshHash,
    operator: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      requiresPasswordChange: user.requiresPasswordChange,
    },
    requiresPasswordChange: user.requiresPasswordChange,
  };
}
