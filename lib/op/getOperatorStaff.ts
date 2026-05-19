/**
 * getOperatorStaff — in-process staff loader for the /op/staff server component.
 *
 * Reads bb_op_access cookie, verifies the operator-scope JWT, then calls
 * listStaff (scoped to operatorId from the JWT claim).
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 * Use this from app/op/staff/page.tsx instead of fetching /api/op/staff.
 *
 * Returns null when not authenticated / operator disabled / missing operatorId.
 * isAdmin reflects the JWT role claim — the page renders read-only for staff.
 */

import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/client';
import { listStaff } from '@/lib/staff/listStaff';
import type { StaffDto } from '@/lib/staff/toStaffDto';

export interface OperatorStaffView {
  operatorId: string;
  staff: StaffDto[];
  requiresPasswordChange: boolean;
  isAdmin: boolean;
}

export async function getOperatorStaff(): Promise<OperatorStaffView | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;
  if (!token) return null;

  const payload = await verifyOperatorAccess(token);
  if (!payload) return null;

  const operator = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      operatorId: true,
      role: true,
      disabledAt: true,
      requiresPasswordChange: true,
    },
  });
  if (!operator || operator.disabledAt !== null) return null;

  const staff = await listStaff(operator.operatorId);
  return {
    operatorId: operator.operatorId,
    staff,
    requiresPasswordChange: operator.requiresPasswordChange,
    isAdmin: operator.role === 'admin',
  };
}
