/**
 * createOperator — provision a new Operator + its bootstrap admin OperatorUser
 * from the platform-admin CLI (Issue 020).
 *
 * Reuse-by-param: takes the Prisma client as an argument so the same core runs
 * under the CLI's own PrismaClient and under a test client — keeps this module
 * Next.js-free for the node-only CLI container (AC6).
 *
 * Flow (single $transaction): create Operator → create bootstrap OperatorUser
 * (role=admin, requiresPasswordChange=true) seeded with a one-time temp password
 * → write the AdminAuditLog row. The SMS dispatch + its NotificationLog happen
 * AFTER commit (the esms stub never does network I/O, but we keep the row write
 * out of the tx so a provider failure never rolls back the operator).
 *
 * The temp password is never persisted in plaintext — it lives only in the SMS
 * body. Phone numbers in the audit args are masked via redactPhone().
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { hash } from '@/lib/auth/password';
import { normalizePhone } from '@/lib/core/validation/phone';
import { genTempPassword } from '@/lib/staff/genTempPassword';
import { sendSms } from '@/lib/notification/esms';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';
import { redactPhone } from '@/lib/audit/redactPhone';
import { AdminServiceError } from './errors';

export interface CreateOperatorInput {
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  notificationPhone?: string;
  baseUrl: string;
  /** Who ran the CLI — recorded verbatim in AdminAuditLog.actor. */
  actor: string;
}

export interface CreateOperatorResult {
  operatorId: string;
  operatorUserId: string;
  loginPhone: string;
}

export async function createOperator(
  prisma: PrismaClient,
  input: CreateOperatorInput
): Promise<CreateOperatorResult> {
  const loginPhone = normalizePhone(input.contactPhone);
  const notificationPhone = input.notificationPhone
    ? normalizePhone(input.notificationPhone)
    : loginPhone;
  const tempPassword = genTempPassword();
  const passwordHash = await hash(tempPassword);

  let result: CreateOperatorResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const operator = await tx.operator.create({
        data: {
          legalName: input.legalName,
          contactEmail: input.contactEmail,
          contactPhone: loginPhone,
          notificationPhone,
        },
        select: { id: true },
      });

      const operatorUser = await tx.operatorUser.create({
        data: {
          operatorId: operator.id,
          phone: loginPhone,
          contactPhone: loginPhone,
          notificationPhone,
          passwordHash,
          displayName: input.legalName,
          role: 'admin',
          requiresPasswordChange: true,
        },
        select: { id: true },
      });

      await writeAdminAuditLog(tx, {
        actor: input.actor,
        action: 'create-operator',
        target: operator.id,
        argsRedacted: JSON.stringify({
          legalName: input.legalName,
          contactEmail: input.contactEmail,
          contactPhone: redactPhone(loginPhone),
          notificationPhone: redactPhone(notificationPhone),
        }),
      });

      return {
        operatorId: operator.id,
        operatorUserId: operatorUser.id,
        loginPhone,
      };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AdminServiceError('phone_in_use');
    }
    throw e;
  }

  const loginUrl = `${input.baseUrl}/op/first-login`;
  const smsResult = await sendSms({
    to: loginPhone,
    template: 'operatorAdminTempPassword',
    payload: { phone: loginPhone, tempPassword, loginUrl },
  });

  await prisma.notificationLog.create({
    data: {
      bookingId: null,
      channel: 'sms',
      template: 'operatorAdminTempPassword',
      recipient: loginPhone,
      payload: JSON.stringify({ phone: loginPhone, loginUrl }),
      status: smsResult.ok ? 'sent' : 'failed',
      externalRef: smsResult.externalRef ?? null,
      sentAt: smsResult.ok ? new Date() : null,
    },
  });

  return result;
}
