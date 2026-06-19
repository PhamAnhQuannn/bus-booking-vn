---
title: Customer Landing Page — Design Review (OTA benchmark)
date: 2026-06-05
scope: app/(customer)/page.tsx + components/home/*
method: internal design-doc audit + web crawl of OTA leaders
status: review only — 3 changes queued, not yet implemented
---

# Home Page Design Review — vs OTA Market Leaders

Reviewed the customer landing page against bus/travel OTA leaders and the project's own
design docs. Four questions: (1) layout/section-org, (2) "Tuyến đường phổ biến" UI treatment,
(3) section order, (4) animation.

## Current section order
1. **Hero** — full-bleed photo cover + floating search card + glass trust strip (`page.tsx:33`)
2. **FeatureHighlights** — "Vì sao chọn BBVN?" asymmetric bento (`components/home/FeatureHighlights.tsx`)
3. **PopularTrips** — "Tuyến phổ biến" horizontal photo-card carousel (`components/home/PopularTrips.tsx`)
4. **ContractCarRental** — charter showcase, tourism bento (`components/home/ContractCarRental.tsx`)
5. **IntroBanner** — full-bleed orange closing CTA band (`components/home/IntroBanner.tsx`)
6. **RouteDirectory** — "Tuyến đường phổ biến" text-link directory grouped by hub (`components/home/RouteDirectory.tsx`)

## Q1 — Layout / section organization: MOSTLY GOOD (2 gaps)
Matches the OTA-canonical sequence: hero+search first → trust in hero → visual popular-routes
high → text-link directory low (SEO) → footer. Confirmed against Vexere, 12Go, Busbud,
Traveloka, Rome2Rio.

**Gaps vs leaders:**
- **(a) PopularTrips cards have no price — biggest divergence.** Bus OTAs are price-forward:
  Vexere shows "Từ 250.000đ", 12Go "From $53" inline on every route card. The project's own
  `design-language.md §2` says "prices always mono + `text-primary`." Adding a starting-price
  line is the single highest-value home change. → Queued #1.
- **(b) Weak early trust/scale.** Leaders surface a scale stat early (Busbud "Join 75M+",
  Rome2Rio "969K bus routes", Traveloka partner logos). The site only has 3 small hero badges;
  "hàng nghìn nhà xe" is buried in the last section. → Queued #3.

## Q2 — "Tuyến đường phổ biến": table / card / border, or keep current? → KEEP TEXT-LINKS
RouteDirectory is the low-page **SEO discovery directory**. Every leader uses **plain grouped
text-links** here — no table, no cards, no borders (Vexere terminal-grouped links, Traveloka
massive footer directory, Rome2Rio 40+ text routes). Rationale:
- A **data table (origin/dest/price/duration) is a search-RESULTS pattern, never the home page.**
- Cards here would duplicate the PopularTrips visual treatment and bloat a section whose job is
  scannable SEO breadth.
- **Verdict: do not tableify, do not card-ify, do not border. Current text-link directory is
  correct.** If route *detail* (price) should be visible on the home, it belongs on the visual
  PopularTrips cards (Q1a), not here.

## Q3 — Section order: GOOD, one worthwhile tweak
- **Closing CTA should be the last beat before the footer.** Currently `IntroBanner` (CTA) sits
  *before* `RouteDirectory` (SEO text). Leaders end with the directory→footer and keep the big
  CTA last. Swap to `… RouteDirectory → IntroBanner → footer`. → Queued #2.
- `ContractCarRental` (charter) splits the two route sections — minor; acceptable as a
  cross-sell, but clustering route content is slightly tidier. No action.

## Q4 — Animation needed? → NO. Already at/above norm.
Crawl finding: OTA landings are **motion-restrained** — functional motion only (carousel nav,
hover lift, dropdown expand). **Zero parallax, zero scroll-reveal; ken-burns not found on any
leader.** Trust-first payment products deliberately avoid delight-motion (reads as
"entertainment," slows perceived performance). The site already runs ken-burns (hero) + blob
drift (IntroBanner) + hover-lift + image-zoom (cards) — i.e. *more* motion than the leaders.
**Do not add animation.** The project's own `motion-direction-spec.md` agrees: "functional, not
decorative; 150–200ms; reduced-motion hard requirement." Optional section-entrance stagger is in
spec but not needed. (Decorative ken-burns/blob are slightly above norm but harmless —
reduced-motion gated.)

## Queued changes (NOT yet implemented)
| # | Change | Target | Dependency / risk |
|---|--------|--------|-------------------|
| 1 | Add starting-price to PopularTrips route cards (mono, `text-primary`) | `components/home/PopularTrips.tsx` | **Blocked on price source** — routes are hard-coded with no price. Needs a min-price lookup (cheapest upcoming trip per origin/dest) or a static "Từ Xđ" seed. **Do not invent fake prices.** |
| 2 | Swap last two sections so CTA is final beat | `app/(customer)/page.tsx` | Trivial reorder — render `<RouteDirectory />` before `<IntroBanner />`. |
| 3 | Add early trust/scale strip near hero | `app/(customer)/page.tsx` (+ maybe a new `components/home/` strip) | If a count is claimed it must be real (no fake-precise number); else qualitative copy ("hàng nghìn nhà xe · toàn quốc" + payment marks). |

## Decided — no action
- RouteDirectory stays text-links (Q2).
- No new animation (Q4).

## Sources
**OTA homes crawled:** vexere.com, 12go.asia, baolau.com, busbud.com, thetrainline.com,
traveloka.com, rome2rio.com.
**SEO pattern refs:** mightytravels.com (Rome2Rio SEO), sammyseo.com (Rome2Rio SEO deep-dive).
**Internal:** docs/design/visual-mood-board.md, design-language.md (§2 typography/price, §3
layout, §6 motion), motion-direction-spec.md, pages/customer-pages.md, anti-generic-audit.md,
benchmarks/ota-capture.md, benchmarks/ota-gap-analysis.md.
