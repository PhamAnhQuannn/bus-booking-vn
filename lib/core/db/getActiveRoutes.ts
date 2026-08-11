/**
 * Aggregate active routes that have at least one upcoming bookable trip, grouped
 * by (origin, destination) across operators. Powers the public /routes browse page.
 *
 * "Upcoming bookable" = scheduled, sales open, departing now or later. Routes with
 * no such trip are omitted so the browse page never links to a dead search.
 */

import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';

export interface ActiveRoute {
  origin: string;
  destination: string;
  operatorCount: number;
  minPrice: number;
  minDurationMinutes: number;
  nextDepartureAt: string; // ISO
  /** Raw Route.boardingSchedule jsonb ([{point,time}] | null). Parse in the app
   *  layer (parseBoardingSchedule) — lib/core must not depend on lib/trips. */
  boardingSchedule: unknown;
}

async function fetchActiveRoutes(): Promise<ActiveRoute[]> {
  type Row = {
    origin: string;
    destination: string;
    operatorCount: number;
    minPrice: number;
    minDurationMinutes: number;
    nextDepartureAt: Date;
    boardingSchedule: unknown;
  };

  const rows = await prisma.$queryRaw<Row[]>(
    Prisma.sql`
      SELECT
        r.origin                         AS origin,
        r.destination                    AS destination,
        COUNT(DISTINCT r."operatorId")::int AS "operatorCount",
        MIN(t.price)::int                AS "minPrice",
        MIN(r."durationMinutes")::int    AS "minDurationMinutes",
        MIN(t."departureAt")             AS "nextDepartureAt",
        (array_agg(r."boardingSchedule" ORDER BY r."operatorId") FILTER (WHERE r."boardingSchedule" IS NOT NULL))[1] AS "boardingSchedule"
      FROM "Route" r
      JOIN "Operator" o ON o.id = r."operatorId"
      JOIN "Trip" t ON t."routeId" = r.id
      WHERE r."deactivatedAt" IS NULL
        AND r."moderatedAt" IS NULL
        AND t."moderatedAt" IS NULL
        AND o.status = 'APPROVED'::"OperatorStatus"
        AND o."disabledAt" IS NULL
        AND t.status = 'scheduled'::"TripStatus"
        AND t."salesClosed" = false
        AND t."departureAt" >= NOW()
      GROUP BY r.origin, r.destination
      ORDER BY "operatorCount" DESC, r.origin ASC
    `
  );

  return rows.map((r) => ({
    origin: r.origin,
    destination: r.destination,
    operatorCount: r.operatorCount,
    minPrice: r.minPrice,
    minDurationMinutes: r.minDurationMinutes,
    nextDepartureAt: r.nextDepartureAt.toISOString(),
    boardingSchedule: r.boardingSchedule,
  }));
}

/**
 * Cached public catalog read (revalidate 300s, tag 'catalog'). Pure catalog data —
 * no live seat/hold/price — so a ≤5-min staleness is fine. Keeps this repeated
 * hot-path read (home + /routes) off the pool-max-2 Neon connection budget.
 *
 * On-demand invalidation is DELIBERATELY NOT wired (accept the ≤5-min auto-heal).
 * If ever needed, invalidate from a Server Action / Route Handler after a catalog
 * mutation with the Next 16 two-arg form `revalidateTag('catalog', 'max')` (SWR) or
 * `updateTag('catalog')` (immediate) — the bare `revalidateTag('catalog')` is
 * deprecated. Never invalidate from the every-minute autoCloseSales cron (thrashes
 * the cache). See the plan's "revalidateTag — cơ chế & gate" section.
 */
export const getActiveRoutes = unstable_cache(fetchActiveRoutes, ['active-routes'], {
  tags: ['catalog'],
  revalidate: 300,
});
