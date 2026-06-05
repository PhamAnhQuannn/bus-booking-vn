/**
 * createPickupPoint — add a pickup point to a route (Issue 012).
 *
 * Throws PickupPointServiceError:
 *   - 'not_found'               — route doesn't exist or belongs to another operator
 *   - 'too_many_pickup_points'  — route already has 50 active pickup points
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import type { PickupPointCreateInput } from '@/lib/core/validation/route';

export class PickupPointServiceError extends Error {
  constructor(
    public code:
      | 'not_found'
      | 'too_many_pickup_points'
      | 'already_deactivated'
      | 'unknown_pickup_points'
      | 'incomplete_reorder'
  ) {
    super(code);
    this.name = 'PickupPointServiceError';
  }
}

const MAX_PICKUP_POINTS = 50;

export async function createPickupPoint({
  operatorId,
  routeId,
  data,
}: {
  operatorId: string;
  routeId: string;
  data: PickupPointCreateInput;
}) {
  // Verify route belongs to operator
  const route = await prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    select: { id: true },
  });

  if (!route) {
    throw new PickupPointServiceError('not_found');
  }

  // Count active pickup points
  const activeCount = await prisma.pickupPoint.count({
    where: { routeId, deactivatedAt: null },
  });

  if (activeCount >= MAX_PICKUP_POINTS) {
    throw new PickupPointServiceError('too_many_pickup_points');
  }

  // Compute next displayOrder if not provided
  let displayOrder = data.displayOrder;
  if (displayOrder === undefined) {
    const maxResult = await prisma.pickupPoint.aggregate({
      where: { routeId, deactivatedAt: null },
      _max: { displayOrder: true },
    });
    displayOrder = (maxResult._max.displayOrder ?? 0) + 1;
  }

  return prisma.pickupPoint.create({
    data: {
      routeId,
      name: data.name,
      address: data.address,
      displayOrder,
    },
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
