/**
 * updateOperatorPickupArea — edit a named pickup point's identity (name + addressLine).
 *
 * The ward (province/district/ward + `label`) is NOT editable here — that would change the
 * point's region; deactivate + recreate for that. Existing TripPickupArea / Booking snapshots
 * are intentionally left untouched (historical accuracy); only future enables pick up the new
 * name. Tenant-scoped.
 *
 * Rejects: not_found (cross-op / missing) | duplicate_area (another active point in the same
 * ward already uses the new name).
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import {
  PickupAreaServiceError,
  areaSelect,
  type OperatorPickupAreaDto,
} from './createOperatorPickupArea';
import type { OperatorPickupAreaUpdateInput } from '@/lib/core/validation/pickupArea';

export async function updateOperatorPickupArea({
  operatorId,
  areaId,
  data,
}: {
  operatorId: string;
  areaId: string;
  data: OperatorPickupAreaUpdateInput;
}): Promise<OperatorPickupAreaDto> {
  const existing = await prisma.operatorPickupArea.findFirst({
    where: withOperatorScope(operatorId, { where: { id: areaId } }).where,
    select: { id: true, wardCode: true },
  });
  if (!existing) throw new PickupAreaServiceError('not_found');

  // Reject if another ACTIVE point in the same ward already uses the new name.
  const dup = await prisma.operatorPickupArea.findFirst({
    where: {
      operatorId,
      wardCode: existing.wardCode,
      name: { equals: data.name, mode: 'insensitive' },
      isActive: true,
      id: { not: areaId },
    },
    select: { id: true },
  });
  if (dup) throw new PickupAreaServiceError('duplicate_area');

  return prisma.operatorPickupArea.update({
    where: { id: areaId, operatorId },
    data: { name: data.name, addressLine: data.addressLine ?? null },
    select: areaSelect,
  });
}
