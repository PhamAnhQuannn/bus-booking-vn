/**
 * Popular-trips card selection for the landing page. Pure function so it is
 * unit-testable without a DB — the RSC (app/[locale]/(customer)/page.tsx) just
 * calls this with the ActiveRoute rows + the image-fallback map.
 *
 * A route (r.origin, r.destination) may carry several boarding-town stops in
 * its `boardingSchedule` (parseBoardingSchedule). Expanding every stop into its
 * own card used to produce up to N near-identical cards per route — same
 * destination/price/duration, differing only by pickup town. This selection
 * caps the section to ROUTE diversity: at most one card per underlying route
 * (the route's own origin, unless it collides with an already-picked card —
 * then the next boarding-town variant is tried), THEN slices to `limit`.
 */

import type { ActiveRoute } from '@/lib/core/db/getActiveRoutes';
import { parseBoardingSchedule } from '@/lib/trips';
import { slugify } from '@/lib/places';

export interface PopularTripCard {
  origin: string;
  destination: string;
  /** public/destinations/<slug>.jpg — slug of the destination (slugify'd server-side). */
  slug: string;
  /** Cheapest upcoming fare (VND) — indicative "Từ" teaser. */
  price: number;
  /** Shortest route duration in minutes. */
  duration: number;
}

export function selectPopularTrips(
  routes: ActiveRoute[],
  imageFallback: Record<string, string>,
  limit = 12,
): PopularTripCard[] {
  const seenCards = new Set<string>();
  const out: PopularTripCard[] = [];

  for (const r of routes) {
    const stops = parseBoardingSchedule(r.boardingSchedule);
    const origins = [r.origin, ...stops.map((s) => s.point)];

    for (const origin of origins) {
      const cardKey = `${origin}→${r.destination}`;
      if (seenCards.has(cardKey)) continue;
      seenCards.add(cardKey);
      const s = slugify(origin);
      out.push({
        origin,
        destination: r.destination,
        slug: imageFallback[s] ?? s,
        price: r.minPrice,
        duration: r.minDurationMinutes,
      });
      break; // cap: at most one card per underlying route
    }
  }

  return out.slice(0, limit);
}
