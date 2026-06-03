/**
 * POST /api/op/auth/forgot-password/reset
 * Body: { otpProof, newPassword }
 * Response: 204 on success. All sessions for that operator are revoked.
 *
 * Errors:
 *   400 WEAK_PASSWORD — newPassword fails validation
 *   401 INVALID_PROOF — otpProof invalid, expired, or wrong purpose
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordResetSchema } from '@/lib/auth/types';
import { verifyOtpProof } from '@/lib/auth/otpProof';
import { hash as hashPassword } from '@/lib/auth/password';
import { revokeAllOperatorSessions } from '@/lib/auth/operatorSession';
import { prisma } from '@/lib/core/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = ForgotPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    const newPwdErrors = parsed.error.issues.filter(i => i.path.includes('newPassword'));
    if (newPwdErrors.length > 0) {
      return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { otpProof, newPassword } = parsed.data;

  const proofPayload = await verifyOtpProof(otpProof, 'op_pwd_reset');
  if (!proofPayload) {
    return NextResponse.json({ error: 'INVALID_PROOF' }, { status: 401 });
  }

  const { phone } = proofPayload;

  const operator = await prisma.operatorUser.findUnique({
    where: { phone },
    select: { id: true, disabledAt: true },
  });

  if (!operator || operator.disabledAt !== null) {
    return NextResponse.json({ error: 'INVALID_PROOF' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);

  await Promise.all([
    prisma.operatorUser.update({
      where: { id: operator.id },
      data: { passwordHash: newHash, requiresPasswordChange: false },
    }),
    revokeAllOperatorSessions(operator.id),
  ]);

  return new NextResponse(null, { status: 204 });
}

export const POST = withErrorHandler(handler);
