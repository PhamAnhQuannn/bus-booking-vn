import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt — allow the public marketing/booking surface; disallow the gated
 * consoles (op/admin/dev), the API, and the transient/private customer flows.
 * `/auth/*` + `/account/*` are parked (guest-only since 2026-06-06) and 302 to
 * `/`, but are disallowed here too as belt-and-suspenders.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/op/',
        '/admin/',
        '/dev/',
        '/api/',
        '/account/',
        '/auth/',
        '/booking/',
        '/verify/',
        '/charter/status/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
