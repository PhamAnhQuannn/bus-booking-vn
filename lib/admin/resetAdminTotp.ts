/**
 * resetAdminTotp — clear a target admin's TOTP secret so they must re-enroll on
 * next login (Issue 057, lost-TOTP recovery). SECURITY-CRITICAL.
 *
 * Setting totpSecret=null + totpEnabledAt=null forces the Issue 055
 * verifyLoginTotp enrollment_required path on the target's next login — they
 * re-enroll a fresh authenticator. No new secret is minted here.
 *
 * GUARDS:
 *  - the actor must be an ACTIVE SUPER_ADMIN (re-checked at the data layer);
 *  - NO self-reset — an admin cannot wipe their OWN TOTP (no_self_reset). This
 *    forces lost-TOTP recovery to go through ANOTHER super-admin, preventing a
 *    single compromised session from dropping its own second factor. The dead-end
 *    case (only one super-admin, who lost their TOTP) is handled by the sealed
 *    break-glass CLI, which authorizes via env-seal rather than the actor guard.
 *
 * Reuse-by-param: takes the Prisma client as an argument (Next.js-free) so the
 * web route AND the break-glass CLI share one core.
 */

import type { PrismaClient } from '@prisma/client';
import { writeAdminAuditLog } from '@/lib/audit';
import { AdminServiceError } from './errors';

export interface ResetAdminTotpInput {
  /** The super-admin performing the reset (AdminUser.id). */
  actorAdminId: string;
  /** The admin whose TOTP is being cleared (AdminUser.id). */
  targetAdminId: string;
  /** Recorded verbatim in AdminAuditLog.actor (e.g. 'admin:<id>' or 'cli:break-glass'). */
  actor: string;
  /**
   * Break-glass bypass: skip the actor-is-super-admin web guard. ONLY the sealed
   * break-glass CLI sets this — it is authorized by env-seal, not by an
   * authenticated super-admin session. The no-self-reset guard still applies.
   */
  bypassActorCheck?: boolean;
}

export interface ResetAdminTotpResult {
  ok: true;
}

export async function resetAdminTotp(
  prisma: PrismaClient,
  input: ResetAdminTotpInput
): Promise<ResetAdminTotpResult> {
  // No self-reset — applies even under break-glass.
  if (input.targetAdminId === input.actorAdminId) {
    throw new AdminServiceError('no_self_reset');
  }

  if (!input.bypassActorCheck) {
    const actorAdmin = await prisma.adminUser.findUnique({
      where: { id: input.actorAdminId },
      select: { role: true, status: true },
    });
    if (!actorAdmin || actorAdmin.role !== 'SUPER_ADMIN' || actorAdmin.status !== 'ACTIVE') {
      throw new AdminServiceError('forbidden');
    }
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
      data: { totpSecret: null, totpEnabledAt: null },
    });

    await writeAdminAuditLog(tx, {
      actor: input.actor,
      action: 'reset-admin-totp',
      target: input.targetAdminId,
      argsRedacted: JSON.stringify({ by: input.actorAdminId }),
    });
  });

  return { ok: true };
}
