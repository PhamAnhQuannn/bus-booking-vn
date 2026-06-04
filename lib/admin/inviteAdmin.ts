/**
 * inviteAdmin — provision a new AdminUser of any role, invited by an existing
 * super-admin (Issue 057). SECURITY-CRITICAL.
 *
 * The invitee is created ACTIVE with a one-time temp password (returned ONCE to
 * the inviting super-admin over the authenticated channel; the inviter conveys it
 * to the invitee out-of-band). The invitee enrolls TOTP on first login (Issue 055
 * enrollment_required path) — there is no separate email/SMS dispatch here.
 *
 * FORCED-PASSWORD-CHANGE NOTE (Wave-3 follow-up): AdminUser has no
 * requiresPasswordChange column (unlike OperatorUser), so we cannot force a temp
 * rotation in this slice. Forcing the invitee to rotate the temp password on first
 * login is deferred — do NOT add the column here.
 *
 * Reuse-by-param: takes the Prisma client as an argument (Next.js-free).
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma, type AdminRole } from '@prisma/client';
import { hash } from '@/lib/auth';
import { genTempPassword } from '@/lib/staff/genTempPassword';
import { writeAdminAuditLog } from '@/lib/audit';
import { AdminServiceError } from './errors';

export interface InviteAdminInput {
  /** The authenticated super-admin minting the invite (AdminUser.id). */
  inviterAdminId: string;
  email: string;
  role: AdminRole;
  /** Recorded verbatim in AdminAuditLog.actor (e.g. 'admin:<id>'). */
  actor: string;
}

export interface InviteAdminResult {
  adminUserId: string;
  /** Returned ONCE — conveyed out-of-band by the inviter. Never persisted in plaintext. */
  tempPassword: string;
}

export async function inviteAdmin(
  prisma: PrismaClient,
  input: InviteAdminInput
): Promise<InviteAdminResult> {
  // Defense-in-depth: even though the route enforces requireAdminAuth({role:'SUPER_ADMIN'}),
  // re-verify the inviter is an ACTIVE SUPER_ADMIN at the data layer (the CLI-less
  // core must hold the invariant on its own).
  const inviter = await prisma.adminUser.findUnique({
    where: { id: input.inviterAdminId },
    select: { role: true, status: true },
  });
  if (!inviter || inviter.role !== 'SUPER_ADMIN' || inviter.status !== 'ACTIVE') {
    throw new AdminServiceError('forbidden');
  }

  const tempPassword = genTempPassword();
  const passwordHash = await hash(tempPassword);

  try {
    const adminUserId = await prisma.$transaction(async (tx) => {
      const admin = await tx.adminUser.create({
        data: {
          email: input.email,
          passwordHash,
          role: input.role,
          status: 'ACTIVE',
          invitedBy: input.inviterAdminId,
        },
        select: { id: true },
      });

      await writeAdminAuditLog(tx, {
        actor: input.actor,
        action: 'invite-admin',
        target: admin.id,
        argsRedacted: JSON.stringify({ email: input.email, role: input.role }),
      });

      return admin.id;
    });

    return { adminUserId, tempPassword };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AdminServiceError('email_in_use');
    }
    throw e;
  }
}
