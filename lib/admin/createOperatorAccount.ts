/**
 * createOperatorAccount — admin-console provisioning of an operator's bootstrap
 * login account from an EXISTING application (2026-06-06, S05).
 *
 * Differs from createOperator (CLI, creates the Operator from scratch): this takes
 * an `operatorId` that already exists as a PENDING_REVIEW application (submitted via
 * the public /op/register form) and mints the login account for it.
 *
 * Flow (single $transaction):
 *   1. Load the Operator application; 404 if missing.
 *   2. Guard against double-provisioning — if any OperatorUser already exists for
 *      this operator, throw account_already_exists (409).
 *   3. Generate username = BRAND_ACRONYM-last4phone (collision-suffixed) + a 12-char
 *      crypto temp password.
 *   4. Create the bootstrap OperatorUser (role=admin, requiresPasswordChange=true).
 *   5. Flip Operator.status → APPROVED.
 *   6. Write the AdminAuditLog row.
 * After commit, enqueue the account-created email (operatorAccountCreated) as a
 * pending NotificationLog row; the dispatch cron delivers it (email sender is a stub
 * today).
 *
 * SECURITY: the temp password is NOT persisted anywhere — not on OperatorUser (only
 * its bcrypt hash) and NOT in the NotificationLog email body. It is returned ONCE to
 * the admin caller for on-screen relay only. The email carries just the username + a
 * self-serve set-password link (the OTP-backed /op/forgot-password flow), so no
 * cleartext credential is ever written to the NotificationLog table.
 */

import type { PrismaClient } from '@prisma/client';
import { hash } from '@/lib/auth';
import { genTempPassword } from '@/lib/staff';
import { writeAdminAuditLog, redactPhone } from '@/lib/audit';
import { buildUsername, ensureUniqueUsername } from '@/lib/auth';
import { AdminServiceError } from './errors';

export interface CreateOperatorAccountInput {
  operatorId: string;
  baseUrl: string;
  /** Admin who triggered the action — recorded in AdminAuditLog.actor. */
  actor: string;
}

export interface CreateOperatorAccountResult {
  operatorUserId: string;
  username: string;
  /** Plaintext temp password — returned ONCE to the admin for on-screen relay; never
   *  persisted and never emailed (the email links to the OTP set-password flow). */
  tempPassword: string;
}

function renderAccountCreatedBody(username: string, loginUrl: string, setupUrl: string): string {
  return [
    'Tài khoản nhà xe của bạn trên BusBookVN đã được tạo.',
    '',
    `Tên đăng nhập: ${username}`,
    '',
    'Để đặt mật khẩu, hãy dùng liên kết bên dưới (xác thực bằng mã OTP gửi tới số',
    'điện thoại đã đăng ký):',
    setupUrl,
    '',
    `Sau đó đăng nhập tại: ${loginUrl}`,
  ].join('\n');
}

export async function createOperatorAccount(
  prisma: PrismaClient,
  input: CreateOperatorAccountInput,
): Promise<CreateOperatorAccountResult> {
  const tempPassword = genTempPassword();
  const passwordHash = await hash(tempPassword);

  const result = await prisma.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: input.operatorId },
      select: {
        id: true,
        brandName: true,
        legalName: true,
        contactEmail: true,
        contactPhone: true,
        notificationPhone: true,
      },
    });
    if (!operator) throw new AdminServiceError('operator_not_found');

    const existing = await tx.operatorUser.count({ where: { operatorId: operator.id } });
    if (existing > 0) throw new AdminServiceError('account_already_exists');

    const displayName = operator.brandName ?? operator.legalName;
    const username = await ensureUniqueUsername(
      tx,
      buildUsername(displayName, operator.contactPhone),
    );

    const operatorUser = await tx.operatorUser.create({
      data: {
        operatorId: operator.id,
        username,
        phone: operator.contactPhone,
        contactPhone: operator.contactPhone,
        notificationPhone: operator.notificationPhone ?? operator.contactPhone,
        passwordHash,
        displayName,
        role: 'admin',
        requiresPasswordChange: true,
      },
      select: { id: true },
    });

    await tx.operator.update({
      where: { id: operator.id },
      data: { status: 'APPROVED' },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'create-operator-account',
      target: operator.id,
      argsRedacted: JSON.stringify({
        username,
        contactPhone: redactPhone(operator.contactPhone),
      }),
    });

    return { operatorUserId: operatorUser.id, username, contactEmail: operator.contactEmail };
  });

  // Account-created email enqueued AFTER commit so a delivery row never rolls back the
  // account. The dispatch cron delivers it (email sender is a stub today). The body
  // carries NO password — only the username + the OTP-backed set-password link.
  const loginUrl = `${input.baseUrl}/op/login`;
  const setupUrl = `${input.baseUrl}/op/forgot-password`;
  if (result.contactEmail) {
    await prisma.notificationLog.create({
      data: {
        bookingId: null,
        channel: 'email',
        template: 'operatorAccountCreated',
        recipient: result.contactEmail,
        // Pre-rendered body — the dispatcher passes payload straight to sendEmail.
        payload: renderAccountCreatedBody(result.username, loginUrl, setupUrl),
        status: 'pending',
      },
    });
  }

  return {
    operatorUserId: result.operatorUserId,
    username: result.username,
    tempPassword,
  };
}
