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
 *   (Issue 111 adds a third `custom` kind = free-text request not on the list.)
 */

export interface PickupSelection {
  kind: 'station' | 'point';
  areaId?: string | null;
  detail?: string | null;
}

export type PickupCheck =
  | { ok: true; pickupKind: 'station'; pickupAreaId: null; pickupDetail: null }
  | { ok: true; pickupKind: 'point'; pickupAreaId: string; pickupDetail: string | null }
  | { ok: false; code: 'pickup_area_invalid' };

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
  return { ok: true, pickupKind: 'point', pickupAreaId: areaId, pickupDetail: detail || null };
}
