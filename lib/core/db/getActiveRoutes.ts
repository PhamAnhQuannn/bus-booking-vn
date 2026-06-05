/**
 * Aggregate active routes that have at least one upcoming bookable trip, grouped
 * by (origin, destination) across operators. Powers the public /routes browse page.
 *
 * "Upcoming bookable" = scheduled, sales open, departing now or later. Routes with
 * no such trip are omitted so the browse page never links to a dead search.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';

export interface ActiveRoute {
  origin: string;
  destination: string;
  operatorCount: number;
  minPrice: number;
  minDurationMinutes: number;
  nextDepartureAt: string; // ISO
}

export async function getActiveRoutes(): Promise<ActiveRoute[]> {
  type Row = {
    origin: string;
    destination: string;
    operatorCount: number;
    minPrice: number;
    minDurationMinutes: number;
    nextDepartureAt: Date;
  };

  const rows = await prisma.$queryRaw<Row[]>(
    Prisma.sql`
      SELECT
        r.origin                         AS origin,
        r.destination                    AS destination,
        COUNT(DISTINCT r."operatorId")::int AS "operatorCount",
        MIN(t.price)::int                AS "minPrice",
        MIN(r."durationMinutes")::int    AS "minDurationMinutes",
        MIN(t."departureAt")             AS "nextDepartureAt"
      FROM "Route" r
      JOIN "Trip" t ON t."routeId" = r.id
      WHERE r."deactivatedAt" IS NULL
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
  }));
}
