# Homepage Mockup — Authoritative Build Spec

| | |
|---|---|
| **Date** | 2026-07-21 |
| **Source mockup** | `docs/design/mockup-home.png` (863×1823, AI-generated) |
| **Measurement basis** | Consolidated post-correction dossier (4 Sonnet agents + cross-critique + PIL re-measurement). All geometry cited below is from that dossier; retractions honored — including the y=744 "hairline" (dossier A2: retracted; **there are no section dividers anywhere on the page**, the S6/S7 verifier's "not contradicted" note was made without knowledge of the retraction and is overruled). |
| **Reconciled against** | `docs/design/landing-page-color-report-20260721.md` (color report) · `docs/design/design-research-20260720.md` (rule set C1–C5, S1–S6, F1–F6) · live tokens `app/globals.css` · current uncommitted implementation |
| **Ground rules** | Phase 1: no customer auth (`proxy.ts:204-212` returns 410 on customer auth routes) · payments = bank transfer (VietQR) + cash + VNPay-gated · **wire real DB data; omit anything with no real backing — never fake it** |

---

## 1. Verdict

### What the mockup gets right that the current site doesn't

1. **Information-first route cards (S4).** The mockup's route card carries *route pair → duration → from-price → CTA* as structured data. The current `PopularTrips` (`components/home/PopularTrips.tsx:94-124`) is a photo tile with only a price overlay. Every field the mockup shows here is real: `getActiveRoutes()` already returns `minPrice`, `minDurationMinutes`, `operatorCount`, `nextDepartureAt` (`lib/core/db/getActiveRoutes.ts:12-19`). This is the single richest upgrade available at zero data cost.
2. **A chromeless trust strip (S3).** Icon-ring + two-line text, no card boxes, no band fill (dossier A4, A12 — the strip sits on the hero's fade tail). The current implementation wraps the same content in four bordered cards on a full `bg-muted` band (`app/(customer)/page.tsx:274-293`). The mockup's version is calmer and reads as part of the hero, not a fifth section.
3. **One mid-page tinted panel as the tonal anchor (S7).** A single inset, rounded, primary-tinted panel (dossier A7: flat `#FEF3EC`) breaking an otherwise flat-white run. This is a stronger, more deliberate device than the current alternating `bg-muted/30` banding (`page.tsx:295-312`), which spends the tint on four wrappers.
4. **Whitespace-only section separation.** Dossier A2/A3: no dividers, no card borders, shadows at the threshold of detectability. The page is held together by one container, photography, and spacing. The current landing leans on `border-border` card strokes that measure 1.26–1.30:1 (color report §8 — invisible anyway).
5. **Vertical benefit checklist with photo (S6).** Photo left, eyebrow/heading/4 checked rows right, vertically centered (dossier S6). Tighter and more scannable than the current 3-card bento (`components/home/FeatureHighlights.tsx:56`).

### What to reject

1. **The full-bleed saturated-orange newsletter band (S9).** Triple violation: research rule **C1** ("orange never a field", design-research §Rule set:140), the 2026-07-16 audit that *already inverted* an orange band to a light field for exactly this reason (color report §11, IntroBanner history), and white-on-`#F26B1C` fails AA. On top of that there is **no newsletter backend** — nothing may collect emails it can't service. **Dropped entirely** (see §4).
2. **All fabricated data**: star ratings, review counts, "N+ tuyến", "N+ chuyến/ngày", the 1900 1234 hotline, the five competitor operator logos (Phương Trang, Mai Linh, The Sinh Tour, Kumho Samco, Hạnh Café — these are competitors, not partners, on a live commercial site), the VI language switcher (no i18n), and "Đăng nhập / Đăng ký" (customer auth is 410-gated). Full disposition in §4.
3. **The mockup's 12-value orange spread, its irregular rhythm (22/26/30/35px), asymmetric S9 insets, and mixed-color payment marks** — all generation noise, all normalized (§2, dossier Part B/D/E).
4. **The dark charcoal footer (S10 `#202123`).** It exists in the mockup to stage an orange hotline block we don't have. Cream IntroBanner → charcoal slab is a hard tonal crash the warm-neutral system (globals.css:70-72 comment) was built to avoid. Current light footer stays; its *column structure* is upgraded (§3 S10).

### The single biggest structural change

**Replace the photo-tile PopularTrips carousel with the mockup's data-card row, and re-anchor the mid-page on one tinted panel instead of alternating band tints.** Everything else is refinement of components that already exist.

---

## 2. Token decisions

### 2a. The orange question (dossier Part E-1) — DECIDED: collapse to existing tokens

The dossier samples ~12 oranges across nominally identical roles (Part B). The color report proved (§0) that the *live site's* "mysterious near-duplicate oranges" are compositing artifacts of **one** token at various alphas. The mockup's spread is the same phenomenon produced by a diffusion model plus JPEG. It is noise. **Do not reproduce it.**

But one tier the S4/S5 agent defended is real design intent, and it maps *exactly* onto the existing token system:

| Mockup role | Sampled (dossier) | Token | Citation |
|---|---|---|---|
| Icon rings, glyphs, star/arrow accents, orange headline words on white | `#FB7734`–`#F97316` family | `text-primary` / `border-primary` = `#f54a00` | `app/globals.css:81` |
| **All CTA fills** (hero "Tìm chuyến xe", S7 "Nhận báo giá") + hero headline line 2 | `#EE5603` core | `bg-primary-strong` / `text-primary-strong` = `#ca3500` | `app/globals.css:88` — the 2026-07-16 audit token; also fixes the live hero-headline contrast bug (color report §7: `#f54a00` on the hero photo = 2.44–2.93, FAIL; `#ca3500` clears 3:1 large-text) |
| "Tìm vé" outline-button border | `#FCDFCE` pale peach | `border-primary/20` — composites to `#FDDBCC` over white, a near-exact match | mechanism per color report §0 table |
| S7 panel tint | `#FEF3EC` (≈ primary at ~6% over white) | `bg-primary/5` (nearest existing alpha step; do **not** mint a hex) | pattern precedent `page.tsx:282` (`bg-primary/10` chips) |
| Icon-chip tints | — | `bg-primary/10` | `page.tsx:282`, `components/home/OperatorShowcase.tsx:18` |

**No new color token.** The mockup's "two-tier orange" is `--primary` + `--primary-strong` + alpha modifiers, all pre-existing. This also honors research **C3** (two-tier orange, action tier ≥ 4.5:1 — ADOPTED, design-research:142) and **C2** (one primary orange per screen, :141): per viewport, exactly one *filled* orange (the strong CTA); everything else is outline/ring/text tier.

### 2b. The muted-text question (dossier Part E-2) — DECIDED: two existing tokens, surface-keyed

The verifier confirmed S6 descriptions (≈ gray-500) and S7 panel copy (≈ gray-700/800) are genuinely different. Whether the mockup "meant" it is unanswerable — but the codebase already converged on the same split *for contrast reasons*: `--muted-foreground` `#6e6862` fails AA on warm tinted fields, so tinted surfaces use `text-foreground/80` (`components/home/IntroBanner.tsx:52-54` documents 4.06:1 fail → 7.79:1 fix). **Rule: secondary text on white/near-white = `text-muted-foreground` (globals.css:92); secondary text on any primary-tinted surface = `text-foreground/80`.** No new token; the mockup's divergence ships as a side effect of doing the right thing.

### 2c. Type scale (mockup @863 → shipped @≥1024, ×~1.5 container scale)

| Role | Mockup (dossier) | Spec | Exists? |
|---|---|---|---|
| Hero H1 | 32–36px extrabold, lh 1.15 | current `text-4xl → md:text-[64px]` stack | `page.tsx:249` — keep |
| Section title | 18–24px bold | `text-2xl sm:text-3xl font-bold tracking-tight` | `PopularTrips.tsx:48` — keep |
| Eyebrow (S6/S7) | 10–11px caps, wide tracking | `text-xs font-bold uppercase tracking-widest text-primary` | new usage, existing utilities |
| Card title | 14–15px bold | `text-base font-semibold` | existing |
| Body/secondary | 13–14px | `text-sm` + token per §2b | existing |
| "Xem tất cả" link | ~12px orange | `text-sm font-medium text-primary-strong` (4.5:1 at small size — `text-primary` at 14px fails AA per color report §7 cookie-link finding) | existing tokens |

Font is already Be Vietnam Pro everywhere (`globals.css:11-14`).

### 2d. Radius

Mockup: cards 8–12, search card/panel ~16–20, pills = height/2 (dossier S2, S7, A9). Map to the existing `--radius: 0.75rem` scale (`globals.css:54-60,118`): **cards `rounded-xl`** (16.8px), **search card + S7 panel `rounded-2xl`** (21.6px — replaces the current `rounded-3xl` on the hero card, `page.tsx:261`), photo-in-card `rounded-t-xl` with square bottoms (dossier S4), buttons `rounded-full` for pills / default `rounded-lg` otherwise. No new radius token.

### 2e. Spacing & rhythm (dossier Part E-5) — DECIDED: normalize

The measured seam rhythm 22/26/30/35/0 (dossier Part D) is irregular below any perceptual threshold that would make it read as "pairing" — treat as noise. Normalize to research **S2** (design-research:151, ADOPTED — sections 48–64px): **every section `py-12 lg:py-16`**, header→content `mb-6`, card gutters `gap-4` (16px), in-card padding `p-4`/`p-5`. S9→S10 flush (dossier A10) becomes moot with S9 dropped; IntroBanner → footer already abut (`page.tsx:313` → `SiteFooter`).

### 2f. Container

Mockup container is 87.5% of page width (755/863, dossier A1) — at 1440 that proportion lands ≈1260px, squarely in research **S6**'s 1200–1280 shell rule (design-research:155). Current landing sections use `max-w-6xl` = 1152 (`PopularTrips.tsx:45`, `OperatorShowcase.tsx:118`, etc.), which the color report §11 marks "partially resolved" against that same rule. **Adopt `max-w-7xl` (1280) as the landing-section shell**, uniformly. One container; no section breaks it except the hero background (full-bleed photo) and nothing else — the mockup's own only full-bleed section (S9) is dropped.

### 2g. Surfaces, borders, shadows

Per dossier A3 (cards are flat white, no stroke, shadow at detectability threshold) and color report §8 (`--border` is 1.26:1 — decorative only): **landing cards = `bg-card` (pure white, `globals.css:74`) on the warm page field `#fdfbf9`, `shadow-e1` (globals.css:63), no border.** Hover: `shadow-e2` + `motion-safe:hover:-translate-y-0.5` (existing idiom, `PopularTrips.tsx:101`). Drop the alternating `bg-muted/30` section wrappers (`page.tsx:295,304,310`) — the S7 panel becomes the sole mid-page tint (see Reconciliation §5 for why this reverses uncommitted work).

---

## 3. Per-section build spec

All mobile behavior below is **inference — the dossier is desktop-only**.

### S1 — Header

Mockup: transparent bar on the hero wash, no band, no hairline (dossier A11); logo and auth button bleed past the container (A1 exception); nav left-packed; active item = weight+color only.

**Decision (dossier E-3): do not reproduce the container bleed or the mockup nav.** The current `SiteHeader` is kept as-is:
- Full-width `px-6` bar with edge-pinned logo is the deliberate, documented current pattern (`components/layout/SiteHeader.tsx:64-67`) — functionally the same "logo outside the content container" effect the mockup shows, already shipped.
- Mockup's 5-item nav (Đặt vé xe / Thuê xe hợp đồng / Nhà xe / Hướng dẫn / Hỗ trợ) maps to pages that mostly don't exist; current nav is `Liên hệ đặt xe` + `Trở thành đối tác` (`SiteHeader.tsx:21-24`). Ship current.
- **"Đăng nhập / Đăng ký" cannot be built**: `proxy.ts:204-212` 410s all customer-auth routes. The header keeps `Đăng nhập nhà xe` → `/op/login` (`SiteHeader.tsx:26`), styled `bg-primary-strong` per `SiteHeader.tsx:28-31`. The mockup's *outlined* auth button is noted but not adopted — the filled CTA is the header's single conversion affordance and follows C2.
- VI language pill: **dropped** — no i18n exists.
- Active-state: current underline-bar (`SiteHeader.tsx:88-93`) is *better* than the mockup's color-only signal (WCAG 1.4.1) — keep.
- The mockup's no-band transparency is already approximated by the scrolled/unscrolled treatment (`SiteHeader.tsx:50-62`); the bottom "feather" gradient stays.

Mobile (inference): existing drawer (`SiteHeader.tsx:134-186`) unchanged.

### S2 — Hero

Mockup: warm cream→peach wash over a panoramic photo bleeding from the right; bus as foreground subject; left-aligned headline (dark line + orange line), 2-line subcopy; **search card 434×152 ≈ 57% of container width, radius 16, left-aligned to the headline, not centered** (dossier S2); trust strip on the fade tail below.

Build:
- Keep the entire current hero infrastructure — 5-breakpoint preloaded photo set, scrims, noise (`page.tsx:172-241`). Research §Ruling 3 already adjudicated "keep the tuned photo hero" (design-research:70-74); the mockup agrees with the shipped direction.
- Headline: keep two-line structure (`page.tsx:249-252`); **change line 2 from `text-primary` to `text-primary-strong`** — fixes the confirmed live AA failure (color report §7: 2.44–2.93 vs 3.0 needed) while keeping the mockup's dark/orange pairing.
- Search card: `rounded-2xl` (was `rounded-3xl`, §2d), `shadow-e4`, width cap stays per the existing bus-clearance math (`page.tsx:258-266`). The card being left-column and photo-clearing is already implemented.
- Form anatomy: the mockup's row-1 origin/destination + circular swap + row-2 date/stepper/CTA **already exists** — `components/search/SearchForm.tsx:51-88,174-176` (swap button, `size-11` circular, orange glyph, straddling the field seam exactly as the dossier describes at S2). CTA fill: `bg-primary-strong`. No rework beyond a compact-density pass if the card visually exceeds ~2 rows.
- Badge pill above H1 (`page.tsx:245-248`): currently fails AA (color report §7, 3.42–3.56). Change label to `text-primary-strong`. (Mockup has no badge; keeping it is a deliberate retention, not mockup fidelity.)

Mobile (inference): stacked headline → card full-width → photo as background (current behavior, keep).

### S3 — Trust strip

Mockup: 4 items, orange **ring** icon ⌀34 (transparent interior — dossier A4), two-line text, no dividers (A8), no band — it sits on the hero fade (A12).

Build — restyle the existing FEATURES block (`page.tsx:59-64,274-293`):
- **Remove** the `bg-muted` band wrapper, the `border-b`, the per-item card chrome (`border border-border bg-card p-5 shadow-e1`).
- Item = icon in a `border-2 border-primary text-primary rounded-full size-10` ring chip (transparent fill — not the current `bg-primary/10` chip) + title `text-sm font-semibold` + one-line sub `text-sm text-muted-foreground`.
- Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`, placed directly under the hero section inside the same visual flow. No dividers.
- **Copy stays the current honest set** (VietQR/cash, email confirmation, real operators, pickup) — the mockup's "Hỗ trợ 24/7" and "Đổi trả linh hoạt" are service claims Phase 1 cannot back; "Xác nhận tức thì" overstates operator-confirmed booking. Current copy at `page.tsx:60-63` already passed this filter.

Mobile (inference): 1-col stack, then 2×2 at `sm`.

### S4 — Tuyến đường phổ biến (route cards) — **the flagship rework**

Mockup (dossier S4): header + "Xem tất cả" on shared baseline; 4 flat-white cards ≈23% width each, gutter 13→16px; photo 16:9 edge-to-edge with rounded top corners; then origin→destination (orange `→` glyph), duration + from-price row, rating + "Tìm vé" outline button row. Carousel arrow straddles container edge, no peek card (A5, A6).

Build — rework `PopularTrips`:
- Card anatomy top→bottom: photo (`aspect-video`, `rounded-t-xl`, existing `/destinations/<slug>.jpg` via `CardImage`) → `p-4` stack: **route pair** (`text-base font-semibold`, `ArrowRight size-4 text-primary` between) → row: clock icon + duration left (`text-sm text-muted-foreground`), **`Từ {formatVnd(minPrice)}`** (`text-sm font-semibold`) → row: *(rating slot DROPPED — §4)* "Tìm vé" button right-aligned.
- **"Tìm vé" = outline tier**: `bg-card border border-primary/20 text-primary-strong rounded-lg h-9 px-4 text-sm font-medium` (§2a — this is the mockup's `#FCDFCE`-border button, token-mapped). Whole card is also a link to `searchHref(origin, destination)` as today (`PopularTrips.tsx:94-101`).
- Data: extend the price map the RSC already builds (`page.tsx:182-188`) to also carry `minDurationMinutes` from `getActiveRoutes()` (`lib/core/db/getActiveRoutes.ts:17`) — format as `7h 30m`. Keep the existing honesty gate: cards render **only** for routes with a live bookable trip (`PopularTrips.tsx:30-34`); section hides below 1.
- Header row: title left, `Xem tất cả` → `/routes` right, shared baseline (`items-end justify-between` — current pattern `PopularTrips.tsx:46`).
- Carousel: keep scroll-snap + arrow buttons (`PopularTrips.tsx:38-70`). Dossier A5 says no peek card — acceptable to keep the current 88%-basis peek on mobile (inference: peek is the better mobile affordance; the arrow-only signifier is desktop).
- 4 visible columns at `xl` (current basis math, `PopularTrips.tsx:90`), 2 at `sm`, 1.15-card peek below `sm` (inference).

### S5 — Nhà xe đối tác (operators)

Mockup (dossier S5): 5 compact horizontal cards — 30px logo left, name + rating + "N+ tuyến" stacked right, height ~74px.

Build — restyle `OperatorShowcase` toward the compact horizontal card, with real data only:
- **Named competitor operators: DROPPED.** Render `getPublicOperators()` results only (`lib/home/getPublicOperators.ts:13`); the section already self-hides when empty and switches to spotlight layout for ≤2 operators (`OperatorShowcase.tsx:102-115`) — correct for the family-operator launch scale. Keep that branching.
- Logo slot: **no logo column exists on Operator** (`prisma/schema.prisma:49-101`) → keep the initials chip `bg-primary/10 text-primary-strong` (`OperatorShowcase.tsx:18`).
- Ratings: DROPPED (no model). "N+ tuyến": REDUCED to the existing free-text `routesSummary` line (`OperatorShowcase.tsx:32-36`) — real words beat small numbers.
- Card: `rounded-xl bg-card shadow-e1` (border dropped per §2g), `p-4`, horizontal `flex items-center gap-4`.
- Header: match S4's header pattern (title left; no "Xem tất cả" — there is no operator directory page).

Mobile (inference): 1-col stack; grid `sm:grid-cols-2 md:grid-cols-3` as today (`OperatorShowcase.tsx:126`).

### S6 — Vì sao chọn BBVN

Mockup (dossier S6): photo left 45.5% of container, flush to container left edge, `rounded-xl`; right column vertically centered: orange eyebrow → 2-line heading → 4 benefit rows (orange ring-check ⌀16 aligned to title line, 14px gap, uniform 36px row pitch).

Build — replace `FeatureHighlights`'s 3-card bento with the two-column layout:
- `grid lg:grid-cols-[45%_1fr] gap-10 items-center`. Photo: reuse an existing `/features/*.jpg` interior shot (`FeatureHighlights.tsx:74`), `rounded-xl`, no frame chrome.
- Right stack: eyebrow `VÌ SAO CHỌN BBVN?` (§2c eyebrow style) → heading `text-2xl sm:text-3xl font-bold` (2 lines) → 4 rows of: `CircleCheck`-style ring icon (`text-primary`, outline glyph, `size-5`, aligned to first text line) + title `text-sm font-bold` + description `text-sm text-muted-foreground`. Row spacing `gap-6` (normalized from the 36px pitch).
- **Copy audit (mandatory):** current `FeatureHighlights.tsx:26` ships `'Đánh giá 4.8/5 từ hành khách'` — a fabricated rating on the live site; it must be removed in this rework regardless of anything else. The mockup's "Hơn 1.000+ tuyến xe" is likewise fabricated — REDUCED to qualitative copy, or gated through the existing `trustMetric` floor mechanism (`components/home/trustDisplay.ts:10,26-33`) if a number is wanted.

Mobile (inference): photo above, text below, both full-width; keep `reveal` stagger idiom (`globals.css:242-250`).

### S7 — Dịch vụ thuê xe hợp đồng (tinted panel)

Mockup (dossier S7): inset rounded panel `x=53-808`, `rounded-2xl`, flat `#FEF3EC`; left third = eyebrow → 2-line heading → 2-line copy; **CTA to the right of the copy, not below**; van cutout right; 4-item trust row along the panel bottom with faint vertical dividers (A8) at uneven, content-sized spacing.

Build — rework `ContractCarRental`'s header into the panel; keep the tourism grid beneath:
- Panel: `rounded-2xl bg-primary/5 p-6 lg:p-8` inside the section container (inset card, NOT full-bleed — dossier S7). This is the page's one mid-band tint (§2g).
- Content: eyebrow `THUÊ XE HỢP ĐỒNG` → heading `Dịch vụ thuê xe cho mọi nhu cầu` → copy (`text-foreground/80` per §2b — tinted surface) → CTA `Nhận báo giá ngay →` as `bg-primary-strong text-primary-foreground rounded-lg` linking to `/lien-he-dat-xe` (real charter flow: `CharterRequest` model, `schema.prisma:1015`). Desktop: CTA sits inline to the right of the copy per mockup; mobile (inference): below the copy.
- Van cutout: **no such asset exists** — omit the image rather than commission fakery; the panel reads fine as copy+CTA (open item §6 if the user wants a real vehicle photo shot later).
- Trust row (Xe đời mới / Tài xế kinh nghiệm / Giá minh bạch / Hỗ trợ tận tình): icon-ring + label, **normalized to an even 4-col grid** (dossier E-7: the 199.5/192.5/170.5 progressive narrowing is auto-width noise, not design), `lg:grid-cols-4`, with `divide-x divide-border` on `lg` only (the dividers are confirmed real design in this component — A8 — and distinguish it from the hero strip, which has none). Labels `text-foreground/80`.
- Watermark skyline: skip — decorative generation garnish, not worth an asset.
- Tourism bento (`ContractCarRental.tsx:71-99`): **retained below the panel** — it is real, already-shipped content and the section's visual payload; the panel replaces only the plain header + outline CTA (`ContractCarRental.tsx:51-69`).

### S8 — Điểm đến được yêu thích — **DROPPED as a section**

Mockup shows 5 destination photo cards with "N+ chuyến/ngày". Disposition:
- The frequency stat is derivable (count upcoming trips per destination) but at family-operator launch scale the honest numbers are ~1–5/day — below any credible display floor (the `TRUST_FLOOR` philosophy, `trustDisplay.ts:5-10`).
- Destination photo cards duplicate what S4 (photo route cards) and `RouteDirectory` (`components/home/RouteDirectory.tsx`) already provide, against the same photo library (`/destinations/*.jpg`).
- **Verdict: drop.** `RouteDirectory` (hub-grouped text links, already honesty-filtered by `activeRouteKeys`, `RouteDirectory.tsx:56-61`) keeps the discovery/SEO slot in the same page position. If the trip volume ever clears a floor of ~10/day per destination, revisit as a reduced version.

### S9 — Newsletter band — **DROPPED; IntroBanner keeps the slot**

Rejected in §1 (C1 violation + prior audit reversal + no backend). The existing `IntroBanner` (`components/home/IntroBanner.tsx`) — light `#ffb682` field, dark ink, one `#bd4700` CTA, all-AA (color report §7 IntroBanner block: 10.46/6.66/5.22/4.95, all PASS) — already serves the closing-CTA slot and embodies the *corrected* version of what the mockup's band attempts. Keep unchanged. The mockup's one adoptable idea here — a single-pill input+button control (dossier A9) — is recorded for whenever a newsletter backend exists, but nothing ships now.

### S10 — Footer

Mockup (dossier S10): charcoal, brand column (logo + blurb + social chips) + 3 link columns + hotline column (orange 20–22px phone, hours, email), inset hairline, payment marks bottom-right.

Build — evolve the current light `SiteFooter`, reject the dark slab (§1):
- Keep `bg-muted/40` field and `border-t` (`components/layout/SiteFooter.tsx:47`).
- **Adopt the brand-column structure**: logo → short blurb → (social chips only when real profile URLs exist — none known today; omit) — the current footer already has logo + blurb (`SiteFooter.tsx:49-55`).
- Link columns: current 4 groups (`Đặt vé` / `Dành cho nhà xe` / `Pháp lý` / `Hỗ trợ & Khiếu nại`, `SiteFooter.tsx:18-34`) already match the mockup's column count with *real* destinations. Keep; adopt the mockup's spacing rhythm (header → 20px gap → links at 14–16px pitch — currently `gap-2`, loosen to `gap-3`).
- **Hotline column: cannot ship.** No platform hotline exists — the only real phone numbers are per-operator `contactPhone`, surfaced contextually on trip/booking pages (`app/(customer)/trips/[id]/page.tsx:168`). No `1900 1234`, no invented hours, no `hotro@bbvn.vn` (unverified mailbox; see §6). The 4th column remains the support-links group.
- **Payment marks: REDUCED + normalized monochrome** (dossier E-6 — the mockup's mixed rendering is a generation defect). Show only methods Phase 1 actually accepts: **VietQR / bank transfer, cash, VNPay** (VNPay gated on `VNPAY_ENABLED`). No Visa/Mastercard/MoMo/ZaloPay marks — displaying unaccepted schemes on a live site is a false claim. Render as monochrome `text-muted-foreground` marks per research **F4** (badges monochrome, cap 3–4; design-research:164).
- Bottom bar: copyright left (exists, `SiteFooter.tsx:91-93`), marks right, separated by the existing `border-t border-border/60` — this matches the mockup's single inset hairline (dossier A2: the footer hairline is the only rule on the page).

Mobile (inference): brand block full-width, link columns 2-up, marks wrap under copyright — current flex-wrap behavior extends naturally.

---

## 4. Data reality table

| Element | Mockup shows | Real data? | Verdict |
|---|---|---|---|
| Route from-price | "Từ 320.000đ" | `getActiveRoutes().minPrice` (`getActiveRoutes.ts:16`) | **SHIP** (already live) |
| Route duration | "7h 30m" | `minDurationMinutes` (`getActiveRoutes.ts:17`) | **SHIP** — new display of existing data |
| Route pairs | HCM→Đà Lạt etc. | `POPULAR_ROUTES` ∩ live routes (`page.tsx:182-183`) | **SHIP** (already live, honesty-gated) |
| Route-card star rating | "4.8 (1.2k)" | No Review/Rating model in `schema.prisma` | **DROP** |
| Operator names | Phương Trang, Mai Linh, … | Competitors, not partners; real ops via `getPublicOperators()` | **DROP names; SHIP real operators** |
| Operator logos | 30px logo box | No logo column (`schema.prisma:49-101`) | **REDUCE** → initials chip (`OperatorShowcase.tsx:18`) |
| Operator rating | "★ 4.8" | No model | **DROP** |
| "N+ tuyến" per operator | "120+ tuyến" | Derivable (`Route` count by `operatorId`) but launch-scale tiny | **REDUCE** → `routesSummary` free text (`schema.prisma:60`) |
| "N+ chuyến/ngày" per destination | "125+ chuyến/ngày" | Derivable but ~1–5/day at launch | **DROP** (with S8) |
| "Hơn 1.000+ tuyến xe" (S6 checklist) | fabricated count | `getHomeMetrics().routes` real but small (`getHomeMetrics.ts:27`) | **REDUCE** → qualitative copy or `trustMetric` floor gate (`trustDisplay.ts:26`) |
| "Đánh giá 4.8/5" — **currently live** | (also in mockup spirit) | None — `FeatureHighlights.tsx:26` | **REMOVE from live site** |
| Hotline "1900 1234" + hours | footer column | No platform hotline; only per-operator `contactPhone` | **DROP** |
| `hotro@bbvn.vn` | footer email | Unverified mailbox; domain is lenxevn.com | **OPEN** (§6) — omit until confirmed |
| Social chips (4) | fb/yt/… | No known profile URLs | **OPEN** (§6) — omit until real |
| Payment marks | VISA · Mastercard · MoMo · ZaloPay | Phase 1 = VietQR/bank + cash + VNPay only | **REDUCE** → real methods, monochrome |
| Newsletter signup | email pill + Đăng ký | No backend, no list | **DROP** |
| "Đăng nhập / Đăng ký" | header button | Customer auth 410-gated (`proxy.ts:204-212`) | **REDUCE** → `Đăng nhập nhà xe` → `/op/login` (`SiteHeader.tsx:26`) |
| VI language pill | header | No i18n | **DROP** |
| Trust-strip claims ("Hỗ trợ 24/7", "Đổi trả linh hoạt") | 4 items | Unsupported service claims | **REDUCE** → current honest copy (`page.tsx:59-64`) |
| Van cutout (S7) | vehicle render | No asset | **DROP image**, ship panel copy+CTA |
| Hero bus photo | bus on road | Real shipped asset set (`/hero/landing-golden-*.jpg`) | **SHIP** (keep current) |

---

## 5. Reconciliation

### With `design-research-20260720.md`

| Rule | Mockup | Resolution |
|---|---|---|
| **C1** orange never a field (:140) | S9 full-bleed orange band violates | **Rule wins** — S9 dropped |
| **C2** one primary orange per screen (:141) | Mockup shows 1 filled CTA per viewport; card CTAs are outline tier | **Agreement** — mockup's outline "Tìm vé" is the C2-compliant device; spec formalizes as `border-primary/20 text-primary-strong` |
| **C3** two-tier orange (:142) | Mockup's spread is noise, but its pale-border tier is real | **Agreement** — mapped to existing `--primary`/`--primary-strong`/alpha (§2a) |
| **S2** section spacing 48–64 (:151) | Mockup rhythm 22–35px (scaled ≈37–58) irregular | **Rule wins** — normalized `py-12 lg:py-16` |
| **S6** shell 1200–1280 (:155) | Mockup container ≈87.5% ≈ 1260 @1440 | **Agreement** — `max-w-7xl`, closing the report's "partially resolved" §6.1 |
| **F4** monochrome badges, cap 3–4 (:164) | Mockup marks mixed-color (defect) | **Rule wins** — monochrome, real methods only |
| **F5** refund-trust over security-trust (:165) | Mockup pushes ratings/badges | Ratings unavailable anyway; footer keeps `Chính sách hủy/hoàn vé` prominent |
| §Ruling 3 keep photo hero (:70) | Mockup has a photo hero | **Agreement** |

### With `landing-page-color-report-20260721.md`

- **§0 artifact trap** → the entire basis for collapsing the mockup's orange spread (§2a). The spec introduces zero new hexes, so the trap has nothing to bite.
- **§7 hero orange line FAIL (2.44–2.93)** → spec fixes it via `text-primary-strong` while *increasing* mockup fidelity (its hero orange `#F75303` is darker than `#f54a00` anyway).
- **§8 `--ring` ≡ `--primary` invisible-focus on orange surfaces** → still open project-wide; this spec avoids adding any new saturated-orange field (S9 dropped), so it adds no new failing surface. Fixing `--ring` remains outside this spec's scope.
- **§4 section banding (`#fdfbf9`/`#faf8f6` alternation)** → **CONFLICT, mockup wins.** The banding was this week's uncommitted answer to the prior scan's "undifferentiated 2,600px run" finding. The mockup solves the same problem differently: flat field + one tinted S7 panel + whitespace (dossier A2/A7). Adopting the mockup means **reverting the `bg-muted/30` wrappers** (`page.tsx:295,304,310`) and the full `bg-muted` trust band (`page.tsx:274`). Reason mockup wins: one deliberate tonal anchor reads as design; alternating near-identical tints (Δ ≈ 3 RGB units) read as noise and consumed the fix budget the panel now spends better. The prior finding stays resolved — differentiation now comes from the panel + section rhythm.
- **§11 IntroBanner inversion history** → upheld; the mockup's S9 would have reversed it (rejected).

### With the current implementation — reuse map

| Component | Status |
|---|---|
| `SiteHeader.tsx` | **Reuse as-is** (S1) |
| Hero infra in `page.tsx:172-266` | **Reuse**; two one-line color fixes (headline line 2, badge label) + `rounded-2xl` card |
| `SearchForm.tsx` / `SearchFormWrapper` | **Reuse as-is** — already matches mockup anatomy incl. swap button |
| FEATURES strip (`page.tsx:274-293`) | **Rework** — de-card, de-band, ring icons (S3) |
| `PopularTrips.tsx` + `popularRoutes.ts` + `CardImage.tsx` | **Rework** — photo tile → data card (S4); carousel + honesty gate retained |
| `OperatorShowcase.tsx` | **Light rework** — compact horizontal card; initials/summary logic retained (S5) |
| `FeatureHighlights.tsx` | **Rework** — bento → 2-col photo+checklist; **delete the fake 4.8/5 line** (S6) |
| `ContractCarRental.tsx` | **Rework header** → tinted panel + trust row; bento grid retained (S7) |
| `RouteDirectory.tsx` | **Reuse as-is** — inherits S8's slot |
| `IntroBanner.tsx` | **Reuse as-is** — supersedes S9 |
| `SiteFooter.tsx` | **Light rework** — payment-mark row + spacing; structure retained (S10) |
| `TrustStrip.tsx` / `trustDisplay.ts` / `getHomeMetrics.ts` | **Available** — floor-gated metrics machinery for any future numeric claim; not on the page in this spec |
| New code needed | Duration formatting + threading `minDurationMinutes` through the S4 price map; monochrome payment-mark row. Nothing else is net-new. |

---

## 6. Open decisions for the user

Everything else in this document is decided. These four are genuinely undecidable from evidence on hand:

1. **Support email.** Does a monitored mailbox exist (e.g. on lenxevn.com)? If yes, it goes in the footer brand column; until confirmed, no email ships.
2. **Social profiles.** Any real Facebook/Zalo/TikTok pages? Chips ship only with real URLs.
3. **Charter panel photograph.** The S7 panel ships text+CTA only (no van asset). Commission/shoot a real vehicle photo later, or leave as-is?
4. **Reverting this week's uncommitted banding work.** §5 rules the mockup's flat-field approach wins over the just-added `bg-muted/30` alternation — but that work is hours old and uncommitted. Confirm the reversal before implementation starts, since it discards recent effort by design, not oversight.
