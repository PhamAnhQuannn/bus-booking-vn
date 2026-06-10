/**
 * Shared popular-route list for the landing page. Lives outside the client
 * carousel so the RSC (`app/(customer)/page.tsx`) can read the same pairs to
 * look up a starting price per route, and the client `PopularTrips` renders them.
 *
 * `origin`/`destination` MUST match seeded `Route.origin`/`Route.destination`
 * canonical names exactly (used as the price-map key against getActiveRoutes()).
 * `slug` keys the destination photo at public/destinations/<slug>.jpg.
 */
export interface PopularRoute {
  origin: string;
  destination: string;
  slug: string;
}

export const POPULAR_ROUTES: PopularRoute[] = [
  { origin: 'Thanh Hóa', destination: 'Sài Gòn', slug: 'sai-gon' },
  { origin: 'Sài Gòn', destination: 'Bình Dương', slug: 'binh-duong' },
  { origin: 'Sài Gòn', destination: 'Đà Lạt', slug: 'da-lat' },
  { origin: 'Hà Nội', destination: 'Sa Pa', slug: 'sa-pa' },
  { origin: 'Đà Nẵng', destination: 'Huế', slug: 'hue' },
  { origin: 'Hà Nội', destination: 'Hải Phòng', slug: 'hai-phong' },
  { origin: 'Sài Gòn', destination: 'Vũng Tàu', slug: 'vung-tau' },
  { origin: 'Hà Nội', destination: 'Đà Nẵng', slug: 'da-nang' },
  { origin: 'Sài Gòn', destination: 'Nha Trang', slug: 'nha-trang' },
  { origin: 'Sài Gòn', destination: 'Hà Nội', slug: 'ha-noi' },
];

/** Stable map key for a route pair (matches the price-map built in the RSC). */
export function routeKey(origin: string, destination: string): string {
  return `${origin}→${destination}`;
}
