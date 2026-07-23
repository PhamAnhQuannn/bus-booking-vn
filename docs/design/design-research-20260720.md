# Design Research — Orange-Primary Booking Marketplace

| | |
|---|---|
| **Date** | 2026-07-20 |
| **Scope** | Colour law, spatial law, human-factors + SEO constraints for an orange-primary Vietnamese intercity bus-booking marketplace |
| **Method** | 3 parallel research crews (web research, no repo access) → 1 synthesis pass resolving their collisions |
| **Status** | Reference rule set — **a migration proposal, not a blank slate.** Not applied to code, and it *conflicts with* the token system already shipped in `app/globals.css`. See [Current state delta](#current-state-delta) before implementing anything. |

**Part I** is the synthesis — the rulings and the rule set. **Parts II–IV** are the crews' raw reports, preserved with citations and their own evidence-quality caveats. The **Appendix** consolidates every claim the crews flagged as weakly sourced.

Companion document: [`landing-page-scan-20260720.md`](./landing-page-scan-20260720.md) — the measured current state.

---
---

# PART I — SYNTHESIS

## The convergent law

> **Reading Part I.** A **†** marks any claim that has a row in the [Evidence Quality Register](#appendix--evidence-quality-register) — i.e. the crews themselves flagged it as weakly sourced. Part I is the section people implement from, so the hedges are carried up here rather than left in the Appendix. A † claim is directional; do not cite it as settled fact or let it be the sole justification for a decision.

Three crews researched independently — colour, space, human/SEO. All three found **the same law from different doors**. That convergence is the finding.

- Google VC×PT study: visual complexity hurts more than unfamiliarity. Clutter is the #1 killer, measured at 17–50ms.
- Token research: 74-step scale = "drift generator." *A small scale is an opinion, a large scale is a palette.*
- Colour research: no shipped product **in the surveyed set** uses orange above ~15% surface. **†** (Part II §1's actual wording was "unsupported by a single real product *in this set*" — a 10-product sample, not an audited universal negative. Structurally the same class of claim as "open lane" below, and flagged accordingly.) Apple HIG — red used for noncritical reasons stops meaning critical.
- Baymard: >3–4 trust badges *reduces* conversion 5–8%. **†** (the *badge-bloat* direction is the sourced part; the 5–8% magnitude is Baymard-via-blog, not traced to primary)

Same law four times: **meaning comes from scarcity, not presence.** **†** Every design decision is a subtraction problem.

Note the convergence is weaker than it looks: the four bullets are not four independent measurements of one law, they are one plausible law that four different literatures are *consistent with*. Treat it as a useful organising heuristic, not as four-way corroboration. The framing originates in none of the three crews' raw reports — it was added at synthesis, and both Part V debate rounds' defenses declined to use it as proof.

---

## Rulings on crew collisions

The crews contradicted each other in 5 places. These rulings are synthesis, not summary.

### 1. Price colour — direct collision

**Space crew:** price must be the bold "spotted-pattern" anchor, right-aligned, coloured.
**Colour crew:** orange means exactly one thing — primary action.

Both are right. Following both naively gives price-orange + CTA-orange → two oranges fighting per row × 20 rows = orange soup, law violated.

**Ruling: price gets weight + size + near-black. Never orange.** The spotted-pattern override fires on *salience*, not hue — 700-weight at 20px on near-black out-saliences everything around it at 14px/400. Orange stays reserved for the CTA. On a results row the eye should land price-first, then CTA — a two-beat, not a tie.

### 2. Density — apparent conflict, actually two axes

**Space crew:** tighten results, don't import marketing whitespace.
**Feel crew:** match SEA category prototypicality, don't import Western minimalism. **†** (observational only — no controlled study shows SEA users intrinsically prefer denser UI)
**Colour crew:** orange sparse, low-teens percent maximum.

Not a conflict. **Information density high, colour density low.** That is the whole answer to "how do we feel local without looking cheap."

Shopee / Vexere / Lazada feel cluttered because they run *high info density AND high colour density* — red, gold, orange, green badges all competing. ~~Nobody in SEA has shipped high-info-density + monochrome-discipline. That is the open lane.~~ **† STRUCK**

> **STRUCK — abandoned by its own defense in BOTH debate rounds, independently, with no coordination between them.** That is as dead as this process can make a claim. The **design instruction** (dense rows, monochrome ink, one orange) survives untouched — it stands on C1 + C2 + C5 and needs no market claim at all. Only the *positioning* claim is struck, pending the [one audit](#the-one-audit-that-settles-three-open-items).

Flagging our own claim, because it is the load-bearing one: "nobody in SEA has shipped this" is a **negative existence claim across an entire regional market**, asserted from three web-research passes with no systematic competitive audit. It is the single least-supported statement in this document and it carries the positioning. An empty lane is also sometimes an empty lane *for a reason* — the alternative reading is that SEA marketplaces converge on high colour density because it works there, and that our monochrome discipline reads as foreign rather than premium. This is the claim to validate first and cheapest, before any token work: audit the top ~10 VN/SEA booking and commerce apps against both axes and record the result here.

Dense rows, tight rhythm, many trips visible per scroll — rendered in a near-black/grey ink scale with exactly one orange. Local density register, premium colour register.

### 3. Hero — SEO and colour solve each other

**Colour crew:** orange never a field/background colour.
**Feel crew:** hero is the LCP element, photo heroes are the #1 LCP risk, and real H1 text is needed above the fold.

> **REJECTED — see [Part V](#part-v--debate--adjudication).** Round 1 rejected 2-of-3; round 2's own auditor found the same verdict inside this document. The problem it solves is already solved: the shipped hero has a real `<h1>` above the fold and measures **1.9s LCP** (Part IV §5.1), inside budget. Adoption cost is demolition of a live, tuned, 5-breakpoint `preload()`ed asset.
>
> **REOPENS IF:** a measured Lighthouse LCP misses the 2.5s budget. Even then the indicated fix is "shave hero weight," not necessarily "rebuild as a navy field" — navy does not exist as a token and would be its own project.
>
> **Dependency note:** rejecting §Ruling 3 *and* C4 together is the coherent pair. Adopting this ruling while rejecting C4 would put a cool navy hero against warm-grey body chrome — the exact undertone clash Part II §4 warns against, poles reversed.

~~**Ruling: deep-navy CSS field hero. Search form on it. Orange CTA.**~~

- CSS field = ~0 bytes; LCP becomes the H1 text node, trivially under 2.5s. Beats every AVIF / `fetchpriority` trick because it removes the image entirely.
- Satisfies "no orange field."
- Satisfies "unique text above fold."
- Navy is the trust register (HubSpot Atomic `#33475B`, Amazon `#131921`).

The performance-optimal hero and the colour-legal hero are the same hero.

### 4. Warning colour — Orange S.A. already solved this

The company literally named Orange routes warning → yellow and danger → red `#CD3C14`, around its own brand colour. Its `.text-primary` utility force-pairs a background because orange text alone cannot pass contrast — a CSS guardrail, not a guideline.

**Ruling: copy Orange S.A. wholesale.** Brand orange maps to CTA + selected/active state only. Danger = red. ANSI Z535.1 codifies orange = warning outside software; that fight is unwinnable, so route around it.

For the warning slot Part II §5 offered **two** options and named one as safer — the synthesis originally dropped that and stated amber as settled. Restored as an explicit implementation-time choice:

| Option | Warning | Note |
|---|---|---|
| **A. Amber/gold** (`#F5A623`-class) | amber | Must differ from brand orange by *hue angle*, not lightness. Requires side-by-side swatch testing, not just a contrast check |
| **B. Yellow caution + red danger** | yellow | Part II §5's **"more safely"** branch — mirrors ANSI and Orange S.A. directly. Maximum hue separation from brand orange |

Option B carries less collision risk; Option A retains a warmer palette. Neither is settled here.

Corollary from the contrast table — two-tier orange is mandatory, not optional:

| Token | Use |
|---|---|
| brand orange `~#FF7A00` | large filled buttons, graphics. **Label must be near-black, not white** — see below |
| action orange `~#C24914` (4.93:1) | links, small icons, any orange text on white |

> **CORRECTION (2026-07-20, post-synthesis).** An earlier revision of this table permitted "≥18px bold white text" on brand orange. That is wrong and was never computed. **White on `#FF7A00` is 2.61:1** — below the 3:1 WCAG large-text floor, so it fails at *every* size, not just small. The doc's headline recommendation ("orange CTA", §Rulings 1/3, §Rule set, §One-sentence version) is unshippable in that form. Two ways out, both legal — pick one at implementation time:
>
> | Option | Ratio | Note |
> |---|---|---|
> | **A. Near-black label on brand orange** `#FF7A00` | **8.04:1** | Keeps the vivid brand hue. Matches Amazon's own `#FFD814` cart button (Part II §1) and Orange S.A.'s force-paired-background guardrail (§Ruling 4) |
> | **B. Darken brand orange until white passes AA** | `#C2410C` → **5.18:1** | Keeps a white label; costs hue vividness. Converges with the repo's existing `--primary-strong` |
>
> Two further constraints the original table missed:
>
> - **WCAG 1.4.11 boundary.** `#FF7A00` against a white page field is also 2.61:1, so an orange fill on white needs its own border regardless of label colour. The navy hero of §Ruling 3 is the one context where the fill clears boundary contrast unaided (**5.09:1** on `#233045`) — the navy-hero ruling and the contrast problem partly solve each other, which the synthesis did not notice.
>   - **Gap, added after review:** that exception covers the hero only. The **results-row CTA sits on a white/light row** (per §Rule set, Space) and is the highest-frequency button in the product — it gets no border treatment anywhere in Part I. Any orange fill outside the navy hero **must** carry an explicit border token. With §Ruling 3 now rejected, the navy exception does not apply anywhere in the shipped product, so this is the *only* live case, not an edge case.
> - **Large-text thresholds are 18.66px bold / 24px regular**, not "18px bold." The original figure was under the actual bold threshold.

### 5. Elevation — three sources agree

**Space crew:** M3 went tint-first; Fluent stayed shadow-first; Carbon uses layer tokens + paired borders.
**Feel crew:** motion/paint budget targets mid-range Android (65.7% of VN).
**Colour crew:** neutral ramp cool / navy-anchored.

**Ruling: Carbon model.** Layer tokens + borders. Shadow reserved for genuinely floating things — modal, bottom sheet, sticky mobile CTA bar. Cheaper to paint, survives dark mode, matches the calm-transactional register. Fluent optimises for a different brand language — Part III §7's finding is explicitly *"Neither is 'wrong' — they optimise for different brand languages"*; the calm-transactional register here favours the Material/Carbon direction, which is a fit judgement, not a correctness one. (An earlier revision of this ruling asserted Fluent was "wrong for a payment product," hardening its own source's hedge into a verdict.)

> **REJECTED for this repo — see [Part V](#part-v--debate--adjudication).** Retained as reference for a future dark-mode build.

---

## The rule set

> **Verdicts** come from two independent adversarial debate rounds plus a synthesis pass — see [Part V](#part-v--debate--adjudication) for the reasoning, the vote on each contested rule, and what evidence would reopen a rejected one.

### Colour

| # | Rule | Verdict | Basis |
|---|---|---|---|
| **C1** | **Orange ≤ ~10% surface.** Never a **field**, never body text, never a warning. *Field = a background/surface colour. A solid-orange **CTA button fill is not a field*** — that distinction was missing from this line and, read literally, the rule forbade the doc's own headline instruction. The percentage: the doc says "low-teens" §Ruling 2, "5–15%" Part II §1, "10–15%" Part II §4; where they disagree ~10% governs. **The number is a sanity check, not a measurement** — the operative rule is C2. | **ADOPT** (qualitative half only) | Both rounds rejected the metric as unenforceable, both kept the ban. Ten-product survey, Part II §1 |
| **C2** | One primary orange per screen. If two orange things compete, one is wrong regardless of pixel percentage. | **ADOPT** | Unattacked in either round. Live violation: `TripCard.tsx:24,31,36,72` runs 3–4 competing oranges |
| **C3** | Two-tier orange (brand / action ≥4.5:1). Never bright teal, which reads gamified. ~~Navy secondary, deep and desaturated.~~ | **SPLIT — ADOPT tier + teal ban; DEFER navy** | Tier is WCAG arithmetic, not taste, and shipped code fails it (bugs 1–3). Navy is coupled to rejected R3/C4 — deferred pending the [one audit](#the-one-audit-that-settles-three-open-items) |
| **C4** | ~~Neutral ramp cool / slate-leaning, not warm / stone. Warm grey + orange = craft/artisanal register, wrong for logistics + payment.~~ | **REJECTED** | See [Part V](#part-v--debate--adjudication). Reverses a deliberate documented decision (`globals.css:70`) on a vibe-only justification |
| **C5** | Discard 60-30-10. Interior-design folklore with no citable inventor. Use semantic roles. | **ADOPT** | Untouched by any agent in either round. Five design systems converge (Part II §2) |

### Space

| # | Rule | Verdict | Basis |
|---|---|---|---|
| **S1** | The law is `inside ≤ outside`. Target 1:2–1:3. **†** — a working rule aggregated from practitioner literature, **not** a published standard; no major design system publishes a numeric proximity ratio. | **ADOPT** as †-hedged heuristic | Round 2's "weakening" restates the hedge already present. Hedged adoption is the correct end state |
| **S2** | Disambiguating "inside" (the crews used it two ways): **gaps between elements *within* a card 8px; card *padding* 16–24px; between cards 16–24px; between sections 48–64px.** Part III §1's worked example (16px padding) and the Airbnb reference (24px padding †) both describe card padding, not element gaps. | **ADOPT** | The one delta row with zero repo conflict — no spacing tokens exist. Concrete numbers beat none |
| **S3** | Linear scale on an 8px atom; 4px permitted as a micro-grid for icon↔label. Cap at **~9–13 steps** (Carbon 9, Atlassian ~13, median ~12). Anything beyond is a component override, never a new primitive. | **ADOPT** (cap widened) | Rule kernel unattacked. Cap was "~9–12" but excluded its own cited exemplar — Atlassian ships ~13 |
| **S4** | `clamp()` for section padding, always with a rem term — pure `vw` breaks browser zoom. Example, **illustrative only**: `clamp(2rem, 2vw + 1rem, 6rem)`. | **ADOPT** | Rule survived both rounds. The prior example's `4vw` coefficient was invented at synthesis with no source; coefficients are per-context |
| **S5** | A results row is one Z-scan: left identity/time → middle route/duration → right price + CTA. **†** | **ADOPT** (+ † added) | Round 2 rejected this on citations — correctly, its Appendix row admits no eye-tracking exists. But its real support is embodied industry practice, and cost ≈ 0. The † was missing; that was the actual defect |
| **S6** | Prose ≤ 66ch. Page shell 1200–1280. The results list is one flexible column, not 12 discrete ones. | **ADOPT** | Bringhurst + independent Bootstrap/Tailwind convergence. Effectively unattacked |

### Feel + SEO

| # | Rule | Verdict | Basis |
|---|---|---|---|
| **F1** | Conform at the skeleton (search-bar order, checkout sequence, seat-map grid, icon semantics). Differentiate at the surface (hue, type, illustration, voice). Prototypical structure also produces more crawlable markup — the goals align. | **ADOPT** | Rests on named studies (Carroll & Rosson 1987, Polson & Lewis 1990), not on the abandoned "four doors" framing |
| **F2** | Faceted URLs are the architectural risk. Curated `/hcm-to-danang` route pages with real per-page content = indexable. Date + filters = query params, non-indexed, History API. One audited aggregator turned 1,200 **hotel properties** into 800k crawlable URLs *(cited analogy — the original wording generalised this to "entities")*. | **ADOPT** (upgraded from DEFER) | Never attacked in either round, only deferred on timing. And it is not a proposal: FD-013 already committed to `/tuyen/{origin}/{destination}/{date}` and it was never built. Overdue spec, not new law |
| **F3** | Fonts: subset to Latin **+ Vietnamese diacritics**, preload 1–2 weights, `font-display: swap`. Fonts are 15–20% of median CLS **†**. | **ADOPT** | Unattacked. Live violation: `app/layout.tsx:13` declares 5 weights. The CLS figure has no citation tied to it — flagged |
| **F4** | Trust: cap at 3–4 badges. **†** Include **Bộ Công Thương** — a registration mark carrying a **legal obligation** (Decree 52/2013, 85/2021). That is the reason to display it. The trust-lift case is *not* established: no VN-market recognition study was found, and the "recognised > generic" principle rests on Baymard US-sample data (Part IV §3) transferred to a market it did not measure. Render badges monochrome so they do not spend colour budget. | **ADOPT** (re-grounded on legal basis) | Both rounds converged on the same repair — keep the badge and the cap, strip the lift percentages entirely |
| **F5** | Show total price including fees early. Cancellation policy in plain language on the trip card, before payment. The VN trust gap is *"will I get my money back"*, not *"is this secure"* — refund/dispute status UI is a trust feature, not an ops feature. | **ADOPT** | Unattacked on substance in either round. Best-aligned rule with the VN-specific evidence |
| **F6** | CWV is a tie-breaker among comparable-relevance pages, not a ranking multiplier. Route-page architecture beats shaving 200ms. | **ADOPT** | The doc's most self-skeptical claim; survived untouched |

---

## Current state delta

The crews had **no repo access**. This rule set was written as if greenfield, but `app/globals.css` already ships a complete, opinionated token system — and it contradicts four of the six rulings above. Nothing here is a net-new addition; each row below overturns a decision already made and shipped.

| Ruling | Repo today (`app/globals.css`) | What adoption costs |
|---|---|---|
| Cool / slate neutral ramp | **Warm** — hues 55–80, `:70` comment: *"Warm-tinted neutrals (mood-board: warm > clinical)"* | Reverses a deliberate prior mood-board decision. The rule set calls warm+orange the "craft/artisanal register, wrong for logistics" — that is a direct contradiction of a shipped choice, and the mood-board rationale is not addressed anywhere in this doc |
| Deep navy secondary (Rulings 3, 6) | **No navy exists.** `--secondary` `:89` is a warm off-white | Net-new token + a hero rebuild |
| Brand orange `~#FF7A00` | `--primary` `:81` = orange-600 `#EA580C`, white-on = **3.56:1** | **A regression.** The proposed orange is 2.61:1. Shipped is already the safer colour — see the CORRECTION in §Ruling 4 |
| Two-tier orange, tier 2 = links/small text | `--primary-strong` `:88` **already exists** — but as a darker *fill* for conversion CTAs (7 call sites), not a text tier. Link variant (`components/ui/button.tsx:21`) still uses `--primary` | Token **redefinition**, not addition. Every `bg-primary-strong` call site changes meaning |
| Carbon layer tokens + borders (Ruling 5) | 4 warm-tinted shadow steps `--shadow-e1`→`e4` `:63-66` | Replaces the shipped elevation model wholesale |
| Spacing scale ~9–12 steps | **No spacing tokens at all.** `--spacing` is Tailwind v4's inherited default | Genuinely net-new — the one row with no conflict |

`--primary-strong` call sites: `components/search/SearchForm.tsx:97,98` · `components/search/BookButton.tsx:25` · `components/layout/SiteHeader.tsx:31` · `components/contact/ContactBookingForm.tsx:264` · `app/(customer)/booking/customer/CustomerForm.tsx:302` · `app/(customer)/booking/review/ReviewClient.tsx:265` · `app/(customer)/lien-he-dat-xe/confirmation/page.tsx:58`

### Confirmed live accessibility bugs

**Four**, all verified at source 2026-07-20. They exist today, independent of whether this rule set is adopted, and the rule set as written would preserve all four. The first two were found in the first review pass; **#1 and #3 were found only during the Part V debate** — by an agent asked to price the rules against real code.

| # | Site | Measured | Verdict |
|---|---|---|---|
| **1** | `components/ui/button.tsx:12` — default variant `bg-primary text-primary-foreground` | white on `#EA580C` = **3.56:1** at 14px (`text-sm`). Every size variant sits under the 18.66px-bold large-text floor — even `lg` at 15.2px | **FAILS AA on every primary CTA sitewide.** Most severe finding in this document |
| **2** | `components/ui/button.tsx:21` — link variant `text-primary` | 3.56:1 as normal-size inline text | **FAILS AA** |
| **3** | `components/booking/BookingSummaryRail.tsx:78` — booking total, `text-lg font-semibold` orange | 18px semibold is **not** large text (needs 18.66px **bold**) → requires 4.5:1, has 3.56:1 | **FAILS AA** |
| **4** | `app/globals.css:106` — `--ring` byte-identical to `--primary` (`:81`) | — | Focus ring on a primary button is orange-on-orange. Keyboard focus is unindicatable on the site's most important control |

`--primary-strong` (5.18:1) already exists and would pass in all three contrast cases.

**These are violations of the repo's own written spec, not requirements imported by this document.** `documentation/frontend-design/FD-008-accessibility/README.md:68` states the contract as *"Primary orange on white: ~3:1 (meets AA large text)"* — bugs 1–3 all use primary orange at sizes that are **not** large text.

**Not a bug, despite appearances:** `components/search/TripCard.tsx:72` renders the price in orange, but at `text-xl`/`text-2xl` **bold** it qualifies as large text and clears the 3:1 floor. It violates C2 and §Ruling 1 on *aesthetic* grounds — "orange soup," 3–4 competing oranges per card at `:24,31,36,72` — not on accessibility grounds. Recorded correctly here because the debate initially misgraded it.

**Also verified, non-a11y:** `app/layout.tsx:13` declares 5 font weights against F3's 1–2. FD-013 committed to `/tuyen/{origin}/{destination}/{date}` route pages that were never built (`/search` redirects to `/`) — the spec drift F2 resolves.

None of this is fixed by this document. **Bug #1 warrants its own issue immediately** — it is sitewide, on a live product.

### Gaps in the rule set itself

The rule set governs colour and space but issues **no rule for**: focus, hover, active, disabled, or dark mode. That is a problem for a document meant to drive tokens — the two bugs above both live in exactly that gap. Dark mode is a particular omission: Rulings 5 and 6 each invoke dark-mode survivability as their *justification*, and then the rule set says nothing about it, while `app/globals.css:129-173` already ships a full `.dark` block (with pure-neutral greys, inconsistent with the warm light-mode ramp).

---

## Push-back on our own crews

- **"SEA users prefer density"** — observational only. The crew flagged it itself; some Shopee users call their own UI cluttered while still using it. The real mechanism is category prototypicality, not cultural preference. This matters because it changes *what* to copy: copy the info density, not the visual noise.
- **Trust-badge lift percentages** (8–12%, 12–18%, 15–30%) — secondary-sourced Baymard-via-blog, not traced to primary. Directional only. The *badge bloat* finding is better sourced than the badge-lift finding.
- **Aesthetic-usability effect is weaker than folklore claims.** A 2023 CHI paper found that controlling for processing fluency drops the correlation from .79 to .34. It also decays with repeated use. It buys the first 50ms and the bounce decision — it does not buy forgiveness for a broken checkout.
- **FAQPage rich results reportedly dead in Google as of ~May 2026.** Re-verify before anyone builds for it.
- **Airbnb's 64px numbers** came from a community-reconstructed repo, not Airbnb. Directional, unverified.

---

## The one audit that settles three open items

Three unresolved items in this document — C4's reopen trigger, C3's deferred navy clause, and R2's struck positioning claim — are **all settled by the same single piece of evidence**:

> A competitive audit of the top ~10 VN/SEA booking and commerce apps (Vexere, Traveloka, FUTA, 12Go, Shopee, Lazada, Tiki…), each scored on two axes: **information density** and **colour density**.

That is one task, not three. It is the cheapest open question in this document and the most load-bearing. Run it before spending anything on positioning or token migration.

---

## The one-sentence version

Dense information, scarce colour: one orange per screen on a near-black-and-grey ink system, results rows that scan left-to-right with a near-black price and an orange button, and a curated route-page layer so faceted URLs do not eat the crawl budget.

*(Originally "on a navy-and-slate ink system." Both navy and the slate/cool ramp were rejected or deferred in Part V; the sentence has been corrected so the doc's own summary does not assert rules it no longer holds.)*

---
---

# PART II — CREW 1: COLOUR SYSTEMS

*Raw report, preserved.*

## 1. Orange as primary in real products

**Key finding: no major consumer product uses orange as a majority-coverage colour. It is always an accent/action colour layered on a neutral base, typically 5–15% of visible surface area.**

| Product | Hex | Where orange appears | Where forbidden/absent |
|---|---|---|---|
| **Amazon** | `#FF9900` | Logo "smile," CTA buttons ("Add to Cart" is actually **yellow** `#FFD814`, "Buy Now" is orange `#FFA41C`), some badges/rating stars | Never body text, never large fills, never nav backgrounds. Site is ~70%+ white/neutral by area per secondary analysis |
| **Home Depot** | `#F96302` | Logo, in-store signage/wayfinding, category tabs, promo banners | Not used for long-form text; paired almost exclusively with white |
| **Etsy** | `#F1641E` | Primary CTA buttons, logo, small accent icons | Body copy is near-black/charcoal |
| **HubSpot** | Coral `#FF7A59` + Atomic (charcoal) `#33475B` | CTA buttons, illustration accents, highlight graphics | Orange is explicitly the *secondary/energy* note against a **dark neutral primary**, not the dominant field colour |
| **SoundCloud** | `#FF5500` | Waveform player accents, logo, brand marketing | Core app UI leans heavily black/white/grey; orange is a "moment" colour, not a surface colour |
| **Firefox** | Gradient `#ff9640→#e31587→#0090ed` (orange is one stop of a multi-hue gradient) | **Logo only.** Browser chrome is blue/grey | Orange never appears as a UI action colour in-product — pure logo/brand-mark, functionally decoupled from interactive colour |
| **Reddit** | OrangeRed `#FF4500` | Upvote arrows, "post" CTA, brand highlights, pops against near-black `#030303` dark canvas | Comment threads use "a range of subtle greys" for hierarchy — orange is not structural, only an action/energy signal |
| **Orange S.A. (telecom)** — best case study of orange-as-literal-brand | `#FF7900` primary, `#F16E00` alt | Logo, primary buttons, key highlights | Its **Boosted** design system separates functional/semantic colours — Red `#CD3C14` for alerts, a distinct Yellow for warning — from brand orange, and text-colour utilities **force a paired background-colour** because orange text alone fails contrast |
| **BlaBlaCar** | Blue `#0071EB` primary (not orange) | — | Included as a comparable "travel/mobility marketplace with one saturated brand hue" |
| **redBus** | Red family `#D84E55`-ish | Header, primary buttons | The OTA-in-this-exact-vertical pattern: saturated warm hue for actions/header, white body |
| **Vexere** (direct VN competitor) | **Yellow/gold** dominant accent + teal/blue interactive elements per live-site scan, *not* pure orange | Icons, badges, promo callouts | Even the nearest direct competitor does not run pure saturated orange as a large-surface colour |

**Crew position:** The pattern is identical across every product regardless of industry. **Orange is a spot colour for the 3–8 things per screen that must win the eye — logo, primary CTA, 1–2 status badges — never a field colour.** Any brief implying "orange-forward" branding at the surface-area level is unsupported by a single real product in this set. State as a hard constraint, not a style preference.

## 2. 60-30-10: folklore vs what mature systems say

**Crew position: 60-30-10 is real practice by name only in interior design. In UI it survives as a rough mnemonic, not an engineering spec. Mature design systems reject fixed ratios entirely in favour of semantic colour roles + "use sparingly" language.**

**Origin:** Interior design — walls/furniture/accessories. The rule's origin is undocumented; decorators themselves describe it as "just like an old wives' tale." Folklore with no citable inventor, sometimes retroactively linked to the golden ratio, which is a stretch.

**What actual design systems specify instead of ratios:**

- **Material Design 3** — no percentage guidance at all. Primary/Secondary/Tertiary *roles*, Secondary explicitly "less prominent," Tertiary a "contrasting accent… to balance primary and secondary." Roles, not ratios.
- **Shopify Polaris** — explicit anti-ratio, anti-overuse language: *"Multiple brand roles in the same area should not be used… Fills should be used on smaller surface areas… not on large components or as backgrounds for entire interfaces"* and *"avoid more than two shaped or filled buttons within a card."*
- **IBM Carbon** — "Additional colors are used sparingly and purposefully." Qualitative restraint, not a number.
- **Atlassian** — the most extreme and (crew's view) correct posture for this problem: **one reserved brand blue for the single primary action; every other colour in a dense UI is near-neutral ink/surface.** Their accent palette (10 hues incl. orange) is explicitly "decorative with no fixed meaning" — deliberately *not* brand-carrying.
- **Apple HIG** — *"The power of color to call attention to important information is heightened when used sparingly… a red triangle that warns of a critical problem becomes less effective when red is used elsewhere for noncritical reasons."* Directly transferable: **if orange is everywhere, it stops meaning anything, including "click here."**

**Verdict:** Discard 60-30-10 as a numeric target. Adopt Atlassian's model — **one orange = one meaning ("primary action"), reserved; everything else neutral.** State as: *"On any given screen, orange MUST be legible as 'the one thing to do here.' If more than ~2 orange elements compete for attention on one screen, the rule has been violated regardless of literal pixel percentage."*

## 3. Orange's WCAG problem — real numbers

Contrast ratios computed directly (relative luminance formula) for the exact brand oranges above, against pure white `#FFFFFF`:

| Brand orange | Hex | Contrast vs white | AA text (4.5:1)? | AA large/UI (3:1)? |
|---|---|---|---|---|
| Amazon | `#FF9900` | **2.14:1** | No | No |
| Material Orange 500 | `#FF9800` | **2.16:1** | No | No |
| Pure "orange" | `#FFA500` | **1.97:1** | No | No |
| HubSpot Coral | `#FF7A59` | **2.57:1** | No | No |
| Home Depot | `#F96302` | **3.08:1** | No | Borderline |
| Etsy | `#F1641E` | **3.19:1** | No | Pass |
| SoundCloud | `#FF5500` | **3.21:1** | No | Pass |
| Reddit OrangeRed | `#FF4500` | **3.44:1** | No | Pass |
| Firefox | `#E66000` | **3.48:1** | No | Pass |

**Every single brand orange in this survey fails AA for normal text on white.** Corroborates the general finding that *"none of the standard brand oranges meet the minimum contrast when used as text on white."*

**Darkened "action orange" candidates, computed:**

| Variant | Hex | Contrast vs white | AA text? |
|---|---|---|---|
| Burnt orange | `#C24914` | **4.93:1** | Yes |
| Deep orange | `#BF4B00` | **4.97:1** | Yes |
| Rust | `#A8460B` | **5.92:1** | Yes (AA; **not** AAA — AAA is 7:1) |

The two-tier pattern is standard, not exotic: a brand orange around `#FF6B00` (**2.86:1**, fails) has a working accessible pair around `#C85400` (**4.45:1 — marginally *under* AA**; use `#C24914` at 4.93:1 instead) or `#A04600` (**6.23:1**, AA, not AAA).

> **CORRECTION (2026-07-20).** The sentence above originally read "`#FF6B00` (~3.5:1) … `#C85400` (4.5:1, AA) … `#A04600` (6.1:1, AAA)" and the Rust row was labelled "AAA-adjacent." All four figures were wrong, and every one erred toward *appearing more compliant than reality* — including one colour presented as AA-passing that measures 4.45:1. The tables above this note were computed directly from the relative-luminance formula and are exact to the hundredth (re-verified 2026-07-20); this sentence was carried over from a secondary source and never recomputed. **Do not trust a ratio in this document that is not in a computed table.**

**Strongest real-world confirmation:** Orange S.A.'s Boosted system — its `.text-primary` utility (orange) **automatically force-pairs a background-colour** rather than letting orange text sit loose on white. Their engineers built a guardrail into the CSS; rather than only darkening it, they constrain *where* it may appear at all.

**Hard constraints:**

- Orange (brand saturation, ~`#FF7A00`–`#FF9900`) **MUST NOT** be used as text colour on white/light-neutral backgrounds below 24px/large-text size.
- Orange **MUST NOT** be used for body copy, form field labels, fine print, or any text under WCAG large-text thresholds. No brand-saturation orange passes AA at those sizes.
- A darkened "action orange" (≥4.5:1, roughly `#C24914`–`#BF4B00` territory for an `#FF7A00`-class brand orange) **MUST** be defined and used for text links, small icon-only buttons, and any orange text on white.
- Full-saturation brand orange **MAY** be used for large filled buttons, illustrations, large graphic fills, and sufficiently large badges — **but not with a white label.** Computed: white on `#FF7A00` is **2.61:1**, white on `#FF7900` (Orange S.A.) is **2.63:1**, white on `#FF9900` (Amazon) is **2.14:1**. None reach the 3:1 large-text floor at any size. Use a near-black label (8.04:1 on `#FF7A00`) or darken the fill. See the CORRECTION block in Part I §Ruling 4.

## 4. Neutral pairing

- **Undertone-matching is the load-bearing principle**, not aesthetic preference: *"Pairing a cool gray with a warm tone like orange… would be disjointed."* Generic recommendation is to match neutral undertone to accent undertone.
- **Warm grey argument**: softens orange, reads organic/human/approachable (beige, sand, kraft, warm charcoal). Risk: dated/"earthy," less premium/tech.
- **Cool grey argument**: sharper, more modern contrast against orange, reads more tech/structured. Risk: undertone clash can look cheap or discordant if untuned.
- **What shipped orange-brand products actually pick:** Amazon → **pure/near-neutral grey-black** (`#000`, `#131921` navy-black) with stark white, not warm grey. Home Depot → white + near-black text, minimal grey. HubSpot → a genuinely **cool, blue-leaning charcoal** (`#33475B`, "Atomic") as dominant neutral, explicitly *not* warm — arguably the most relevant precedent, pairing coral-orange with a navy-adjacent dark neutral.

**Crew position:** For a travel-booking marketplace, **cool-neutral-to-true-neutral greys win**, not warm greys. Reasoning: (a) every orange-brand precedent that also needed "trustworthy for a transaction" (HubSpot = B2B trust, Amazon = commerce trust) skewed cool/near-black rather than warm/beige; (b) warm greys pair better with orange in *decorative/artisanal* contexts (Etsy-adjacent, craft, food), which is not this positioning; (c) a bus-booking app needs the "serious logistics/payment product" register, which cool neutrals support better. Secondary guidance on "premium UI" independently suggests keeping orange under **10–15% coverage** paired with **muted, less-saturated greys**.

**Rule:** Neutral scale = **cool-to-true grey ramp** (blue-grey undertone, Tailwind "slate"-class, not "stone"/"warm gray"), anchored by a near-black navy-charcoal (HubSpot Atomic-like) rather than pure `#000`, for body text and structural chrome.

## 5. Semantic colour collision — orange = warning

A genuine, well-documented conflict, not theoretical.

- **ANSI Z535.1** (industrial safety-colour standard): orange = "WARNING — potentially hazardous situation… not as immediate as red 'Danger,' more severe than yellow 'Caution.'" Orange's warning association is codified outside software.
- **Direct articulation of the collision**: *"When a brand uses orange or yellow as a primary color for CTAs, using the same colors for warnings creates confusion… When one color tries to carry two conflicting meanings — positive action and caution — both meanings weaken."*
- **Real shipped solution — Orange S.A.**, the highest-stakes case of this exact problem: **Red `#CD3C14`** as alert/danger and a **separate Yellow** as warning, deliberately routing *around* its own brand orange. Brand orange is reserved exclusively for brand/primary-action.
- **Atlassian reinforces this**: brand colour reserved for exactly one meaning; their own accent-orange swatch is explicitly "decorative with no fixed meaning" and never used for status. Status uses Lozenges with a dedicated semantic palette, decoupled from brand colour.

**Hard rules:**

- Brand orange **MUST NOT** be reused as the warning/caution semantic token.
- The semantic warning colour **MUST** be a distinct hue — practically, **amber/gold** (a genuinely different hue family, e.g. `#F5A623`-class, not a lighter/darker version of the brand orange) or, more safely, **yellow for caution + red for error/danger**, mirroring ANSI and Orange S.A.
- If amber is chosen, it **MUST** be perceptibly distinguishable from brand orange at a glance (different hue angle, not just lightness) — side-by-side swatch testing required, not just a contrast check.
- Brand orange maps only to: primary CTA, brand marks, selected/active state. Never a toast, badge, or banner meaning "something needs your attention."

## 6. Secondary/accent colour

- **Colour theory**: orange and blue/teal are true complements, producing maximum contrast. The "orange-and-teal" pairing is famous because it mimics golden-hour light against sky — which is why it recurs in travel/photography/film grading.
- **What shipped travel products do**: *"Deep navy, slate blue, teal… feel calm and premium, creating a 'trusted booking brand' look"* paired with warm orange/amber accents for routes, highlights, and CTAs. Navy-orange is explicitly called out as a common airline/OTA pattern balancing trust (navy) with energy (orange).
- **Cross-validation**: HubSpot pairs coral-orange with navy-charcoal. Firefox pairs orange with blue in its gradient narrative ("orange = passion/community, blue = the vast unexplored web"). BlaBlaCar uses deep blue as primary specifically for the trust register.

**Crew position, with pushback on pure theory:** Textbook complementary (orange + saturated teal/cyan) is visually loud and reads "sporty/gamified" rather than "trustworthy transactional" when both are pushed to full saturation — great in photography/film grading, worse in a payment-flow UI. **The better real-world-validated move is orange + a *desaturated/deep* navy or near-black-teal.** Keep one of the two pure/vivid, keep the other deep and muted. Since orange is already vivid and carrying the action-colour job, **the secondary should be a deep, low-saturation navy** — which simultaneously solves the neutral-pairing and semantic-separation problems.

**Rule:** Secondary/structural colour = **deep navy** (desaturated, near-charcoal-navy, `#233045`–`#33475B` range), for headers, nav, dark-mode base, and "confidence" surfaces (payment confirmation, ticket/receipt UI). Orange stays reserved for the primary-action layer. Avoid pairing orange with a second *equally saturated* hue (bright teal, bright green) — reads playful/game-like, undermining the "I am trusting you with my money and my bus seat" register.

## Crew 1 constraint list

1. Orange (brand saturation) surface coverage **should be single-digit-to-low-teens percent** of any screen; never a field/background colour — confirmed without exception across Amazon, Home Depot, Etsy, HubSpot, Reddit, Orange S.A.
2. Discard 60-30-10 as a numeric target; adopt Atlassian's semantic-role model.
3. Brand-saturation orange **MUST NOT** be text colour on light backgrounds at normal size (2.1–3.5:1 for every real brand orange sampled). Define a darkened action orange (≥4.5:1).
4. Neutral palette **cool/true grey, navy-anchored**, not warm grey.
5. Brand orange **MUST NOT** double as the semantic warning colour.
6. Secondary accent: **deep, desaturated navy**, not bright/saturated teal.

### Crew 1 sources

- [HubSpot Brand Color Palette (Mobbin)](https://mobbin.com/colors/brand/hubspot)
- [Amazon Orange color specs](https://www.color-name.com/amazon-orange.color)
- [Amazon color psychology / white-space analysis](https://coloracci.ai/blog/amazon-color-psychology-what-makes-palette-work)
- [Etsy Orange color](https://www.colorxs.com/color/etsy-orange)
- [Home Depot Colors](https://www.eggradients.com/palette/home-depot-colors)
- [SoundCloud Color Palette](https://www.onlinepalette.com/soundcloud/)
- [BlaBlaCar new visual identity](https://newsroom.blablacar.com/news/blablacar-unveils-new-visual-identity-to-embody-its-global-travel-platform-ambition)
- [Firefox logo — Wikipedia](https://en.wikipedia.org/wiki/Firefox_logo)
- [Reddit design system notes](https://explainx.ai/designs/whyashthakker-design-md-templates-skills/reddit/design-md)
- [Orange (telecom) Boosted brand guidelines](https://boosted.orange.com/docs/4.4/about/brand/)
- [Orange you accessible? case study](https://www.bounteous.com/insights/2019/03/22/orange-you-accessible-mini-case-study-color-ratio/)
- [Accessible color palette / darkened-orange example (Amigo Studios)](https://www.amigostudios.co/blog/color-contrast-accessibility-guide)
- [60-30-10 rule origin/outdated critique](https://www.livingetc.com/advice/is-the-60-30-10-rule-outdated)
- [Material Design 3 color roles](https://m3.material.io/styles/color/roles)
- [Shopify Polaris — using color](https://polaris-react.shopify.com/design/colors/using-color)
- [Atlassian Design — color](https://atlassian.design/foundations/color)
- [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [ANSI Z535.1 safety colors](https://trdsf.com/blogs/news/ansi-z535-1-safety-colors)
- [Warning Colors Aren't Always Orange](https://medium.com/@sara.gh1997sp/warning-colors-arent-always-orange-273ea061ca8a)
- [Orange/teal complementary color look](https://kevinraposo.com/a-guide-to-the-orange-and-teal-look/)
- [Travel color palette guidance](https://www.media.io/color-palette/travel-color-palette.html)
- [Warm vs cool neutral pairing](https://colorarchive.org/guides/neutral-color-palettes/)

---
---

# PART III — CREW 2: SPATIAL SYSTEMS

*Raw report, preserved. Confidence is marked per claim — official docs were sometimes thin (M3 spacing/elevation pages return mostly navigational shells to fetchers), cross-checked with secondary sources where the primary did not yield numbers.*

## 1. Proximity law, quantified

**Core finding: no major system publishes a single universal "2x ratio." They publish *scales*, with the expectation that you pick a rung meaningfully below vs above the current one. The ratio comes out to roughly 1.5x–3x in practice as a byproduct of scale-hopping, not a codified constant.**

- **Atlassian** states it in prose, not a ratio: "the distance between elements creates semantic meaning; elements placed close to one another are assumed related." Guidance buckets into three practical bands: **0–8px = compact/component-internal, 12–24px = content grouping, 32–80px = layout/section separation** (space.0 → space.1000, base 8px). Roughly a 3x jump between "grouping" and "section" tiers.
- **Cieden's** spacing-best-practices synthesis names this the **"internal ≤ external" rule**: space inside a group must be *less than or equal to* space around it — not merely "smaller," but bounded above by it. The most defensible universal law found: a floor/ceiling relationship, not a fixed multiplier.
- A practitioner synthesis (Mantlr) gives a worked example matching this: a card with **16px internal padding** should sit in **≥16px external margin** — internal:external capped at 1:1, pushed in practice toward 1:1.5–1:2 for clearer grouping signal.
- None of Material, Carbon, Polaris, or Primer publish an explicit numeric proximity ratio (confirmed by direct fetch on m3.material.io and carbondesignsystem.com — both mostly prose/token tables with no stated ratio). The ratio is *emergent* from scale-step choice.

**Defensible working rule:** gap-inside-group ≤ gap-between-groups, targeting **inside:outside ≈ 1:2 to 1:3** (8px inside a trip-card's internal elements, 16–24px between trip cards, 48–64px between page sections). Matches Atlassian's banding and the reverse-engineered Airbnb spec (card gutters 16px vs section padding 48–64px — roughly 3–4x). *Airbnb figures carry a source caveat, see §3.*

## 2. Spacing scales: 4pt vs 8pt, linear vs geometric

**Verdict: every major system studied uses a linear/arithmetic base-unit scale (multiples of a 4px or 8px atom), not a geometric/modular scale. Ratio-based spacing (golden ratio, 1.5x compounding) is explicitly rare and impractical for pixel-grid UI.**

| System | Base unit | Scale (px) |
|---|---|---|
| Material Design 3 | 4dp | 4, 8, 12, 16, 20, 24, 28, 32… (components snap to 8dp grid, type/icons to 4dp) |
| Carbon (IBM) | 2/4/8 multiples | 2, 4, 8, 12, 16, 24, 32, 40, 48 (spacing-01 → 09) |
| Polaris (Shopify) | 4px | 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128 |
| Primer (GitHub) | 4px → base-8 | 0, 4, 8, 16, 24, 32, 40 |
| Atlassian | 8px | 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 |

**Pattern:** all **linear** (arithmetic on a shared atom), but the step *size* grows — 2–4px increments at the low end, widening to 4–8px, then 8–16px jumps at the top. Technically a "quasi-geometric-looking linear scale" (the delta itself grows), but NOT compounding multiplication.

**4px vs 8px — why both exist:** 8px is the default for most product/marketing UI (screen widths and component sizes divide cleanly by 8; keeps token count manageable). 4px serves as a sub-grid for tight internal spacing (icon-text gaps, dense tables) where 8px is too coarse. Material's own split (8dp components, 4dp type/icons) mirrors this — not either/or, but 8px macro grid with 4px permitted micro-adjustment.

**What breaks with too many steps** — the most useful non-obvious finding. A synthesis of design-token scale sizes reports the **median spacing scale across real systems is ~12 steps** (most 8–15). Extremes: Mantine ships 5, Open Props ships 74. The framing that matters: *"a small scale is an opinion, a large scale is a palette."* With 74 steps, every gap becomes an open decision — "every gap on every screen is an open decision… a drift generator" — and systems that look consistent at a glance fall apart under inspection.

**Recommendation:** cap the primitive spacing scale at **~9–13 steps** (Carbon's 9 or Atlassian's ~13 are good reference sizes); anything beyond is a component-specific override, not a new primitive. *(Originally stated as "~9–12" — a cap that excluded Atlassian, one of the two exemplars offered to justify it. Widened one step 2026-07-20.)*

## 3. Vertical rhythm and section spacing

*Real numbers are harder to pin from primary sources — no design system publishes "marketing site section spacing" as a token spec. This section leans on secondary/practitioner sources, flagged accordingly.*

- A GitHub-hosted reverse-engineered spec of Airbnb's system (VoltAgent/awesome-design-md — **caveat: community-reconstructed, not official Airbnb publication; treat as directional**) reports **~64px vertical section padding** for major page bands — deliberately tighter than typical SaaS marketing at **80–96px**, because a marketplace/listings page needs higher card density per scroll. Desktop section padding ~48–64px, mobile ~24–32px. Homepage card gutters 16px.
- General practitioner convention: **section-level spacing 48px (2xl) to 96px (4xl+)**, with 64px a very common default and 96–128px reserved for hero/marketing breaks.
- **Fixed vs fluid vs clamp():** modern practice has shifted from fixed px + media queries to **`clamp(min, preferred, max)`** for section padding and gaps — e.g. `padding: clamp(2rem, 2vw + 1rem, 6rem)` — to avoid the "jump" artifact of breakpoint-based spacing and reduce media-query count. *(This example originally read `clamp(2rem, 5vw, 6rem)` — pure `vw`, contradicting the rem-term rule stated in the very next sentence. Corrected 2026-07-20.)* ~98% browser support. Best practice: add a fixed rem component to the viewport term (`2vw + 1rem` rather than pure `vw`) so spacing does not collapse on narrow viewports or fail to scale with browser zoom / text-size settings — an accessibility consideration.

**Crew position:** "Marketing site" whitespace conventions (80–96px, magazine pacing) are the wrong reference class for a **search-results-heavy booking marketplace**. Homepage hero/marketing sections can use 64–96px; density-critical pages (search results, seat picker) should follow Airbnb's own internal split — tighter, ~48–64px max between major zones, 16–24px between cards — because conversion-path pages reward scanability over browsing pace.

## 4. Optical vs mathematical alignment

A well-documented, real phenomenon with consistent qualitative agreement, though exact correction percentages vary by source (no canonical number).

**Core principle:** mathematical alignment (centring by bounding-box coordinates) frequently reads as *visually* off-centre because different shapes distribute "optical weight" differently.

1. **Round/pointed shapes vs square shapes at "equal" size look unequal.** A circle or triangle inscribed at the same nominal size as a square looks *smaller* — "straight lines feel solid, curved edges read as retreating inward." Standard fix: **overshoot**. One concrete example: a 400px square paired with a **450px circle** to read as equal (~12.5% overshoot) — though sources agree the exact % is context-dependent (icon grids typically use ~2–8%). This is why most icon-grid systems (Material Symbols, Streamline) define separate "keyline shapes" — square, circle, non-uniform bounding boxes — with different effective sizes that render as visually consistent.
2. **Play-button icons** are the canonical case: a triangle's visual centre of mass sits left of its bounding-box centre, so it must be nudged right to look centred inside a circular/square button. Cited repeatedly (YouTube play button) as the textbook instance of optical correction overriding mathematical centring.
3. **Buttons with text / asymmetric padding:** symmetric numeric padding can make text-in-button look top-heavy because cap-height, x-height, and descenders distribute visual mass unevenly within the type's bounding box. Documented fix: reduce padding slightly on one side rather than keeping numeric symmetry.
4. **Icon-next-to-label gaps** are one place the 4px sub-grid is used specifically because 8px reads too loose for icon-text pairing — effectively an optical correction expressed as "use the smaller grid increment here."
5. **Cards with full-bleed images**: not deeply sourced in this pass, but the established pattern (from editorial/magazine design) is that **full-bleed image + inset text content** requires the text content's own padding to be tuned independently rather than matching the card's outer padding — treating image-bleed and text-inset as two spatial systems layered in one card, consistent with applying `internal ≤ external` recursively.

**Crew position:** optical correction is real and unavoidable at the icon/button/glyph scale, but it does NOT contradict the token-based spacing scale — it operates *below* the token grid (sub-pixel/percentage nudges within a single token-sized box), so it belongs in component-level fine-tuning, not as a reason to abandon systematic spacing.

## 5. Density, F/Z pattern, price/CTA placement

The most actionable — and most contrarian — findings.

**The naive "F-pattern → put price top-left" reasoning is wrong for structured list/search-result UI, and NN/g's own research shows why.**

- NN/g's foundational eye-tracking (Text Scanning Patterns) describes an F-pattern for **continuous prose**. But NN/g also documents the **"spotted pattern"**: users fixate on visually distinct elements — bold, colour, bullets, numbers — regardless of position, when those match what they are task-seeking. **A price is exactly this kind of element**: users on a booking site are not "reading" the row, they are *hunting for the number*. A bold, right-aligned, larger/coloured price gets fixated even though it sits outside the "F" zone. This is why virtually every mature travel search UI puts price on the right, bold, often in a distinct colour — right-alignment does not fight the F-pattern, it exploits the spotted-pattern override.
- NN/g's newer **"pinball pattern"** research (their update to the classic F/Z model for **complex results pages** — flights/hotels/shopping) found modern SERPs/results pages are scanned **non-linearly**, "bouncing" between results and salient features. Concrete numbers: users spend an average of **5.7 seconds** before their first click; position-1 click share fell from **51% (2006) to 28%**, meaning results below the fold and beyond positions 1–3 now get real attention. Simple/fact-finding tasks concentrate near the top; open-ended/comparison tasks (which describes bus/flight search) distribute clicks much more broadly, with **20% of clicks below the fold** vs 5% for fact-finding.
- **Practical implication:** each row is its own scan unit, not a paragraph. Lay it out for a fast **left→right single-pass sweep**: operator/departure-time left (identity/orientation, F-pattern-consistent), duration/route middle (secondary), **price + CTA locked far right** (the "spotted" anchor, and the convergent industry pattern). This is closer to a **grid of repeated Z-scans**, one per row — consistent with NN/g's "layer-cake" pattern applied at row granularity.
- **Baymard's flight-booking research** (240+ guidelines across 10 major airline/OTA sites) confirms users want price visible directly in the results list without click-through; some users "immediately discard options upon discovering pricing on [a separate] detail page."
- Site-specific eye-tracking for Booking.com / Skyscanner / redBus / Kayak / Google Flights could **not** be sourced. What is documented is their converged *design pattern*. redBus documentation confirms **colour-coded seat-status indicators** (available/booked/women-only) and filter-first density controls (AC/Sleeper/departure-time/price/seat-availability/popularity) as standard toolkit — but treat the row-layout convergence claim as inference from convention + NN/g's general findings, not a study of those specific products.

**Recommendation:** treat each result row as an independent Z-scan (left = identity, middle = route/duration, right = price + CTA as a bold spotted anchor), keep row density moderate-tight (comparison task, not fact-finding), and never bury price behind a click.

## 6. Container width, measure, grid

**Content measure:**

- Convergent citation: **Bringhurst's 45–75 characters per line**, with **~66** the most-cited sweet spot for single-column prose. Research (Dyson & Haselgrove, via UXPin) found **~55 characters** optimal for *scanning speed* specifically — relevant since booking-flow copy is scanned, not read start to finish. Below ~45 chars, frequent line breaks fragment attention; above ~80, saccadic return-sweeps miss the next line's start.
- Implementation: `ch` units or `max-width` in the 45–75ch range for prose blocks (T&Cs, trip details, help content). Does NOT apply to structured data (result rows, seat maps), which the grid governs.

**Container widths** (Bootstrap/Tailwind — the de facto production standards):

- Bootstrap breakpoint max-widths: **1140px (xl)**, **1320px (xxl)**.
- Tailwind default container steps: 540/720/960/1140/1320 at sm/md/lg/xl/2xl — mirrors Bootstrap almost exactly. That convergence is itself evidence these numbers are load-bearing defaults, not arbitrary.
- Most frequent "max content width" in the wild: **1200–1280px** (Tailwind's `max-w-7xl` = 1280px is a widely-used single value).
- **Full-bleed break-out**: standard pattern is body copy/forms constrained to the readability measure or 1140–1280px page shell, while hero imagery, dividers, and marketing bands break to true 100vw — a deliberate two-track system (content track vs bleed track), not one container width for the whole page.

**Grid:**

- Material's responsive grid is genuinely **4/8/12** — 4 columns on phone, 8 on tablet, 12 on desktop, gutters scaling by breakpoint: **16dp gutters/margins at the 360dp mobile breakpoint, 24dp at the 600dp tablet breakpoint**. The clearest primary-sourced numeric grid spec found.
- For a booking site with a persistent results list (one dominant content column), a **12-column desktop grid collapsing to 4 at mobile** is the industry default — but the results list itself behaves as a **single flexible column within that grid**. The grid governs page-level composition (nav, filters sidebar, results column, map panel), not row-internal layout.

## 7. Hierarchy beyond size: elevation, border, tint, spacing

The clearest documented shift in this research pass: **Material 3's move from shadow-based to tonal (colour-tint) elevation**, and the general industry trend away from shadow-as-default.

- **M2 → M3**: M2 used realistic drop-shadows across **8 elevation levels up to 24dp**. **M3 collapsed this to ~5 levels, max 12dp**, and made **tonal elevation (blending the surface colour with a tint — more tint = higher) the primary/default signal**, demoting shadow to a "selective tool… for elements that need more focus, or to avoid overlapping elements blending into each other." A deliberate, stated decision.
- **Why:** shadow-heavy skeuomorphic elevation reads as visually noisy/dated at scale, performs worse in dark mode (shadows nearly invisible on dark backgrounds — the practical technical driver), and does not hold up across large token-driven surface systems. Tonal elevation solves the dark-mode problem directly since it is a colour operation, not a light simulation.
- **Fluent (Microsoft)** still treats shadow as first-class — "sharp/directional (key) + soft/diffused (ambient)" pairs on a numeric blur ramp (shadow-2 = 2px blur → shadow-64 = 64px). Fluent has **not** made M3's shift. This is a genuine current disagreement between the two largest cross-platform systems: **Material and Fluent disagree on whether elevation is primarily a colour signal or primarily a shadow signal.** Neither is "wrong" — they optimise for different brand languages (Material's flat/graphic vs Fluent's literal depth/materiality).
- **Carbon (IBM)** takes a third position, leaning on **borders + layered background tokens**: `$background → $layer-01 → $layer-02 → $layer-03` gives deterministic z-ordering via background-colour steps, with border tokens paired per-layer (`$field-03` pairs with `$border-strong-03`). Shadow is secondary — closer to M3's philosophy, implemented via structured borders.

**Trade-off matrix** (crew synthesis; no single source lays this out):

- **Shadow** — strongest, most literal separation signal; costly in dark mode; looks dated/heavy if overused.
- **Border** — cheap, precise, identical in light/dark; weaker as a hierarchy signal alone; mostly defines edges, not importance.
- **Background tint/layering** — solves dark mode, reads systematic rather than loud; needs a well-designed tonal palette with enough contrast steps.
- **Spacing/whitespace** — the "free" hierarchy signal. Isolating an element with more surrounding space raises perceived importance without adding visual weight, and has no dark-mode problem. Several sources implicitly treat spacing as the *first* tool to reach for, with colour/shadow/border reserved for cases spacing alone cannot resolve (e.g. distinguishing an active/selected seat from an available one, which genuinely needs colour + border).

**Crew position:** given an information-dense, conversion-focused product (not a brand-forward marketing surface), follow the **Material 3 / Carbon direction** (tint/layer/border over heavy shadow) rather than Fluent's — cheaper to keep consistent, works without special-casing dark mode, matches the "trustworthy, calm, transactional" tone dominant OTAs converge on. Reserve shadow for genuinely floating elements (bottom sheets, modals, sticky CTA bars).

## Crew 2 evidence-quality notes

- **Strong / primary-sourced**: Polaris space tokens (direct fetch, official), Carbon spacing scale, Atlassian spacing scale + proximity language (direct fetch, official), Material 4/8-grid + window-size breakpoints, NN/g pinball-pattern and text-scanning findings (direct fetch, official NN/g domain), Bootstrap/Tailwind container widths, M3 tonal-elevation shift (multiple corroborating sources, consistent story).
- **Medium confidence / practitioner synthesis**: exact M3 spacing token pixel list (M3's own site did not yield token values on fetch; numbers from secondary aggregations, roughly matching known 4dp-grid logic — treat specific token names as approximate); Primer's spacing scale (secondary source, internally consistent with Primer's stated base-8 philosophy); the "internal ≤ external" and 1.5–3x proximity ratio claims (aggregation/practitioner literature, not a single named study).
- **Explicitly weak sourcing**: Airbnb pixel-specific numbers (64px section padding, 24px card padding) come from a community-reconstructed GitHub repo, not Airbnb's own published system — directionally useful, numerically unverified. The optical-correction "circle 12.5% larger" example is a single illustrative case, not a general constant. No brand-specific eye-tracking data was found for Booking.com/Skyscanner/redBus/Kayak/Google Flights.

### Crew 2 sources

- [Spacing – Material Design 3](https://m3.material.io/foundations/layout/grids-spacing/spacing)
- [Breakpoints – Material Design 3](https://m3.material.io/foundations/layout/breakpoints/overview)
- [Applying layout – Material Design 3 (window size classes)](https://m3.material.io/foundations/layout/applying-layout/window-size-classes)
- [Elevation – Material Design 3](https://m3.material.io/styles/elevation/applying-elevation)
- [Responsive layout grid - Material Design (M2)](https://m2.material.io/design/layout/responsive-layout-grid.html)
- [Spacing – Carbon Design System](https://carbondesignsystem.com/elements/spacing/overview/)
- [Color/layer tokens – Carbon Design System](https://carbondesignsystem.com/elements/color/tokens/)
- [Space — Shopify Polaris React](https://polaris-react.shopify.com/tokens/space)
- [Primer CSS Spacing Scale | GeeksforGeeks](https://www.geeksforgeeks.org/primer-css-spacing-scale/)
- [Overview - Spacing - Atlassian Design](https://atlassian.design/foundations/spacing)
- [Layout - Human Interface Guidelines - Apple](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Spacing System Cheat Sheet: 4px vs 8px vs Custom — Mantlr](https://mantlr.com/blog/spacing-system-cheat-sheet)
- [What are spacing best practices (8pt grid, internal ≤ external rule) — Cieden](https://cieden.com/book/sub-atomic/spacing/spacing-best-practices)
- [50 design token files, one problem — thedesignsystem.guide](https://learn.thedesignsystem.guide/p/50-design-token-files-one-problem)
- [Text Scanning Patterns: Eyetracking Evidence - NN/g](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/)
- [Complex Search-Results Pages Change Search Behavior: The Pinball Pattern - NN/g](https://www.nngroup.com/articles/pinball-pattern-search-behavior/)
- [Flight Booking & Airlines Ecommerce UX Data – Baymard](https://baymard.com/research/flight-booking-and-airlines)
- [Optimal Line Length for Readability – UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/)
- [Readability: The Optimal Line Length – Baymard](https://baymard.com/blog/line-length-readability)
- [max-width - Sizing - Tailwind CSS](https://tailwindcss.com/docs/max-width)
- [Container - Tailwind CSS (v3, Bootstrap breakpoint parity)](https://v3.tailwindcss.com/docs/container)
- [Elevation - Fluent 2 Design System](https://fluent2.microsoft.design/elevation)
- [Layering and elevation in Windows - Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/layering)
- ['Eyeballing' or Optical Alignment in Design - RingCentral UX](https://medium.com/ringcentral-ux/eyeballing-or-optical-alignment-in-design-4ef5ab2d326f)
- [Formulas for optical adjustments - Bjango](https://bjango.com/articles/opticaladjustments/)
- [Create consistent, harmonious icons with Grids and Key Shapes - Streamline](https://blog.streamlinehq.com/grids-and-keyshapes/)
- [Using CSS Clamp for Fluid Typography and Spacing](https://blog.pixelfreestudio.com/using-css-clamp-for-fluid-typography-and-spacing/)
- [Layout Spacing Clamp Guide - clampgenerator.com](https://clampgenerator.com/guides/layout-spacing-padding-margin-gap-css-clamp/)
- [Airbnb design system reconstruction (community, unofficial)](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/airbnb/DESIGN.md)

---
---

# PART IV — CREW 3: HUMAN FACTORS + SEO

*Raw report, preserved.*

## 1. The "feels professional" mechanism — what is measurable

**Processing fluency** (Reber, Schwarz, Winkielman): people prefer stimuli that are easier to process; ease-of-processing produces a positive affect signal misattributed to quality/usability judgments. This is the proposed causal engine underneath the effects below, not a separate law.

**Aesthetic-usability effect** (Kurosu & Kashimura, 1995, n=252, 26 ATM interface variants): perceived usability correlated with aesthetics at **r=0.589** — far stronger than with actual task-completion usability. Replicated 1997 (Israeli sample) with an even stronger correlation. A **2023 CHI paper** found that statistically controlling for processing fluency drops the aesthetic→usability correlation from **~.79 to ~.34** — fluency is a real confound, not just a label. **Limits:** the effect weakens with repeated/prolonged use (a 2019 boundary-conditions paper found only limited support in some conditions) — it is a first-impression bias, not durable forgiveness of broken checkout flows.

**Google's visual-complexity × prototypicality study** (Reinecke et al., Google Research/IJHCS): visual complexity (VC) and prototypicality (PT) both drive first-impression aesthetic judgment, forming within **17–50ms** — pre-attentive, faster than conscious deliberation. High VC → worse impression regardless of familiarity; high PT → better impression. **VC's effect is larger than PT's — clutter hurts more than unfamiliarity.** Practical rule: "low complexity + high prototypicality" is the safe zone; novelty for its own sake, especially combined with clutter, is a net negative. Limits: static-screenshot methodology; does not measure conversion or task success.

**Lindgaard et al. 2006 ("50ms rule")**: visual-appeal ratings at 50ms correlate highly with ratings at 500ms — confirms instant, stable aesthetic judgment. Note: measures *appeal*, not trust/usability/conversion — those linkages are practitioner extrapolations.

**Net synthesis:** users form an appeal verdict in under 50ms from layout gestalt; this measurably colours (halo effect) subsequent usability/trust perception, but the effect is bounded to first-impression/bounce behaviour, not sustained tolerance of real friction. **Weakest evidence:** precise conversion-lift percentages attributed to "trust badges" in secondary blog content are not traceable to primary studies — directional only.

## 2. Familiarity (Jakob's Law) vs differentiation

**Jakob's Law**: users transfer expectations across all products (Norman 1988 mental-models grounding; Nielsen's usability corpus). Convention-based flows execute ~3–5x faster with fewer errors; a cited 2022 Baymard figure claims convention adherence cuts errors up to 30% and lifts completion up to 18% (**flagged — not independently verified to a primary source in this pass**).

**MUST-conform** (strongest transfer-of-expectation evidence — Carroll & Rosson 1987, Polson & Lewis 1990): origin-destination-date search bar placement/order; linear checkout sequence (search → select trip/seat → passenger info → payment → confirmation); icon semantics; form conventions; button affordance (contrast/shape signalling clickability — a VC/PT finding, not just habit); price-display conventions; recognisable payment-method logos (Momo, ZaloPay, VNPay, VietQR, Visa/Mastercard).

**CAN differentiate freely**: brand hue (orange, as long as CTA contrast still reads as "button"), illustration/icon style, copy voice, hero storytelling, below-fold marketing modules, card visual styling (as long as info hierarchy matches expectation), motion personality (budget permitting — see §5.3).

**Synthesis:** conform at the skeleton (IA, interaction patterns, near-identical to Vexere/FUTA/Traveloka/12Go), differentiate at the surface (colour, type, illustration, voice). This is also where aesthetic and SEO goals align — prototypical structure tends to use more standard, more crawlable markup.

## 3. Trust signals in travel booking

**Baymard Institute**: checkout-UX-bundle fixes cite up to **35.26%** conversion increase as a theoretical ceiling (not attributable to trust signals alone). **19%** of abandonment tied to card-trust concerns; **72%** of travel bookers weigh payment-security reputation (both secondary-sourced — verify primary before external use). Most travel sites over-rely on reviews alone and under-use payment/security/certification signals — combining signal *types* is the underused lever.

Secondary-sourced badge figures (**directional only**): payment logos near checkout ~8–12% trust lift; reviews/ratings near price ~12–18% conversion lift; security badges ~15–30% lift **specifically for unfamiliar brands** (matters for a challenger vs incumbent Vexere). **Badge bloat**: >3–4 badge types can *reduce* conversion 5–8% — reinforcing the VC finding from §1.

**Badge recognition beats presence**: Norton SSL (35.4% recognised), Google Trusted Store (20.9%), BBB (15.7%), McAfee (12.8%) in a Baymard n=3,516 survey. An unrecognised generic "secure" icon carries little weight.

**Nielsen's four trustworthiness factors** (1999, still cited as durable): design quality, up-front disclosure, comprehensive/current content, connection to the rest of the web. Trust is cumulative across encounters, not a single-page fix.

**Booking-specific structural elements**: price transparency (total incl. fees shown early — "drip pricing" explicitly named a top trust-destroyer in current travel-UX commentary); cancellation policy as a plain-language summary visible **before payment**, not buried in T&Cs (actionable: show operator-specific terms on the trip card, not only on the receipt); seat maps following the standard grid convention (a MUST-conform pattern); review **count + recency** as a stronger trust cue than average score alone.

## 4. Vietnam / SEA specifics

**Payment trust**: VN remains bank-transfer/QR-dominant vs card trust. VietQR (NAPAS-interoperable) grew fast — 1.29B transactions by 2023, +107% YoY to 151.7M in H1 2024 — and is explicitly framed as *reducing* scam risk via standardisation, making QR familiarity itself a trust signal. E-wallet logos (Momo, ZaloPay) function like Visa/Mastercard logos do in Western trust research.

Countervailing point: ~1/3 of VN consumers cite difficulty tracking transfers / understanding refunds as a hesitation driver — the VN trust gap is less "is this secure" and more **"will I get my money back, can I see status"** → argues for prominent, explicit refund/dispute-status UI.

**Local trust badge**: the **Bộ Công Thương "đã đăng ký/đã thông báo" logo** (Decree 52/2013, 85/2021, via online.gov.vn) is a government-backed, VN-specific badge a Western design system would likely omit — but per the "recognised > generic" finding in §3, it is plausibly the single highest-recognition trust badge available locally, more so than an SSL padlock most VN consumers do not parse. Treat as required, not optional.

**Mobile-first is the substrate, not a preference**: ~80M internet users (78.8% penetration), mobile connections at 126% of population (multi-SIM), ~55% of e-commerce projected mobile, 6+ hrs/day online, Android 65.7% vs iOS 33.7% → performance/motion budgets should target mid-range Android, not flagship devices.

**Visual density**: no controlled study proves SEA users intrinsically prefer denser UI. What exists is observational (Shopee/Lazada/Tiki's icon-heavy, promo-dense, red/gold urgency-driven layouts), better explained as a **regional prototypicality effect** (density matching category expectation) than an innate cultural preference — some Shopee users even call their own UI "cluttered" while still preferring the app functionally. Practical read: match the density of the established SEA booking-app category (Vexere, Traveloka, 12Go), not a Western SaaS-minimalist import — but hold this conclusion with caution given the weak evidence base.

**Competitors**: Vexere (VN's largest homegrown platform, 10,000+ routes, 2,000+ operators) uses icon-driven results, integrated seat diagrams, reviews woven into the journey, described as "conversion-first." Traveloka uses persistent search-memory and quick date-shift shortcuts on results pages — friction-removal patterns worth benchmarking functionally, independent of aesthetics.

## 5. The SEO/aesthetics tension — conflicts and resolutions

**5.1 Hero image vs LCP <2.5s** — **[OPERATIVE. An earlier revision marked this SUPERSEDED by Part I §Ruling 3 (delete the hero image). Ruling 3 was subsequently REJECTED — see Part V — so this guidance is the live guidance again. Note the number below undercuts Ruling 3's own necessity argument: an engineered photo hero measured 1.9s, comfortably inside the 2.5s budget, so deleting the image was a robustness preference, never an LCP requirement.]** — treat the hero as the LCP element deliberately: AVIF (70%+ size cut), `fetchpriority="high"` (Google Flights case study: ~700ms LCP improvement, 2.6s→1.9s, from this one attribute), never `loading="lazy"` on it (the single most common LCP mistake cited), preload, reserve dimensions via `aspect-ratio`. Not a real conflict once engineered for explicitly.

**5.2 Web fonts vs FOUT/CLS** — font-related shifts cause ~15–20% of median-page CLS. `font-display: swap` as floor; `font-display: optional` with tuned fallback metrics for CLS-strict builds (near-zero CLS, occasional missed custom-font load). Preload 1–2 weights only; subset to Latin **+ Vietnamese diacritics** specifically (not full Unicode).

**5.3 Animation vs INP** — INP good ≤200ms, poor >500ms. Use GPU-composited transform/opacity, `requestAnimationFrame`, avoid unnecessary post-interaction visual changes, budget conservatively for mid-range Android. Motion is a spend-carefully budget, not binary.

**5.4 Client-side interactivity vs crawlability** — Googlebot renders JS via headless Chromium but on a delayed second pass; most non-Google crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JS at all. Resolution: SSR/hydration baseline (price, times, operator, key facts) with interactive widgets (seat picker, live date-shift) as a progressive-enhancement layer; real `<a href>` for navigation, not JS click handlers.

**5.5 Faceted search URLs vs crawl budget — the big one** — route × date × filter combinations multiply combinatorially (cited analogy: 1,200 base hotel properties → 800,000+ crawlable faceted URLs at one audited aggregator). Resolution: a small curated tier of durable, editorially-enriched, indexable route pages (e.g. `/hcm-to-danang`) as the real SEO assets; dates and most filters as query params, non-indexed, self-canonicalising or `noindex`/`robots.txt`-blocked; History API for pure UI filtering to avoid minting URLs at all. Programmatic pages only rank in current guidance if paired with genuine unique content per page (duration, operators, boarding points, FAQs) — template+DB output alone is treated as thin content now. Needs deliberate architecture, not a bolt-on fix.

**5.6 Above-the-fold text vs clean hero** — Google's guidance treats a generic decorative hero as fine *if paired with* some unique on-page text above the fold (a real H1 + one unique descriptive line). Pure image/slider-only heroes with zero text are explicitly flagged as unreadable to Google. Low-cost fix; trim hero height on mobile to preserve above-fold content density.

**5.7 Structured data in 2026** — `Trip`/`BusTrip` + `Offer` for departures/pricing; `BreadcrumbList` still high-ROI; **`FAQPage` rich results reportedly stopped appearing in Google Search as of ~May 2026** — still useful for Bing/AI answer engines but should not be pitched as a Google rich-result win (time-sensitive; re-verify near implementation). Recommended composite: `Organization`, `BreadcrumbList`, `Trip`/`BusTrip`+`Offer`, `AggregateRating`/`Review` only if genuine (fabrication risks manual action). JSON-LD is Google's recommended format.

## 6. Core Web Vitals 2026 — skeptical read

Thresholds unchanged: **LCP ≤2.5s** / >4.0s poor; **INP ≤200ms** / >500ms poor; **CLS ≤0.1** / >0.25 poor — all at p75 over a 28-day CrUX window. INP formally replaced FID in March 2024 (stable status quo through 2026, not a pending change).

**Critical skepticism point:** CWV is a confirmed ranking input but functions as a **tie-breaker among comparable-relevance pages**, not a lever that lets a fast page outrank a more relevant one. Content/authority and the faceted-URL architecture in §5.5 almost certainly matter more for this marketplace's organic visibility than pushing CWV from "good" to "excellent." Precise "% ranking boost" claims tied specifically to CWV are largely unsourced agency marketing — the defensible claim is qualitative (gate/tie-breaker), not a quantified multiplier.

## Crew 3 conflict summary

| Conflict | Resolution |
|---|---|
| Big hero image vs LCP | Treat hero as LCP element: AVIF, `fetchpriority=high`, preload, no lazy-load, reserved dimensions. **OPERATIVE** — §Ruling 3 (delete the image) was rejected in Part V |
| Premium web font vs CLS/FOUT | `font-display: swap` (floor) or `optional` (CLS-strict), preload 1–2 weights, subset incl. Vietnamese diacritics |
| Brand motion vs INP | GPU-composited transforms only, rAF, scope to CTA feedback, conservative on mid-range Android |
| Rich JS widgets vs crawlability | SSR baseline content + client-side enhancement layer; real `<a href>` links |
| Faceted route×date×filter URLs vs crawl budget | Curated indexable route-page layer + param-based non-indexed filters + canonicalisation + real editorial content per indexed page |
| Visual hero vs above-fold text requirement | H1 + one unique line in/near hero; avoid pure image-only heroes |
| Trust-badge density vs visual complexity cost | Cap at 3–4 recognised badges (incl. Bộ Công Thương); more hurts |
| Regional density expectation vs Western minimalism | Match SEA booking-app category prototypicality, not a SaaS-minimalist import |

### Crew 3 sources

Kurosu & Kashimura 1995; Reber/Schwarz/Winkielman (processing fluency); Reinecke et al./Google Research ([research.google](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/), [research.google/blog](https://research.google/blog/users-love-simple-and-familiar-designs-why-websites-need-to-make-a-great-first-impression/)); Lindgaard et al. 2006, *Behaviour & Information Technology* 25:115–126; 2023 CHI paper "Statistically Controlling for Processing Fluency Reduces the Aesthetic-Usability Effect" ([ACM DL](https://dl.acm.org/doi/10.1145/3544549.3585739)); Nielsen 1999 / [NN/g trust reports](https://www.nngroup.com/articles/trustworthy-design/); [Baymard Institute](https://baymard.com/research/travel-tours-experience-booking); [web.dev Fetch Priority API](https://web.dev/articles/fetch-priority); Vietnam Decree 52/2013/NĐ-CP & 85/2021/NĐ-CP; [DataReportal Digital 2025 Vietnam](https://datareportal.com/reports/digital-2025-vietnam); [schema.org/Trip](https://schema.org/Trip); [Google Search Central Core Web Vitals docs](https://developers.google.com/search/docs/appearance/core-web-vitals).

---
---

# PART V — DEBATE & ADJUDICATION

*Added 2026-07-20, after the corrections in Parts I–IV. This is where the rule set was tested rather than written.*

## Method

Two adversarial debate rounds plus one synthesis pass. Six agents total, three fixed roles per round.

| Round | Access | Purpose |
|---|---|---|
| **1** | Full repo | Judge each rule against shipped reality — what it costs, what it buys, what is already true |
| **2** | **This document only** — forbidden from opening any other file | Judge each rule on internal coherence alone: does it follow from the evidence this document itself presents? |
| **Synthesis** | Both rounds + repo | Rule on every conflict between the two |

Round 2's debaters were **not told round 1's verdicts.** That makes round 2 an independent replication, not a review of round 1.

Two weighting rules, applied throughout:

- **A concession outweighs an assertion.** What the prosecution conceded and what the defense abandoned carry more evidential weight than anything either side argued for.
- **Lens priority.** Where the rounds conflict, the repo lens governs *deployment* questions and the doc lens governs *document-integrity* questions. Round 1 never noticed this document's internal contradictions; round 2 never saw what the rules would cost. Each is blind in a specific, predictable way.

## The central finding — what the two lenses actually measure

The rounds disagreed on three rules. The disagreement is not noise, and it is the most useful result of the exercise.

**Adoption is a conjunction:** *(the argument is sound)* **AND** *(the cost is justified in this repo)*. Round 2 could only evaluate the first conjunct. Each lens therefore fails open in a specific direction:

**Doc-only review over-adopts rules whose costs are external to the document.** Round 2's defense adopted §Ruling 3 and §Ruling 5 — rationally, given its evidence. On the page, "CSS field = 0 bytes, LCP becomes the H1" and "layer tokens survive dark mode" are elegant and well-cited. What a doc-only reader structurally cannot see is that both rules are priced in demolition: a live, tuned, 1.9s-LCP photo hero with a preload chain and a real `<h1>`; 61 shadow call sites.

§Ruling 5 is the sharper case. Its justification is not merely expensive — it is **void**. This document truthfully reports that `globals.css` ships a `.dark` block, so a doc-only reader correctly infers "dark mode exists." Only repo access reveals that no toggle ships, so the dark-mode problem §Ruling 5 solves *cannot occur*. The document is not lying; it is **framing**. A doc-only reader has no way to test a frame.

> **The lesson worth keeping: a well-written document can argue a careful reviewer into an expensive mistake, because rhetorical coherence substitutes for ground truth exactly when ground truth is unavailable.**

**Doc-only review over-rejects rules whose support is external to the document.** Round 2's prosecution rejected S5 (results-row Z-scan) — and was right *by the citations*. This document's own Appendix admits the row-layout convergence is "inference from convention," with no brand-specific eye-tracking, and Part I failed to carry the † flag that its own contract required. But S5's real support was never in the literature; it is embodied industry practice, at essentially zero adoption cost. Doc-only review is **stricter than warranted** on rules whose evidence lives in the world rather than in a paper.

**One result needs no adjudication.** The "open lane" positioning claim was **abandoned by its own defense in both rounds, independently, with no coordination between them.** A claim that fails doc-only and repo-grounded scrutiny, twice, at the hands of the agents assigned to defend it, is as dead as this process can make a claim.

## Verdict table

| Rule | Round 1 | Round 2 | FINAL | Why |
|---|---|---|---|---|
| **C1** orange ≤~10%, never field/body/warning | Adopt (qualitative) | Weaken | **ADOPT** (qualitative) | Both rounds rejected the metric, both kept the ban. "Field" needed a gloss — as printed it forbade the orange CTA |
| **C2** one primary orange per screen | Adopt | Conceded | **ADOPT** | Unattacked in either round |
| **C3** two-tier orange + navy | Adopt tier; defer navy | Weaken | **SPLIT** — adopt tier + teal ban, defer navy | Tier is WCAG arithmetic and shipped code fails it. Navy is coupled to rejected R3/C4 |
| **C4** cool/slate neutrals | **REJECT** 2-of-3 | Prosecution reject; defense adopt-**later** | **REJECT** | Repo lens governs. Neither round's defense would defend it as written |
| **C5** discard 60-30-10 | Unanimous adopt | Conceded | **ADOPT** | Untouched by any agent |
| **S1** inside ≤ outside | Adopt | Weaken | **ADOPT** as †-hedged heuristic | The "weakening" restates the hedge already present |
| **S2** spacing tiers | Adopt | Weaken | **ADOPT** | The one delta row with zero repo conflict |
| **S3** 8px atom, cap steps | Unanimous adopt | Auditor hit the cap | **ADOPT**, cap widened to ~9–13 | Cap excluded its own cited exemplar |
| **S4** clamp() with rem term | Unanimous adopt | Conceded; example faulted | **ADOPT**, example fixed | Rule survived; the `4vw` coefficient was invented at synthesis |
| **S5** results row Z-scan | Adopt | **Prosecution REJECTED** | **ADOPT** + † added | See central finding. Round 2's rejection was really an indictment of the missing †, which was the genuine defect |
| **S6** ≤66ch, shell 1200–1280 | Adopt | Conceded | **ADOPT** | Effectively unattacked |
| **F1** conform / differentiate | Unanimous adopt | Weaken (framing) | **ADOPT** | The weakening hit the "four doors" framing, not the rule |
| **F2** curated route pages | **Defer** | Conceded | **ADOPT** (upgraded) | Never attacked, only deferred. And FD-013 already committed to it — overdue spec, not new law |
| **F3** font subset + preload | Unanimous adopt | Conceded | **ADOPT** | Unattacked. Live violation at `app/layout.tsx:13` |
| **F4** badge cap + Bộ Công Thương | Adopt | Reject trust-lift basis | **ADOPT**, re-grounded on legal basis | Both rounds converged on the same repair |
| **F5** price/cancellation/refund UI | Adopt | Conceded | **ADOPT** | Unattacked on substance either round |
| **F6** CWV tie-breaker | Unanimous adopt | Conceded | **ADOPT** | Survived untouched |
| **R1** price near-black | Unanimous adopt | Weaken (cherry-picks) | **ADOPT**, justification rewritten | See Q7 — the rule is right, its stated reason was not |
| **R2** density + "open lane" | Density kept; lane **abandoned** | **Rejected**; lane **abandoned again** | **SPLIT** — adopt density, **STRIKE** the lane | Abandoned by its own defense twice, independently |
| **R3** navy CSS field hero | **REJECT** 2-of-3 | Defense adopted; auditor undercut it | **REJECT** | Repo lens governs. Round 2's own auditor found the same verdict inside the doc (the 1.9s figure) |
| **R4** orange=CTA, amber, red | Unanimous adopt | Conceded; auditor found drift | **ADOPT** + dropped branch restored | Strongest-precedented ruling in the document |
| **R5** Carbon elevation | **REJECT** 2-of-3 | Defense adopted | **REJECT** | Clearest lens-priority call: the justification is void, the cost is 61 call sites |
| **R6** white-on-orange fails | Confirmed by live bugs | Conceded | **ADOPT — highest urgency** | The one rule *proven by the repo*. Not a design opinion; a defect report |

**Tally: 15 adopt (several amended) · 3 reject · 2 split · F2 upgraded from defer.**

## Q&A on the contested calls

### Q1 — Should the neutral ramp go cool/slate? (C4)

**Prosecution:** Built on three cherry-picked products, with a fourth (Etsy) defined out of the sample as "decorative" rather than counted against the rule. The entire justification is one unsourced register assertion — *"warm grey + orange = craft/artisanal register."* It reverses a documented, deliberate decision (`globals.css:70`, "mood-board: warm > clinical") that survived a 26-finding audit, and this document admits *"the mood-board rationale is not addressed anywhere in this doc."*

**Defense:** Amazon and HubSpot both skew cool specifically in trust/transaction registers; that is a real directional pattern. But the defense **downgraded C4 to ADOPT-LATER in both rounds** and declined to defend it as an immediate unscoped rewrite.

**Ruling: REJECTED.** Overturning a shipped, deliberate choice without engaging its stated rationale is advocacy, not analysis. No functional bug is attached.

**What would settle it:** the [one audit](#the-one-audit-that-settles-three-open-items).

### Q2 — Should the photo hero become a navy CSS field? (R3)

**Prosecution:** Demolishes a live asset — 5 responsive images, per-breakpoint `preload()`, gradient scrim, Ken-Burns animation, real `<h1>` above the fold — that passed audit 4 days prior. The SEO problem it solves (no crawlable above-fold text) is already solved a different way.

**Defense:** A CSS field removes the LCP image as a *class* of risk, permanently, for mid-range Android on variable networks. No preload strategy removes bytes the way deleting the image does.

**Ruling: REJECTED** — and notably, round 2's auditor reached the same verdict *without repo access*, from this document's own retained evidence: Part IV §5.1 records an engineered photo hero at **1.9s LCP**, inside the 2.5s budget. Part I implies deletion is necessary for LCP compliance; its own sources say otherwise. Deletion is a robustness preference wearing a necessity's clothes.

**What would settle it:** a measured Lighthouse run against the production hero. If LCP is inside budget, R3 stays dead. If not, the indicated fix is still "shave hero weight" — navy is a separate project.

### Q3 — Should shadows be replaced by Carbon layer tokens? (R5)

**Prosecution:** 61 call sites replaced, on a live product, to fix a problem that cannot occur — no dark-mode toggle ships.

**Defense (round 2, doc-only):** Adopted it. Reasonably: the document reports a `.dark` block exists, and shadows genuinely are near-invisible on dark surfaces.

**Ruling: REJECTED.** The clearest lens-priority call in the exercise, and the cleanest illustration of the central finding — round 2's adoption was rational *inside a frame it could not test*.

**Genuine latent issue worth keeping:** `--shadow-e1..e4` are **not** re-specified under `.dark` (`globals.css:129-173`). If dark mode ever ships a toggle, that is a real bug — which is the argument for fixing elevation *then*, cheaply, not now, expensively.

### Q4 — Is the "open lane" positioning claim defensible? (R2)

**Both defenses abandoned it, independently, in both rounds.** Round 2's defense wrote: *"I'm not going to lose credibility defending a claim the source material itself disowns."*

**Ruling: STRUCK.** The design instruction survives on C1 + C2 + C5 and needs no market claim. Only the positioning claim dies.

**What would settle it:** the [one audit](#the-one-audit-that-settles-three-open-items). Note the live alternative reading, which this document records against itself: the lane may be empty *because* density-plus-colour is what converts in this market, and monochrome discipline may read as foreign rather than premium.

### Q5 — Route-page SEO: build now or defer? (F2)

**Prosecution:** 1–2 operators at Phase 1. Building SEO infrastructure with no content to fill it is premature.

**Defense:** URL architecture is the single most expensive thing to retrofit after Google has indexed the wrong shape.

**Ruling: ADOPT** — upgraded from round 1's DEFER, on a fact neither debate weighted properly: **this was never a proposal.** FD-013 already committed to `/tuyen/{origin}/{destination}/{date}` and it was never built; `/search` redirects to `/`. The question is not "adopt a new rule," it is "reconcile a spec the team walked away from."

**What would settle the remaining timing question:** whether FD-013's abandonment was a documented scope cut or silent drift. No superseding ADR was found.

### Q6 — Navy secondary, separated from C4 (C3 clause)

**Ruling: DEFERRED.** Round 2's auditor found the trap: rejecting C4 while keeping navy produces warm-grey body chrome against a cool navy hero — the exact undertone clash Part II §4 warns against, poles reversed. With C4 and R3 both rejected, **warm neutrals + photo hero is the coherent pair.** Navy cannot be adopted piecemeal.

**What would settle it:** the [one audit](#the-one-audit-that-settles-three-open-items), plus a mock of navy against the shipped warm scheme.

### Q7 — Does R1 cherry-pick its own evidence?

Flagged independently by round 2's prosecution *and* its auditor. Part III §5's spotted-pattern finding is that users fixate on **"bold, colour, bullets, numbers"** — conjunctive. §Ruling 1 keeps weight and size and discards the colour term of the very finding it cites as justification, then asserts an uncited salience mechanism ("out-saliences everything at 14px/400") to close the gap.

**Ruling: rule ADOPTED, justification rewritten.** The critique lands: this is a **trade**, not a reading of the evidence. Colour scarcity (C2) is bought by paying with the colour cue on price. That is a defensible choice, and the rule stands on C1 + C2 alone without needing any salience claim. It should be stated as a trade, not as what the research dictates.

## The load-bearing core

Rules no agent in either round successfully attacked:

> **C2 · C5 · S6 · F2 · F3 · F5 · F6 · R6** — plus the rule kernels of **S4** and **R4**, whose textual presentation took hits but whose substance held.

Three groups: **semantic-role colour discipline** (one orange, one meaning, discard ratios), **web-platform fundamentals** (fonts, fluid spacing, route architecture, CWV realism), and **transactional honesty** (total price early, cancellation visible, refund status).

Note the shape. This is the document's *consensus* content — the parts where three crews faithfully relayed what Atlassian, Orange S.A., NN/g, Baymard and Google already agree on. **Every ambitious or contrarian claim layered on top fell:** the open lane, the navy hero, the cool-neutral reversal, the elevation swap, the four-door convergence.

**The document is strongest exactly where it is least original.** That is not an insult — it is what a research document is for. But it means this should be read as a **constraint checklist, not a redesign thesis.**

Its single largest concrete contribution was accidental: forcing the repo audit that found four live WCAG failures, three of which violate the repo's own accessibility contract.

---
---

# APPENDIX — Evidence Quality Register

Consolidated list of every claim the crews themselves flagged as weak, **plus claims the 2026-07-20 review flagged that the crews did not.** Marked **†** where they appear in Part I. **Do not cite these as settled fact.**

| Claim | Problem | Use as |
|---|---|---|
| **"Nobody in SEA has shipped high-info-density + monochrome-discipline — that is the open lane"** (Ruling 2) | **Added by review, not self-flagged.** A negative existence claim over an entire regional market, from web research with no systematic competitive audit. **STRUCK in Part V — abandoned by its own defense in both debate rounds independently, with no coordination between them.** | **Dead until the audit is run.** The design instruction survives on C1+C2+C5; the positioning claim does not. Consider the alternative reading: the lane may be empty because density+colour works in this market. |
| **"No shipped product uses orange above ~15% surface"** (§The convergent law) | **Added by review (round 2).** Structurally the *same* class of unaudited negative-existence claim as "open lane" above, but went unflagged for longer. Part II §1's actual wording was "unsupported by a single real product **in this set**" — a 10-product sample. | Directional. Never state as a universal negative; the sample is 10 products chosen by the crew. |
| **"Fonts are 15–20% of median CLS"** (Feel+SEO rule set, Part IV §5.2) | **Added by review (round 2).** No citation in the Crew 3 source list is tied to this figure. | Directional. The *mechanism* (webfont swap causes layout shift) is uncontroversial; the magnitude is unsourced. |
| **FD-013 route-page spec drift** (F2) | **Open question, not a weak claim.** FD-013 committed to `/tuyen/{origin}/{destination}/{date}`; it was never built and `/search` redirects to `/`. No superseding ADR found. | Unresolved. Determine whether this was a documented scope cut or silent drift before scheduling F2. |
| **Bộ Công Thương = highest local recognition** | **Added by review.** No VN-market recognition study found. Rests on Baymard's US-sample "recognised > generic" finding transferred to an unmeasured market. | Display it — but for the legal-registration obligation, which is solid, not the trust-lift claim, which is not. |
| **The "four doors, same law" convergence** (§The convergent law) | **Added by review.** Not four independent measurements of one law — one plausible law that four literatures are separately consistent with. | Organising heuristic. Not four-way corroboration. |
| **Contrast ratios quoted outside the computed tables** (Part II §3 prose) | **Added by review.** Four figures were wrong and all four erred toward appearing *more* compliant (`#C85400` presented as AA-passing measures 4.45:1). Corrected 2026-07-20. | Trust only ratios inside a computed table. Recompute anything else before relying on it. |
| "SEA users prefer denser UI" | Observational only; no controlled study. Better explained as category prototypicality than cultural preference. Some Shopee users call their own UI cluttered. | Directional. Copy the info density, not the visual noise. |
| Trust-badge lift percentages (8–12%, 12–18%, 15–30%) | Secondary-sourced Baymard-via-blog; not traced to primary reports. | Directional only. The *badge bloat* finding (>3–4 reduces conversion) is better sourced than the lift finding. |
| Baymard 35.26% checkout ceiling, 19% card-trust abandonment, 72% payment-security weighting | Secondary-sourced. | Verify primary before external use. |
| Jakob's-law "30% fewer errors / 18% higher completion" (2022 Baymard) | Not independently verified to primary. | Directional. |
| CWV → ranking-boost magnitude | Largely agency marketing. | Defensible claim is "gate/tie-breaker" only, never a quantified multiplier. |
| FAQPage rich results discontinued ~May 2026 | Recent and fast-moving. | Re-verify before building for it. |
| Airbnb section-padding numbers (64px, 24px card padding, 16px gutters) | Community-reconstructed GitHub repo, not Airbnb's published system. | Directionally useful, numerically unverified. |
| Optical overshoot "circle 12.5% larger than square" | Single illustrative example, not a general constant. Icon grids typically use 2–8%. | Context-dependent; eyeball per case. |
| "internal ≤ external" + 1.5–3x proximity ratio | Aggregation/practitioner literature, not a single named study. No major system publishes a numeric ratio. | Defensible as a working rule; do not cite as a published standard. |
| Row-layout convergence (price right-aligned) for Booking.com / Skyscanner / redBus / Kayak / Google Flights | No brand-specific eye-tracking found. | Inference from NN/g general findings + observed industry convention. |
| M3 spacing token pixel list | m3.material.io did not yield token values on fetch; numbers from secondary aggregation. | Approximate; token names may not be verbatim. |
| Aesthetic-usability effect strength | 2023 CHI: controlling for processing fluency drops r from ~.79 to ~.34. Decays with repeated use. | Buys the first 50ms and the bounce decision. Not forgiveness for broken flows. |
