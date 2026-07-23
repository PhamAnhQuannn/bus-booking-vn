# Landing Page — Measured State (Baseline Scan)

| | |
|---|---|
| **Date** | 2026-07-20 |
| **Target** | `http://localhost:3001/` (dev server, `app/(customer)/page.tsx` → `HeroMarketingView`) |
| **Tree** | `32deaf0` |
| **Method** | 3 sequential Playwright MCP passes + synthesis. `browser_evaluate` computed-style readback as primary instrument; screenshots used only as sanity check. |
| **Viewports** | 390 · 768 · 1024 · 1440 · 1920 · 2560 · 3840 |
| **Status** | Baseline measurement **+ review** (reviews added 2026-07-20; review layer audited and corrected — rev 2, 2026-07-20). The "before" baseline any redesign gets diffed against. |

Pass 1 = structural sweep @1920. Pass 2 = responsive rescan × 7 widths. Pass 3 = verification, lab()→hex conversion, contrast, colour inventory.

---

## How to read this document

The scan was originally **measurement only, no recommendations**. Reviews were added afterwards and are kept visually separate: every measured section is followed by a **`▸ REVIEW`** block. Measurement text above each review block is untouched original scan output — if a measured figure was found to be wrong, the correction lives in the review, never silently edited into the table.

**Review basis:** the adopted rule set in [`design-research-20260720.md`](./design-research-20260720.md), as it stands after two adversarial debate rounds and an adjudication pass. Rule IDs (C1, S2, R6…) refer to that document.

**Rev 2 (2026-07-20):** the review layer itself was audited — independent recomputation of every arithmetic claim, plus a source-code ground-truth pass against tree `32deaf0`. The demarcation above is unchanged: measurement text is never edited, and that now includes the §10 anomaly list even where rev 2 found an anomaly to be a scan artifact — those corrections live in the review rows beneath it. Review-layer text is the correction layer and is revised in place; every rev-2 revision is enumerated in the **Rev-2 change log** at the end of this file.

**Three standing constraints on every review below:**

1. **Orange is the primary brand colour.** It stays. No review here recommends reducing brand orange, de-saturating it, or replacing it with a different primary. Where orange is implicated, the finding is always about **contrast compliance on orange**, never about using less of it.
2. **Three rules were REJECTED for this repo** and the page is *not* scored against them: cool/slate neutrals (the **warm ramp is upheld**), navy CSS-field hero (the **photo hero is upheld**), Carbon layer elevation (the **shadow system is upheld**). If a future reader is tempted to "fix" the warm greys or delete the hero photo — those were argued and settled. Don't.
3. **Four rules do not apply to this surface.** S5 (results-row Z-scan), S6's prose/one-column clauses, F4 (trust-badge strip) and F5 (checkout price + cancellation policy) govern surfaces this landing page does not contain. They are marked `N/A` rather than failed.

**Finding types used below:** `PAGE` = a defect in the design · `DOC` = a defect in this scan's own measurement · `GAP` = the scan never measured what a rule governs · `N/A` = rule does not apply here.

---

## 0. Cross-pass contradictions — resolved

Passes disagreed twice. Resolutions:

**Which hero image is active at 1920?** Pass 1 said `3840.jpg`, Pass 2 said `1920.jpg`. **Pass 1 correct.** Pass 3 found the mechanism: CSS media queries match against `window.innerWidth` (1920), *not* `document.documentElement.clientWidth` (1905, scrollbar-deducted). Pass 2 reasoned from `clientWidth` and inverted the result.

Consequence — `landing-golden-1920.jpg` serves only the 1024–1919 band: `lg:block 3xl:hidden` means at 1024/1440 it is active, and at 1920+ the 3xl branch takes over.

**h1 size flip.** Pass 2 guessed `3xl`. Pass 3 binary-searched: **1535px → 64px, 1536px → 72px**. It is `2xl`, not 3xl.

**Token count.** Pass 1 found 42, Pass 3 enumerated **59** colour-valued custom properties (56 opaque + 3 alpha-0 gradient placeholders). Pass 1 missed the `--color-*` Tailwind palette vars.

### ▸ REVIEW — §0

**This section is the document's strongest credibility signal, and simultaneously its biggest unadvertised weakness.**

Publishing your own cross-pass contradictions — and root-causing them rather than just picking a winner — is rare and correct. The `innerWidth` vs scrollbar-deducted `clientWidth` finding is a genuine mechanism discovery, not an arbitration. The binary-searched h1 breakpoint (1535→64px, 1536→72px) is the single most rigorous measurement in the file.

But read the hit rate: **three items were spot-checked across passes and all three were wrong** — hero asset misidentified, h1 breakpoint misguessed, token count undercounted by 17 (42→59). That is not a reassuring sample.

| # | Finding | Type | Severity |
|---|---|---|---|
| 0.1 | Pass 3's remit was *"verification, lab()→hex conversion, contrast, colour inventory"* — i.e. **§7 and §8 only.** The geometry in §2, the component detail in §4, and most of §6 rest on Passes 1 and 2, which are exactly the passes this section demonstrates were error-prone. No re-verification of those sections is claimed anywhere. | DOC | **High** |

**Action:** re-run a verification pass over §2 / §4 / §6 geometry and state the result either way. A baseline whose own errata section shows a 3-for-3 error rate on checked items cannot leave the *unchecked* items unmarked.

---

## 1. Global

Page: `scrollWidth 1905` · `scrollHeight 4794` @≥1920 · **803 DOM nodes** · **23 `<img>`** · total page area **9,132,570 px²**

A 15px vertical scrollbar is permanent at every tested width (`innerWidth − clientWidth = 15` throughout).

Fonts: `Be Vietnam Pro` (body/display, via next/font `--font-be-vietnam`), `Geist Mono` (`--font-geist-mono`, used on prices). `--radius: 12px`.

Radius ladder resolved: `md 9.6` · `lg 12` · `xl 16.8` · `2xl 21.6` · `3xl 26.4` · `full 3.35e7`

### Core tokens — lab() → hex

Conversion technique: 1×1 canvas pixel readback (`ctx.fillStyle = cssColor` → `getImageData`), validated against `lab(100% 0 0)` → `#ffffff` and `lab(0% 0 0)` → `#000000` before trusting output. Note `ctx.fillStyle` echo alone does **not** work — it round-trips the authored `lab()` string.

| Token | Hex | rgb |
|---|---|---|
| `--primary` | **#f54a00** | 245,74,0 |
| `--primary-strong` | **#ca3500** | 202,53,0 |
| `--primary-foreground` | #fafafa | 250,250,250 |
| `--foreground` | #1c1612 | 28,22,18 |
| `--background` | #fdfbf9 | 253,251,249 |
| `--card` / `--popover` | #ffffff | 255,255,255 |
| `--card-foreground` / `--popover-foreground` | #0a0a0a | 10,10,10 |
| `--muted` / `--secondary` / `--accent` | #f6f3ef | 246,243,239 |
| `--muted-foreground` | #6e6862 | 110,104,98 |
| `--border` / `--input` | #e4e1dc | 228,225,220 |
| `--destructive` | #e7000b | 231,0,11 |
| `--warning` | #fffbeb | 255,251,235 |
| `--warning-foreground` | #7b3306 | 123,51,6 |
| `--warning-border` | #fee685 | 254,230,133 |
| `--success` | #f0fdf4 | 240,253,244 |
| `--success-foreground` | #0d542b | 13,84,43 |
| `--success-border` | #b9f8cf | 185,248,207 |
| `--info` | #d8f5f5 | 216,245,245 |
| `--info-foreground` | #005f64 | 0,95,100 |
| `--info-border` | #b2e2e2 | 178,226,226 |
| `--color-orange-50` | #fff7ed | 255,247,237 |
| `--color-amber-500` | #fe9a00 | 254,154,0 |
| `--color-amber-600` | #e17100 | 225,113,0 |
| `--chart-1` | #f54a00 | 245,74,0 |
| `--chart-2` | #008384 | 0,131,132 |
| `--chart-3` | #c39900 | 195,153,0 |
| `--chart-4` | #3b9555 | 59,149,85 |
| `--chart-5` | #566cb7 | 86,108,183 |
| `--sidebar` | #fafafa | 250,250,250 |
| `--sidebar-accent` | #f5f5f5 | 245,245,245 |
| `--sidebar-border` | #e5e5e5 | 229,229,229 |

Two observations of record:

- The neutral ramp is **warm** — `#fdfbf9`, `#f6f3ef`, `#6e6862`, `#1c1612` all carry positive lab-a/b.
- `--primary-strong` #ca3500 sits at lab-L 46.5 vs primary's 57.1 — a genuinely darker shade, not an opacity tint of the same colour.

### ▸ REVIEW — §1

**The token system is in better shape than any other layer of this page.** Two things here are genuinely well built and should survive any redesign.

**The two-tier orange is real.** `--primary-strong` at lab-L 46.5 against `--primary`'s 57.1 is a true darker shade, not an alpha tint of the same hue. That is exactly what **C3** asks for, and it means the brand keeps its full-saturation orange for fills *while* having a compliant tier for text and small elements. The architecture is right — §8 shows the problem is rollout discipline, not design.

**The warm neutral ramp is upheld, deliberately.** Every grey carrying positive lab-a/b is a documented brand decision, and the proposal to swap it for cool/slate was argued and **rejected**. Warm greys pair with the orange primary. This is not a defect and should not be "fixed."

**Cross-document correction — this file wins.** The companion research document states `--primary` as `#EA580C`, taken from a source-code comment. This scan measured it empirically via validated canvas readback as **`#f54a00`**. The measurement is authoritative; the comment was stale. Contrast impact is negligible (3.58:1 vs 3.56:1 on white — both fail AA either way), but any future work should quote **`#f54a00`**, not `#EA580C`.

**Rev-2 source notes:** (1) `app/globals.css:78` literally comments the stale value ("Brand primary — orange (Tailwind orange-600 #EA580C)") — provenance of the drift confirmed; the companion document still prints `#EA580C` and needs its own correction. (2) Tokens are authored in `oklch()` (`globals.css:81,88` — e.g. `--primary: oklch(0.646 0.222 41.116)`); the measured section's "lab() → hex" heading describes Chrome's computed-value readback, not the authoring space. Hex values unaffected. (3) No `--spacing` override exists in `globals.css` — the project runs Tailwind v4's default scale, atom **4px**. The §1.1 spacing-ladder action is therefore a tabulation task, not design work, and S3's 8px-atom clause will be scored against a 4px-atom reality once the ladder exists.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 1.1 | **No spacing scale is captured anywhere in this document.** A radius ladder is published (`md 9.6 · lg 12 · xl 16.8 · 2xl 21.6 · 3xl 26.4`) and it is clean — but radius is not spacing. Padding and gap values appear scattered across §2/§3/§4 (32/40/48 py-, 16/20/24 gaps, hero `120 104 80`) and are never assembled into a scale with a stated atom or step count. | S3, S1 | **GAP** | **High** |
| 1.2 | Because of 1.1, **S3** (8px atom, cap ~9–13 steps) and **S1's ratio clause** are unscoreable. **S1 splits into two independent clauses:** the *ratio* clause (1:2–1:3) requires the spacing scale that 1.1 shows was never captured — it stays **GAP** here; the *boundary* clause (`inside ≤ outside`) **is** scoreable from §2's section-gap math and is scored at §2.4 as PAGE / Medium. Radius-as-proxy is the wrong artifact — its atom is ~2.4/4.8px, which says nothing about the spacing system. | S3, S1 (ratio clause) | **GAP** | **High** |

**Action:** inventory every padding / gap / margin value on the page, dedupe to atoms, publish as a spacing ladder beside the radius ladder. That single addition unblocks two rules that are currently permanently unscoreable.

---

## 2. Section stack — absolute geometry @1920

| # | Section | y | height | width | max-w | content left-x | bg hex |
|---|---|---|---|---|---|---|---|
| — | SiteHeader (sticky, z-40) | 0 | 96 | 1905 | — | 24 | #fdfbf9 |
| 1 | `#search` hero | 96 | 756 | 1905 | 1920 | 104 | transparent (image) |
| 2 | Feature strip | 852 | 181 | 1905 | 1920 | 104 | **#f6f3ef** |
| 3 | PopularTrips | 1032.7 | 357 | 1905 | 1024 | 457 | #f5f2ee |
| 4 | OperatorShowcase | 1389.7 | 298.75 | 1024 | 1024 | 457 | #fdfbf9 |
| 5 | FeatureHighlights | 1688.4 | 933.6 | 1024 | 1024 | 457 | #fdfbf9 |
| 6 | ContractCarRental | 2622 | 888 | 1024 | 1024 | 457 | #fdfbf9 |
| 7 | RouteDirectory | 3510 | 490 | 1024 | 1024 | 457 | #fdfbf9 |
| 8 | IntroBanner | 4000 | 480 | 1905 | — | — | **#f54a00** |
| 9 | Footer | 4528 | 266 | 1905 | 1024 | 457 | #f5f2f0 |

### Section gaps — measured by rect math (`next.top − prev.bottom`)

| Boundary | Gap |
|---|---|
| Header → Hero | **0** |
| Hero → Feature strip | **0** |
| Feature strip → PopularTrips | **0** |
| PopularTrips → Operator | **0** |
| Operator → FeatureHighlights | **0** |
| FeatureHighlights → ContractCar | **0** |
| ContractCar → RouteDirectory | **0** |
| RouteDirectory → IntroBanner | **0** |
| IntroBanner → Footer | **48** (footer `margin-top`) |

**Every section boundary on the page is 0px.** All vertical separation comes from internal `padding` (py-8/32px, py-10/40px, py-12/48px) plus background-colour changes. One margin exists on the entire page.

### ▸ REVIEW — §2

Zero-gap sectioning is a **legitimate technique**, not automatically a defect. Background-colour banding plus generous internal padding can do everything whitespace does, and it costs less vertical scroll — which serves **R2**'s high-information-density goal. **S2**'s 48–64px figure assumes a whitespace-separated layout, so scoring this page against the number alone would be lazy.

The technique has to actually be present, though. Read the `bg hex` column:

| Sections 4 → 7 | Background |
|---|---|
| OperatorShowcase | `#fdfbf9` |
| FeatureHighlights | `#fdfbf9` |
| ContractCarRental | `#fdfbf9` |
| RouteDirectory | `#fdfbf9` |

**Four consecutive sections share one background colour and have 0px between them.** Across that entire run — y=1389.7 to y=4000, roughly 2,600px of continuous scroll, over half the page — there is no gap, no margin, and no colour change. Nothing separates them but whatever internal padding each happens to carry. The banding defence holds everywhere else on the page and collapses exactly here.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 2.1 | Four consecutive `#fdfbf9` sections (Operator → RouteDirectory) with 0px boundaries and no colour change — ~2,600px of undifferentiated scroll. The separation mechanism this page relies on is simply absent for over half its length. | S2 | **PAGE** | **High** |
| 2.2 | **"Every section boundary on the page is 0px" is not true by this table's own decimals.** Recomputed: Feature strip → PopularTrips = `852+181=1033` vs `1032.7` → **−0.3px**. Operator → FeatureHighlights = `1389.7+298.75=1688.45` vs `1688.4` → **−0.05px**. Trivial in magnitude; the *claim* is still false as written. **Rev-2 full recomputation:** every other boundary is exactly 0; IntroBanner→Footer = 48 (footer margin); sanity check: footer bottom `4528+266=4794` = stated scrollHeight ✓. Resolution: a **±0.5px rounding tolerance is hereby declared** — under it the measured claim stands and the two sub-pixel deltas are float artifacts. | — | **DOC** | Low |
| 2.3 | IntroBanner is a full-bleed `1905×480` solid `#f54a00` **section background**. See §7 — this single element is 97.7% of all orange on the page. Reviewed in full there. | C1 | PAGE | see §7 |
| 2.4 | Inside-vs-outside is inverted page-wide: internal padding runs 32–48px while external gaps are 0. **S1** targets `inside ≤ outside`; this is the reverse at 8 of 9 boundaries. The footer's 48px margin is the only compliant boundary on the page. **Scope: this scores S1's *boundary* clause only** — the *ratio* clause (1:2–1:3) remains unscoreable until a spacing scale exists (§1.2). | S1 (boundary clause) | PAGE | Medium |

**Action:** either introduce a background change or a real gap between the four `#fdfbf9` sections, or accept them as one visual super-section and stop treating them as four. 2.2 is resolved in-row (rev 2): tolerance declared, all boundaries recomputed.

---

## 3. Hero — layer by layer

Section rect `0,96,1905,756`. Inner wrapper padding **`120px 104px 80px`**, `max-w-[1920px]`.

Nine stacked children, z-order bottom → top:

| # | Layer | @1920 state | bg-position |
|---|---|---|---|
| 1 | `landing-golden-1280.jpg` (mobile) | 0×0 hidden | 72% center |
| 2 | `landing-golden-md-1536.jpg` | 0×0 hidden | 50% 30% |
| 3 | `landing-golden-1920.jpg` (lg) | 0×0 hidden | 53% 30% |
| 4 | **`landing-golden-3840.jpg`** | **active 1905×756** | 53% 30% |
| 5 | white gradient (mobile) 85%→40%→70% | 0×0 hidden | — |
| 6 | **cream gradient 90deg** `rgba(255,247,237, .82→.66→.30→.08→0)` | **active** | — |
| 7 | **black right-edge** `transparent 62% → rgba(0,0,0,.2) 100%` | **active** | — |
| 8 | **SVG fractalNoise** `mix-blend-overlay` | **active, opacity 0.04** | — |
| 9 | content wrapper | active | — |

Cream wash = `#fff7ed` = `--color-orange-50`. Noise confirmed at exactly 0.04 (IntroBanner uses the same generator at 0.06).

Gradient opacity ramps differ by breakpoint: `.88 → .72 → .38 → .12` at 768/1024 vs `.82 → .66 → .30 → .08` at 1440+.

### Hero content

| Element | rect @1920 | font | colour |
|---|---|---|---|
| Badge pill "Đặt vé dễ dàng – Đi xe an toàn" | 104,216,266×34 | 14/20 500 | #f54a00 on white/80, pill, border primary/20 |
| h1 line 1 "Đặt vé xe khách" | 104,266 | **72/75.6 800 ls −1.8** | #1c1612 |
| h1 line 2 "trong 30 giây" | — | 72/75.6 800 | **#f54a00** |
| Subcopy | 104,433,680×61 | 22/30.25 400 | foreground/80 |
| Search card | 104,518,**1078×254** | — | #ffffff, r26.4, shadow-e4 |

Subcopy verbatim: *"Tìm chuyến, đặt vé, nhà xe gọi xác nhận. Không cần chọn ghế trên màn hình."*

`shadow-e4` resolves to `rgba(...,0.18) 0px 16px 48px -8px`.

Search card internals: inner pad `20px 32px`; origin input `442×58` r12; swap button `44×44` pill; destination `562×58`; date button `475×58`; pax stepper `317×58`; submit `196×58` pill on **#ca3500**.

**Form carries persisted state at scan time**: origin `"Ha Noi"`, destination `"Sai Gon"` (Latin, no diacritics), date `21/07/2026`, pax `1`. These are values, not placeholders.

### ▸ REVIEW — §3

**The photo hero is upheld.** The proposal to replace it with a flat CSS field was argued and **rejected** — the engineering here is sound (4 media-scoped `preload()` variants, correct asset per band, a real `<h1>` above the fold) and the SEO problem a CSS field would have solved is already solved. Do not delete this hero.

**The submit button gets it right.** `#ca3500` (`--primary-strong`) on the primary conversion control is exactly the two-tier system working as designed. This is the pattern §8's failures should be copying.

**The blocking gap is the h1.** The page's largest, most prominent text — 72/800 at `#1c1612` and `#f54a00` — sits directly on a photograph and is therefore in §8's 32-element "indeterminate" bucket with **no contrast verification at all**. That is the single most-read element on the site, unverified. Worse, the cream wash protecting it ramps `.82 → .66 → .30 → .08 → 0` left-to-right, so protection is weakest exactly where line 2 ends. Note the scan records a `text-shadow` on PopularTrips route names and the IntroBanner h2 but records none on the h1 — on a *less* controlled backdrop.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 3.1 | **h1 has zero contrast verification** (both spans), plus badge pill and subcopy — 4 elements on the hero photo. Backdrop protection thins to `.08→0` at the right edge where h1 line 2 sits. No `text-shadow` recorded on the h1. | R6, C3 | **GAP** | **Critical** |
| 3.2 | h1 line 2 "trong 30 giây" is `#f54a00` — brand orange used as **display text**. Orange is the primary colour and this is a deliberate, effective brand moment, so the question is *not* whether to keep it. The question is whether it clears contrast over a photo at that position, which 3.1 says nobody has checked. | C1, R4 | PAGE | **High** (pending 3.1) |
| 3.3 | Hero wrapper padding renders as a fixed `120px 104px 80px` with no fluid variation. **Rev 2:** `clamp(` has **zero occurrences repo-wide** (.ts/.tsx/.css); the ramp is Tailwind responsive-prefix steps mixing rem utilities with literal arbitrary px (`lg:pt-[120px]`, `xl:px-[104px]`). What §5.4 held as inferred is now observed at source — retyped GAP → **PAGE**. | S4 | **PAGE** | Medium |
| 3.4 | **Rev 2 — reclassified PAGE → DOC (scan contamination).** `lib/stores/searchStore.ts` is a deliberate Zustand `persist` store (localStorage, spec'd AC-5/AC-6 for back-nav restore) with all-empty `DEFAULT_STATE` and `skipHydration: true`, rehydrated on mount by `components/search/SearchFormWrapper.tsx:19-30`. A first-time visitor has no localStorage entry and sees empty placeholders. The observed "Ha Noi"/"Sai Gon" values were almost certainly typed by this scan's own earlier pass and read back later — the measurement is real, but it is a property of the scan's dirty browser profile, not of the shipped page. Same reclassification at §10.1. Pass-4 protocol: scan under a cleared profile. | — | **DOC** | Medium |

**Action on 3.1 (do this first):** canvas-sample the composited hero pixels under both h1 spans at worst-case position — right side, where the wash reaches `.08→0` — and report min/median local contrast per breakpoint. Until that number exists, the most important text on the site is unverified. If it fails, the fix is a `text-shadow` or a deeper wash, **not** removing the orange.

---

## 4. Sections 2–9 detail

**Feature strip** — 4 cards, `412×116` each, gaps **16/17/16px** (17 is float rounding on `gap-4`). Card: `#ffffff`, r21.6, border #e4e1dc, shadow-e1, pad 20 (24 at xl). Icon circle `48×48` at primary/10 → composites to **#eb4500**. Title 14/20 600 (→16/24 at xl), sub 14/20 400 #6e6862.

Copy: *Thanh toán đơn giản* · *Xác nhận qua email* · *Nhiều nhà xe uy tín* · *Đón trả tận nơi*.

Wrapper is `border-b border-border bg-muted` full-bleed; the inner `<section>` carries the 1920 cap.

**PopularTrips** — h2 "Tuyến phổ biến" 30/36 700. 10-card horizontal snap carousel (`snap-x snap-mandatory`, scrollbar hidden), card `236×177` r16.8, gap 16. Image `object-cover` + `black/80 → 15 → transparent` gradient, route name white 18/28 600 with text-shadow, price **Geist Mono** 14/20 600 white/95.

Samples: Thanh Hóa→Sài Gòn *Từ 960.000 ₫* · Sài Gòn→Bình Dương *Từ 96.000 ₫* · Sài Gòn→Đà Lạt *Từ 276.000 ₫*.

**OperatorShowcase** — 3 cards `320×107`, r16.8, border + shadow-e1. **No logo images** — text-initial avatars only (PB / MN / TN), `48×48` r12 on primary/10. Phương Bắc · Miền Nam · Tây Nguyên, each with legal name and a route line.

**FeatureHighlights** — h2 "Vì sao chọn BBVN?" centred. Bento: **3 articles, not 4**. Large `653×738` (col-span-2 row-span-2, image AR 16/10, h407) + two `315×357` stacked. Gap **24px** both axes. Floating icon badge `48×48` straddles the image/body boundary via `translate-y-1/2`. Each card carries 3 bullets.

Cards: *Dịch vụ tuyệt vời* · *Đón trả tận nơi* · *Hỗ trợ 24/7*.

**ContractCarRental** — 8-figure bento on `lg:grid-cols-6 auto-rows-[10.5rem]`. Hero figure `656×352` (col-span-4 row-span-2), then `320×168` ×5, `488×168` ×2. Gap 16. All r16.8 + the same black gradient + white 18/28 600 captions.

Thanh Hóa tourism set: Biển Sầm Sơn · Thành Nhà Hồ · Pù Luông · Suối cá Cẩm Lương · Khu di tích Lam Kinh · Vườn quốc gia Bến En · Biển Hải Tiến · Thác Mây.

Header CTA "Liên hệ thuê xe" `159×36` r12 — ghost style, background equals page background.

**RouteDirectory** — 3 columns `309×306`, 18 links total, each link `309×44` (min-h-11 touch target), 14/20 400. Column heads: *Từ Hà Nội* · *Từ Sài Gòn* · *Tuyến khác*.

**IntroBanner** — `1905×480`, solid `#f54a00`, plus 6 decorative layers:

1. `filter: saturate(.7) brightness(.97)` base tint div
2. 135° gradient `transparent → rgba(124,45,18,.18) 45% → rgba(124,45,18,.55) 100%`
3. animated blob `size-96`, organic radius `42% 58% 56% 44% / 48% 42% 58% 52%`, `bg-white/30 blur-3xl`, `motion-safe:animate-[blob_22s_...]`
4. radial gold glow `58% 55% at 85% 112%, rgba(252,211,77,.45) → transparent 70%`
5. bottom vignette `to-black/12`
6. SVG noise `opacity-[0.06] mix-blend-overlay`

h2 "Cả nước trong tầm tay bạn" 48/48 700 + `text-shadow 0 2px 12px rgba(0,0,0,.18)`. Badge pill "Nền tảng đặt xe toàn quốc" on white/15 + backdrop-blur-sm.

Paragraph verbatim: *"BBVN kết nối bạn với các nhà xe uy tín. Tìm chuyến, đặt vé, thuê xe hợp đồng — nhanh và an toàn, hỗ trợ 24/7."*

CTAs: "Tìm chuyến xe ngay" (white pill) + "Liên hệ đặt xe" (outline, `border-white/40`, r12).

**Footer** — `#f5f2f0`, border-top #e4e1dc, `max-w-5xl`, pad `32px 16px`. Logo 173×72. 4 columns (ĐẶT VÉ / DÀNH CHO NHÀ XE / PHÁP LÝ / HỖ TRỢ & KHIẾU NẠI), headers 12/16 600 uppercase. Bottom bar `border-border/60`, `© 2026 BBVN` 12/16 400.

### ▸ REVIEW — §4

**Component-level spacing is compliant.** Feature strip 16px, carousel 16px, FeatureHighlights 24px, ContractCar 16px — all clean 8px multiples. The lone 17px is float rounding on `gap-4` and the scan correctly self-diagnoses it. Card padding 20–24px sits inside **S2**'s 16–24 band. RouteDirectory links at `309×44` meet the 44px touch-target minimum. This layer is fine.

**Two rules do not apply here and should stop being cited against this page:**

- **F4 (cap 3–4 trust badges, monochrome)** — `N/A`. There is no trust-badge strip. OperatorShowcase cards are partner identity, not trust seals. Note separately that the page currently ships **zero** trust badges, which is a content gap rather than a rule violation — and the **Bộ Công Thương** registration mark is a legal obligation for a live VN commerce site regardless of any conversion argument.
- **F5 (total price incl. fees, cancellation before payment)** — `N/A`. This governs checkout. A marketing carousel showing "Từ 960.000 ₫" is a teaser price, and there is no payment step on this page.

**On prices and R1.** R1 says price gets weight + size in near-black, never orange. The prices here are **white on photo cards with a `black/80 → transparent` scrim**. The "never orange" clause passes cleanly — no price anywhere on this page is orange. The "near-black" clause is unmet, but near-black on a dark photo scrim would be unreadable; white is the correct call here. **R1 was written for a light-background results row, not a photo card.** Scored as compliant-in-spirit; the real R1 test will be the search-results page, which this scan does not cover.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 4.1 | **Operator initials `#f54a00` on `#fdece5` = 3.12:1** — a clean AA failure (needs 4.5). These are PB/MN/TN text avatars, the smallest orange text on the page. Fix is `--primary-strong`, which already exists. Keeps the orange tint, passes contrast. | C3, R6 | **PAGE** | **High** |
| 4.2 | Carousel prices and tourism captions (28 elements) sit on photos and are **unverified for contrast** — same class as the h1. They do at least carry a `black/80` scrim and a text-shadow, which the h1 does not, so these rank lower risk than 3.1. | R6 | GAP | Medium |
| 4.3 | OperatorShowcase ships **no logos** — text initials only. Operator credibility is a core trust lever for a VN bus marketplace where the operator *is* the product. Not a rule violation; a content gap worth naming. | — | PAGE | Medium |
| 4.4 | **Rev 2 — closed as intentional at source.** `components/home/FeatureHighlights.tsx:54-55` comments the layout explicitly: "Asymmetric bento… 3 items → 3 cells." The 3-cards-in-a-4-slot-reading grid is deliberate composition, not a missing card. No action. | — | closed | — |
| 4.5 | ContractCarRental header CTA "Liên hệ thuê xe" is ghost-styled with **background equal to page background** — a CTA that renders as flat text. On a conversion path this is an affordance loss. **Rev-2 source note:** it is `buttonVariants({ variant: 'outline' })`, not ghost — `components/ui/button.tsx:13-14` gives it `border-border` (#e4e1dc) + `hover:bg-muted`. On the `#fdfbf9` page background that border is near-invisible, so the *measured* flat appearance is real, but the framing softens from "renders as flat text" to **weak affordance**. Low stands. | — | PAGE | Low |

**Action:** 4.1 executes via Priority 1a (token swap to `--primary-strong`). 4.3: commission operator logos — content task, no rule pressure. 4.4 closed (intentional at source). 4.5: give the outline CTA a visible affordance (stronger border or filled treatment) when the section is next touched.

---

## 5. Typography ramp

| Element | 390 | 768 | 1024 | 1440 | 1920 | 2560 | 3840 |
|---|---|---|---|---|---|---|---|
| **h1** | 36/40 | 64/67.2 | 64/67.2 | 64/67.2 | **72/75.6** | 72/75.6 | 72/75.6 |
| h1 letter-spacing | −0.9 | −1.6 | −1.6 | −1.6 | −1.8 | −1.8 | −1.8 |
| Hero subcopy | 16/24 | 18/28 | 18/28 | **22/30.25** | 22 | 22 | 22 |
| Section h2 | 24/32 | 30/36 | 30/36 | 30/36 | 30/36 | 30/36 | 30/36 |
| IntroBanner h2 | 30/36 | 48/48 | 48/48 | 48/48 | 48/48 | 48/48 | 48/48 |
| Card title | 14/20 | 14/20 | 14/20 | **16/24** | 16/24 | 16/24 | 16/24 |
| Body / links | 14/20 | 14/20 | 14/20 | 14/20 | 14/20 | 14/20 | 14/20 |

All weights: h1 800, h2 700, card title 600, body 400–500.

Breakpoints actually in play: h1 bumps at `md`(768) and `2xl`(**1536**). Hero subcopy at `xl`(1280). Card title at `xl`(1280). Everything else is frozen from 768 upward.

Header height: **72px** at ≤1024, **96px** at ≥1440.

### ▸ REVIEW — §5

**The weight hierarchy is clean** — 800 / 700 / 600 / 400–500, consistently applied, no stray weights. That is a real system.

**The step-ladder is deliberate and sparse**, which is the right instinct: two h1 jumps across a 10× viewport range is restraint, not jank. But sparse discrete steps are not the same thing as **S4**'s fluid `clamp()`, and the scan shows zero `clamp()` on any type or section padding.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 5.1 | **Body and links are frozen at 14/20 from 390px to 3840px** — the only row in the ramp with no breakpoint at all. At 2560–3840, 14px body text inside a 1024px column stranded in a 73%-empty viewport is small. This compounds §6's dead-space finding rather than being independent of it. | S4 | PAGE | Medium |
| 5.2 | No `clamp()` observed anywhere in the type ramp or section padding — every rendered value is a fixed px at a discrete breakpoint. **S4** asks for fluid scaling with a rem term (rem so browser zoom and text-size settings still work). **Rev 2:** absence is now source-confirmed (zero `clamp(` repo-wide; the ramp is discrete Tailwind prefixes with literal px terms — `md:text-[64px]`, `xl:text-[22px]`) — retyped GAP → **PAGE**. | S4 | **PAGE** | Medium |
| 5.3 | Section h2 frozen at 30/36 from 768 up, while IntroBanner h2 is 48/48. The page's own heading scale is inconsistent between its sections and its banner. Cosmetic, but it means there is no single h2 rung. | — | PAGE | Low |
| 5.4 | The scan measures rendered px only, so it **cannot confirm whether `clamp()` or rem terms are used in the source** — 5.2 is inferred from discrete stepping, not directly observed. Stated honestly rather than asserted. **Rev 2: closed** — the source check this row asked for has been done; see 5.2/3.3. | S4 | closed | — |

**Action:** give body/links at least one step above 1440, or move the ramp to fluid rem-based sizing (S4). With `clamp()` absence source-confirmed, S4 work is now a build task, not further measurement.

---

## 6. Responsive behaviour

Hero + feature strip cap at `max-w-[1920px]` with `xl:px-[104px]`. Every section below caps at `max-w-5xl` = **1024px**, centred.

### Two spatial systems — left-edge divergence

| Viewport | h1 left-x | first section h2 left-x | **divergence** | gutter beside max-w-5xl (per side) |
|---|---|---|---|---|
| 1024 | 32 | ~16 | 16 | ~0 |
| 1440 | 104 | 217 | **112** | 216.5 |
| 1920 | 104 | 457 | **352** | 440.5 |
| 2560 | 417 | 777 | **360** | 760.5 |
| 3840 | 1057 | 1417 | **360** | **1400.5** |

Dead space flanking below-fold content: **59.7% of viewport at 2560**, **73.0% at 3840**.

### Grid track freezing

Every `max-w-5xl` grid locks its track widths from 1024–1280 upward and never grows again — bit-identical at 1440 / 1920 / 2560 / 3840 (992px content box, ±0px variance).

| Grid | 390 | 768 | ≥1024 |
|---|---|---|---|
| Feature strip | 1 col 343 | 2 col 336.5 | 4 col → 412 @1920, **416 capped** @2560+ |
| OperatorShowcase | 1 col 343 | 3 col 229.7 | 3 col **320 fixed** |
| FeatureHighlights | 1 col 343 | 2 col 348.5 | 3 col **314.66 fixed** |
| ContractCarRental | 2 col 165.5 | 2 col 354.5 | 6 col **~152 fixed** |
| RouteDirectory | 1 col 343 | 2 col 344.5 | 3 col **309.33 fixed** |
| Carousel basis | 88% | calc(50%−8) | calc(25%−12) → **236×177 fixed** |

The feature strip caps at 1712px content = 1920 − 2×104 padding.

### Search card — the one element that keeps growing

Constraint is `xl:max-w-[min(63vw-132px, 13.2vw+828px)]`. Term crossover falls between 1920 and 2560:

| Width | 63vw−132 | 13.2vw+828 | binding term | card width |
|---|---|---|---|---|
| 1920 | 1077.6 | 1081.4 | 63vw−132 | **1077.6** |
| 2560 | 1480.8 | 1165.9 | 13.2vw+828 | **1165.9** |
| 3840 | 2287.2 | 1334.9 | 13.2vw+828 | **1334.9** |

### Hero background asset by width

| Width | Active jpg |
|---|---|
| 390 | `landing-golden-1280.jpg` |
| 768 | `landing-golden-md-1536.jpg` |
| 1024 | `landing-golden-1920.jpg` |
| 1440 | `landing-golden-1920.jpg` |
| 1920 | `landing-golden-3840.jpg` |
| 2560 | `landing-golden-3840.jpg` |
| 3840 | `landing-golden-3840.jpg` |

### Page height

| Width | scrollHeight |
|---|---|
| 390 | 6943 |
| 768 | 5778 |
| 1024 | 4861 |
| 1440 | 4797 |
| 1920 | 4794 |
| 2560 | 4794 |
| 3840 | 4794 |

No horizontal overflow at any width (`scrollWidth − clientWidth = 0` everywhere, verified at 390 and 768 specifically).

### Mobile @390

Header collapses to hamburger `40×40 @ (311,16)`, `aria-label="Mở menu điều hướng"`. Search form inner grid becomes 2 columns (`175px 122px`); at 768 it becomes 3 (`183.9 / 122.6 / 195.5`, matching `md:grid-cols-[3fr_2fr_auto]`). Carousel basis 88% — near-full-width card with a peek of the next.

### ▸ REVIEW — §6

**No horizontal overflow at any width** (verified at 390 and 768) — responsive correctness on that axis is clean, and the mobile grid collapse is sensible.

**The headline finding is the two spatial systems.** The hero and feature strip cap at 1920 with `xl:px-[104px]`; everything below caps at `max-w-5xl` = **1024**. Left edges never converge — they plateau 360px apart and stay there. Two independent layout systems on one page, and the page never resolves them.

Two consequences compound:

- **The shell is 1024 against S6's 1200–1280 floor.** That is not a near-miss; it is 176–256px short, and it is the constant that drives everything else here.
- **Every `max-w-5xl` grid freezes from 1024 and never grows again** — bit-identical at 1440 / 1920 / 2560 / 3840, ±0px. The page is designed once at laptop width and then simply centred in progressively emptier viewports. 73% of a 4K viewport is empty margin.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 6.1 | **Shell is 1024, rule floor is 1200–1280.** Single highest-leverage fix on the page: widening the shell narrows the left-edge divergence, reduces dead space, and gives the frozen grids room — all from one constant. **Rev-2 source confirmation:** `max-w-5xl` verified exhaustively at all six below-hero call sites + footer (`PopularTrips.tsx:45`, `OperatorShowcase.tsx:107,118`, `FeatureHighlights.tsx:46`, `ContractCarRental.tsx:50`, `RouteDirectory.tsx:66`, `SiteFooter.tsx:48`); IntroBanner is the sole full-bleed exception. Widening is a mechanical 6-file constant change + visual QA. | S6 | **PAGE** | **High** |
| 6.2 | Left-edge divergence plateaus at **360px**; flanking dead space **59.4% @2560** (rev 2: `2×760.5/2560 = 59.41%`; the measured 59.7% above stands unedited per the frozen rule), **73.0% @3840** (verified: `2×1400.5/3840 = 72.94%`). The two systems never reconcile at any tested width. | S1, S6 | **PAGE** | **High** |
| 6.3 | All six grids freeze their track widths from 1024 upward (992px content box, ±0px across four viewports). Nothing on the page below the hero responds to viewport growth except the search card. | S6 | PAGE | Medium |
| 6.4 | **Unit inconsistency vs §7.** These dead-space percentages are **width ratios** (`2×gutter ÷ viewport`; verified: `2×1400.5/3840 = 72.9%`), while every percentage in §7 is an **area ratio**. Same document, no label on either. A reader comparing "73% dead space" against "10.25% orange" is comparing incompatible quantities. | — | **DOC** | Medium |
| 6.5 | The search card is the one element that keeps growing — a genuinely well-engineered `min()` constraint with correct term crossover. Worth noting as the pattern the rest of the page does not follow. | — | *(strength)* | — |

**Action:** raise the shell toward 1200–1280 and label the §6 percentages `width-ratio`. 6.1 is the single change with the widest downstream effect on this page.

---

## 7. Colour inventory

**18 distinct hex values** in the union, across `color` (10) · `background-color` (8) · `border-color` (3).

| `color` | n | | `background-color` | n | | `border-color` | n |
|---|---|---|---|---|---|---|---|
| #1c1612 | 326 | | #ffffff | 31 | | #e4e1dc | 22 |
| **#f54a00** | 90 | | **#eb4500** | 7 | | **#f54b00** | 1 |
| #ffffff | 83 | | #fdfbf9 | 3 | | #ffffff | 1 |
| #6e6862 | 61 | | **#ca3500** | 2 | | | |
| **#f44900** | 54 | | **#f54a00** | 2 | | | |
| #0a0a0a | 23 | | #f6f3ef | 1 | | | |
| #fafafa | 16 | | #f5f2ee | 1 | | | |
| #1b1611 | 4 | | #f5f2f0 | 1 | | | |
| #000000 | 1 | | | | | | |
| #f9f9f9 | 1 | | | | | | |

Near-duplicate clusters present:

- orange — `#f54a00` / `#f44900` / `#f54b00`
- near-black — `#1c1612` / `#1b1611`
- warm grey — `#f6f3ef` / `#f5f2ee` / `#f5f2f0`
- white — `#ffffff` / `#fafafa` / `#f9f9f9`

`#eb4500` is primary/10 composited over white. `#f44900` / `#f54b00` are anti-aliasing variants on SVG fills and a border.

### Orange surface area

| Measure | px² | % of page |
|---|---|---|
| Orange background, **deduplicated** | **936,129** | **10.25%** |
| Orange background, raw sum (IntroBanner double-counted — section + filter overlay share an identical rect) | 1,850,529 | 20.26% |
| Hero photo (warm/golden — image, not a token colour; listed separately) | 1,439,580 | 15.76% |

Dedup breakdown: IntroBanner 1905×480 = 914,400 px² (**97.7% of all orange on the page**) · header pill 199×44 · submit button 196×58 · 4 feature icon circles 48×48 @α.102 · 3 operator avatars 48×48 @α.102.

### ▸ REVIEW — §7

**Producing this measurement at all puts the page ahead of most.** Very few teams can state their brand-colour surface area as a computed, deduplicated, page-wide number. And 10.25% lands essentially on **C1**'s ~10% budget.

**The near-duplicate hex clusters are mostly not a defect** — this section says so itself, and it is right. `#eb4500` is `primary/10` composited over white; `#f44900` and `#f54b00` are anti-aliasing variants on SVG fills and a border. Those are rendering artifacts, not authored tokens. Real authored duplication is limited to the near-black pair (`#1c1612` / `#1b1611`) and the warm-grey trio, which are plausibly composite results too. **18 distinct hexes overstates token sprawl considerably.**

**On the orange concentration — and this is where the framing matters.** 97.7% of page orange is one element, IntroBanner. Read one way that trips C1's "never a background field" clause. But **orange is this product's primary brand colour**, and a full-bleed orange brand band near the end of a landing page is a legitimate, deliberate brand moment — not an accident, and not something to delete. Two things are simultaneously true:

- The **aggregate 10.25% is a misleading health signal**, because it averages one enormous field against near-zero elsewhere. Strip IntroBanner and page orange collapses to **~0.24%**. The number should not be cited as proof of colour discipline.
- The **actionable defect is not the orange field — it is the contrast of the text sitting on it** (§8). Every fix worth making here keeps the orange band exactly as it is.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 7.1 | **The dedup total does not reproduce from this section's own breakdown.** Recomputed: `914,400 + 8,756 + 11,368 + 9,216 + 6,912 = 950,652`, but the stated total is **936,129** — off by **14,523 px² (1.55%)**. Applying the `@α.102` weighting to the seven tinted circles gives 936,169 — still 40px² short. No stated methodology reproduces the printed figure, and the headline **10.25%** rests on it. **Rev-2 resolution:** applying the stated `@α.102` weighting to the seven tinted circles gives `914,400 + 8,756 + 11,368 + 0.102×16,128 = 936,169` — within **40 px²** of the published 936,129. The raw-sum row reproduces with the *same* −40 offset, so both published totals share one small systematic (consistent with anti-aliased canvas pixel counting vs idealized rect math). The defect shrinks from "does not reproduce" to "methodology label missing." **10.25% unaffected.** Severity High → Low. | — | **DOC** | Low |
| 7.2 | Percentages are computed at **@1920 only**, using the ≥1920 `scrollHeight` of 4794 — but §6 shows scrollHeight ranges to **6943 @390**. "10.25% of page" is a desktop-only fact presented as a property of the design. On mobile the same orange occupies a materially different share. | C1 | **DOC** | Medium |
| 7.3 | Aggregate orange % is a weak compliance signal when one element is 97.7% of it. Report **orange-excluding-IntroBanner** alongside the total so the distribution is visible, rather than a single averaged number. | C1 | DOC | Medium |
| 7.4 | Orange appears on decoration — feature icon circles and operator avatars at `primary/10`. **R4** sanctions orange for CTA + active state only. In practice this is a consistent third role ("brand tint for icons/avatars") applied deliberately across the page. Recommend **formalising it as a named token role** rather than eliminating it — the usage is coherent, the rule simply did not anticipate it. | R4 | PAGE | Low |

**Action:** 7.1 resolved in-row (rev 2 — α-weighted formula published; residual 40 px² systematic). The measured percentages remain `@1920`-only and unit-unlabelled in the frozen tables; rows 7.2/6.4 carry the labels. **No change to the IntroBanner orange itself.**

---

## 8. Contrast

WCAG 2.x, computed with ancestor-composited backgrounds (Porter-Duff over, walking up to the first opaque layer).

| fg | bg | size / weight | ratio | needs | verdict |
|---|---|---|---|---|---|
| #fafafa | #f66526 | 14 / 500 | **2.95** | 4.5 | **FAIL** — IntroBanner badge |
| #f54a00 | #fdece5 | 16 / 700 | **3.12** | 4.5 | **FAIL** — operator initials PB/MN/TN |
| #f9f9f9 | #f54a00 | 18 / 400 | **3.40** | 4.5 | **FAIL** — IntroBanner subcopy |
| #fafafa | #f54a00 | 48 / 700 | 3.43 | 3.0 | pass (large text) — IntroBanner h2 |
| #f54a00 | #ffffff | 15.2 / 500 | **3.58** | 4.5 | **FAIL** — CTA "Tìm chuyến xe ngay" |
| #ffffff | #f54a00 | 15.2 / 500 | **3.58** | 4.5 | **FAIL** — CTA "Liên hệ đặt xe" |
| #fafafa | #ca3500 | 18 / 500 | 5.00 | 4.5 | pass, zero headroom — header pill |
| #fafafa | #ca3500 | 16 / 600 | 5.00 | 4.5 | pass, zero headroom — search submit |
| #6e6862 | #faf7f5 | 14, 12 / 400 | 5.17 | 4.5 | pass — footer text, copyright |
| #6e6862 | #fbf8f6 | 16 / 400 | 5.20 | 4.5 | pass — PopularTrips subcopy |
| #6e6862 | #fdfbf9 | 18, 16, 14 / 400–500 | 5.33 | 4.5 | pass — nav links, section subcopy |
| #6e6862 | #ffffff | 14, 12 / 400 | 5.50 | 4.5 | pass — card captions |
| #1c1612 | #faf7f5 | 14, 12 / 500–600 | 16.83 | — | pass |
| #1c1612 | #fbf8f6 | 30 / 700 | 16.95 | — | pass |
| #1c1612 | #fdfbf9 | 72, 30, 16, 14 | 17.34 | — | pass |
| #1c1612 | #ffffff | 20, 18, 16, 14 | 17.90 | — | pass |
| #1b1611 | #ffffff | 14 / 400 | 17.96 | — | pass |
| #0a0a0a | #ffffff | 14–16 / 400–600 | **19.80** | — | pass |

### 5 clean failures + 1 borderline

All five failures sit in **IntroBanner** or on the **orange-tint operator avatar**. `#f54a00` on white measures 3.58:1. The darkened `#ca3500` (5.00:1) already exists in the token set and is already used on the header pill and search submit — IntroBanner's CTAs use base primary instead.

The two 5.00:1 passes clear AA with zero headroom.

**IntroBanner ratios are best-case.** The section layers a 135° brown gradient reaching `rgba(124,45,18,.55)` plus a `black/12` bottom vignette over the solid orange, so true local contrast is position-dependent and degrades toward bottom-right.

### 32 indeterminate elements

No opaque ancestor background — text sits directly on photographs, so no valid ratio is computable without sampling the image itself:

| Group | Count | Backdrop |
|---|---|---|
| Hero h1 (both spans), badge pill, subcopy | 4 | `hero/landing-golden-3840.jpg` + overlays + noise |
| PopularTrips card route + price | 20 | `destinations/*.jpg` + black gradient |
| ContractCarRental captions | 8 | `tourism/*.jpg` + black gradient |

Search-form text is **not** in this group — the white card beneath it is opaque, so those pairs are scored in the table above.

### ▸ REVIEW — §8

**This is the best-executed section in the document.** Porter-Duff compositing up to the first opaque ancestor is the correct technique for layered UI, and refusing to fake ratios for photo-backed text is the right call. I re-verified all 17 rows independently: **every FAIL verdict is exact**, and the only drifts are ≤0.04 on three composited-background rows — rounding in the composite step, not errors. One caveat in the measurement text above does not survive review: the "ratios are best-case" claim has its sign inverted — see 8.2.

**The finding underneath the five failures is that this is two problems, not five — split by text polarity:**

- **Orange text on a light field (2 of 5):** operator initials `#f54a00` on `#fdece5` (3.12) and the CTA label "Tìm chuyến xe ngay" `#f54a00` on `#ffffff` (3.58). Here the fix already exists and already ships on this page: `--primary-strong` `#ca3500` measures 5.00:1 on white and is correctly used on the header pill and the search submit. A token swap fixes these two with zero visible surface change.
- **Light text on the orange field (3 of 5):** IntroBanner badge `#fafafa` on `#f66526` (2.95), IntroBanner subcopy `#f9f9f9` on `#f54a00` (3.40), and the outline CTA "Liên hệ đặt xe" `#ffffff` on `#f54a00` (3.58). **The token swap does not work here** — `#ca3500` text on `#f54a00` lands near **1.4:1**, far worse than what it replaces. The real options are near-black text on the orange (`#1c1612` on `#f54a00` = **5.00:1** — rev-2 recomputation, cross-validated against this table's own #1c1612/#ffffff = 17.90 and #f54a00/#ffffff = 3.58 rows; the previously printed 4.75 was review-layer arithmetic drift — passes AA with real headroom) or darkening the field — either way a visible polarity inversion of the banner's text treatment, i.e. a **design change requiring sign-off**, not a code-only token application.

So the earlier framing must be scoped precisely: a token swap "keeps every orange surface exactly as designed" for the **two orange-on-light failures only**. For the three light-on-orange failures, any compliant fix visibly changes the banner. Per the review invariants (see OVERALL REVIEW), no action line below asserts "fixes N of M" without naming the exact fg/bg pairs the arithmetic is computed from.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 8.1 | **Five AA failures, all on brand orange:** IntroBanner badge `2.95` · operator initials `3.12` · IntroBanner subcopy `3.40` · both IntroBanner CTAs `3.58`. All need 4.5. Four of five are in IntroBanner. | R6, C3 | **PAGE** | **Critical** |
| 8.2 | **The measurement text's "best-case" caveat has its sign inverted.** Every IntroBanner text element in the table is *light* (`#fafafa` / `#f9f9f9` / `#ffffff`); the 135° brown gradient reaching `rgba(124,45,18,.55)` and the `black/12` vignette **darken** the backdrop, which **raises** light-text contrast. Plain `#f54a00` is the *lightest* backdrop state, so the tabulated ratios are the **floor**, not the best case — local contrast can only improve toward bottom-right, not degrade. The FAIL verdicts stand (the lightest state genuinely occurs on the banner) and no severity in 8.1 changes in either direction. An actual bottom-right composite sample remains unmeasured. The operator-initials row (dark orange on light, no gradient) is unaffected. | R6 | **DOC** | Medium |
| 8.3 | The two 5.00:1 passes clear AA with **exactly zero headroom**. Correct today, but any future tweak to either colour silently drops them below. Worth a regression guard. | C3 | PAGE | Medium |
| 8.4 | **32 elements unscored**, including the h1 (§3.1) and all 20 carousel prices. They are bucketed flat with no risk ranking — yet they are not equal risk: carousel and tourism captions have a `black/80` scrim *and* text-shadow; the hero h1 has neither and sits on a wash thinning to `.08→0`. | R6 | **GAP** | **High** † |
| 8.5 | "5 clean failures + 1 borderline" — **which row is the borderline is never stated**, and at least three qualify: the `3.43` large-text pass (0.43 over its 3.0 floor) and both `5.00` zero-headroom passes. Counting to a specific number while describing three candidates is ambiguous. **Rev-2 designation:** "the borderline" = the IntroBanner h2 large-text pass at **3.43** vs its 3.0 floor — the smallest *absolute* margin (0.43) in the table. The two 5.00 zero-headroom rows are the smallest *relative* margin and are already carried separately by 8.3. | — | **DOC** | Low |

† **Severity-containment rule (stated once, applied here):** a bucketed finding must not carry a lower severity label than a finding its scope strictly contains. This 32-element bucket contains §3.1's four hero elements, independently rated **Critical**. Resolution: the four hero elements (h1 both spans, badge pill, subcopy) are carved out and inherit §3.1's **Critical**; this row's **High** rates the residual 28 carousel/tourism elements, which carry a `black/80` scrim and text-shadow.

**Action, in order:** **(1a) mechanical token swap — no sign-off needed:** operator initials (`#f54a00` → `#ca3500` on `#fdece5`) and the "Tìm chuyến xe ngay" label (`#f54a00` → `#ca3500` on `#ffffff`). Fixes **2 of 5** (the two orange-on-light rows) with zero surface change. **(1b) design change — sign-off required:** IntroBanner badge, subcopy and "Liên hệ đặt xe" are light-on-orange, so the swap is unavailable (`#ca3500` on `#f54a00` ≈ 1.4:1); choose near-black text (`#1c1612` on `#f54a00` = 5.00:1, AA — rev 2) or a darker field. Fixes the remaining **3 of 5**. **(2)** sample the IntroBanner composite at bottom-right to establish the actual position-dependent range — expected at or above the tabulated floor per 8.2, but currently unmeasured. **(3)** risk-rank the 32, h1 first (per the 8.4 carve-out, the four hero elements are already Critical).

---

## 9. Assets

23 `<img>` elements, 17 distinct files.

| Asset | natural | rendered | overdraw |
|---|---|---|---|
| **`hero/landing-golden-3840.jpg`** | 3840×1920 (7.37 MP) | 1905×756 (1.44 MP) | **5.1×** |
| `features/pickup.jpg` | 1000×625 | 313×137 | ~3.2× per dim |
| `features/support.jpg` | 1000×625 | 313×137 | ~3.2× per dim |
| `features/service.jpg` | 1000×625 | 651×407 | ~1.5× |
| `destinations/*.jpg` ×10 | 640×480 | 236×177 | ~2.7× per dim |
| `tourism/sam-son.jpg` | 640×480 | **656×352** | **upscaled** |
| `tourism/*.jpg` ×7 | 640×480 | 320×168 / 488×168 | ok–2× |
| `brand/logo-horizontal.png` | 959×400 | 173×72 (×2) | via `_next/image` |

Hero is preloaded via `react-dom` `preload()` with 4 media-scoped variants.

### ▸ REVIEW — §9

**The delivery strategy is engineered, not careless** — `preload()` with 4 media-scoped variants, correct asset per breakpoint band. That intent matters, and **F6** explicitly demotes Core Web Vitals to a tie-breaker rather than a ranking multiplier, so asset weight alone is not disqualifying.

But intent is not outcome: **7.37 MP delivered for 1.44 MP rendered** is real bytes on the most important load on the site, on a market where mid-range Android dominates.

| # | Finding | Rule | Type | Severity |
|---|---|---|---|---|
| 9.1 | **No performance measurement exists anywhere in this document** — no LCP, CLS, INP, or transferred bytes. Overdraw ratios are a geometry proxy, not a load cost. **F6 is therefore unscoreable**, and more importantly a redesign could swap this hero and nobody could prove regression or improvement. This is the largest single gap in the baseline. | F6 | **GAP** | **High** |
| 9.2 | **The overdraw column silently switches units.** Hero `5.1×` is an **area** ratio (verified `7.3728/1.44018 = 5.12`). But `service.jpg` "~1.5×" is **per-dimension** — its true area ratio is **2.36×**. Two rows are explicitly labelled "per dim", two are not labelled at all. A reader assuming the headline convention undercounts overdraw by roughly half. **Rev-2 normalized area-ratio column** (natural ÷ rendered px²): hero **5.12×** · `pickup.jpg`/`support.jpg` **14.6×** · `service.jpg` **2.36×** · `destinations/*` **7.35×** · `sam-son.jpg` **1.33× by area yet upscaled past native width** — area alone conceals the upscale. Additionally, "~3.2× per dim" on pickup/support conceals a **non-uniform crop**: width 3.20× but height 4.56× (natural AR 1.6 → rendered 2.28; `object-cover` discards ~30% of source height). `service.jpg` and `destinations/*` are uniform, so "per dim" was valid there only. | — | **DOC** | Medium |
| 9.3 | `tourism/sam-son.jpg` renders at `656×352` from a `640×480` natural source — **upscaled past its native width**. Visible softness on a hero-sized figure. | — | PAGE | Low |
| 9.4 | `landing-golden-1920.jpg` serves only the 1024–1919 band and is unreachable at a real 1920 window (§0/§10.1). One of four preloaded variants is effectively dead weight at the most common desktop width. | — | PAGE | Low |
| 9.5 | **Rev 2 — closed, no defect.** All 23 `<img>` carry `alt` at source: `CardImage.tsx:19` requires the prop (×10 PopularTrips) · `FeatureHighlights.tsx:75` `alt={title}` (×3) · `ContractCarRental.tsx:78` `alt={p.name}` (×8) · `Logo.tsx:37` `alt="BBVN — Bus Booking"` (×2) — 10+3+8+2 = 23, matching the measured count. Hero layers are `aria-hidden` divs, correctly excluded. | — | closed | — |

**Action:** run a Lighthouse pass and record LCP / CLS / INP / bytes per breakpoint. Without it this baseline cannot support any performance claim in either direction. Overdraw normalisation published in-row (rev 2, 9.2); the frozen table stands as measured.

---

## 10. Anomalies of record

1. **`landing-golden-1920.jpg` serves only the 1024–1919 band.** At a 1920 window the 3xl branch takes over — media queries match `innerWidth`, not scrollbar-deducted `clientWidth`.
2. **Header has zero scroll state.** Sampled at scrollY 0 / 100 / 200 / 400 / 800 / 2000 — `box-shadow: none`, `backdrop-filter: none`, `border-bottom-width: 0px`, bg `#fdfbf9`, identical throughout. Sticky, but visually undifferentiated from content passing beneath it.
3. **Search form carried persisted state** at scan time — "Ha Noi" / "Sai Gon" undiacriticised, date `21/07/2026`, pax 1.
4. **Zero section margins page-wide** except the footer's 48px.
5. **Two spatial systems coexist** — 1920-cap hero/strip vs 1024-cap everything else; left edges never converge, plateauing 360px apart.
6. **Operator cards have no logos** — text initials only.
7. **FeatureHighlights is 3 cards**, not 4.
8. **Warm neutral ramp** — every grey carries positive lab-a/b.
9. **Near-duplicate hexes** — 3 oranges, 3 warm greys, 3 whites, 2 near-blacks.
10. **97.7% of all orange surface is a single element** — IntroBanner.
11. `tourism/sam-son.jpg` renders larger than its natural size (656 rendered vs 640 natural).
12. IntroBanner runs a 22s `blob` CSS animation (`motion-safe:` gated).

### ▸ REVIEW — §10

Most of these are correctly identified. Three deserve promotion from "anomaly of record" to actionable defect, and one is weaker evidence than it reads.

| # | Finding | Type | Severity |
|---|---|---|---|
| 10.1 | **Rev 2 — reclassified PAGE → DOC (scan contamination).** See §3.4 for the full source trace (`searchStore.ts` persist + `skipHydration`, all-empty defaults; `SearchFormWrapper.tsx:19-30` mount-effect rehydration; behaviour spec'd AC-5/AC-6). The persisted values were this scan's own earlier form interaction read back from localStorage — a first-time visitor sees placeholders, and the undiacriticised "Ha Noi" describes the scan operator's own typed input. Priority item 3 is withdrawn. Pass-4 protocol: cleared profile. | **DOC** | Medium |
| 10.2 | **Rev 2 — contradicted at source; reclassified PAGE → DOC (suspected instrument artifact), pending re-measurement.** `components/layout/SiteHeader.tsx:36-43` ships a real scroll listener (`window.scrollY > 8` → state) and `:59-61` applies `bg-background/90 shadow-e1 backdrop-blur` when scrolled vs plain `bg-background` when not — present in commit `b88b6bf`, before scanned tree `32deaf0`, no uncommitted diff. Most plausible cause of "identical throughout": programmatic `scrollTo()` + synchronous `getComputedStyle()` inside one `evaluate()` samples before the scroll event and React re-render fire. Pass 4 must re-measure awaiting an event flush / animation frame. If re-measurement still shows no change, this reverts to PAGE. | **DOC** | Medium |
| 10.3 | **Anomaly 12 — reduced-motion is NOT verified.** The scan observed the **class name** `motion-safe:animate-[blob_22s_...]`, which proves only that a class is present. `prefers-reduced-motion: reduce` was never emulated and the animation never confirmed to stop. Class-name presence is not behavioural verification. **Rev-2 source note:** `motion-safe:` is present at all four animation sites (`IntroBanner.tsx:28`, `FeatureHighlights.tsx:64`, `OperatorShowcase.tsx:48,65`, `ContractCarRental.tsx:81`) — Tailwind's standard variant compiling to `@media (prefers-reduced-motion: no-preference)`, compliant by construction. Residual risk Medium → Low; Pass 4 confirms rather than discovers. | **GAP** | Low |
| 10.4 | Anomaly 8 — "warm neutral ramp" is listed as an anomaly. It is **not** one: it is a deliberate documented brand decision, and the proposal to replace it was rejected. Recommend relabelling so no future reader treats it as a defect to fix. | — | Low |
| 10.5 | Anomaly 9 — "near-duplicate hexes" overstates the issue; §7 itself explains most as compositing and anti-aliasing artifacts. Relabel as observation, not anomaly. | — | Low |

**Also missing from this list entirely:** focus-state / keyboard indicators, hover / active / disabled states, touch-target sizing beyond RouteDirectory (the hamburger is measured at `40×40` and never checked against the 44px minimum — the number is already in hand), heading-outline and landmark semantics, and dark mode.

**Action:** the measured anomaly list above stays frozen; every correction lives in rows 10.1–10.5. Pass-4 items from this section: re-measure header scroll state with an event flush (10.2), emulate `prefers-reduced-motion` (10.3), rescan under a cleared browser profile (10.1). The hamburger is source-confirmed `size-10` = 40×40 (`SiteHeader.tsx:126`) — a **confirmed sub-44px touch target**; fold into the Priority touch-target sweep.

---
---

# ▸ OVERALL REVIEW

*Added 2026-07-20. Basis: the adopted rule set in [`design-research-20260720.md`](./design-research-20260720.md) after two adversarial debate rounds, plus a four-agent review of this scan and a synthesis pass. Every arithmetic claim below was independently recomputed.*

## Review invariants

Three standing requirements on this review layer, adopted after the adversarial pass. Each is stated once here and applied at the site named:

1. **No bare "fixes N of M."** Any action or priority line claiming a fix count, or invoking a standing constraint ("keeps the orange as designed"), must name the specific fg/bg pairs or table rows the arithmetic is computed from, per instance. *(Applied: §8 Action, Priority 1a/1b below.)*
2. **Severity containment.** A bucketed finding must not carry a lower severity than any independently rated finding its scope contains — carve the member out or inherit its severity. *(Applied: §8.4 footnote re §3.1.)*
3. **The scorecard must reproduce.** The outcome table's row counts must sum to the prose total, every rule scored per-clause must be disclosed as clause-split, and no entry may appear in two rows simultaneously. *(Applied: Scorecard below.)*

## The headline

**The page is in better shape than a raw defect count suggests, and its problems are unusually concentrated.** Two things carry almost the entire ledger:

1. **IntroBanner** — hosts 4 of the 5 WCAG failures *and* is 97.7% of all page orange. Strip it from the accounting and page orange drops from 10.25% to ~0.24% and contrast failures drop from five to one.
2. **The 1024px shell** — drives the two-spatial-systems divergence, the 360px left-edge plateau, the 73% dead space at 4K, and the frozen grids. One constant, four symptoms.

This is a **concentrated page, not a teardown — but it is two sites, not two clean surgeries.** Site 1 (IntroBanner) splits by polarity: a mechanical token swap clears 2 of the 5 contrast failures (operator initials `#f54a00` on `#fdece5`; "Tìm chuyến xe ngay" `#f54a00` on `#ffffff`), while the 3 light-on-orange failures (badge, subcopy, "Liên hệ đặt xe") need a visible polarity change to the banner's text and design sign-off. Site 2 (the shell constant) resolves the S6 symptom cluster but not the rest of the FAIL ledger — S2's four-section run *(§2.1)*, S1's inside>outside inversion *(§2.4)*, S4's frozen ramp *(§5.1)* and R4's decorative-tint question *(§7.4)* sit outside both sites.

## Scorecard

Of the rules that actually apply and could actually be scored:

| Outcome | Count | Rules |
|---|---|---|
| **FAIL** | 8 | R6 (contrast, §8.1) · C3 rollout clause (§4.1/§8.1) · C1 field clause (§2.3/§7) · S2 section boundaries (§2.1) · S6 shell width (§6.1) · S4 (frozen ramp §5.1 + source-confirmed no `clamp()`/fluid rem) · R4 as written (§7.4) · S1 boundary clause (§2.4) |
| **PASS** | 4 | C1 percentage clause ‡ · S2 element/card clauses · C3 two-tier architecture · R1 in spirit (§4 prose) |
| **N/A — wrong surface** | 4 | S5 · S6 prose clause · F4 · F5 |
| **GAP — never measured** | 9 | C2 · C5 · S1 ratio clause · S3 spacing scale · F1 · F2 (18 RouteDirectory hrefs never captured) · F3 subset · F6 · R2 density |

*Derivation (rev 2): `8 + 4 + 4 + 9 = 25` clause-level entries over **20 distinct rule IDs** = the adopted set's **23 IDs** (design-research Part V: C1–C5, S1–S6, F1–F6, R1–R6) **− 3 REJECTED** (C4, R3, R5 — standing constraint 2). Clause-split rules appearing in two rows: **C1, C3, S1, S2, S6**. Rev-2 changes: S3's radius-ladder PASS entry **removed as a category error** (§1.2's own words: radius says nothing about the spacing system — S3 is entirely GAP); **F2** and **R1** added (previously omitted); the merged "R6/C3" FAIL bullet split into its two entries. This resolves the former TODO: the set is 23 rules, 20 in scope, all 20 now scored. Note: the companion doc's own tally line ("15 adopt · 3 reject · 2 split") does not reconcile with its verdict table's 18 ADOPT rows — a defect in that file, flagged for its own correction.*

*‡ C1-percentage caveat: passes the clause arithmetic only — per §7's review, 97.7% of the orange is one element and the 10.25% aggregate "should not be cited as proof of colour discipline."*

*S4 note: the FAIL rests on §5.1's observed frozen rendering **and** (rev 2) source-confirmed absence of `clamp()`/fluid rem terms repo-wide; the former GAP retypes (§3.3, §5.2) fold into this single FAIL entry, not separate GAP entries.*

*R1 note: PASS is "in spirit" — the never-orange clause is cleanly met; the near-black clause is inapplicable on dark photo scrims where white is correct (§4 prose). The real R1 test is the results page, outside this scan.*

*R4 note: the FAIL scores the rule **as written** (orange sanctioned for CTA + active state only). §7.4 rates the page's decorative-tint usage Low and recommends amending the **rule** to add a named token role — a rule gap, not a page defect. R4 stays in the FAIL row until the rule is amended; table and §7.4 are consistent once read as rule-vs-page.*

**Nine of the twenty-five clause-level entries cannot be scored at all** because this scan never measured what they govern. That remains the most important structural fact about this baseline: rigorous on geometry and colour, close to silent on performance, interaction states, and spacing systems.

## What is genuinely well built

Worth stating plainly, because the finding tables above are necessarily negative:

- **The two-tier orange is real** — `--primary-strong` at lab-L 46.5 vs 57.1 is a true darker shade, not a tint, and it is already deployed correctly on the header pill and search submit. The compliant pattern exists on this page; it just is not everywhere yet.
- **Contrast methodology** — Porter-Duff ancestor compositing and refusal to fake ratios for photo-backed text. I re-verified all 17 rows; every FAIL is exact. (The measurement's own "best-case" caveat did not survive — its sign is inverted; the tabulated IntroBanner ratios are the floor, see §8.2.)
- **The lab()→hex pipeline** was validated against known reference points before being trusted, with the naive-approach failure mode documented.
- **Clean radius ladder, clean weight hierarchy, 8px-multiple gaps, 44px touch targets on RouteDirectory, zero horizontal overflow at any width.**
- **The search-card `min()` constraint** is the one element that responds correctly to viewport growth — the pattern the rest of the page should follow.

## Priority order

**Do first — accessibility. 1a is mechanical; 1b changes the banner's text treatment and needs design sign-off:**

1a. **Token swap to `--primary-strong`** on the operator initials (`#f54a00` on `#fdece5`, 3.12 — `OperatorShowcase.tsx:18,66`) and the "Tìm chuyến xe ngay" label (`#f54a00` on `#ffffff`, 3.58 — `IntroBanner.tsx:60`). Fixes **2 of 5** contrast failures with zero surface change — the token already ships on the header pill and search submit (`SiteHeader.tsx:31`, `SearchForm.tsx:97-98`). *Effort: trivial, 2 files.* *(§8.1)*
1b. **Repolarise the IntroBanner text — design change, sign-off required.** Badge (2.95), subcopy (3.40) and "Liên hệ đặt xe" (3.58) are light-on-orange; the token swap is unavailable there (`#ca3500` on `#f54a00` ≈ 1.4:1). Options: near-black `#1c1612` on `#f54a00` (**5.00:1**, AA — rev-2 corrected figure) or darken the field. Fixes the remaining **3 of 5**. *Effort: small, 1 file + design review.* *(§8.1)*
2. **Measure the h1's composited contrast** over the hero photo, worst-case right-edge position where the wash reaches `.08→0`. The most prominent text on the site is still unverified. *(§3.1 — Pass 4)*

*(The former item 3 — "clear the persisted form state" — is **withdrawn**: rev 2 traced the observed values to the scan's own localStorage, not shipped behaviour. See §3.4/§10.1.)*

**Then — structure:**

3. **Widen the shell toward 1200–1280.** Highest-leverage single change; narrows the divergence, cuts dead space, unfreezes the grids. *Effort: mechanical 6-file constant change (`PopularTrips.tsx:45`, `OperatorShowcase.tsx:107,118`, `FeatureHighlights.tsx:46`, `ContractCarRental.tsx:50`, `RouteDirectory.tsx:66`, `SiteFooter.tsx:48`) + visual QA.* *(§6.1)*
4. **Separate the four consecutive `#fdfbf9` sections** — or accept them as one super-section. Doing this properly also discharges the S1 inside≤outside inversion *(§2.4)*: external gaps/colour changes are the same lever — track both against this item. *(§2.1)*
5. **Unfreeze the body/link ramp** — at least one step above 1440, or a fluid rem-based ramp (S4; `clamp()` absence now source-confirmed). Pairs naturally with item 3. *(§5.1, §5.2)*

**Then — close the measurement gaps, ranked by what a redesign could silently regress:**

6. Core Web Vitals + payload *(§9.1)* → 7. Spacing-scale inventory — tabulation only; atom is Tailwind-default 4px *(§1.1)* → 8. Focus / hover / disabled states → 9. Full touch-target sweep — the hamburger's 40×40 is already a confirmed miss *(§10 Action)* → 10. Verified `prefers-reduced-motion` — confirm, don't discover *(§10.3)* → 11. Heading outline + landmarks *(alt text closed at source, §9.5)* → 12. Capture the 18 RouteDirectory hrefs *(F2)*

**Rule-track (design-system follow-ups, not page fixes):**

13. Formalise the `primary/10` decorative tint as a named token role, then amend R4 *(§7.4)*. 14. Correct `#EA580C` → `#f54a00` and the "15 adopt · 3 reject · 2 split" tally line in `design-research-20260720.md` *(companion-file defects flagged in rev 2; out of scope for this file's edit pass)*.

**Fixed in this document (rev 2)** — the former "fix in this document itself" list, executed in the review layer with measured text untouched: §7.1 (α-weighted formula published; residual 40 px² systematic; High→Low) · §9.2 (area column published) · §6.4/§7.2 (unit/viewport labels carried by review rows) · §2.2 (±0.5px tolerance declared, all boundaries recomputed) · §8.5 (borderline designated: the 3.43 row) · §8.2 (corrected earlier). **Still open: §0.1** — re-verification of §2/§4/§6 geometry needs a live pass; it heads the Pass-4 list.

## Standing constraints, restated

**Orange is the primary brand colour and stays.** No recommendation in this document reduces how much orange the page uses. For the two orange-on-light failures *(1a)* the contrast work changes only a text token and no surface. For the three light-on-orange failures *(1b)* the compliant options change how text sits **on** the orange band — darker text or a darker field — a visible design change to the banner, stated explicitly above rather than smuggled in as a token swap. The band itself, and every other orange surface, stays.

**Do not "fix" these — they were argued and settled:** the warm neutral ramp *(upheld)*, the photo hero *(upheld)*, the shadow elevation system *(upheld)*.

## Rev-2 change log (2026-07-20)

Every review-layer change made in rev 2, for the audit trail. Measured text: **zero edits**.

| # | Site | Change |
|---|---|---|
| L1 | Status / preamble | third-generation marker added |
| L2 | §1 review | source notes: `oklch()` authoring, `#EA580C` comment provenance, 4px Tailwind atom |
| L3 | §1.3 | row deleted — self-described non-defect; substance lives in §7 review |
| L4 | §2.2 | full boundary recomputation; ±0.5px tolerance declared |
| L5 | §3.3 / §5.2 / §5.4 | `clamp()` absence source-confirmed; GAP → PAGE (5.4 closed) |
| L6 | §3.4 / §10.1 | persisted-state finding reclassified PAGE → DOC (scan contamination); Priority item 3 withdrawn |
| L7 | §4.4 | closed — intentional at source (`FeatureHighlights.tsx:54-55`) |
| L8 | §4.5 | softened — outline variant, not ghost; Low stands |
| L9 | §6.2 | 59.7% → 59.4% @2560 (recomputed); 73.0% @3840 verified |
| L10 | §7.1 | dedup total reproduced via α-weighting to within 40 px²; High → Low |
| L11 | §8 (two sites) + Priority 1b | `#1c1612` on `#f54a00` corrected **4.75 → 5.00** (review-layer arithmetic error, cross-validated) |
| L12 | §8.5 | borderline designated: IntroBanner h2 3.43 row |
| L13 | §9.2 | area-ratio column published; pickup/support non-uniform crop exposed (3.20× w / 4.56× h) |
| L14 | §9.5 | closed — 23/23 `alt` confirmed at source |
| L15 | §10.2 | header scroll state contradicted at source (`SiteHeader.tsx:36-61`); PAGE → DOC pending Pass-4 re-measure |
| L16 | §10.3 | `motion-safe` source-confirmed at 4 sites; Medium → Low |
| L17 | Scorecard | rebuilt: S3 PASS removed (category error), F2 + R1 added, R6/C3 split, counts re-derived (25 entries / 20 IDs); TODO resolved |
| L18 | Priority order | rebuilt: item 3 withdrawn, S4/S1/R4 dispositions added, effort tags + file pointers added; §4/§5/§10 Action lines added |

---

*Companion document: [`design-research-20260720.md`](./design-research-20260720.md) — the rule set this baseline is judged against.*
