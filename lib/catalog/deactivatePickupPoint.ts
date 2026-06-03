/**
 * deactivatePickupPoint — soft-delete a pickup point (Issue 012).
 *
 * Verifies operator scope via nested route ownership check.
 * Throws PickupPointServiceError:
 *   - 'not_found'          — pickup point doesn't exist or cross-operator
 *   - 'already_deactivated' — already soft-deleted
 */

import { prisma } from '@/lib/core/db/client';
import { PickupPointServiceError } from './createPickupPoint';

export async function deactivatePickupPoint({
  operatorId,
  routeId,
  ppId,
}: {
  operatorId: string;
  routeId: string;
  ppId: string;
}) {
  const existing = await prisma.pickupPoint.findFirst({
    where: { id: ppId, routeId, route: { operatorId } },
    select: { id: true, deactivatedAt: true },
  });

  if (!existing) {
    throw new PickupPointServiceError('not_found');
  }
  if (existing.deactivatedAt !== null) {
    throw new PickupPointServiceError('already_deactivated');
  }

  return prisma.pickupPoint.update({
    where: { id: ppId },
    data: { deactivatedAt: new Date() },
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
