/**
 * setAdminRole — change a target AdminUser's role (Issue 070, System tab → Admin
 * accounts). SECURITY-CRITICAL.
 *
 * Updates AdminUser.role to one of SUPER_ADMIN | FINANCE | SUPPORT. The role is
 * authoritative: requireAdminAuth reads the DB role (not the JWT claim) on every
 * request, so a downgrade takes effect within the access-token TTL.
 *
 * GUARDS:
 *  - NO self-role-change (no_self_role_change) — an admin cannot change their OWN
 *    role; prevents a SUPPORT/FINANCE admin from self-escalating to SUPER_ADMIN and
 *    a last super-admin from accidentally demoting themselves out of the realm.
 *    Checked BEFORE any DB read.
 *  - the role must be a valid AdminRole; anything else → no_self_role_change's
 *    sibling validation error (invalid_role is surfaced as a plain reject below).
 *
 * Reuse-by-param: takes the Prisma client as an argument (Next.js-free).
 */

import type { PrismaClient, AdminRole } from '@prisma/client';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';
import { AdminServiceError } from './errors';

/** The valid AdminRole values — guards against an arbitrary string slipping in. */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'] as const;

export interface SetAdminRoleInput {
  /** The super-admin performing the change (AdminUser.id). */
  actorAdminId: string;
  /** The admin whose role is changing (AdminUser.id). */
  targetAdminId: string;
  /** The new role. Validated against ADMIN_ROLES. */
  role: string;
  /** Recorded verbatim in AdminAuditLog.actor (e.g. 'admin:<id>'). */
  actor: string;
}

export interface SetAdminRoleResult {
  ok: true;
}

function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export async function setAdminRole(
  prisma: PrismaClient,
  input: SetAdminRoleInput
): Promise<SetAdminRoleResult> {
  // No self-role-change — checked before any DB read.
  if (input.targetAdminId === input.actorAdminId) {
    throw new AdminServiceError('no_self_role_change');
  }

  if (!isAdminRole(input.role)) {
    throw new AdminServiceError('invalid_role');
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
      data: { role: input.role as AdminRole },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'set-admin-role',
      target: input.targetAdminId,
      argsRedacted: JSON.stringify({ role: input.role }),
    });
  });

  return { ok: true };
}
