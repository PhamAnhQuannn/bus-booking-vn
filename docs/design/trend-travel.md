---
product-type: travel-booking (VN intercity)
corpus-size: 4 (knowledge-based, NOT live-captured)
captures: [vexere.com, 12go.asia, grab (app), be.com.vn]
generated: 2026-05-26
method: knowledge-based benchmark — no live web-design-capture corpus available; values
  derived from well-known characteristics of these apps, not extracted computed styles.
  Re-run /web-design-capture + this skill for empirical token tables when web access exists.
---

# Modern design direction — VN travel/booking

## Corpus read (knowledge-based)
- **Vexere** (VN bus leader): strong **orange-red** brand, clean white, **dense result list +
  sticky filter/sort rail** on desktop, prominent price, trust chips (free cancellation, refund),
  rounded-md cards, mobile-first.
- **12Go**: teal brand, multimodal route cards, balanced density, clear CTA, i18n.
- **Grab**: green brand, **confident bold full-width CTAs**, large rounded geometry, **icons
  everywhere**, real card elevation, **motion-forward** (tap feedback), friendly humanist type.
- **Be**: yellow/black brand, bold **brand-color fills** (header bands), rounded, playful-confident.

## Corpus metrics
| Dimension | Central tendency | Leading edge | Auto-pick |
|---|---|---|---|
| Palette | light default, one strong brand accent used confidently, warm/clean neutral | brand-color fills (header/hero bands), price in accent | **light, warm-neutral, single dominant ORANGE accent used boldly (fills, chips, price), teal only as sparing info** |
| Type | humanist/geometric sans, 400–700 | friendly rounded display, ~1.25 scale | **Be Vietnam Pro: display 600/700 + body 400/500, scale 1.25, mono for price/time** |
| Spacing | 4–8px base, balanced | dense lists / airy landing | **4px base; landing airy (gap-6/8), result lists dense (gap-2/3)** |
| Radius | soft 8–12, mixed | larger friendly rounding, pill primaries | **cards `rounded-xl` (~14px), inputs `rounded-lg`, primary buttons pill, chips/badges pill** |
| Shadow | single soft | layered + brand-tinted elevation | **layered warm elevation scale e1–e4 (low-alpha, warm hue), not flat** |
| Motion | minimal–moderate | moderate, ease-out, tap feedback | **moderate: ease-out 160ms / 240ms large, tap-scale feedback, list entrance stagger; reduced-motion safe** |
| Layout | mobile-first, card lists | hero-search landing + sticky filter rail results | **hero-search landing; results = dense list + sticky filter/sort rail (desktop); operator = dense dashboard tables; container ~max-w 1120** |
| Imagery | icons + trust badges | operator monograms, route/coach imagery | **lucide icons everywhere, trust row, operator monogram avatars, optional hero coach/route illustration** |

## Auto-picked direction (the decision — design-system consumes this)

**Palette** — light default. Warm-neutral ramp (already in `globals.css`). **One dominant accent:
orange `#EA580C`** used *confidently* — filled brand header/hero bands, primary CTAs, price,
active states, selection. Ink = warm near-black. **Teal `#115E59` only** for sparing
info/secondary chips (NOT co-equal — leaders use a single hero color, not dual). Status
green/amber/red unchanged.

**Typography** — Be Vietnam Pro. Display 600/700 (h1 `text-3xl/4xl`, h2 `text-2xl`, h3 `text-lg`),
body 400/500, scale ratio ~1.25, line-height 1.3 headings / 1.55 body, tight tracking on display.
Geist Mono for prices, booking refs, times.

**Spacing** — 4px base. Landing/airy sections `gap-6`→`gap-8`, `py-12/16`. Dense lists (results,
manifest, tables) `gap-2`→`gap-3`, tighter row padding.

**Radius** — `--radius` 12px. Cards `rounded-xl`, inputs/selects `rounded-lg`, **primary buttons
pill (`rounded-full`)**, badges/chips pill, surfaces `rounded-2xl`.

**Elevation** — warm-tinted layered scale (define as tokens):
- `e1` card resting: `0 1px 2px oklch(.3 .03 60 / .06), 0 1px 1px oklch(.3 .03 60 / .04)`
- `e2` raised/hover: `0 2px 8px oklch(.3 .03 60 / .08), 0 1px 2px /.06`
- `e3` sticky/popover: `0 8px 24px oklch(.3 .03 60 / .10)`
- `e4` modal: `0 16px 48px oklch(.3 .03 60 / .14)`

**Motion** — ease-out `cubic-bezier(.2,.8,.2,1)`; 160ms standard, 240ms larger surfaces; tap
active scale `0.98`; result/list entrance fade+rise stagger; hold-countdown pulse at T-2min.
All gated by `prefers-reduced-motion`.

**Layout** — landing: brand hero band + elevated search. Results: dense list + **sticky
filter/sort rail** on desktop (≥768px), single column mobile. Booking funnel: narrow centered
column + **step indicator**. Operator: dense dashboard tables inside the `(console)` sidebar shell.
Desktop content container `max-w-5xl/6xl`; funnel forms narrower.

## What makes VN travel-booking modern in 2026
A single **confident brand color** carried into filled surfaces (not timid accents), **dense
scannable result lists** with a sticky filter rail, **icon-rich** cards, **real elevation**, and
**snappy tap-feedback motion** — wrapped in friendly rounded geometry and a humanist VN typeface.
Trust is shown explicitly (payment marks, refund/cancellation chips, operator identity).

## Moves worth stealing (outliers)
- **Vexere** — sticky desktop **filter/sort rail** + sort tabs on results; explicit trust chips.
- **Grab** — **bold full-width primary CTAs** + big rounded tiles + tap-scale motion + icons on everything.
- **Be** — **brand-color filled header/hero band** as identity (we already started the orange hero).

## Next
- `/design-system` (Phase 1) consumes this: elevation tokens, pill primary, type scale, radius 12.
- Re-run `/anti-generic-design-check` WITH this as the corpus benchmark → corpus-delta.
