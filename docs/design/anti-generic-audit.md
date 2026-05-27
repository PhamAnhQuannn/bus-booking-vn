---
audited: 2026-05-26
target: app/globals.css + docs/design/design-system.md + live UI (docs/dev/screenshots/review-*.png)
product-type: travel/booking marketplace
corpus-benchmark: NONE (no docs/design/trend-*.md — corpus-delta half skipped; run /design-trend-compare for the travel/booking segment to enable it)
genericness-score: 0.54
band: generic-leaning
---

# Anti-generic design audit — Bus-Booking VN

Standalone 13-tell checklist (corpus benchmark unavailable). Audited the live built UI
+ tokens after the design-system migration + orange-primary change.

## 13-tell checklist

| # | Tell | Result | Note |
|---|------|--------|------|
| T1 | Default font | **flag** | Geist-only intent, no display face, no rationale — AND currently broken (binds to serif fallback, see review #1). Doubly generic. |
| T2 | Slate-only neutrals | **flag** | Pure-grayscale ramp (chroma 0), zero warmth. Clinical next to a warm orange brand; warm-tinted neutrals would cohere. |
| T3 | Single safe accent | pass | Orange is a deliberate, non-default brand choice (not the stock purple/blue). Caveat: no secondary accent + no usage rules doc. |
| T4 | KPI-grid headline | pass | No stat-card row anywhere. |
| T5 | Rigid symmetric grid | **flag** | Every screen is one centered column; no asymmetry, no break-out, no sidebar/rail on customer side. |
| T6 | Uniform radius | pass | Radius IS role-differentiated (badge `sm`, button/input `lg`, card `xl`) per design-system scale. |
| T7 | Generic shadow stack | **flag** | Only `shadow-sm` soft-black on every card; no elevation scale, no brand-tinted or flat/inset variation. |
| T8 | No / generic motion | **flag** | No motion in the built UI at all (`motion-direction-spec.md` exists but is unapplied). |
| T9 | Gradient-blob hero | pass | No hero at all (which is its own problem — see T13 — but not the blob cliché). |
| T10 | Centered max-w everything | **flag** | `max-w-md`/`max-w-2xl mx-auto` on every page; content floats mid-canvas on desktop, no full-bleed. |
| T11 | Emoji-as-icon | pass | No emoji — but ALSO no icon system (`lucide-react` installed, unused). "Pass" only because nothing stands in for icons; add a real set. |
| T12 | One-weight typography | pass | Multiple weights (bold headings / medium / normal) in use. |
| T13 | No layout personality | **flag** | Every screen is cards-in-a-column. No editorial home, no dense operator list, no asymmetric search. Uniform = forgettable. |

**Genericness score: 7 flags / 13 = 0.54 — generic-leaning. Meaningful rework needed** (not a full reset; the bones are sound).

## Corpus delta
Skipped — no `docs/design/trend-travel.md` / `trend-marketplace.md`. Recommend `/design-trend-compare`
on the VN travel/booking segment (Vexere, 12Go, Baolau, Grab) to benchmark and catch
collective genericness the checklist can't.

## Divergent moves (prioritized)

1. **[T1 — do first, it's also a bug] Fix the font, then add a display face.**
   Bind `--font-sans` to Geist (1-line, review #1). Then pair a **Vietnamese-diacritic-complete
   display face** for h1/h2. ⚠️ Hard constraint: the face MUST render `đ ơ ư ạ ầ ể …` + stacked
   tone marks — most trendy display fonts fail this. Safe, characterful, VN-built options:
   **Be Vietnam Pro** (designed for Vietnamese; warm, modern — strong brand fit), or Lexend /
   Manrope (full VN coverage). Reserve display for headings; Geist/Be-Vietnam-Pro for body.

2. **[T2] Warm-tint the neutral ramp.** Shift the grayscale toward a warm stone (tiny chroma
   at hue ~60–70): e.g. `--background: oklch(0.99 0.004 70)`, `--muted`/`--border` warmed to
   match. Pairs the surfaces with the orange brand so the page reads warm, not clinical.

3. **[T10/T5/T13] Break the centered-column monotony — give each context its own layout.**
   - Home: full-bleed **orange hero band** with value-prop headline ("Đặt vé xe khách trong 30 giây")
     + the search card elevated over it + a trust row (MoMo/ZaloPay marks, operator count).
   - Search results: wider container + a **sticky filter/sort rail** on desktop; denser list rows.
   - Operator: lean into the existing sidebar shell as the "product" surface; dense tables.

4. **[T7] Elevation + warm shadow.** Replace the single `shadow-sm` with a 3-step elevation
   scale; tint shadows warm (low-alpha orange/brown) for brand cohesion; flat-bordered cards
   for dense lists (results, manifest), elevated cards for primary actions.

5. **[icons / T11] Adopt `lucide-react`.** Route arrow (→), clock (departure), users/seat
   (ticket count), phone (operator contact), wallet/card (payment), map-pin (pickup). Icons in
   result cards, booking summary, manifest, status badges.

6. **[T8] Apply the motion spec.** Subtle entrance/stagger on result cards, button press
   feedback, hold-countdown pulse at T-2min, page transitions. Honor `prefers-reduced-motion`
   (already a design-system a11y rule).

7. **[T3] Add a secondary accent + orange usage rules.** A deep teal or navy for non-primary
   emphasis/info (keeps orange for action). Document when orange is filled vs tint vs text.

## Re-run
After applying moves 1–4, re-run this audit; score should drop below ~0.30. If it doesn't,
the moves were cosmetic. Enable the corpus delta by running `/design-trend-compare` first.

## Auto-chain
- Direction for the warm palette + display face + layout personality → `/visual-mood-board`.
- Benchmark vs market leaders → `/design-trend-compare` (travel/booking).
- Header logo for the hero/shell → `/logo-brief`.
