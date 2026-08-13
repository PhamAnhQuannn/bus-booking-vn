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

/**
 * Serialize a JSON-LD object for safe embedding in an inline `<script>` (SEC-XSS-JSONLD, #557).
 *
 * `JSON.stringify` does NOT escape `<`, `>`, `&`, or the U+2028/U+2029 line separators, so a value
 * containing `</script><script>…` breaks out of the LD block and executes. Several embedded fields
 * are operator self-service free-text (route origin/destination, operator legal name), so that
 * breakout is a real stored-XSS vector on the public /trips/[id] page. Escaping the dangerous
 * sequences to their `\uXXXX` JSON escapes keeps the JSON value semantically identical while making
 * it impossible to close the script element or open an HTML entity.
 *
 * ALWAYS use this (never bare `JSON.stringify`) when feeding `dangerouslySetInnerHTML` for JSON-LD.
 */
export function jsonLdHtml(obj: unknown): string {
  // Kept fully ASCII on purpose (fromCharCode, not literal separators) so no editor/formatter
  // can silently mangle the exotic code points. Each dangerous char → its \uXXXX JSON escape.
  return JSON.stringify(obj)
    .split('<').join('\\u003c')
    .split('>').join('\\u003e')
    .split('&').join('\\u0026')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');
}

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
