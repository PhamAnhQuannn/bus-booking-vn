# Logo Brief — Bus-Booking VN
**Date:** 2026-05-26
**Name:** BBVN (Bus-Booking VN) · customer-facing title "Đặt vé xe khách"
**Direction source:** `docs/design/visual-mood-board.md` (Warm · Trustworthy · Brisk · Local)

Adapted: no external designer / budget — this brief is scoped to be **implemented in-code as an
SVG React component** (Tailwind v4 + Be Vietnam Pro + `lucide-react` already in stack). Aim:
ship a real mark in the header + favicon in ~2 hours, no design-tool dependency.

## Logo type
**Picked: Combination (glyph + wordmark).**
**Why:** short name → a glyph carries favicon/app-icon (16px) while the wordmark carries the
header. The product's essence is "route + date, not a seat map" — every screen already shows
`Origin → Destination`, so a **route glyph** (two stops joined by a path/arrow) is the most
honest, recognizable mark.

## Concepts

### ⭐ Concept A — "Route mark" (recommended)
- **Glyph:** two dots (origin ● and destination ●) joined by a short orange path that ends in
  an arrowhead — a stylized `●—→●`. Reads as a journey/route; nods to the pervasive `→` in the
  UI. At favicon size, the glyph alone is legible.
- **Wordmark:** `BBVN` in **Be Vietnam Pro 700**, ink (`#1C1714`); OR the full "Đặt vé" with
  the route-arrow replacing the space.
- **Color:** orange path + arrow (`#EA580C`), ink dots/wordmark. Monochrome = all ink or all orange.
- **Why it wins:** product-true, ASCII wordmark (no diacritic risk in the lockup), trivially
  SVG/CSS-drawable, scales to 16px.

### Concept B — "Squircle lettermark"
- Rounded orange squircle tile containing `BB` (Be Vietnam Pro 700, white) — app-icon native;
  wordmark "BBVN" sits to the right. Familiar VN super-app feel (Be/Grab). Safe, slightly less
  distinctive than A.

### Concept C — "Wordmark accent" (cheapest — already half-shipped)
- Pure wordmark "Đặt **vé** xe khách" with "vé" in orange (the landing already does this), the
  dot on a custom mark or the arrow tucked into the "é". ⚠️ Requires Vietnamese diacritics in the
  logo itself (đ, é) — fine for header, weaker as a square app icon/favicon.

## Usage contexts
| Surface | Min size | Variant |
|---------|----------|---------|
| Favicon | 16×16 | glyph only (Concept A route mark / B squircle) |
| Apple touch / app icon | 180–1024 | glyph on warm bg, rounded mask |
| Header bar | 28–32px tall | combo horizontal |
| OG / social image | 1200×630 | combo centered on warm band |
| PDF ticket header (`@react-pdf`) | ~120×40 | combo or wordmark, mono-safe |
| SMS / plain text | n/a | name text "BusBookVN" (already used in templates) |
| Operator console sidebar | 24–28px | glyph + short wordmark |
| Empty states / loading | 32–48px | glyph, muted |

## Constraints
- **Monochrome single-color version required** (PDF ticket, print, fax) — both glyph + wordmark
  must hold in one ink color.
- **Legible at 16px** (glyph only below ~80px wide).
- Two aspect ratios: **1:1** (glyph/app icon) + **~3:1** (horizontal combo).
- Colors from mood board: orange `#EA580C`, ink `#1C1714`, warm bg `#FCFBF8`, teal `#115E59` (sparingly).
- Font: **Be Vietnam Pro** (700 wordmark) — the one display family; no second font.
- SVG-first, implementable as a React component (`components/brand/Logo.tsx`) with `currentColor`
  so it inherits monochrome contexts. Clearspace = glyph height × 1.

## Avoid
- Gradients, drop shadows, 3D, bevels.
- Photographic elements (real buses/roads).
- More than one font; script/Lobster-style fonts.
- Swooshes / speed lines / motion streaks.
- Generic icons: gear, lightbulb, globe, infinity, generic bus side-view clipart, location-pin-as-logo.
- "AI startup" signals: sparkles, atoms, robot faces.

## Loved references
| # | Logo | Why |
|---|------|-----|
| 1 | FedEx | hidden arrow = motion/direction done with restraint (our route-arrow echoes this) |
| 2 | Grab | warm, confident, VN-market-fluent, single strong color |
| 3 | Citymapper | transit dots-and-lines motif, friendly + functional |

## Rejected references
| # | Logo | Why |
|---|------|-----|
| 1 | Generic SaaS cube/hexagon | forgettable, says nothing about travel |
| 2 | Gradient swoosh "motion" logos | dated web-2.0; conflicts with flat warm direction |
| 3 | Detailed bus illustration | doesn't scale to 16px, clutter |

## Deliverables (in-code)
- [ ] `components/brand/Logo.tsx` — props: `variant="glyph"|"combo"`, inherits `currentColor`.
- [ ] SVG glyph + combo (inline, no asset pipeline).
- [ ] `app/icon.svg` (favicon) + `app/apple-icon.png` (Next.js metadata convention).
- [ ] Monochrome verified (render in one ink color).
- [ ] Used in: customer header (new), operator sidebar, PDF ticket header, OG image.
- [ ] Dark variant (orange + near-white wordmark) for `.dark`.

## Budget + timeline
- **Budget: $0** — built in-code (SVG component), no external designer.
- **Effort:** ~2h for Concept A glyph + wordmark + favicon + header placement.
- **Decision needed from user:** pick Concept A / B / C before implementation.

## Next
- User picks a concept → implement `Logo.tsx` + favicon + header shell (part of the broader
  "app shell + hero" implementation task from `review-20260526.md`).
- Tokenize alongside `/design-system` (font + color already specced in the mood board).
