/**
 * PopularTrips card image is keyed by ORIGIN (the pickup town) so cards don't
 * all share one photo. Towns without their own public/destinations/<slug>.jpg
 * fall back to a province image slug.
 */
export const IMAGE_FALLBACK: Record<string, string> = {
  // North (Thanh Hóa-side) pickups → Thanh Hóa
  'trieu-son': 'thanh-hoa',
  'dong-son': 'thanh-hoa',
  'nong-cong': 'thanh-hoa',
  'ben-sung': 'thanh-hoa',
  // South (Sài Gòn-side) pickups → the corridor province they sit in
  'cho-tan-khai': 'binh-phuoc',
  'chon-thanh': 'binh-phuoc',
  'bau-bang': 'binh-duong',
  'ben-cat': 'binh-duong',
  'my-phuoc': 'binh-duong',
  'song-than': 'binh-duong',
  'an-phu': 'binh-duong',
  'tan-dong-hiep': 'binh-duong',
  'nga-tu-mieu-ong-cu': 'binh-duong',
  'nga-tu-550': 'binh-duong',
};
