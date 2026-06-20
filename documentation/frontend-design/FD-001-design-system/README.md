# DS-018 Design System

## Component Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Primitives | `@base-ui/react` | 1.4.1 |
| Recipes | `shadcn` | 4.7.0 |
| Styling | Tailwind CSS v4 | PostCSS, `@theme inline` |
| Variants | `class-variance-authority` (CVA) | — |
| Class merge | `clsx` + `tailwind-merge` via `cn()` (`lib/utils.ts`) | — |
| Icons | `lucide-react` | 1.16.0 |

All interactive components wrap Base-UI headless primitives and are styled with Tailwind utilities. Every UI component carries `data-slot="component-name"` for scoped styling and test selectors.

## Color System (OKLCH)

Colors defined as CSS custom properties in `app/globals.css`.

### Light Theme (default)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.646 0.222 41.116)` (orange-600) | CTAs, links, focus rings |
| `--background` | `oklch(0.99 0.004 80)` | Page bg (warm near-white) |
| `--foreground` | `oklch(0.205 0.012 55)` | Body text |
| `--card` | `oklch(1 0 0)` | Card/popover (pure white) |
| `--muted` | `oklch(0.965 0.006 75)` | Disabled/secondary surfaces |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Errors, danger actions |
| `--border` / `--input` | `oklch(0.91 0.008 75)` | Borders, input outlines |

### Status Tokens

| Status | Bg | Fg | Border |
|--------|----|----|--------|
| Success | green-50 | green-900 | green-200 |
| Warning | amber-50 | amber-900 | amber-200 |
| Info | teal-50 | teal-900 | teal-200 |
| Danger | red tinted | destructive | red-200 |

### Dark Theme

CSS prepared under `.dark` selector. Primary shifts to orange-500. No toggle UI yet (Phase A scope).

### Chart Colors (5-series)

Orange (primary), teal, amber, green, indigo.

## Typography

| Role | Font | Variable |
|------|------|----------|
| Sans / Display | Be Vietnam Pro (400/500/600/700) | `--font-be-vietnam` |
| Monospace | Geist Mono | `--font-geist-mono` |

Vietnamese + Latin subsets. HTML `lang="vi"`.

**Scale:** Display `text-3xl`→`md:text-5xl` · Page title `text-2xl` · Section `text-lg` · Body `text-base` (16px) · Caption `text-sm`/`text-xs`.

## Spacing

Base unit: 4px (Tailwind `gap-1`). Common: `gap-2` (8px), `gap-4` (16px), `px-4` (16px), `py-8` (32px).

## Border Radius

Base `--radius: 0.75rem` (12px). Variants: `radius-sm` 7.2px · `radius-md` 9.6px · `radius-lg` 12px · `radius-xl` 16.8px. Buttons: `rounded-lg` or `rounded-full`.

## Elevation (Warm Shadows)

| Level | Shadow | Usage |
|-------|--------|-------|
| e1 | `0 1px 2px -1px oklch(0.3 0.03 60/0.10)` | Cards, inputs |
| e2 | `0 2px 8px -2px oklch(0.3 0.03 60/0.12)` | Raised |
| e3 | `0 8px 24px -4px oklch(0.3 0.03 60/0.14)` | Popovers |
| e4 | `0 16px 48px -8px oklch(0.3 0.03 60/0.18)` | Modals |

Warm 60deg hue tint pairs with orange brand.

## Component Inventory

### Primitives (`components/ui/`)

Button · Input · Select · Dialog · Tabs · Checkbox · RadioGroup · Card · Badge (neutral/success/pending/danger/count) · Alert (info/success/warning/error) · Table · Skeleton · Toast · Calendar · DatePicker · Combobox · Sparkline · Label

### Domain Components

| Directory | Contents |
|-----------|----------|
| `components/layout/` | SiteHeader, SiteFooter |
| `components/op/` | OperatorNav, ConsoleHeader, DataTable, KpiTile, FilterBar, EmptyState, etc. |
| `components/admin/` | AdminNav |
| `components/auth/` | AuthSplitLayout |
| `components/search/` | SearchForm, SearchFilters, BookButton |
| `components/booking/` | BookingSteps, BookingSummaryRail |
| `components/contact/` | ContactBookingForm |
| `components/home/` | IntroBanner, FeatureHighlights, PopularTrips, RouteDirectory, TrustStrip |
| `components/brand/` | Logo |
| `components/geo/` | AdminUnitPicker |
| `components/ticket/` | TripDetailCard |

## Grain Texture

SVG fractal noise overlay at `opacity-[0.04]` (light) / `opacity-[0.06]` (dark) for subtle depth.
