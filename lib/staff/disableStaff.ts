/**
 * disableStaff — deactivate a staff member and kill all their sessions (Issue 017).
 *
 * Atomic: setting disabledAt and revoking every OperatorSession happen in one
 * transaction so a disabled staff member can never retain a live session. The
 * session revoke is inlined here (updateMany on tx) rather than calling
 * revokeAllOperatorSessions, which uses the global prisma client and would
 * escape the transaction.
 *
 * Idempotent: re-disabling an already-disabled staff member is a no-op success.
 * Scoped by (id, operatorId, role=staff) → cross-operator/admin id is not_found.
 */

import { prisma } from '@/lib/core/db/client';
import { StaffServiceError } from './errors';
import { toStaffDto, type StaffDto } from './toStaffDto';

export interface DisableStaffInput {
  operatorId: string;
  staffId: string;
}

export async function disableStaff(input: DisableStaffInput): Promise<StaffDto> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.operatorUser.findFirst({
      where: { id: input.staffId, operatorId: input.operatorId, role: 'staff' },
      select: { id: true, disabledAt: true },
    });
    if (!existing) throw new StaffServiceError('not_found');

    const row = await tx.operatorUser.update({
      where: { id: input.staffId },
      data: { disabledAt: existing.disabledAt ?? new Date() },
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

    await tx.operatorSession.updateMany({
      where: { operatorUserId: input.staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return toStaffDto({ ...row, role: row.role as 'admin' | 'staff' });
  });
}
