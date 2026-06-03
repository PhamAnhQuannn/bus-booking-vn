/**
 * listOperatorBuses — list operator-scoped buses.
 *
 * AC1: returns buses where operatorId matches AND (activeOnly ? deactivatedAt IS NULL : *).
 * AC6: cross-operator isolation — only buses with operatorId === arg are ever returned.
 * Sort: createdAt DESC (newest first) — Bus has no createdAt column in current schema,
 *   so we sort by id DESC as a proxy (cuid is time-sortable lexically) until a createdAt
 *   column is added. Stable for list-view consumers.
 */

import { prisma } from '@/lib/db/client';
import { withOperatorScope } from '@/lib/core/db';

export interface OperatorBusListItem {
  id: string;
  licensePlate: string;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
  deactivatedAt: Date | null;
}

export async function listOperatorBuses(
  operatorId: string,
  opts: { activeOnly: boolean }
): Promise<OperatorBusListItem[]> {
  const rows = await prisma.bus.findMany({
    // SYS20 rule 5: operator-owned read goes through the tenant-scope one-way door
    // (lib/core/db) rather than inlining `where: { operatorId }`. Behavior identical.
    ...withOperatorScope(operatorId, {
      where: {
        ...(opts.activeOnly ? { deactivatedAt: null } : {}),
      },
    }),
    select: {
      id: true,
      licensePlate: true,
      capacity: true,
      busType: true,
      deactivatedAt: true,
    },
    orderBy: { id: 'desc' },
  });
  return rows;
}
