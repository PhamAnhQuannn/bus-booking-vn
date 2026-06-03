/**
 * bulkReorder — reorder pickup points for a route (Issue 012).
 *
 * Uses $transaction (callback form) with FOR UPDATE lock on Route row
 * to prevent TOCTOU races (AC precedent from Issue 011).
 *
 * Throws PickupPointServiceError:
 *   - 'not_found'              — route doesn't exist or belongs to another operator
 *   - 'unknown_pickup_points'  — orderedIds contains IDs not in active set for this route
 *   - 'incomplete_reorder'     — not all active pickup points included in orderedIds
 */

import { prisma } from '@/lib/core/db/client';
import { PickupPointServiceError } from './createPickupPoint';

export async function bulkReorder({
  operatorId,
  routeId,
  orderedIds,
}: {
  operatorId: string;
  routeId: string;
  orderedIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    // Lock the Route row to serialize concurrent reorder operations
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Route"
      WHERE id = ${routeId} AND "operatorId" = ${operatorId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new PickupPointServiceError('not_found');
    }

    // Fetch all active pickup points for this route
    const activePoints = await tx.pickupPoint.findMany({
      where: { routeId, deactivatedAt: null },
      select: { id: true },
    });

    const activeIds = new Set(activePoints.map((p) => p.id));
    const requestedIds = new Set(orderedIds);

    // Check for unknown IDs (IDs in request not in active set)
    for (const id of orderedIds) {
      if (!activeIds.has(id)) {
        throw new PickupPointServiceError('unknown_pickup_points');
      }
    }

    // Check that all active IDs are in the request (no omissions)
    for (const id of activeIds) {
      if (!requestedIds.has(id)) {
        throw new PickupPointServiceError('incomplete_reorder');
      }
    }

    // Update each pickup point's displayOrder to 1-indexed position
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.pickupPoint.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Return updated list in new order
    return tx.pickupPoint.findMany({
      where: { routeId, deactivatedAt: null },
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
  });
}
