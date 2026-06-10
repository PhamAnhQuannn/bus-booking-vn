/**
 * deactivateOperatorPickupArea — soft-delete a pickup-area menu entry (Issue 105).
 *
 * Soft (isActive=false) — never hard-deleted, so historical bookings keep their
 * snapshotted label and any TripPickupArea rows survive. Tenant-scoped.
 *
 * Issue 112 (deactivate-then-book, edge P2-4 — decided + documented): deactivation removes the area
 * from the NEW-trip setup menu ONLY. Trips that already enabled this area via TripPickupArea keep it
 * bookable — that per-trip enablement is an explicit operator choice and is honored for the life of
 * the trip. The holds-route pickup validation therefore does NOT join isActive (see
 * app/api/holds/route.ts). No active-area gate is applied to existing TripPickupArea rows here.
 *
 * Rejects: not_found (cross-op / missing) | already_inactive.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { PickupAreaServiceError, areaSelect, type OperatorPickupAreaDto } from './createOperatorPickupArea';

export async function deactivateOperatorPickupArea({
  operatorId,
  areaId,
}: {
  operatorId: string;
  areaId: string;
}): Promise<OperatorPickupAreaDto> {
  const existing = await prisma.operatorPickupArea.findFirst({
    where: withOperatorScope(operatorId, { where: { id: areaId } }).where,
    select: { id: true, isActive: true },
  });
  if (!existing) throw new PickupAreaServiceError('not_found');
  if (!existing.isActive) throw new PickupAreaServiceError('already_inactive');

  // Scope the write to { id, operatorId } so it is tenant-bound atomically.
  return prisma.operatorPickupArea.update({
    where: { id: areaId, operatorId },
    data: { isActive: false },
    select: areaSelect,
  });
}
