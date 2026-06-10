/**
 * validatePickupSelection — pure validator for a traveler's pickup choice (Issue 107).
 *
 * Used BOTH client-side (CustomerForm UX) and server-side (authoritative, POST /api/holds).
 * `tripAreaIds` is the set of OperatorPickupArea ids this trip enables (TripPickupArea).
 *
 * Rules:
 *   - station → always valid, no detail.
 *   - point   → areaId must be one of the trip's enabled areas. The point is a named stop,
 *               so the free-text detail is an OPTIONAL note (no minimum length).
 *   - custom  → free-text request NOT on the list (Issue 111). detail REQUIRED, ≥5 trimmed
 *               chars; no areaId. The operator is flagged + notified and phones the traveler.
 */

export const CUSTOM_PICKUP_MIN_DETAIL = 5;

export interface PickupSelection {
  kind: 'station' | 'point' | 'custom';
  areaId?: string | null;
  detail?: string | null;
}

export type PickupCheck =
  | { ok: true; pickupKind: 'station'; pickupAreaId: null; pickupDetail: null }
  | { ok: true; pickupKind: 'point'; pickupAreaId: string; pickupDetail: string | null }
  | { ok: true; pickupKind: 'custom'; pickupAreaId: null; pickupDetail: string }
  | { ok: false; code: 'pickup_area_invalid' | 'pickup_custom_detail_required' };

export function validatePickupSelection(
  tripAreaIds: readonly string[],
  sel: PickupSelection
): PickupCheck {
  if (sel.kind === 'station') {
    return { ok: true, pickupKind: 'station', pickupAreaId: null, pickupDetail: null };
  }
  if (sel.kind === 'custom') {
    const detail = (sel.detail ?? '').trim();
    if (detail.length < CUSTOM_PICKUP_MIN_DETAIL) {
      return { ok: false, code: 'pickup_custom_detail_required' };
    }
    return { ok: true, pickupKind: 'custom', pickupAreaId: null, pickupDetail: detail };
  }
  const areaId = sel.areaId ?? '';
  if (!areaId || !tripAreaIds.includes(areaId)) {
    return { ok: false, code: 'pickup_area_invalid' };
  }
  const detail = (sel.detail ?? '').trim();
  return { ok: true, pickupKind: 'point', pickupAreaId: areaId, pickupDetail: detail || null };
}
