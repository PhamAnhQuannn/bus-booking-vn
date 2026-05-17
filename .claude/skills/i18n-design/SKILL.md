---
name: i18n-design
description: Locale strategy, ICU MessageFormat, RTL, currency/date/number formatting, translation pipeline (Crowdin/Lokalise), fallback chain, locale routing. Triggers on "i18n", "internationalization", "localization", "/i18n-design". Writes docs/design/i18n.md + lib/i18n.ts.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

## Why you'd care

Retrofitting i18n into a string-concatenated codebase is a months-long rewrite and a guaranteed source of layout bugs in RTL locales. Designing it upfront costs days and saves the rewrite.

Internationalization + localization design. Forces explicit locale strategy, message catalog format, RTL support, formatting rules, translation pipeline, and routing model before strings get hard-coded. Retrofitting i18n is 10Ã— harder than designing it in.

## When This Skill Applies

- User says "i18n", "internationalization", "localization", "translate", "RTL", "/i18n-design"
- Before launching outside English-only market
- Before first non-English user request
- After accumulating > 50 hard-coded user-facing strings
- Before adding a market with non-Latin script (CJK, Arabic, Hebrew, Cyrillic, Devanagari)

## Prerequisites

- Target market list (which locales, ranked by priority)
- Decision: who translates (machine-only, human-only, hybrid)
- Translation budget (per-word rate or flat-fee per market)
- `docs/design/analytics-events.md` (locale becomes event property)

## Steps

1. **Inventory locales.** Each entry: `xx-YY` (BCP 47). Mark primary, secondary, RTL, script.
2. **Pick locale-detection strategy.**
   - **URL path** (`/en/...`, `/fr/...`) â€” best for SEO, sharable, cache-friendly. **Recommended.**
   - **Subdomain** (`en.product.com`, `fr.product.com`) â€” geo-DNS friendly, more infra
   - **Cookie/header only** â€” bad for SEO, hidden from users
3. **Define fallback chain.** `fr-CA` â†’ `fr` â†’ `en` (default). Always specify ultimate fallback.
4. **Pick message format.**
   - **ICU MessageFormat** (recommended) â€” handles plurals, gender, select, nested formats. Supported by FormatJS, i18next, react-intl.
   - **Plain key-value** (gettext-style) â€” simpler but breaks on plurals + CJK counter words
5. **Pick library.**
   - **next-intl** for Next.js App Router (recommended for Next stack)
   - **i18next + react-i18next** for general React
   - **FormatJS / react-intl** for ICU-heavy apps
6. **Wire formatting via Intl APIs (built-in, no library):**
   - `Intl.NumberFormat(locale, { style: 'currency', currency })` â€” money
   - `Intl.DateTimeFormat(locale, options)` â€” dates
   - `Intl.RelativeTimeFormat(locale)` â€” "3 days ago"
   - `Intl.PluralRules(locale)` â€” plural category
   - `Intl.Collator(locale)` â€” sort
7. **RTL support.**
   - `<html dir="rtl">` for Arabic/Hebrew locales
   - Use logical CSS properties (`margin-inline-start` not `margin-left`, `padding-block`, `text-align: start`)
   - Mirror icons that imply direction (chevrons, back arrows)
   - Test with pseudo-RTL early
8. **Translation pipeline.**
   - Source-of-truth: `messages/en.json` in repo
   - Push to translation tool (Crowdin, Lokalise, POEditor, Phrase) on merge to main
   - Pull translated catalogs into `messages/<locale>.json` via PR
   - CI fails if a key is missing in primary locales (machine-translate as placeholder is acceptable, mark `__machine__: true`)
9. **Translator context.** Every string ships with description + max length. No bare `"Submit"` keys.
10. **Pseudo-locale testing.** Add `en-XA` pseudo-locale that wraps strings (`[!! Submit !!]`) â€” catches hard-coded strings + truncation early. Run before every release.
11. **Locale-aware routing in Next.js.**
    - `next.config.js` `i18n` config (or middleware in App Router)
    - 301 redirect from `/` to detected locale
    - Hreflang tags on every page
12. Document in `docs/design/i18n.md` + scaffold `lib/i18n.ts`.

## Output Format (i18n.md)

```markdown
# Internationalization Design

**Last updated:** YYYY-MM-DD
**Library:** next-intl (Next.js App Router)
**Format:** ICU MessageFormat
**Source locale:** en
**Translation pipeline:** Crowdin
**Detection:** URL path (`/<locale>/...`)

## Locales

| Locale | Language | Region | Script | RTL | Status | Coverage |
|---|---|---|---|---|---|---|
| en | English | global | Latin | no | source | 100% |
| en-GB | English | UK | Latin | no | live | 100% |
| fr | French | global | Latin | no | live | 95% |
| fr-CA | French | Canada | Latin | no | live | 80% |
| de | German | global | Latin | no | live | 90% |
| es | Spanish | global | Latin | no | live | 85% |
| ja | Japanese | Japan | CJK | no | live | 70% |
| ar | Arabic | global | Arabic | **yes** | beta | 40% |
| he | Hebrew | Israel | Hebrew | **yes** | planned | 0% |

## Fallback Chain

```
fr-CA â†’ fr â†’ en
ar-MA â†’ ar â†’ en
ja-JP â†’ ja â†’ en
```

Ultimate fallback: `en`. Always render *something*.

## Routing

- URL: `/<locale>/<path>` (e.g., `/fr/dashboard`)
- Default redirect: `/` â†’ `/<detected-locale>/` (Accept-Language header, 301)
- User override: locale switcher in nav, persisted in cookie + URL
- `<link rel="alternate" hreflang="fr">` per page

## Message Catalogs

Location: `messages/<locale>.json`

```json
{
  "auth.signIn.title": "Sign in to {productName}",
  "auth.signIn.cta": "Sign in",
  "cart.itemCount": "{count, plural, =0 {No items} =1 {# item} other {# items}}",
  "checkout.priceDue": "{amount, number, ::currency/USD}"
}
```

## Translator Context

Each key has paired metadata in `messages/_meta.json`:

```json
{
  "auth.signIn.cta": {
    "description": "Button label on sign-in form",
    "maxLength": 20,
    "context": "primary CTA, single-word preferred"
  }
}
```

## Formatting

| Type | API | Example |
|---|---|---|
| Currency | `Intl.NumberFormat(locale, { style: 'currency', currency })` | `1.234,56 â‚¬` (de), `$1,234.56` (en) |
| Number | `Intl.NumberFormat(locale)` | `1,234.56` (en), `1.234,56` (de) |
| Date | `Intl.DateTimeFormat(locale, opts)` | `10/05/2026` (en-GB), `2026/05/10` (ja) |
| Relative time | `Intl.RelativeTimeFormat(locale)` | `il y a 3 jours` |
| Plural rules | `Intl.PluralRules(locale)` | one/few/many/other |

NEVER concatenate localized strings. Use ICU placeholders.

## RTL Support

For Arabic, Hebrew, Persian, Urdu:

- `<html lang="ar" dir="rtl">`
- All CSS uses logical properties:
  - `margin-inline-start` not `margin-left`
  - `padding-block-end` not `padding-bottom`
  - `text-align: start` not `text-align: left`
- Icons that imply direction get mirrored via `transform: scaleX(-1)` in `[dir="rtl"]`
- Test: visit any RTL page â†’ eyeball mirroring + scroll behavior

## Translation Pipeline

```
dev edits messages/en.json
   â†“ push to main
GitHub Action pushes to Crowdin
   â†“ translators work in Crowdin
weekly: Crowdin webhook opens PR with messages/<locale>.json updates
   â†“ CI: lint + type-check + pseudo-locale render
   â†“ merge
deploy
```

## CI Gates

- All locales must have â‰¥ 90% key coverage for primary release locales (en, fr, de, es, ja)
- Beta locales (ar, he) allowed at â‰¥ 40%, marked `[beta]` in switcher
- Pseudo-locale (`en-XA`) renders without overflow on all critical screens
- New string in `en.json` without `_meta.json` entry â†’ CI fails

## Analytics

- Add `locale` property to every event
- Add `locale_source` (`url` | `cookie` | `header`) to track detection accuracy
- Funnel by locale to catch translation regressions causing drop-off

## Out of Scope

- Currency conversion at checkout â€” see `payment` design
- Region-based pricing â€” see `cost-model`
- Right-to-left mirroring of marketing imagery â€” design system task
```

## Output Format (lib/i18n.ts skeleton)

```ts
// lib/i18n.ts â€” locale resolution + formatting helpers
import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "en-GB", "fr", "fr-CA", "de", "es", "ja", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const rtlLocales: Locale[] = ["ar"];

export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export function fallbackChain(locale: Locale): Locale[] {
  const map: Record<Locale, Locale[]> = {
    "en": ["en"],
    "en-GB": ["en-GB", "en"],
    "fr": ["fr", "en"],
    "fr-CA": ["fr-CA", "fr", "en"],
    "de": ["de", "en"],
    "es": ["es", "en"],
    "ja": ["ja", "en"],
    "ar": ["ar", "en"],
  };
  return map[locale] ?? [defaultLocale];
}

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  const messages = (await import(`../messages/${safeLocale}.json`)).default;
  return {
    locale: safeLocale,
    messages,
    timeZone: "UTC",
    now: new Date(),
  };
});

export function formatCurrency(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, opts ?? { dateStyle: "medium" }).format(date);
}

export function formatRelative(value: number, unit: Intl.RelativeTimeFormatUnit, locale: Locale): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}
```

## Boundaries

- Does NOT do translation itself â€” pipes to human translators / MT services.
- Does NOT cover content i18n (blog posts, marketing pages) â€” separate CMS concern.
- Does NOT cover legal-text translation â€” privacy policy / ToS in non-English markets need lawyer review per jurisdiction.
- Does NOT replace `a11y-design` â€” RTL + screen-reader lang attributes overlap; both required.

## Re-run Behavior

Single `docs/design/i18n.md` per product. Update locale table as markets added. `lib/i18n.ts` stable contract; expand `locales` array in place.

## Auto-chain

- New locale added â†’ `transactional-email` per-locale templates
- New locale added â†’ `a11y-design` re-run for that locale (lang attribute, screen-reader pronunciation)
- New locale added â†’ `analytics-spec` adds locale event prop
- RTL locale added â†’ `ui-wireframe` review for mirroring
- Currency added â†’ `payment-reconciliation` checks for currency drift

## Example Trigger

> "Plan i18n for the chess app â€” launching in French Canada and Japan next quarter."
