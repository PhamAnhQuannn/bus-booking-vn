/**
 * PopularTrips card image is keyed by ORIGIN (the pickup town) so cards don't
 * all share one photo. Towns without their own public/destinations/<slug>.jpg
 * fall back to a province image slug.
 */
export const IMAGE_FALLBACK: Record<string, string> = {
  // North (Thanh Hóa-side) pickup with no own photo → Thanh Hóa
  'nong-cong': 'thanh-hoa',
  // South (Sài Gòn-side) pickups with no own photo → the corridor province they sit in
  'cho-tan-khai': 'binh-phuoc',
  'song-than': 'binh-duong',
  'an-phu': 'binh-duong',
  'tan-dong-hiep': 'binh-duong',
  'nga-tu-mieu-ong-cu': 'binh-duong',
  'nga-tu-550': 'binh-duong',
};
