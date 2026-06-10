/**
 * updateOperatorPickupArea — edit a named pickup point's identity (name + addressLine).
 *
 * The ward (province/district/ward + `label`) is NOT editable here — that would change the
 * point's region; deactivate + recreate for that. The `name`/`label` snapshots on existing
 * TripPickupArea / Booking rows are intentionally left frozen (historical accuracy); only
 * future enables pick up the new name. EXCEPTION: `kind` is a display-grouping, not a
 * historical field — a kind change cascades to existing snapshots (see DECISION below).
 * Tenant-scoped.
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
    select: { id: true, wardCode: true, kind: true },
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

  // DECISION (kind-drift, Issue 110): `kind` is a DISPLAY-GROUPING field, not a
  // historical-accuracy field like `label` (which is deliberately frozen on existing
  // snapshots). When the operator re-classifies a place (Bến xe ↔ Đón tận nơi), the new
  // grouping is correct for ALL its trip/template snapshots too — a station that was
  // mislabeled `pickup` should regroup everywhere at once. So when kind actually changes,
  // cascade it to every TripPickupArea + TemplatePickupArea referencing this area, in the
  // SAME transaction as the place update. (Only when changed — no-op write otherwise.)
  const kindChanged = existing.kind !== data.kind;

  const [updated] = await prisma.$transaction([
    prisma.operatorPickupArea.update({
      where: { id: areaId, operatorId },
      data: { name: data.name, addressLine: data.addressLine ?? null, kind: data.kind },
      select: areaSelect,
    }),
    ...(kindChanged
      ? [
          prisma.tripPickupArea.updateMany({
            where: { operatorPickupAreaId: areaId },
            data: { kind: data.kind },
          }),
          prisma.templatePickupArea.updateMany({
            where: { operatorPickupAreaId: areaId },
            data: { kind: data.kind },
          }),
        ]
      : []),
  ]);

  return updated;
}
