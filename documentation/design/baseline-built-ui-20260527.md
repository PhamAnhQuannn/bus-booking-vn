---
title: As-built UI baseline
date: 2026-05-27
supersedes-claims-in: review-20260526.md
status: authoritative snapshot of what ships today
---

# As-built UI baseline (2026-05-27)

Authoritative snapshot of what the running app actually renders today. Several
earlier audit docs predate the work landed 2026-05-26/27 and make false claims;
this doc is the source of truth for "current state". Downstream redesign docs
(design-language, patterns, page specs) cite **this**, not the stale reviews.

## STALE DOC CORRECTIONS — `review-20260526.md`
| Claim in review-20260526 | Reality today | Status |
|---|---|---|
| `--font-sans` undefined → serif fallback | `app/layout.tsx` loads **Be Vietnam Pro** (400/500/600/700) + Geist Mono; `--font-display`/`--font-heading` aliased | ✅ FIXED |
| No app shell (header/logo/nav/footer) | `components/layout/SiteHeader.tsx` (logo + nav + aria-current) and `SiteFooter.tsx` ship on all customer pages; operator console has branded sidebar (`components/op/OperatorNav.tsx`) | ✅ FIXED |
| Zero iconography | `lucide-react` used across home (Wallet/ShieldCheck/Bus), search (ArrowRight/Clock/Armchair), trip detail (MapPin/Phone/Timer), operator nav (per-item icons) | ✅ FIXED |
| Flat depth, single shadow | warm-tinted elevation scale `shadow-e1..e4` defined in `app/globals.css`, used on cards/search/hero | ✅ FIXED |
| Home is bare title + form | Home has gradient hero band, trust row (3 cards), search card | ✅ FIXED |
| No motion | `motion-safe:hover:-translate-y-0.5` + shadow transitions on cards; reduced-motion respected | ⚠️ PARTIAL (still minimal vs spec) |

`review-20260526.md` should be read only for its *layout-personality* critique (centered max-w column, density), which still partially applies.

## Current design truths (as-built)
- **Type:** Be Vietnam Pro (display+body, VN diacritics), Geist Mono (times/prices/refs).
- **Color:** warm oklch palette; brand **orange `#EA580C`** (light) / `#F97316` (dark); semantic `success`/`warning`/`destructive` tokens; sidebar tokens. Dark tokens exist, no toggle.
- **Elevation:** `shadow-e1` (resting) → `e4` (modal), warm-tinted.
- **Radius:** base 0.75rem; role scale `sm`→`4xl`.
- **Primitives** (`components/ui/`, base-ui + cva): Button, Input, Label, Card, Badge, Alert, Select, Dialog, Tabs, RadioGroup, Checkbox, Skeleton, Toast, Combobox, Table.
- **Shells:** customer SiteHeader/SiteFooter; operator left sidebar + mobile drawer.

## Route-by-route as-built status
Legend: Shell ✓ = uses standard shell · Icons ✓ · Prim ✓ = uses design-system primitives · Resp = responsive maturity (◐ partial).

### Customer
| Route | Shell | Icons | Prim | Notes / gaps vs OTA |
|---|:--:|:--:|:--:|---|
| `/` home | ✓ | ✓ | ✓ | Hero+trust+search. No popular-routes module (removed), no destination inspiration, thin footer trust. |
| `/search` | ✓ | ✓ | ✓ | Results list + collapsible filter panel + sort + ±1-day nav. Filter is a toggle panel, NOT a persistent sticky rail (OTA norm). Cards lack badges/amenities. |
| `/routes` | ✓ | ✓ | ✓ | Card grid + text filter. No imagery, no sort, no "from price" emphasis hierarchy. |
| `/trips/[id]` | ✓ | ✓ | ✓ | Facts grid + pickup + sticky price/CTA bar + ticket stepper. No fare tiers, no seat/amenity detail, no breadcrumb. |
| `/booking/customer` | ✓ | ◐ | ✓ | Form + 3-step indicator. No sticky order-summary rail. |
| `/booking/review` | ✓ | ◐ | ✓ | Summary card + payment radios (no icons) + hold timer. No summary rail; radios generic. |
| `/booking/result/[token]` | ✓ | ✓ | ✓ | Status polling (meta refresh). OK. |
| `/booking/confirmation/[token]` | ✓ | ✓ | ✓ | Success + details. No e-ticket/add-to-calendar/QR. |
| `/dev/stub-pay` | n/a | — | ✓ | Branded card + Button (this session). Dev-gated but live under PAYMENTS_STUB. |
| `/auth/*` (4) | ✓ | ◐ | ✓ | Functional forms. No split-layout/brand panel OTA style. |
| `/account/bookings` | ✓ | ◐ | ✓ | Upcoming/Past tabs + status badges + pagination. No "My Trips" card richness, no filters. |
| `/account/bookings/[id]` | ✓ | ◐ | ✓ | Detail + PDF. No manage-booking actions surface, no breadcrumb. |
| `/account/settings` | ✓ | ◐ | ✓ | Forms. No section nav. |
| `/terms`, `/privacy` | ✓ | — | ✓ | Legal text. No TOC/wayfinding. |

### Operator
| Route | Shell | Prim | Notes |
|---|:--:|:--:|---|
| `/op/login`, `/op/first-login` | auth | ✓ | Functional. |
| `/op/(console)/dashboard` (+`/[id]`) | sidebar | ✓ | Booking queue. Strong. |
| `/op/(console)/reports/overview` | sidebar | ✓ | KPI tiles + funnel bars. Tiles plain (no spark/compare). |
| `/op/(console)/reports/{revenue,payouts}` | sidebar | ✓ | Tables + filters + CSV. |
| `/op/(console)/{trips,routes,buses,trip-templates,staff}` | sidebar | ✓ | Data tables. Strong, consistent. |
| `/op/(console)/trips/[id]`, `manifest/[tripId]` | sidebar | ✓ | Detail/table. Trip detail sticky bar not aligned to customer card system. |
| `/op/(console)/upcoming`, `/profile` | sidebar | ✓ | OK. |
| `/op/staff/dashboard` | minimal | ✓ | Single-trip staff view. |

## Net assessment
Foundation (tokens, type, icons, primitives, shells) is **OTA-capable**. The gap to AA/ANA/Expedia is **layout/IA pattern sophistication applied consistently**: persistent filter rails, richer result/fare cards, multi-step checkout with sticky summary rail, manage-booking surfaces, breadcrumbs, trust signals, and responsive density. That gap is what Phases B–D address.
