/**
 * Proxy matcher regression test.
 *
 * The proxy hands every matched page path to next-intl (handleI18nRouting), which
 * rewrites it as an app/[locale] route. Static assets (/public files) and Next
 * file-metadata routes (robots/sitemap/manifest/icons) are NOT pages — if the matcher
 * lets them through, next-intl 404s the whole class. This was the production incident
 * after the i18n (#640) restructure: every /public image + metadata asset went dark.
 *
 * Locks the matcher's intent by exercising its real config strings:
 *   - the page matcher (negative-lookahead regex) must EXCLUDE static/metadata paths
 *     and INCLUDE genuine page routes,
 *   - /api stays covered by its own matcher entry (rate-limit + CSRF).
 */

import { describe, it, expect } from 'vitest';
import { config } from '@/proxy';

// The page-route matcher is the negative-lookahead entry; /api has its own entry.
const pageMatcher = config.matcher.find((m) => m.includes('_next/static'))!;
const apiMatcher = config.matcher.find((m) => m.startsWith('/api'))!;
// Next passes this string through as a path regex; test it as one (anchored full match).
const pageRe = new RegExp(`^${pageMatcher}$`);

describe('proxy matcher — static assets bypass the proxy (and thus next-intl)', () => {
  // /public files + Next file-metadata routes: MUST NOT be matched → served statically.
  it.each([
    '/brand/logo-horizontal.png',
    '/brand/logo-horizontal-white.png',
    '/destinations/da-lat.jpg',
    '/hero/landing-hero-v8.jpg',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.webmanifest',
    '/favicon.ico',
    '/icon.png',
    '/apple-icon.png',
    '/opengraph-image',
    '/_next/static/chunks/x.js',
    '/_next/image',
  ])('excludes static/metadata path %s', (path) => {
    expect(pageRe.test(path)).toBe(false);
  });
});

describe('proxy matcher — page routes still run through the proxy', () => {
  // Genuine pages (no file extension): MUST match so guards + session cookies + i18n run.
  it.each(['/', '/lich-trinh', '/tro-ly-du-lich', '/op/login', '/admin', '/en/lich-trinh'])(
    'includes page route %s',
    (path) => {
      expect(pageRe.test(path)).toBe(true);
    }
  );
});

describe('proxy matcher — /api stays gated', () => {
  it('keeps an /api matcher entry (rate-limit + CSRF depend on it)', () => {
    // Even /api paths with a dotted final segment (e.g. revenue.csv) are covered here,
    // independent of the page matcher's extension exclusion.
    expect(apiMatcher).toBe('/api/:path*');
  });
});
