/**
 * Popular-trips card selection for the landing page. Pure function so it is
 * unit-testable without a DB — the RSC (app/[locale]/(customer)/page.tsx) just
 * calls this with the ActiveRoute rows + the image-fallback map.
 *
 * The product is a single physical corridor (Thanh Hóa ↔ Sài Gòn) whose value is
 * its many boarding towns. A route (r.origin, r.destination) carries those pickups
 * in its `boardingSchedule` (parseBoardingSchedule); we FAN each route out into one
 * card PER boarding point (the route origin + every stop) so a rider in each pickup
 * town sees their own "Nông Cống → Sài Gòn" card. Cards are deduped by
 * `origin→destination`, then sliced to `limit`. `limit` is high enough to hold both
 * directions' pickups (the corridor has ~14 boarding towns) so neither direction's
 * towns get sliced off the tail.
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
  limit = 24,
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
    }
  }

  return out.slice(0, limit);
}
