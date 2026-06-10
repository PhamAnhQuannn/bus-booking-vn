/**
 * listOperatorPickupAreas — the operator's pickup-area menu (Issue 105).
 *
 * Returns all entries (active + deactivated) ordered by displayOrder; the client
 * filters/labels. Tenant-scoped via withOperatorScope.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { areaSelect, type OperatorPickupAreaDto } from './createOperatorPickupArea';

export async function listOperatorPickupAreas({
  operatorId,
}: {
  operatorId: string;
}): Promise<OperatorPickupAreaDto[]> {
  return prisma.operatorPickupArea.findMany({
    ...withOperatorScope(operatorId),
    orderBy: { displayOrder: 'asc' },
    select: areaSelect,
  });
}
