import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/core/db/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';
import { SITE_URL } from '@/lib/seo';

/**
 * sitemap.xml — the public static pages plus every currently-bookable trip
 * (`/trips/[id]`). Trips are filtered by the SAME search-visible gate the search
 * page uses (scheduled, sales open, not moderated, search-visible operator, not
 * yet departed) so the sitemap never lists a URL that resolves to notFound().
 * `/auth/*` + `/account/*` are intentionally excluded (parked, guest-only).
 */

// Trip set changes constantly; never statically cache this sitemap.
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['', '/search', '/routes', '/terms', '/privacy', '/lien-he-dat-xe'];

const MAX_TRIP_URLS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${SITE_URL}${p || '/'}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: p === '' ? 1 : 0.7,
  }));

  let tripEntries: MetadataRoute.Sitemap = [];
  try {
    const trips = await prisma.trip.findMany({
      where: {
        status: 'scheduled',
        salesClosed: false,
        moderatedAt: null,
        departureAt: { gt: now },
        operator: { status: { in: SEARCH_VISIBLE_STATUSES }, disabledAt: null },
        route: { deactivatedAt: null, moderatedAt: null },
      },
      select: { id: true, departureAt: true },
      orderBy: { departureAt: 'asc' },
      take: MAX_TRIP_URLS,
    });
    tripEntries = trips.map((t) => ({
      url: `${SITE_URL}/trips/${t.id}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    }));
  } catch {
    // DB unreachable at request time → still serve the static sitemap.
    tripEntries = [];
  }

  return [...staticEntries, ...tripEntries];
}
