/**
 * getOperatorSession — minimal in-process auth resolver for server components.
 *
 * Returns { operatorId, requiresPasswordChange } when authenticated, null otherwise.
 * Avoids loading full profile data — use getOperatorProfile when you need PII fields.
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 */

import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/client';

export interface OperatorSession {
  operatorId: string;
  requiresPasswordChange: boolean;
  /** OperatorUser row id (JWT sub) — needed for badge tracking + ownership writes. */
  operatorUserId: string;
  /** Operator role — gates admin-only nav/actions. */
  role: 'admin' | 'staff';
}

export async function getOperatorSession(): Promise<OperatorSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;
  if (!token) return null;

  const payload = await verifyOperatorAccess(token);
  if (!payload) return null;

  const operator = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: {
      operatorId: true,
      disabledAt: true,
      requiresPasswordChange: true,
    },
  });
  if (!operator || operator.disabledAt !== null) return null;

  return {
    operatorId: operator.operatorId,
    requiresPasswordChange: operator.requiresPasswordChange,
    operatorUserId: payload.sub,
    role: payload.role,
  };
}
