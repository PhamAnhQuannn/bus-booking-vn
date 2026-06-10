/**
 * PICKUP_KIND_GROUPS — the station-vs-pickup grouping + Vietnamese display labels for the
 * operator pickup-area pickers. Shared by the trip/template console clients (was declared
 * byte-for-byte in three of them). Client-safe (pure constants, no prisma/server imports).
 *
 * `kind` mirrors the PickupPlaceKind values ('station' = Bến xe, 'pickup' = Đón tận nơi).
 */
export type PickupPlaceKindValue = 'station' | 'pickup';

export const PICKUP_KIND_GROUPS: { kind: PickupPlaceKindValue; label: string }[] = [
  { kind: 'station', label: 'Bến xe' },
  { kind: 'pickup', label: 'Đón tận nơi' },
];
