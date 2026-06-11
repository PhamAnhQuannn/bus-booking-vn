/**
 * setRoutePickupAreas — replace the full set of pickup areas assigned to a route
 * (Issue 113). Full-replace semantics: delete existing RoutePickupArea rows for the
 * route, re-insert the given set. displayOrder follows input order.
 *
 * Rejects:
 *   - not_found           — route is not owned by the operator
 *   - invalid_pickup_area — some id is not one of the operator's ACTIVE menu areas
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';

export class RoutePickupAreaServiceError extends Error {
  constructor(public code: 'not_found' | 'invalid_pickup_area') {
    super(code);
    this.name = 'RoutePickupAreaServiceError';
  }
}

export async function setRoutePickupAreas({
  operatorId,
  routeId,
  areaIds,
}: {
  operatorId: string;
  routeId: string;
  areaIds: string[];
}): Promise<{ assigned: number }> {
  // Route must belong to the operator.
  const route = await prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    select: { id: true },
  });
  if (!route) throw new RoutePickupAreaServiceError('not_found');

  const ids = [...new Set(areaIds)];

  // Validate every id is one of THIS operator's active menu areas before mutating.
  if (ids.length > 0) {
    const owned = await prisma.operatorPickupArea.findMany({
      where: { id: { in: ids }, operatorId, isActive: true },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new RoutePickupAreaServiceError('invalid_pickup_area');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.routePickupArea.deleteMany({ where: { routeId } });
    if (ids.length > 0) {
      await tx.routePickupArea.createMany({
        data: ids.map((operatorPickupAreaId, i) => ({
          routeId,
          operatorPickupAreaId,
          displayOrder: i,
        })),
      });
    }
  });

  return { assigned: ids.length };
}
