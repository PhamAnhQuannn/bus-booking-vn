/**
 * snapshotPickupAreas — shared owned-area validation + snapshot helpers for the
 * three per-trip / per-template pickup-area write paths (createTrip, setTripPickupAreas,
 * generateFromTemplate). Extracted (Issue 110/112 review) so the validate-owned-active
 * + composePickupLabel + kind-snapshot logic lives in ONE place — it had already drifted
 * once when the `kind` snapshot was hand-added to each copy.
 *
 * Server-side only (runs inside the caller's $transaction).
 */

import { Prisma } from '@prisma/client';
import { composePickupLabel } from '@/lib/catalog';
import { TripServiceError } from './errors';

export interface OwnedPickupArea {
  id: string;
  name: string;
  addressLine: string | null;
  kind: 'station' | 'pickup';
}

/**
 * Resolve `areaIds` to the operator's ACTIVE pickup areas, deduped. Throws
 * TripServiceError('invalid_pickup_area') if any id is cross-operator, inactive, or
 * unknown (i.e. the owned set doesn't cover every distinct requested id). Returns []
 * for an empty request. Must run inside the caller's transaction (`tx`).
 */
export async function resolveOwnedAreas(
  tx: Prisma.TransactionClient,
  operatorId: string,
  areaIds: string[],
): Promise<OwnedPickupArea[]> {
  const uniqueIds = [...new Set(areaIds)];
  if (uniqueIds.length === 0) return [];

  const owned = await tx.operatorPickupArea.findMany({
    where: { id: { in: uniqueIds }, operatorId, isActive: true },
    select: { id: true, name: true, addressLine: true, kind: true },
  });
  if (owned.length !== uniqueIds.length) {
    throw new TripServiceError('invalid_pickup_area');
  }
  return owned;
}

export interface PickupAreaSnapshotRow {
  operatorPickupAreaId: string;
  label: string;
  kind: 'station' | 'pickup';
  displayOrder: number;
}

/**
 * Map owned areas to the createMany row shape shared by TripPickupArea and
 * TemplatePickupArea. The caller spreads its own FK column onto each row
 * (`tripId` for TripPickupArea, `recurringTemplateId` for TemplatePickupArea).
 * Snapshots the label + kind so a later rename never retroactively changes
 * already-written rows.
 */
export function toPickupAreaRows(owned: OwnedPickupArea[]): PickupAreaSnapshotRow[] {
  return owned.map((a, i) => ({
    operatorPickupAreaId: a.id,
    label: composePickupLabel(a),
    kind: a.kind,
    displayOrder: i,
  }));
}
