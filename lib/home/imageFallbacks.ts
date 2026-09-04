/**
 * PopularTrips card image is keyed by ORIGIN (the pickup town) so cards don't
 * all share one photo. Towns without their own public/destinations/<slug>.jpg
 * fall back to a province image slug.
 */
export const IMAGE_FALLBACK: Record<string, string> = {
  'nong-cong': 'thanh-hoa',
  'cho-tan-khai': 'binh-phuoc',
  'song-than': 'binh-duong',
  'an-phu': 'binh-duong',
  'tan-dong-hiep': 'binh-duong',
  'nga-tu-mieu-ong-cu': 'binh-duong',
  'nga-tu-550': 'binh-duong',
};
