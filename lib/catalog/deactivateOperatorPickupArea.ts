/**
 * deactivateOperatorPickupArea — soft-delete a pickup-area menu entry (Issue 105).
 *
 * Soft (isActive=false) — never hard-deleted, so historical bookings keep their
 * snapshotted label and any TripPickupArea rows survive. Tenant-scoped.
 *
 * Rejects: not_found (cross-op / missing) | already_inactive.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { PickupAreaServiceError, type OperatorPickupAreaDto } from './createOperatorPickupArea';

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
    select: {
      id: true,
      provinceCode: true,
      districtCode: true,
      districtName: true,
      wardCode: true,
      wardName: true,
      label: true,
      isActive: true,
      displayOrder: true,
    },
  });
}
