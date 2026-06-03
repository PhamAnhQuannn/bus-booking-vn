/**
 * getOperatorFleet — in-process fleet loader for the /op/buses server component.
 *
 * Reads bb_op_access cookie, verifies the operator-scope JWT, then calls
 * listOperatorBuses (scoped to operatorId from the JWT claim).
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 * Use this from app/op/buses/page.tsx instead of fetching /api/op/buses.
 *
 * Returns null when not authenticated / operator disabled / missing operatorId.
 */

import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth/jwt';
import { prisma } from '@/lib/core/db/client';
import {
  listOperatorBuses,
  type OperatorBusListItem,
} from '@/lib/catalog/listOperatorBuses';

export interface OperatorFleet {
  operatorId: string;
  buses: OperatorBusListItem[];
  requiresPasswordChange: boolean;
}

export async function getOperatorFleet(opts: { activeOnly?: boolean } = {}): Promise<OperatorFleet | null> {
  const activeOnly = opts.activeOnly ?? true;

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
      disabledAt: true,
      requiresPasswordChange: true,
    },
  });
  if (!operator || operator.disabledAt !== null) return null;

  const buses = await listOperatorBuses(operator.operatorId, { activeOnly });
  return {
    operatorId: operator.operatorId,
    buses,
    requiresPasswordChange: operator.requiresPasswordChange,
  };
}
