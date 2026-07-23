# Landing Page — Full Colour Report

| | |
|---|---|
| **Date** | 2026-07-21 |
| **Target** | `http://localhost:3001/` (dev server) → `app/(customer)/page.tsx` → `HeroMarketingView` |
| **Tree** | `master` @ `32deaf0` **plus uncommitted landing-page work** (shell widening, section banding, IntroBanner inversion — see [What changed since the 2026-07-20 scan](#what-changed-since-the-2026-07-20-scan)) |
| **Method** | 3 **sequential** measurement passes (each building on the last) + 1 synthesis/adjudication pass |
| **Instrument** | `chrome-devtools` MCP; canvas 1×1 `getImageData` readback for colour resolution; Porter-Duff compositing to first opaque ancestor; real-JPEG pixel sampling for photo-backed text; `elementFromPoint` z-buffer grid for area distribution |
| **Viewports** | 390 · 768 · 1024 · 1440 · 1920 · 2560 |
| **Scope** | Measurement and verdicts only. **No design recommendations.** No source file was modified. |

Companion documents: [`landing-page-scan-20260720.md`](./landing-page-scan-20260720.md) (prior baseline, now partly superseded) · [`design-research-20260720.md`](./design-research-20260720.md) (the rule set).

---

## How to read this document

Passes ran **consecutively, not in parallel** — Pass 2 was given Pass 1's output and told to close its gaps; Pass 3 was given both and told to verify them adversarially. That structure is why this report can state which numbers are *confirmed by independent re-measurement* rather than merely *asserted once*.

Every figure below carries a confidence marker:

- **✔✔ verified** — measured in one pass, independently reproduced in a later pass
- **✔ single-source** — measured once, not re-checked
- **⚠ contested** — passes disagreed; adjudication given inline
- **~ sampled** — a representative subset was measured, not the whole population

The prior scan had a **3-for-3 error rate** on every item it cross-checked. That is why Pass 3's entire first section is verification rather than new measurement.

---

## 0. The measurement trap — read before trusting any hex

**This is the single most important methodological finding, and it invalidates a chunk of the prior scan's colour inventory.**

Tailwind v4's alpha-modifier utilities (`bg-primary/10`, `border-primary/20`, `text-primary/70`, `bg-muted/30`…) compile to:

```css
color-mix(in oklab, var(--token) NN%, transparent)
```

Chrome's `getComputedStyle` serialises that back as `oklab(<L> <a> <b> / <alpha>)`. If you then paint that string onto a **transparent** 1×1 canvas and read it back, the browser's premultiply → un-premultiply round-trip rounds each channel by ±1–2. The result *looks like* a new opaque hex but is an artifact.

This mechanism, discovered in Pass 2 and reproduced live in Pass 3, explains **every** "mysterious near-duplicate orange" in this codebase and in the prior scan:

| Artifact hex | Actually is | Alpha |
|---|---|---|
| `#f44900` | `text-primary/70` | 0.70 |
| `#f54b00` | `border-primary/20` | 0.20 |
| `#f54800` | `border-primary/40` | 0.40 |
| `#eb4500` | `bg-primary/10` | 0.10 |
| `#ef4a00` | `bg-primary/12` (IntroBanner blob) | 0.12 |
| `#f5f2ee` / `#f5f2f0` | `bg-muted/30` / `bg-muted/40` | 0.30 / 0.40 |
| `#fda972` | a pixel inside the IntroBanner blob footprint | composite |

**All seven are `--primary` or `--muted` at reduced alpha. None is an authored colour.** Pass 3 demonstrated the trap has *three* possible wrong answers for the same input: painting `bg-muted/30` on transparent canvas gives `#f5f2ee`; the prior scan's method gave `#fbf8f6`; the true composited render is **`#faf8f6`**.

**Rule for any future scan of this repo:** never resolve a colour by painting it on a transparent surface. Always composite over the element's *actual* backdrop first.

---

## 1. Adjudicated disagreements

| # | Claim | Pass 1 | Pass 2 | Pass 3 | **Adjudication** |
|---|---|---|---|---|---|
| 1 | `bg-muted/30` composite | `#fbf8f6` | `#faf8f6` | `#faf8f6` | **`#faf8f6`.** Two independent passes agree; Pass 3 gave the exact rendered pixel `rgb(250,248,246)`. Pass 1 wrong. |
| 2 | Hero asset at exactly 1920 | `3840.jpg` | `3840.jpg` | `3840.jpg` | **`3840.jpg`.** `--breakpoint-3xl` = 120rem = **1920px exactly**, and Tailwind `min-width` is inclusive. Pass 3 binary-checked the edge: 1919 → `1920.jpg`, 1920 → `3840.jpg`. Consistent with the prior scan. |
| 3 | Elements walked / zero-area | 811 / 212 | 811 / 212 | 811 / 212 | **✔✔ Confirmed exactly** by all three. |
| 4 | Colour-declaration-bearing elements | 338 | — | 337 | **337–338**, off-by-one in the `color` change-point count (121 vs 120). Immaterial; likely one ambiguous pseudo-element boundary. |
| 5 | `#f54a00` background element count | 2 elements / 3,905px² | — | **1 element** / same area | **1 element.** Area total reproduces exactly; the element count does not. Pass 1 miscounted. |
| 6 | "Zero double-counting in the background aggregate" | asserted true | — | **false** | **Pass 1's claim is wrong.** Its `#fdfbf9` row sums `<body>` (9,282,291px²) *plus* `<header>` and two buttons that are **nested inside body's own rect**. The total is arithmetically reproducible but is not a unique-pixel area. Superseded by Pass 3's z-buffer (§6). |
| 7 | "Every neutral carries positive lab-a/b" | — | — | 5 of 7 | **Nuanced.** The *warm neutral ramp* (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`) does carry positive a/b — the prior scan's claim holds for those. But `--card`/`--popover` (`#ffffff`) and `--primary-foreground` (`#fafafa`) are **exactly achromatic (a=0, b=0)**. Pure white is not a warm grey. The blanket phrasing is false; the design intent behind it is intact. |
| 8 | Rendered page width at "1920" | 1905 | 1905 | 1905 | **1905px.** A 15px scrollbar gutter is permanent. Every px² figure is against 1905, not 1920 — a ~0.8% shift if misread. |

---

## 2. Token inventory — `app/globals.css`

All tokens are authored in `oklch()` and mapped into Tailwind via `@theme inline` as `--color-*`. Hex values below are empirical canvas readbacks, validated against `lab(100% 0 0)`→`#ffffff` and `lab(0% 0 0)`→`#000000` before use. ✔✔

### `:root` (light — the only active theme)

| Token | Authored | Hex |
|---|---|---|
| `--background` | `oklch(0.99 0.004 80)` | `#fdfbf9` |
| `--foreground` | `oklch(0.205 0.012 55)` | `#1c1612` |
| `--card` / `--popover` | `oklch(1 0 0)` | `#ffffff` |
| `--card-foreground` / `--popover-foreground` | `oklch(0.145 0 0)` | `#0a0a0a` |
| **`--primary`** | `oklch(0.646 0.222 41.116)` | **`#f54a00`** |
| `--primary-foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| **`--primary-strong`** | `oklch(0.553 0.195 38.4)` | **`#ca3500`** |
| `--secondary` / `--muted` / `--accent` | `oklch(0.965 0.006 75)` | `#f6f3ef` |
| `--muted-foreground` | `oklch(0.52 0.012 70)` | `#6e6862` |
| `--border` / `--input` | `oklch(0.91 0.008 75)` | `#e4e1dc` |
| **`--ring`** | `oklch(0.646 0.222 41.116)` | **`#f54a00` — byte-identical to `--primary`** |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `#e7000b` |
| `--success` / `-foreground` / `-border` | — | `#f0fdf4` / `#0d542b` / `#b9f8cf` |
| `--warning` / `-foreground` / `-border` | — | `#fffbeb` / `#7b3306` / `#fee685` |
| `--info` / `-foreground` / `-border` | — | `#d8f5f5` / `#005f64` / `#b2e2e2` |
| `--chart-1..5` | — | `#f54a00` `#008384` `#c39900` `#3b9555` `#566cb7` |
| `--sidebar*` (8 tokens) | — | `#fafafa` `#0a0a0a` `#f54a00` `#f5f5f5` `#171717` `#e5e5e5` … |
| `--shadow-e1..e4` | `oklch(0.3 0.03 60 / .10–.18)` | `#3b271d`–`#372c1c` at α 0.10–0.18 |

### `.dark` — present but **inactive** (no `.dark` class on `<html>`)

Overrides `--background` `#0a0a0a`, `--primary` `#ff6900`, `--muted-foreground` `#a1a1a1`, etc.

> **`--primary-strong` is the only token NOT redefined in `.dark`.** It falls through to the `:root` value. ✔✔ (both Pass 1 and Pass 2 flagged this independently)

---

## 3. The real palette — authored vs artifact

**Defensible count: ~14 authored colours.** ✔ (Pass 3, traced to source)

- **10 distinct hex values from the token system** — fewer than the token count, because `--card`/`--popover` share `#ffffff`, `--secondary`/`--muted`/`--accent` share `#f6f3ef`, `--border`/`--input` share `#e4e1dc`, and `--ring` ≡ `--primary`.
- **2 hand-authored arbitrary literals**, both in `components/home/IntroBanner.tsx`: `bg-[#ffb682]` (the band field) and `bg-[#bd4700]` (the primary CTA, plus its pinned `hover:` and `[a]:hover:` variants).
- **1 gradient wash colour** — the hero's `rgba(255,247,237,*)` cream scrim.
- **1 elevation shadow colour** — the `--shadow-e*` family.

Everything else measured anywhere on this page — `#eb4500`, `#ef4a00`, `#f44900`, `#f54b00`, `#f54800`, `#fda972`, `#f5f2ee`, `#fdece5`, `#fbf9f6`, `#faf8f5`, `#fcfbf9`, `#fffefe` — is a **compositing artifact** of those 14. See §0.

This is a materially tighter palette than the prior scan's "18 distinct hex values" headline suggested, because that figure counted artifacts as colours.

---

## 4. Section map @1920 ✔✔

Rendered width 1905px (scrollbar gutter). Document height **4873px**.

| # | Section | y | height | width | Composited bg |
|---|---|---|---|---|---|
| — | `header` (sticky, z-40) | 0 | 96 | 1905 | `#fdfbf9` |
| 1 | `section#search` — hero | 96 | 756 | 1905 | *photo + scrims* |
| 2 | TrustStrip wrapper | 852 | 189 | 1905 | `#f6f3ef` |
| 3 | PopularTrips wrapper | 1041 | 381 | 1905 | `#faf8f6` |
| 4 | OperatorShowcase | 1422 | 302 | **1152** | transparent → `#fdfbf9` |
| 5 | FeatureHighlights wrapper | 1724 | 971 | 1905 | `#faf8f6` |
| 6 | ContractCarRental | 2695 | 888 | **1152** | transparent → `#fdfbf9` |
| 7 | RouteDirectory wrapper | 3583 | 490 | 1905 | `#faf8f6` |
| 8 | `section#intro-banner` | 4073 | 486 | 1905 | **`#ffb682`** |
| 9 | `footer` | 4607 | 266 | 1905 | `#faf7f5` |

The alternating `#fdfbf9` / `#faf8f6` banding is new since the prior scan, which recorded four consecutive identical `#fdfbf9` sections spanning ~2,600px. That finding (its §2.1, rated High) is **resolved**.

---

## 5. Responsive colour behaviour ✔✔

| Width | Rendered | scrollHeight | Active hero asset |
|---|---|---|---|
| 390 | 375 | 6949 | `landing-golden-1280.jpg` |
| 768 | 753 | 5784 | `landing-golden-md-1536.jpg` |
| 1024 | 1009 | 4867 | `landing-golden-1920.jpg` |
| 1440 | 1425 | 4865 | `landing-golden-1920.jpg` |
| 1920 | 1905 | 4873 | **`landing-golden-3840.jpg`** |
| 2560 | 2545 | 4873 | `landing-golden-3840.jpg` |

**No hex exists at only some breakpoints.** The palette is byte-identical across all six widths. Two breakpoint-dependent *effects* exist, both reusing already-catalogued colours:

- SVG stroke counts redistribute at 390 (mobile nav icon swap): `#fafafa`×7 / `#1c1612`×21 / `#6e6862`×14, versus `#fafafa`×4 / `#1c1612`×20 / `#6e6862`×18 elsewhere. Net 42 either way.
- Gradient count 21 @390 vs 22 elsewhere — the mobile hero scrim (`from-white/85 via-white/40 to-white/70`) *replaces* the two desktop scrims rather than adding to them.

Media queries match `window.innerWidth`, **not** scrollbar-deducted `clientWidth` — the two diverge by exactly 15px at every width. ✔✔

---

## 6. Whole-picture pixel distribution ✔ (Pass 3, z-buffer)

Measured by `elementFromPoint` on a 40px grid across the full scrolled page — 6,480 sample points over 1905×4912 ≈ 9,356,160px². **This method is double-count-free by construction**, one colour per cell, which is why it supersedes Pass 1's per-element sums (see adjudication #6).

| Colour | % of page | Role |
|---|---|---|
| `#fdfbf9` | **42.64%** | page background |
| `#faf8f6` | **24.34%** | `bg-muted/30` section bands |
| `#ffffff` | **12.10%** | cards |
| *photographic content* | **12.08%** | hero + destination + tourism + feature photos |
| `#ffb682` | **4.49%** | IntroBanner field |
| `#faf8f5` | 2.96% | footer (`bg-muted/40`) |
| `#ca3500` | 0.54% | `--primary-strong` CTA fills |
| `#f6f3ef` | 0.34% | TrustStrip band |
| `#f54a00` | 0.23% | `--primary` fills |
| `#bd4700` | 0.14% | IntroBanner CTA |
| `bg-primary/10` chips | 0.14% | icon/avatar tints |

**Neutrals + white = ~82% of the page. Photography 12%. All chroma combined ~5.5%.**

### Orange surface area

| Measure | px² | % of page |
|---|---|---|
| **Including IntroBanner** | ≈518,000 | **5.54%** |
| **Excluding IntroBanner** | ≈98,000 | **1.05%** |

By role: decorative field/tint (IntroBanner base + blob) 4.49% · CTA fills 0.77% · icon chips 0.14% · **zero orange in form-field fills**.

The ~5:1 dominance of a single element over this metric persists from the prior scan (which measured 97.7% concentration), though it has moderated substantially — the band is no longer saturated `#f54a00` but a light `#ffb682` tint. Against rule **C1** (`orange ≤ ~10% surface, never a field`), the percentage clause passes comfortably at 5.54%; the *field* clause remains a judgement call, since `#ffb682` is a pale tint rather than a saturated slab.

---

## 7. Text contrast audit ✔ (Pass 3)

**160 text-bearing elements.** Porter-Duff composite to first opaque ancestor; for photo-backed text, the actual served JPEG was loaded into an offscreen canvas, `background-position: cover` math replicated, all active gradient scrims applied analytically, then real pixels sampled beneath each text's bounding box.

| Verdict | Count |
|---|---|
| **PASS** | 126 |
| **FAIL** | 2 |
| Photo-composited (resolved below) | 32 |

> Pass 3 initially false-classified 17 elements as photo-backed merely because they were *DOM-descendants* of an `<img>` container. Requiring actual bounding-rect overlap reclassified all 17 to solid-backdrop PASS. Noted because it is exactly the kind of error that inflates a failure count.

### The 2 solid-background failures — both on the cookie banner

| Element | fg | bg | Size/wt | Ratio | Needs | |
|---|---|---|---|---|---|---|
| "Chính sách bảo mật" link | `#f54a00` | `#fcfbf9` | 14/500 | **3.47** | 4.5 | **FAIL** |
| "Chấp nhận" button | `#fafafa` | `#f54a00` | 14/500 | **3.43** | 4.5 | **FAIL** |

These are the same structural failure seen from both sides: **`--primary` `#f54a00` does not clear 4.5:1 against near-white, nor does white text clear it on `#f54a00`, at any normal size/weight.** This is the research doc's confirmed live bug #1, still present, now located on the cookie bar.

### Hero photo cluster — previously "indeterminate", now resolved

The prior scan rated these **Critical / unverified** and said the fix was to sample composited pixels. Done:

| Text | Size/wt | Large? | Needs | Worst | Typical | Best | Verdict |
|---|---|---|---|---|---|---|---|
| Badge "Đặt vé dễ dàng…" | 14/500 | no | 4.5 | 3.42 | 3.50 | 3.56 | **FAIL across entire footprint** |
| h1 "Đặt vé xe khách" `#1c1612` | 72/800 | yes | 3.0 | 12.61 | 15.27 | 17.05 | **PASS throughout** |
| h1 "trong 30 giây" `#f54a00` | 72/800 | yes | 3.0 | **2.44** | **2.93** | 3.44 | **FAIL across most of its footprint** |
| Subcopy `#1b1611` | 22/400 | no | 4.5 | 12.84 | 15.70 | 17.27 | **PASS throughout** |

**This resolves the prior scan's §3.1 (Critical) and §3.2.** The near-black h1 line is comfortably safe. The **orange** h1 line and the badge pill genuinely fail — and only the brightest patches of the photo lift "trong 30 giây" above 3:1 at all.

### Photo-card captions ~ sampled

One of ten destination cards was pixel-sampled in full:

| Text | Size/wt | Needs | Worst-case | Margin |
|---|---|---|---|---|
| City pair "Thanh Hóa → Sài Gòn" | 18/600 | 4.5 *(600 weight ⇒ not large text)* | **4.89** | 8.7% — thin |
| Price "Từ 960.000 ₫" | 14/600 | 4.5 | 5.65 | 26% |

The other 9 destination cards and 8 tourism cards use an identical `black/80 → transparent` scrim + text-shadow recipe but were **not individually sampled**. A brighter photo in the caption zone could plausibly push one below the 8.7% margin the sampled card shows. Coverage gap, not a clean bill of health.

### IntroBanner (current state) ✔✔

Field `#ffb682`, hue 25.0°. h2 `#1c1612` **10.46** · subcopy `foreground/80` **6.66** · badge `#ca3500` on white **5.22** · CTA1 label on `#bd4700` **4.95** · CTA2 label **17.90**. All PASS.

---

## 8. Non-text contrast — WCAG 1.4.11 (3:1) ✔

### Focus ring — the most consequential finding

`--ring` is **byte-identical to `--primary`** (`#f54a00`). Every focus indicator on the site resolves to it — both the native `outline` on `<a>` elements and the `focus-visible:ring-ring/50` box-shadow ring.

| Backdrop | Ratio | Verdict |
|---|---|---|
| `#ffffff` (card) | 3.58 | PASS, 19% margin |
| `#fdfbf9` (page) | 3.47 | PASS, 16% margin |
| `#faf8f6` (banded sections) | 3.38 | PASS, 13% margin |
| `#f6f3ef` (TrustStrip) | 3.24 | PASS, **8% margin** |
| **`#ffb682` (IntroBanner)** | **2.09** | **FAIL** |
| **`#ca3500` (primary-strong button)** | **1.46** | **FAIL** |
| **`#bd4700` (IntroBanner CTA)** | **1.44** | **FAIL** |

**Any control focused while sitting on the IntroBanner, or on an orange button, has an effectively invisible keyboard-focus indicator.** This is the research doc's confirmed bug #4, now quantified per-surface.

### Borders

`--border` / `--input` `#e4e1dc`: **1.26:1** against `#fdfbf9`, **1.30:1** against `#ffffff`. Far below 3:1 — card and input boundaries are carried by shadow and spacing, not by colour contrast, on every surface of this page.

### Button fills vs their field

`#ca3500` vs `#fdfbf9` **5.06** PASS · `#bd4700` vs `#ffb682` **3.02** PASS *(at the cap)* · `#f54a00` vs `#fdfbf9` **3.47** PASS as non-text — though the same colour fails as text.

---

## 9. Gradient and layer decomposition ✔ (Pass 2)

### Hero scrims @1440 over `landing-golden-1920.jpg`

Two stacked 90° layers — a cream gradient `rgba(255,247,237, .82→.66→.30→.08→0)` then a right-edge darken `rgba(0,0,0, 0→.2)` from 62%→100%:

| x | After cream | Final composite |
|---|---|---|
| 0% | `#ffedd0` | `#ffedd0` |
| 50% | `#ffd692` | `#ffd692` |
| 100% | `#080700` | `#060500` |

At 768/1024 the cream stops are the `md:` tier `.88/.72/.38/.12/0`; at ≥1280 the `xl:` tier `.82/.66/.30/.08/0`. Protection is weakest at the right edge — where the orange h1 line sits, which is consistent with its 2.44 worst-case.

### IntroBanner wash stack — resolves `#fda972`

`#ffb682` base ⊕ 135° `rgba(245,74,0, .04→.09)` wash ⊕ `bg-primary/12` blob (`blur(64px)`, organic radius, `-left-24 -top-16 size-96`, rendered rect inflated to 429×429 by the blur) ⊕ gold radial `rgba(252,211,77,0.22)` ⊕ noise `opacity-[0.04] mix-blend-overlay`.

Blob-centre pixel **`#fda971`**; a 121-point sample grid gives mode `#fdaa72`. **`#fda972` is one pixel inside the blob footprint, not an authored colour.** Section centre reads `#ffb27c`, far right `#feaf79` — the 135° wash alone shifts the base only 1–2 units.

### Photo-card scrims

20 instances @1920 share one formula: `linear-gradient(to top, oklab(0 0 0/0.8) 0%, oklab(0 0 0/0.15) 50%, transparent 100%)`.

### Element opacity < 1 — 6 elements ✔✔

2 noise overlays @ 0.04 · 1 disabled carousel arrow @ 0.4 · **3 `.reveal` grids at opacity 0** — these are the pre-animation state of an IntersectionObserver reveal; steady state is 1. Do not read as permanent.

---

## 10. Risk register — the silent-regression class

Pairs clearing their threshold by <10%:

| Pair | Ratio | Threshold | Margin |
|---|---|---|---|
| IntroBanner CTA fill vs field | **3.02** | 3.0 | **0.7%** |
| Focus ring vs `#f6f3ef` | 3.24 | 3.0 | 8.0% |
| Destination-card caption (worst sampled pixel) | 4.89 | 4.5 | 8.7% |
| Focus ring vs `#faf8f6` | 3.38 | 3.0 | 12.7% |

Outright failures, consolidated:

| Failure | Ratio | Needs |
|---|---|---|
| Focus ring on `#bd4700` | 1.44 | 3.0 |
| Focus ring on `#ca3500` | 1.46 | 3.0 |
| Focus ring on `#ffb682` | 2.09 | 3.0 |
| Hero h1 "trong 30 giây" (typical) | 2.93 | 3.0 |
| Hero badge pill | 3.42–3.56 | 4.5 |
| Cookie "Chấp nhận" button | 3.43 | 4.5 |
| Cookie policy link | 3.47 | 4.5 |
| `--border` vs any page surface | 1.26–1.30 | 3.0 |

**Token-role drift:** `--primary` at 10–20% alpha reads as a pale peach chip fill — a genuinely different visual role from the same token at full opacity. Not a defect, but it is the exact mechanism that produced the measurement errors in §0.

**Animation-dependent:** the `.reveal` opacity-0 state and the 22s IntroBanner blob were characterised in Pass 2 but **not reconfirmed live in Pass 3**.

---

## 11. What changed since the 2026-07-20 scan

| Prior finding | Status now |
|---|---|
| §2.1 Four consecutive `#fdfbf9` sections, ~2,600px undifferentiated (High) | **Resolved** — alternating `#fdfbf9` / `#faf8f6` banding |
| §6.1 Shell 1024 vs 1200–1280 floor (High) | **Partially** — now 1152 (`max-w-6xl`) |
| §3.1 Hero h1 contrast unverified (Critical) | **Resolved** — near-black line passes 12.6–17.1; **orange line fails at 2.44–2.93** |
| §4.1 Operator initials 3.12 (High) | **Resolved** — now `--primary-strong` |
| §8.1 Five AA failures, four in IntroBanner (Critical) | **Resolved** — band inverted to light field + dark ink; all current band text passes |
| §7 Orange 10.25%, 97.7% in one element | **Moderated** — now 5.54% / 1.05% without the band |
| §10 Hamburger 40×40 sub-44px | **Resolved** — 44×44 |
| §1.1 No spacing scale captured (High) | **Still open** — out of scope for a colour report |
| §9.1 No performance measurement (High) | **Still open** |
| `--ring` ≡ `--primary` (research doc bug #4) | **Still open, now quantified** — invisible on 3 surfaces |
| `button.tsx:12` default variant 3.56:1 (research doc bug #1) | **Still open** — surfaces on the cookie banner |

---

## 12. What was not measured

1. **9 of 10 destination-card and all 8 tourism-card captions** — one representative card pixel-sampled; the rest share the recipe but sit over different photographs.
2. **Live `:hover` / `:focus-visible` rendered frames** — interactive-state colours were derived by parsing the served stylesheet and compositing token values, not by driving real pseudo-class states through CDP.
3. **`.dark` mode** — the token block exists but is inactive; not exercised.
4. **Animation-in-progress states** — the 22s blob's full positional cycle and the `.reveal` transition midpoints.
5. **Per-stop compositing of the 20 photo-card scrims** over each individual JPEG — formula validated on the hero only.
6. **Element `opacity` interaction with `mix-blend-overlay`** on the two noise layers — treated as visually negligible after spot checks, not exhaustively modelled.
7. **`outline-color`** computes to a non-`none` value on 426 elements but paints only under `:focus-visible`; filtering requires `outline-style !== 'none'`.

---

*Three sequential Sonnet measurement passes; adjudication and synthesis by Opus. No source file was modified in producing this report.*
