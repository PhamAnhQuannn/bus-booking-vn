/**
 * updatePickupPoint — partial update a pickup point (Issue 012).
 *
 * Verifies operator scope via nested route ownership check.
 * Throws PickupPointServiceError('not_found') if not found or cross-operator.
 */

import { prisma } from '@/lib/core/db/client';
import { PickupPointServiceError } from './createPickupPoint';
import type { PickupPointPatchInput } from '@/lib/core/validation/route';

export async function updatePickupPoint({
  operatorId,
  routeId,
  ppId,
  data,
}: {
  operatorId: string;
  routeId: string;
  ppId: string;
  data: PickupPointPatchInput;
}) {
  const existing = await prisma.pickupPoint.findFirst({
    where: { id: ppId, routeId, route: { operatorId } },
    select: { id: true },
  });

  if (!existing) {
    throw new PickupPointServiceError('not_found');
  }

  return prisma.pickupPoint.update({
    where: { id: ppId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
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
