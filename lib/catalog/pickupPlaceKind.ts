/**
 * pickupPlaceKindToPickupKind — bridge the two pickup enums (Issue 110, edge P3-5).
 *
 * `PickupPlaceKind` (the operator's place taxonomy) and `PickupKind` (how a traveler
 * boards on a Hold/Booking) share the `station` value but DIVERGE on the door-to-door
 * case: a place tagged `pickup` becomes a `point` booking. They are distinct Prisma
 * enums with distinct runtime string values — NEVER `as`-cast between them; this explicit
 * mapping is the only sanctioned conversion.
 *
 * Consumed by Issue 111 (the 3-way holds path). Defined + tested here so the seam exists
 * before that work lands.
 *
 *   station → station
 *   pickup  → point
 */

export function pickupPlaceKindToPickupKind(k: 'station' | 'pickup'): 'station' | 'point' {
  return k === 'station' ? 'station' : 'point';
}
