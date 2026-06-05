/**
 * bootstrapSuperAdmin — provision the FIRST platform SUPER_ADMIN (Issue 057).
 *
 * SECURITY-CRITICAL. This is the genesis credential for the entire admin realm:
 * there is no in-app way to create the first super-admin (every admin-creating
 * route requires an authenticated super-admin), so this core is driven ONLY by a
 * sealed CLI (scripts/admin/bootstrapSuperAdmin.ts) reading out-of-band env. NO
 * public/web route exposes it.
 *
 * Reuse-by-param: takes the Prisma client as an argument so the same core runs
 * under the CLI's own PrismaClient and under a test client — keeps this module
 * Next.js-free for the node-only CLI container.
 *
 * IDEMPOTENT re-run guard: if ANY SUPER_ADMIN already exists, this returns the
 * existing id with created:false and makes NO write — re-running the bootstrap
 * CLI can never mint a second genesis admin.
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { hash } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { AdminServiceError } from './errors';

export interface BootstrapSuperAdminInput {
  email: string;
  password: string;
  /** Who ran the bootstrap — recorded verbatim in AdminAuditLog.actor (e.g. 'cli:bootstrap'). */
  actor: string;
}

export interface BootstrapSuperAdminResult {
  created: boolean;
  adminUserId: string;
}

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  input: BootstrapSuperAdminInput
): Promise<BootstrapSuperAdminResult> {
  // Re-run guard: a SUPER_ADMIN already exists → no-op, return its id.
  const existing = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (existing) {
    return { created: false, adminUserId: existing.id };
  }

  const passwordHash = await hash(input.password);

  try {
    const adminUserId = await prisma.$transaction(async (tx) => {
      const admin = await tx.adminUser.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          invitedBy: null,
        },
        select: { id: true },
      });

      await writeAdminAuditLog(tx, {
        actor: input.actor,
        action: 'bootstrap-super-admin',
        target: admin.id,
        argsRedacted: JSON.stringify({ email: input.email }),
      });

      return admin.id;
    });

    return { created: true, adminUserId };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AdminServiceError('email_in_use');
    }
    throw e;
  }
}
