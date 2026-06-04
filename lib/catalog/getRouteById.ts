/**
 * getRouteById — fetch a single route with its active pickup points (Issue 012).
 *
 * Returns null if route doesn't exist or belongs to another operator.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';

export async function getRouteById({
  operatorId,
  routeId,
}: {
  operatorId: string;
  routeId: string;
}) {
  return prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    include: {
      pickupPoints: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });
}
