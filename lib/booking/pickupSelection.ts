/**
 * validatePickupSelection — pure validator for a traveler's pickup choice (Issue 107).
 *
 * Used BOTH client-side (CustomerForm UX) and server-side (authoritative, POST /api/holds).
 *
 * Rules:
 *   - station → always valid, no detail.
 *   - custom  → free-text request (Issue 111). detail REQUIRED, ≥5 trimmed
 *               chars. The operator is flagged + notified and phones the traveler.
 */

export const CUSTOM_PICKUP_MIN_DETAIL = 5;

export interface PickupSelection {
  kind: 'station' | 'custom';
  detail?: string | null;
}

export type PickupCheck =
  | { ok: true; pickupKind: 'station'; pickupDetail: null }
  | { ok: true; pickupKind: 'custom'; pickupDetail: string }
  | { ok: false; code: 'pickup_custom_detail_required' };

export function validatePickupSelection(
  sel: PickupSelection
): PickupCheck {
  if (sel.kind === 'station') {
    return { ok: true, pickupKind: 'station', pickupDetail: null };
  }
  const detail = (sel.detail ?? '').trim();
  if (detail.length < CUSTOM_PICKUP_MIN_DETAIL) {
    return { ok: false, code: 'pickup_custom_detail_required' };
  }
  return { ok: true, pickupKind: 'custom', pickupDetail: detail };
}
