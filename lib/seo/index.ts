/**
 * lib/seo — canonical site origin + JSON-LD structured-data builders.
 *
 * Pure + client-safe (no server-only / prisma / next/server siblings) so any
 * consumer may import it; cross-domain callers enter through THIS barrel
 * (boundaries/entry-point). SITE_URL is the single source of the public origin —
 * it drives `metadataBase`, `app/robots.ts`, `app/sitemap.ts`, and the absolute
 * URLs embedded in JSON-LD. Set NEXT_PUBLIC_SITE_URL at deploy; dev falls back to
 * :3001 (the project's dev port — :3000 is a different app).
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3001';

const ORG_NAME = 'BBVN';

/** Organization schema for the home page. */
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
  };
}

/** schema.org BusTrip + Offer for a public /trips/[id] page. */
export function busTripLd(t: {
  origin: string;
  destination: string;
  departureTime: string; // ISO
  arrivalTime?: string; // ISO
  price: number;
  operatorName: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BusTrip',
    name: `${t.origin} → ${t.destination}`,
    url: t.url,
    departureBusStop: { '@type': 'BusStop', name: t.origin },
    arrivalBusStop: { '@type': 'BusStop', name: t.destination },
    departureTime: t.departureTime,
    ...(t.arrivalTime ? { arrivalTime: t.arrivalTime } : {}),
    provider: { '@type': 'Organization', name: t.operatorName },
    offers: {
      '@type': 'Offer',
      price: t.price,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    },
  };
}

/** BreadcrumbList from an ordered list of {name, url} crumbs. */
export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
