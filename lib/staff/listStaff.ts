/**
 * listStaff — all staff members for an operator (Issue 017).
 *
 * Scoped to the caller's operator and role=staff (admins are not listed in the
 * staff roster). Ordered newest-first.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { toStaffDto, type StaffDto } from './toStaffDto';

export async function listStaff(operatorId: string): Promise<StaffDto[]> {
  const rows = await prisma.operatorUser.findMany({
    where: { ...withOperatorScope(operatorId).where, role: 'staff' },
    orderBy: { createdAt: 'desc' },
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

  return rows.map((row) => toStaffDto({ ...row, role: row.role as 'admin' | 'staff' }));
}
