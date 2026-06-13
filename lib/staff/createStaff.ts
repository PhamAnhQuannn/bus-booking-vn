/**
 * createStaff — provision a staff OperatorUser scoped to an operator (Issue 017).
 *
 * Flow: normalize phone → generate a one-time temp password → hash it →
 * create the row (role=staff, requiresPasswordChange=true) → SMS the temp
 * password once → audit the dispatch in NotificationLog.
 *
 * The temp password is never persisted in plaintext; it lives only in the SMS
 * body. contactPhone/notificationPhone are NOT NULL on OperatorUser, so we seed
 * both from the staff member's login phone.
 *
 * P2002 (unique phone collision) maps to StaffServiceError('phone_in_use') → 409.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { hash } from '@/lib/auth';
import { normalizePhone } from '@/lib/core/validation/phone';
import { sendSms } from '@/lib/notification';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';
import { genTempPassword } from './genTempPassword';
import { buildUsername, ensureUniqueUsername } from '@/lib/auth';
import { StaffServiceError } from './errors';
import { toStaffDto, type StaffDto } from './toStaffDto';

export interface CreateStaffInput {
  operatorId: string;
  name: string;
  phone: string;
  baseUrl: string;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffDto> {
  const phone = normalizePhone(input.phone);
  const tempPassword = genTempPassword();
  const passwordHash = await hash(tempPassword);

  // 2026-06-06: staff log in by generated username (BRAND_ACRONYM-last4phone), not phone.
  const operator = await prisma.operator.findUnique({
    where: { id: input.operatorId },
    select: { brandName: true, legalName: true },
  });
  if (!operator) throw new StaffServiceError('not_found');
  const usernameBase = buildUsername(operator.brandName ?? operator.legalName, phone);

  let row;
  try {
    row = await prisma.$transaction(async (tx) => {
      const username = await ensureUniqueUsername(tx, usernameBase);
      return tx.operatorUser.create({
      data: {
        operatorId: input.operatorId,
        username,
        phone,
        contactPhone: phone,
        notificationPhone: phone,
        passwordHash,
        displayName: input.name,
        role: 'staff',
        requiresPasswordChange: true,
      },
      select: {
        id: true,
        displayName: true,
        phone: true,
        role: true,
        requiresPasswordChange: true,
        disabledAt: true,
        assignedTripId: true,
        createdAt: true,
      },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new StaffServiceError('phone_in_use');
    }
    throw e;
  }

  const loginUrl = `${input.baseUrl}/op/first-login`;
  const smsResult = await sendSms({
    to: phone,
    template: 'staffTempPassword',
    payload: { phone, tempPassword, loginUrl },
  });

  await createNotificationLog({
    bookingId: null,
    template: 'staffTempPassword',
    recipient: phone,
    payload: JSON.stringify({ phone, loginUrl }),
    status: smsResult.ok ? 'sent' : 'failed',
    externalRef: smsResult.externalRef ?? null,
    sentAt: smsResult.ok ? new Date() : null,
    attemptCount: smsResult.ok ? 1 : 5,
  });

  return toStaffDto({ ...row, role: row.role as 'admin' | 'staff' });
}
