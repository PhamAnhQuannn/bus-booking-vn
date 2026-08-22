import { defineRouting } from 'next-intl/routing';

/**
 * i18n routing config (P-spike, feat/i18n-en).
 *
 * - `vi` is the default locale and stays UNPREFIXED (`/`, `/search`, …) so every
 *   existing Vietnamese URL is byte-identical — zero SEO churn.
 * - `en` is served under a `/en/…` prefix.
 * - `localePrefix: 'as-needed'` = default locale has no prefix, others do.
 *
 * SCOPE NOTE (spike): the customer/planner route tree is NOT yet moved under
 * `app/[locale]`. During the spike, proxy.ts only invokes the next-intl handler
 * for the throwaway `/spike` route (see proxy.ts), so the rest of the app is
 * untouched. P0 moves `app/(customer)` → `app/[locale]/(customer)` and widens
 * the handler to the full customer matcher.
 */
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // VI-first site: EN is an explicit opt-in via the /en prefix + LanguageSwitcher, never an
  // automatic redirect. localeDetection MUST stay off — with it on, next-intl 307-redirects an
  // unprefixed non-localized surface (/op, /admin, /dev) to /en/… whenever the browser sends
  // Accept-Language: en (or a NEXT_LOCALE=en cookie), and proxy.ts then 308-redirects it back to
  // the canonical non-localized path → an infinite redirect loop that locks English-preferring
  // staff out of every console. See proxy.ts isNonLocalized handling.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
