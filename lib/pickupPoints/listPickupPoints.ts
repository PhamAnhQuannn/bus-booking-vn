/**
 * listPickupPoints — list pickup points for a route (Issue 012).
 *
 * Verifies operator scope. Returns active + deactivated, ordered by displayOrder.
 * Returns null if route doesn't exist or belongs to another operator.
 */

import { prisma } from '@/lib/db/client';

export async function listPickupPoints({
  operatorId,
  routeId,
}: {
  operatorId: string;
  routeId: string;
}) {
  // Verify route ownership first
  const route = await prisma.route.findFirst({
    where: { id: routeId, operatorId },
    select: { id: true },
  });

  if (!route) return null;

  return prisma.pickupPoint.findMany({
    where: { routeId },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      routeId: true,
      name: true,
      address: true,
      displayOrder: true,
      deactivatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
