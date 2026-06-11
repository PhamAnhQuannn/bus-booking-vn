/**
 * listRoutePickupAreas — the subset of the operator's pickup-area menu assigned to a
 * single route (Issue 113). Returns active areas only, ordered by displayOrder, in the
 * same OperatorPickupAreaDto shape so the new-trip picker reuses existing types.
 *
 * Tenant-guarded: the route must belong to the operator (cross-op → not_found → []).
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { areaSelect, type OperatorPickupAreaDto } from './createOperatorPickupArea';

export async function listRoutePickupAreas({
  operatorId,
  routeId,
}: {
  operatorId: string;
  routeId: string;
}): Promise<OperatorPickupAreaDto[]> {
  // Confirm the route is operator-owned before exposing its assignments.
  const route = await prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    select: { id: true },
  });
  if (!route) return [];

  const rows = await prisma.routePickupArea.findMany({
    where: { routeId, pickupArea: { isActive: true } },
    orderBy: { displayOrder: 'asc' },
    select: { pickupArea: { select: areaSelect } },
  });
  return rows.map((r) => r.pickupArea);
}
