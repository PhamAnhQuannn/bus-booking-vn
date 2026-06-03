/**
 * updateStaff — rename a staff member (Issue 017).
 *
 * V1 is displayName-only; role is immutable through this path. Scoped by
 * (id, operatorId) so a cross-operator id resolves to not_found (404), never
 * a silent edit of another operator's staff.
 */

import { prisma } from '@/lib/core/db/client';
import { StaffServiceError } from './errors';
import { toStaffDto, type StaffDto } from './toStaffDto';

export interface UpdateStaffInput {
  operatorId: string;
  staffId: string;
  name: string;
}

export async function updateStaff(input: UpdateStaffInput): Promise<StaffDto> {
  const existing = await prisma.operatorUser.findFirst({
    where: { id: input.staffId, operatorId: input.operatorId, role: 'staff' },
    select: { id: true },
  });
  if (!existing) throw new StaffServiceError('not_found');

  const row = await prisma.operatorUser.update({
    where: { id: input.staffId },
    data: { displayName: input.name },
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

  return toStaffDto({ ...row, role: row.role as 'admin' | 'staff' });
}
