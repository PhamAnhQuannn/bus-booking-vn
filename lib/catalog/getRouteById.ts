/**
 * getRouteById — fetch a single route (Issue 012). Pickup points removed in
 * issue 104 (route-scoped PickupPoint replaced by per-trip OperatorPickupArea).
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
    where: withOperatorScope(operatorId, { where: { id: routeId } }).where,
  });
}
