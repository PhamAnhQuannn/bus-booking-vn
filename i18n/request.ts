import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Per-request i18n config consumed by the next-intl plugin (wired in next.config.ts).
 * Loads the message catalog for the resolved locale. `requestLocale` comes from the
 * `[locale]` route segment; unknown/absent falls back to the default locale.
 *
 * Catalog: `messages/<locale>.json` with namespaced keys ({ common: {...}, spike: {...} }).
 * P0 will split this into per-domain files (messages/<locale>/<namespace>.json) and merge.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
