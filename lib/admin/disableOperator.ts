/**
 * disableOperator — platform-admin kill switch for an operator (Issue 020, AC2).
 *
 * Reuse-by-param Prisma client → Next.js-free for the node-only CLI container.
 *
 * Atomic ($transaction + SELECT ... FOR UPDATE on the Operator row so concurrent
 * disable attempts serialize):
 *   1. Operator.disabledAt = now()  (gates session validation in requireOperatorAuth)
 *   2. every OperatorUser.disabledAt = now()  (gates fresh login — operatorLogin
 *      checks the user-level flag, NOT the operator-level one)
 *   3. revoke every live OperatorSession for those users (kills active sessions)
 *   4. force salesClosed=true on the operator's scheduled trips (blocks new sales)
 *   5. AdminAuditLog row
 *
 * In-flight (already-paid) bookings are untouched — they are honored per AC2.
 * CUID ids are TEXT, so the FOR UPDATE lock uses no ::uuid cast.
 */

import type { PrismaClient } from '@prisma/client';
import { withOperatorScope } from '@/lib/core/db';
import { writeAdminAuditLog } from '@/lib/audit';
import { AdminServiceError } from './errors';

export interface DisableOperatorInput {
  operatorId: string;
  /** Who ran the CLI — recorded verbatim in AdminAuditLog.actor. */
  actor: string;
}

export interface DisableOperatorResult {
  operatorId: string;
  disabledAt: Date;
  usersDisabled: number;
  sessionsRevoked: number;
  tripsClosed: number;
}

export async function disableOperator(
  prisma: PrismaClient,
  input: DisableOperatorInput
): Promise<DisableOperatorResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; disabledAt: Date | null }>>`
      SELECT id, "disabledAt" FROM "Operator" WHERE id = ${input.operatorId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AdminServiceError('operator_not_found');
    }
    if (locked[0].disabledAt !== null) {
      throw new AdminServiceError('already_disabled');
    }

    const now = new Date();

    await tx.operator.update({
      where: { id: input.operatorId },
      data: { disabledAt: now },
    });

    const users = await tx.operatorUser.findMany({
      ...withOperatorScope(input.operatorId),
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    const usersDisabled = await tx.operatorUser.updateMany({
      ...withOperatorScope(input.operatorId, { where: { disabledAt: null } }),
      data: { disabledAt: now },
    });

    const sessionsRevoked =
      userIds.length === 0
        ? { count: 0 }
        : await tx.operatorSession.updateMany({
            where: { operatorUserId: { in: userIds }, revokedAt: null },
            data: { revokedAt: now },
          });

    const tripsClosed = await tx.trip.updateMany({
      where: { ...withOperatorScope(input.operatorId).where, status: 'scheduled', salesClosed: false },
      data: { salesClosed: true },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'disable-operator',
      target: input.operatorId,
      argsRedacted: JSON.stringify({
        usersDisabled: usersDisabled.count,
        sessionsRevoked: sessionsRevoked.count,
        tripsClosed: tripsClosed.count,
      }),
    });

    return {
      operatorId: input.operatorId,
      disabledAt: now,
      usersDisabled: usersDisabled.count,
      sessionsRevoked: sessionsRevoked.count,
      tripsClosed: tripsClosed.count,
    };
  });
}
