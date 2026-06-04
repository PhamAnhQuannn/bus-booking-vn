/**
 * resetOperatorAdminPassword — regenerate an operator admin's temp password
 * from the platform-admin CLI (Issue 020, AC3).
 *
 * Reuse-by-param Prisma client → Next.js-free for the node-only CLI container.
 *
 * Atomic ($transaction + SELECT ... FOR UPDATE on the OperatorUser row):
 *   1. set a fresh hashed temp password
 *   2. requiresPasswordChange = true  (forces rotation on next login)
 *   3. revoke every live OperatorSession for the user (the old refresh token is
 *      invalidated — AC3: reset invalidates the refresh token)
 *   4. AdminAuditLog row
 *
 * The new temp password is SMS'd after commit (esms stub is non-network, but the
 * dispatch + NotificationLog stay outside the tx so a provider failure can't roll
 * back the credential rotation). Plaintext lives only in the SMS body.
 */

import type { PrismaClient } from '@prisma/client';
import { hash } from '@/lib/auth';
import { genTempPassword } from '@/lib/staff';
import { sendSms } from '@/lib/notification';
import { writeAdminAuditLog } from '@/lib/audit';
import { redactPhone } from '@/lib/audit';
import { AdminServiceError } from './errors';

export interface ResetOperatorAdminPasswordInput {
  operatorUserId: string;
  baseUrl: string;
  /** Who ran the CLI — recorded verbatim in AdminAuditLog.actor. */
  actor: string;
}

export interface ResetOperatorAdminPasswordResult {
  operatorUserId: string;
  phone: string;
  sessionsRevoked: number;
}

export async function resetOperatorAdminPassword(
  prisma: PrismaClient,
  input: ResetOperatorAdminPasswordInput
): Promise<ResetOperatorAdminPasswordResult> {
  const tempPassword = genTempPassword();
  const passwordHash = await hash(tempPassword);

  const { phone, sessionsRevoked } = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "OperatorUser" WHERE id = ${input.operatorUserId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AdminServiceError('operator_user_not_found');
    }

    const now = new Date();

    const user = await tx.operatorUser.update({
      where: { id: input.operatorUserId },
      data: { passwordHash, requiresPasswordChange: true },
      select: { phone: true },
    });

    const revoked = await tx.operatorSession.updateMany({
      where: { operatorUserId: input.operatorUserId, revokedAt: null },
      data: { revokedAt: now },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'reset-operator-admin-password',
      target: input.operatorUserId,
      argsRedacted: JSON.stringify({
        phone: redactPhone(user.phone),
        sessionsRevoked: revoked.count,
      }),
    });

    return { phone: user.phone, sessionsRevoked: revoked.count };
  });

  const loginUrl = `${input.baseUrl}/op/first-login`;
  const smsResult = await sendSms({
    to: phone,
    template: 'operatorAdminTempPassword',
    payload: { phone, tempPassword, loginUrl },
  });

  await prisma.notificationLog.create({
    data: {
      bookingId: null,
      channel: 'sms',
      template: 'operatorAdminTempPassword',
      recipient: phone,
      payload: JSON.stringify({ phone, loginUrl }),
      status: smsResult.ok ? 'sent' : 'failed',
      externalRef: smsResult.externalRef ?? null,
      sentAt: smsResult.ok ? new Date() : null,
    },
  });

  return { operatorUserId: input.operatorUserId, phone, sessionsRevoked };
}
