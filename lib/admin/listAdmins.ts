/**
 * listAdmins — list all AdminUser rows for the System tab → Admin accounts table
 * (Issue 070). In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003).
 *
 * The admin set is tiny (a handful of operators of the platform itself), so there
 * is no pagination — one ordered read returns everyone. NEVER selects passwordHash
 * or totpSecret: the table only needs identity + role + status + enrollment state.
 *
 * Reuse-by-param: takes the Prisma client as an argument (Next.js-free).
 */

import type { AdminRole, AdminStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db/client';

export interface AdminRow {
  id: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  totpEnabledAt: Date | null;
  invitedBy: string | null;
  createdAt: Date;
}

/** Minimal prisma surface — lets unit tests inject an adminUser.findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'adminUser'>;

export async function listAdmins(prisma: PrismaLike = defaultPrisma): Promise<AdminRow[]> {
  const rows = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      totpEnabledAt: true,
      invitedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    totpEnabledAt: row.totpEnabledAt,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt,
  }));
}
