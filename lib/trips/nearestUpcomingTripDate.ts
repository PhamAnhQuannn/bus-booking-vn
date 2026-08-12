/**
 * nearestUpcomingTripDate — the VN date (YYYY-MM-DD) of the nearest bookable departure
 * for a route on/after max(now, requested-day 00:00 VN). Null when none exists forward.
 *
 * Used to skip the blank "no trips today" page for a daily route: if today's bus has
 * already left, the results page redirects to the next date that actually has a trip.
 * Forward-only (never jumps to an earlier date) and seat-agnostic (a cheap date hint —
 * searchTrips re-checks seats on the target day, so a full target simply stops the hop
 * with near === date, never a redirect loop).
 *
 * Route matching mirrors searchTrips (slug → alias/canonical → raw, substring ILIKE).
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';
import { findCanonicalNameBySlug, findByNameOrAlias } from '@/lib/places';
import { fromZonedTime } from 'date-fns-tz';
import { startOfDay } from 'date-fns';

const TZ = 'Asia/Ho_Chi_Minh';

export async function nearestUpcomingTripDate(
  origin: string,
  destination: string,
  fromDate: string,
): Promise<string | null> {
  const o =
    (await findCanonicalNameBySlug(origin)) ??
    (await findByNameOrAlias(origin))?.canonicalName ??
    origin;
  const d =
    (await findCanonicalNameBySlug(destination)) ??
    (await findByNameOrAlias(destination))?.canonicalName ??
    destination;

  const routeRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "Route"
    WHERE unaccent_immutable(lower(origin)) ILIKE '%' || unaccent_immutable(lower(${o})) || '%'
      AND unaccent_immutable(lower(destination)) ILIKE '%' || unaccent_immutable(lower(${d})) || '%'
      AND "deactivatedAt" IS NULL
      AND "moderatedAt" IS NULL
  `);
  if (routeRows.length === 0) return null;

  const [y, m, day] = fromDate.split('-').map(Number);
  const dayStartUtc = fromZonedTime(startOfDay(new Date(y, m - 1, day)), TZ);
  const now = new Date();
  const floor = dayStartUtc > now ? dayStartUtc : now;

  const trip = await prisma.trip.findFirst({
    where: {
      routeId: { in: routeRows.map((r) => r.id) },
      departureAt: { gte: floor },
      status: 'scheduled',
      salesClosed: false,
      moderatedAt: null,
      operator: { status: { in: SEARCH_VISIBLE_STATUSES }, disabledAt: null },
    },
    orderBy: { departureAt: 'asc' },
    select: { departureAt: true },
  });
  if (!trip) return null;

  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(trip.departureAt);
}
