/**
 * getOperatorProfile — in-process operator profile loader for server components.
 *
 * Reads bb_op_access cookie, verifies JWT, fetches OperatorUser from DB.
 * Returns null when the operator is not authenticated or disabled.
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 * Call this instead of fetching /api/op/profile from a server component.
 */

import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { prisma } from '@/lib/core/db/client';

export interface OperatorProfile {
  id: string;
  phone: string;
  displayName: string | null;
  contactPhone: string | null;
  notificationPhone: string | null;
  requiresPasswordChange: boolean;
  role: string;
}

export async function getOperatorProfile(): Promise<OperatorProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;
  if (!token) return null;

  const payload = await verifyOperatorAccess(token);
  if (!payload) return null;

  const operator = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      phone: true,
      displayName: true,
      contactPhone: true,
      notificationPhone: true,
      requiresPasswordChange: true,
      role: true,
      disabledAt: true,
    },
  });

  if (!operator || operator.disabledAt !== null) return null;

  return {
    id: operator.id,
    phone: operator.phone,
    displayName: operator.displayName,
    contactPhone: operator.contactPhone,
    notificationPhone: operator.notificationPhone,
    requiresPasswordChange: operator.requiresPasswordChange,
    role: operator.role,
  };
}
