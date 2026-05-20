/**
 * listOperators — read-only operator roster for the platform-admin CLI
 * (Issue 020). No AdminAuditLog row (audit is for write actions only).
 *
 * Reuse-by-param Prisma client → Next.js-free for the node-only CLI container.
 */

import type { PrismaClient } from '@prisma/client';

export interface OperatorRosterRow {
  id: string;
  legalName: string;
  contactPhone: string;
  disabledAt: Date | null;
  createdAt: Date;
}

export async function listOperators(prisma: PrismaClient): Promise<OperatorRosterRow[]> {
  return prisma.operator.findMany({
    select: {
      id: true,
      legalName: true,
      contactPhone: true,
      disabledAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
