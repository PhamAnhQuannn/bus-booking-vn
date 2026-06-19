# Visual Mood Board — Bus-Booking VN
**Date:** 2026-05-26
**Mood:** Warm · Trustworthy · Brisk · Local-Vietnamese
**Anchor brand color:** Orange (Tailwind orange-600 `#EA580C`) — already set in `app/globals.css`.

Direction doc that turns the orange token + the two audits
(`review-20260526.md`, `anti-generic-audit.md`, score 0.54) into a concrete, implementable
visual identity. Built to drop the genericness score below ~0.30.

## Vibe sentence
> "Feels like a friendly Vietnamese coach-station counter if it ran on a modern fintech app —
> warm and human, but fast and dependable."

## Feel adjectives (and what they reject)
- **Warm** — VN hospitality; warm-tinted neutrals + orange, never clinical slate.
- **Trustworthy** — payment + SMS-of-record product; calm structure, clear hierarchy, no gimmicks.
- **Brisk** — "book in 30s"; snappy motion, dense where it counts, no fluff.
- **Local-Vietnamese** — diacritic-perfect type, VN-built font, local idiom — not an imported SaaS template.

## Reference grid (annotated; capture live via /web-design-capture later)
| # | Source | Why it works | Pull this |
|---|--------|--------------|-----------|
| 1 | Vexere (vexere.com) — VN bus market leader | familiar booking flow, orange-ish energy | result-list density, trust row |
| 2 | 12Go.asia | clear multimodal route cards, strong CTA | route-card structure + icons |
| 3 | Grab (app) | warm, confident, brisk; great VN diacritic type | motion brevity, button confidence |
| 4 | Be (be.com.vn) — VN super-app | local warmth, rounded friendly forms | warm palette, rounded geometry |
| 5 | Off-category: VN coffee/banh-mi packaging | warm cream + burnt-orange + ink | neutral warmth + accent pairing |
| 6 | Off-category: train-station departure boards | dense, scannable, monospace times | mono for times/prices, dense rows |
| 7 | Be Vietnam Pro type specimen | VN-designed, full diacritics, modern | display + body typeface |
| 8 | Airbnb stays cards | elevation + photo + price hierarchy | card elevation, price emphasis |
| 9 | Linear | snappy short ease-out motion | easing character |

## Color palette
Warm-tinted neutrals (move off pure grayscale) + orange anchor + a calm teal secondary for
info/non-action emphasis. oklch values are implementation-ready for `app/globals.css`.

| Role | Hex (approx) | oklch | Notes |
|------|------|-------|-------|
| Ink (foreground) | #1C1714 | `oklch(0.22 0.012 60)` | warm near-black text |
| Brand / primary | #EA580C | `oklch(0.646 0.222 41.116)` | CTAs, active, focus (already set) |
| Primary hover / link-on-white | #C2410C | `oklch(0.566 0.20 38)` | deeper orange for `text-primary` links to hit 4.5:1 on white |
| Secondary accent (teal) | #115E59 | `oklch(0.43 0.07 192)` | info, secondary emphasis, operator chips — NOT actions |
| Gold micro-accent | #E0A52E | `oklch(0.77 0.13 80)` | sparing: verified/trust ticks only |
| Background (warm white) | #FCFBF8 | `oklch(0.99 0.004 80)` | page bg (was pure white) |
| Card surface | #FFFFFF | `oklch(1 0 0)` | raised surfaces stay pure white for contrast |
| Muted fill | #F5F2EB | `oklch(0.965 0.006 75)` | section bands, subtle fills |
| Border | #E7E1D6 | `oklch(0.91 0.008 75)` | warm dividers (was cold gray) |
| Muted foreground | #6E665A | `oklch(0.52 0.012 70)` | metadata, labels |
| Success / Warning / Error | (keep existing) | — | green / amber / red tokens unchanged |

**Orange usage rules:** filled orange = primary action + price only. Links/inline = deeper
orange (`#C2410C`) for contrast. Never orange-on-orange; never orange for body text. Teal
carries info/secondary so orange stays "the action color."

## Typography
**Single VN-safe family + mono.** Hard constraint met: full Vietnamese diacritics (đ ơ ư +
stacked tones).
- **Display (h1/h2, hero, CTAs):** **Be Vietnam Pro** 600/700 — VN-designed, warm, modern.
- **Body / UI:** Be Vietnam Pro 400/500 (same family → one load, guaranteed diacritics).
- **Mono (prices, booking refs, times):** Geist Mono (already wired) or JetBrains Mono.
- Weights to load: 400, 500, 600, 700.
- **Implementation:** add via `next/font/google` `Be_Vietnam_Pro` → `--font-be-vietnam`;
  map `--font-sans: var(--font-be-vietnam)` and add `--font-display: var(--font-be-vietnam)`
  in `@theme`. **This also fixes the review #1 serif bug** (the broken `--font-sans` binding).

## Iconography
- **`lucide-react`** (installed, unused). Stroke ~1.75px, rounded joins, size 16/20.
- Map: `ArrowRight` (route), `Clock` (departure), `Users`/`Armchair` (ticket count/seats),
  `Phone` (operator contact), `Wallet`/`CreditCard` (payment), `MapPin` (pickup), `Bus` (trip).
- Use in result cards, booking summary, manifest rows, status badges, empty states.

## Surface & elevation
- **Warm-tinted shadows** (brown/orange, very low alpha) not flat black — brand cohesion.
- 3-step scale: `flat` (1px warm border — dense lists: results, manifest) → `raised` (sm warm
  shadow — standard cards) → `floating` (md warm shadow — hero search card, modals).
- **Hero band:** full-bleed warm-orange (`#FFF3EC` tint or solid orange) behind the home search
  — the brand surface the audit said is missing (T13).

## Spacing rhythm
- Keep 4px base. Generous vertical section rhythm (`py-12`/`py-16` between bands).
- Customer pages: content container `max-w-5xl` with **anchored top** layout + asymmetric hero,
  not a lonely centered `max-w-md` mid-canvas (fixes T10).
- Operator: dense tables, tighter rhythm (it's a workspace).

## Motion references
| # | Reference | How it moves | Pull this |
|---|-----------|--------------|-----------|
| 1 | Grab | brief, confident, ease-out | easing character |
| 2 | Linear | snappy ~150–200ms, sparing | motion presence |
- **Easing:** snappy ease-out, ~160ms standard / 240ms for larger surfaces.
- **Presence:** balanced (not motion-forward). Animate: result-card entrance (subtle stagger),
  button press, hold-countdown pulse at T-2min, page/route transitions. Honor
  `prefers-reduced-motion`. Feeds `/motion-direction-spec`.

## Layout personality
- **Picked: spacious-editorial (customer) + dense (operator).**
- Customer: hero-led home (warm band + value prop + elevated search + trust row), editorial
  result list with icons, generous booking flow with a step indicator.
- Operator: dense, table-driven workspace inside the existing `(console)` sidebar shell.
- **Explicitly NOT** uniform cards-in-a-column (the current T13 failure).

## Anti-mood board (NOT this)
| # | Reference | Why we reject |
|---|-----------|----------------|
| 1 | Purple/blue gradient-blob SaaS hero | generic AI-app cliché (T9); distrustful for payments |
| 2 | Cold slate dashboard + KPI stat-card row | clinical, wrong warmth (T2/T4); not a consumer travel feel |
| 3 | Neon/cyber dark aesthetic | wrong audience (VN families booking buses) |
| 4 | Emoji as icons | unprofessional for a payment product (T11) |

Cross-checked vs 13-tell checklist: this direction resolves T1 (Be Vietnam Pro display),
T2 (warm neutrals), T7 (warm elevation scale), T8 (motion), T9 (no blob), T10/T13 (layout
personality + hero). Projected post-implementation genericness ≈ 0.15–0.23.

## Vibe check
Pending — show 3 prospects + 1 designer; confirm the "warm / trustworthy / brisk / local"
triangle holds. (Not yet run.)

## Next
- Logo/wordmark within this direction → `/logo-brief`.
- Encode palette + fonts + shadow scale as tokens → update `app/globals.css` + `/design-system`.
- Benchmark vs VN travel leaders → `/design-trend-compare`.
- Motion spec → `/motion-direction-spec`.
- Then an implementation task: app shell + hero + icons + warm tokens.
