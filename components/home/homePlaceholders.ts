/**
 * PLACEHOLDER DATA — not real, not derived from the database.
 *
 * The landing page was rebuilt to match `docs/design/mockup-home.png`, which shows
 * star ratings, review counts, per-operator route totals and per-destination daily
 * trip counts. None of those exist in the schema:
 *   - no Review/Rating model at all
 *   - Operator has no logo column
 *   - trips-per-day IS derivable but lands at ~1-5/day at launch scale, below any
 *     credible display floor (see components/home/trustDisplay.ts)
 *
 * These values are invented so the page renders as designed. Every one of them must
 * be replaced with real data (or the element removed) before this ships to
 * production — see `docs/design/mockup-home-spec.md` §4 for the per-element
 * disposition the honest version would use.
 *
 * Values are derived from a hash of a stable key rather than Math.random() because
 * these render inside RSCs, where a non-deterministic body is a react-hooks/purity
 * violation and would also flicker between server and client renders.
 */

/** FNV-1a. Small, stable, and enough to spread a handful of keys. */
function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** PLACEHOLDER rating in the 4.5-4.9 band the mockup shows. */
export function placeholderRating(key: string): string {
  return (4.5 + (hash(`rating:${key}`) % 5) / 10).toFixed(1);
}

/** PLACEHOLDER review count, rendered as the mockup's "(1.2k)" / "(980)" forms. */
export function placeholderReviewCount(key: string): string {
  const n = 400 + (hash(`reviews:${key}`) % 1400);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** PLACEHOLDER route total per operator — the mockup's "120+ tuyến". */
export function placeholderRouteCount(key: string): number {
  return 40 + (hash(`routes:${key}`) % 10) * 10;
}

/** PLACEHOLDER daily departures per destination — the mockup's "125+ chuyến/ngày". */
export function placeholderTripsPerDay(key: string): number {
  return 80 + (hash(`trips:${key}`) % 8) * 10;
}

/**
 * PLACEHOLDER partner operators, used to pad the showcase to the mockup's 5 cards
 * when the real operator list is shorter (1-2 at launch).
 *
 * Deliberately invented names. The mockup named Phương Trang, Mai Linh Express,
 * The Sinh Tour, Kumho Samco and Hạnh Café — those are real Vietnamese carriers and
 * our competitors; rendering them under "Nhà xe đối tác uy tín" would assert a
 * partnership that does not exist.
 */
export interface PlaceholderOperator {
  id: string;
  name: string;
  province: string;
}

export const PLACEHOLDER_OPERATORS: PlaceholderOperator[] = [
  { id: 'ph-1', name: 'Nhà xe Phương Nam', province: 'TP. Hồ Chí Minh' },
  { id: 'ph-2', name: 'Nhà xe Hoàng Long Việt', province: 'Hà Nội' },
  { id: 'ph-3', name: 'Nhà xe Thành Đạt', province: 'Đà Nẵng' },
  { id: 'ph-4', name: 'Nhà xe Minh Châu', province: 'Thanh Hóa' },
  { id: 'ph-5', name: 'Nhà xe An Phú', province: 'Khánh Hòa' },
];

/** PLACEHOLDER support hotline. Not a working number — 1900 xxxx is a real, billable
 *  Vietnamese service range, so this uses an obviously-masked form instead. */
export const PLACEHOLDER_HOTLINE = '1900 xxxx';
export const PLACEHOLDER_HOTLINE_HOURS = '(7:00 – 22:00 mỗi ngày)';
export const PLACEHOLDER_SUPPORT_EMAIL = 'hotro@lenxevn.com';
