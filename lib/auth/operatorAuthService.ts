/**
 * operatorAuthService — operator login (2-step when email is set).
 *
 * operatorLogin({ username, password }) — authenticate an operator user.
 *   - 2026-06-06: login key is the generated username (BRAND_ACRONYM-last4phone),
 *     NOT phone. Phone is contact-only.
 *   - When OperatorUser.email is set: returns { otpRequired: true, loginChallenge, maskedEmail }
 *     and sends OTP to email. Caller must verify via verifyOperatorLoginOtp + verifyOtpProof.
 *   - When OperatorUser.email is null: returns full session directly (password-only fallback).
 *   - Throws AuthServiceError('INVALID_CREDENTIALS') on failure (no enumeration)
 *   - Throws AuthServiceError('DISABLED') when disabledAt is set
 *
 * operatorLoginStep2(loginChallenge) — complete login after OTP verification.
 *   Verifies the loginChallenge JWT, issues a full session.
 */

import { prisma } from '@/lib/core/db/client';
import { verify as verifyPassword, dummyVerify } from './password';
import { issueOperatorSession } from './operatorSession';
import { AuthServiceError } from './authService';
import { issueOtpProof } from './otpProof';
import { sendOperatorLoginOtp } from './operatorLoginOtp';

export interface OperatorLoginInput {
  username: string;
  password: string;
}

export interface OperatorAuthResult {
  otpRequired: false;
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

export interface OperatorOtpRequiredResult {
  otpRequired: true;
  loginChallenge: string;
  maskedEmail: string;
}

export type OperatorLoginResult = OperatorAuthResult | OperatorOtpRequiredResult;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function operatorLogin(input: OperatorLoginInput): Promise<OperatorLoginResult> {
  const username = input.username.trim();

  const user = await prisma.operatorUser.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      email: true,
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

  if (user.disabledAt !== null) {
    await dummyVerify();
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  // 2FA: if operator has email, require OTP verification
  if (user.email) {
    const otpResult = await sendOperatorLoginOtp(user.email);
    if (!otpResult.ok) {
      throw new AuthServiceError(
        otpResult.reason === 'locked_out' ? 'OTP_LOCKED_OUT' : 'OTP_RATE_LIMITED'
      );
    }
    const loginChallenge = await issueOtpProof(user.id, 'op_login');
    return {
      otpRequired: true,
      loginChallenge,
      maskedEmail: maskEmail(user.email),
    };
  }

  // No email → password-only login (Phase 1 fallback)
  const session = await issueOperatorSession(user.id, user.requiresPasswordChange, user.operatorId);

  return {
    otpRequired: false,
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

/**
 * Complete operator login after OTP verification.
 * Called by the verify-otp route after validating both the loginChallenge JWT
 * and the OTP code.
 */
export async function operatorLoginStep2(operatorUserId: string): Promise<OperatorAuthResult> {
  const user = await prisma.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      requiresPasswordChange: true,
      disabledAt: true,
      operatorId: true,
    },
  });

  if (!user || user.disabledAt !== null) {
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const session = await issueOperatorSession(user.id, user.requiresPasswordChange, user.operatorId);

  return {
    otpRequired: false,
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
