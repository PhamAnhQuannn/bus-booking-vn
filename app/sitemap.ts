import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/core/db/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';
import { SITE_URL } from '@/lib/seo';
import { ENABLED_LOCALES } from '@/i18n/routing';

/**
 * sitemap.xml — the public static pages plus every currently-bookable trip
 * (`/trips/[id]`). Trips are filtered by the SAME search-visible gate the search
 * page uses (scheduled, sales open, not moderated, search-visible operator, not
 * yet departed) so the sitemap never lists a URL that resolves to notFound().
 * `/auth/*` + `/account/*` are intentionally excluded (parked, guest-only).
 */

// Trip set changes constantly; never statically cache this sitemap.
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['', '/routes', '/tro-ly-du-lich', '/terms', '/privacy', '/lien-he-dat-xe', '/chinh-sach-huy-ve-hoan-tien', '/khieu-nai'];

const MAX_TRIP_URLS = 5000;

/** hreflang alternates for a locale-agnostic path (i18n P2b). vi is unprefixed
 * (default locale), other locales live under /<loc>. The entry `url` stays the vi URL.
 * Only ENABLED_LOCALES are advertised (EN is currently disabled → vi-only). */
function langAlternates(path: string): { languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const loc of ENABLED_LOCALES) {
    languages[loc] = loc === 'vi' ? `${SITE_URL}${path || '/'}` : `${SITE_URL}/${loc}${path}`;
  }
  return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${SITE_URL}${p || '/'}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: p === '' ? 1 : 0.7,
    alternates: langAlternates(p),
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
      alternates: langAlternates(`/trips/${t.id}`),
    }));
  } catch {
    // DB unreachable at request time → still serve the static sitemap.
    tripEntries = [];
  }

  return [...staticEntries, ...tripEntries];
}
