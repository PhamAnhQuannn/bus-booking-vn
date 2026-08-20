import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Per-request i18n config consumed by the next-intl plugin (wired in next.config.ts).
 * Loads + merges the per-domain message catalog for the resolved locale. `requestLocale`
 * comes from the `[locale]` route segment; unknown/absent falls back to the default.
 *
 * Catalog layout: `messages/<locale>/<namespace>.json`, one file per lib/<domain> boundary
 * so ownership of translations matches the dev mental model. Each file becomes a top-level
 * namespace key ({ common: {...}, booking: {...}, … }). Add a namespace here when its file
 * lands; every locale must ship the same set.
 */
const NAMESPACES = ['common', 'home', 'search', 'booking', 'trips', 'charter', 'account', 'auth'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const)
  );

  return {
    locale,
    messages: Object.fromEntries(entries),
  };
});
