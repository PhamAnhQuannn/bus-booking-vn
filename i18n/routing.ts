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
});

export type Locale = (typeof routing.locales)[number];
