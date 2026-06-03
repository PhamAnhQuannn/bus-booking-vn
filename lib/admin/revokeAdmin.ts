/**
 * revokeAdmin — disable a target AdminUser so they can no longer authenticate
 * (Issue 070, System tab → Admin accounts). SECURITY-CRITICAL.
 *
 * Sets the target's AdminUser.status = 'DISABLED'. There is NO separate session
 * table to clear: requireAdminAuth re-reads the AdminUser row on EVERY request and
 * rejects any non-ACTIVE admin (401), and the access token is short-TTL (600s), so
 * a DISABLED admin's in-flight token stops working within that TTL with no extra
 * eviction step. The DISABLED status is therefore the single source of truth that
 * "revoking also kills their sessions".
 *
 * GUARDS:
 *  - NO self-revoke (no_self_revoke) — an admin cannot disable their OWN account;
 *    this prevents a single compromised session from locking everyone out (or a
 *    last super-admin self-destructing the realm). Checked BEFORE any DB read.
 *
 * Reuse-by-param: takes the Prisma client as an argument (Next.js-free) so the web
 * route and any future CLI share one core.
 */

import type { PrismaClient } from '@prisma/client';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';
import { AdminServiceError } from './errors';

export interface RevokeAdminInput {
  /** The super-admin performing the revoke (AdminUser.id). */
  actorAdminId: string;
  /** The admin being disabled (AdminUser.id). */
  targetAdminId: string;
  /** Recorded verbatim in AdminAuditLog.actor (e.g. 'admin:<id>'). */
  actor: string;
}

export interface RevokeAdminResult {
  ok: true;
}

export async function revokeAdmin(
  prisma: PrismaClient,
  input: RevokeAdminInput
): Promise<RevokeAdminResult> {
  // No self-revoke — checked before any DB read.
  if (input.targetAdminId === input.actorAdminId) {
    throw new AdminServiceError('no_self_revoke');
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: input.targetAdminId },
    select: { id: true },
  });
  if (!target) {
    throw new AdminServiceError('admin_not_found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: input.targetAdminId },
      data: { status: 'DISABLED' },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'revoke-admin',
      target: input.targetAdminId,
      argsRedacted: JSON.stringify({ by: input.actorAdminId }),
    });
  });

  return { ok: true };
}
