/**
 * validatePickupSelection — pure validator for a traveler's pickup choice (Issue 107).
 *
 * Used BOTH client-side (CustomerForm UX) and server-side (authoritative, POST /api/holds).
 * `tripAreaIds` is the set of OperatorPickupArea ids this trip enables (TripPickupArea).
 *
 * Rules (grilled decision #6):
 *   - station → always valid, no detail.
 *   - area    → areaId must be one of the trip's enabled areas AND detail ≥ 5 chars.
 */

export const PICKUP_DETAIL_MIN = 5;

export interface PickupSelection {
  kind: 'station' | 'area';
  areaId?: string | null;
  detail?: string | null;
}

export type PickupCheck =
  | { ok: true; pickupKind: 'station'; pickupAreaId: null; pickupDetail: null }
  | { ok: true; pickupKind: 'area'; pickupAreaId: string; pickupDetail: string }
  | { ok: false; code: 'pickup_area_invalid' | 'pickup_detail_required' };

export function validatePickupSelection(
  tripAreaIds: readonly string[],
  sel: PickupSelection
): PickupCheck {
  if (sel.kind === 'station') {
    return { ok: true, pickupKind: 'station', pickupAreaId: null, pickupDetail: null };
  }
  const areaId = sel.areaId ?? '';
  if (!areaId || !tripAreaIds.includes(areaId)) {
    return { ok: false, code: 'pickup_area_invalid' };
  }
  const detail = (sel.detail ?? '').trim();
  if (detail.length < PICKUP_DETAIL_MIN) {
    return { ok: false, code: 'pickup_detail_required' };
  }
  return { ok: true, pickupKind: 'area', pickupAreaId: areaId, pickupDetail: detail };
}
