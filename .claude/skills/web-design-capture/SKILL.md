---
name: web-design-capture
description: Capture real design data from a live product — extract computed-style design tokens (color, type, spacing, radius, shadow, motion, layout) and screenshots via Playwright, classify by product type, write to a corpus. Use before mood-board or design-system when references should be real market-leading products, not invented. Triggers on "capture design from <url>", "what does <product> use", "/web-design-capture".
output_size:
  XS: skip
  S: ~20min — 1 URL, desktop only, token tables + 1 screenshot
  M: ~45min — 1 URL, desktop + mobile, full token extraction + personality read
  L: ~1.5h — 2-3 URLs same product type, full extraction each, corpus seeded
  XL: ~3h — 4-6 URLs across product types, full corpus build for compare/audit
---

# /web-design-capture — Live product → design tokens + screenshots

Browse a real, modern, market-leading product and extract its **design data** — computed-style tokens and screenshots — into a product-type-segmented corpus. The corpus is the evidence base that `/design-trend-compare` auto-picks from and `/anti-generic-design-check` benchmarks against. Capture is **visual/structural design data only** — never content, text, or user data.

## Why you'd care

Mood boards invented from designer intuition lack the legibility of real market leaders' tokens. Capturing computed-style tokens from live products is what grounds the design language in reality, not vibes.

## When This Skill Applies

- User says "capture design from <url>", "what does <product> use", "grab the design tokens off <site>", "/web-design-capture".
- Before `/visual-mood-board` or `/design-system` when the design references should be **real live products**, not invented or recalled-from-memory.
- When seeding or extending the corpus so `/design-trend-compare` has ≥2 same-type captures to work with.
- NOT for: auditing your own built output (that's `/anti-generic-design-check`), or comparing already-captured products (that's `/design-trend-compare`).

## Prerequisites

- **Playwright MCP available** — `npx @playwright/mcp@latest`. Tools used: `browser_navigate`, `browser_evaluate`, `browser_take_screenshot`. No other browser automation.
- **`/scraper-ethics-pre` MUST run first** (auto-chained — see Steps). If it returns abort, do not capture.
- A target URL that is a **public, non-auth-walled** page of a real product. Marketing sites, public app shells, public docs, public dashboards. No login walls unless the user supplies their own credentials and owns the account.

## Steps

### 1. Auto-chain `/scraper-ethics-pre` — gate before any navigation

Run `/scraper-ethics-pre` for the target host FIRST. It classifies the target tier, checks ToS + robots.txt, sets rate limits.

- **Abort** if it flags the target as disallowed, anti-bot protected, or auth-walled. Do not proceed, do not "try anyway."
- This skill captures **design tokens + screenshots only** — computed styles, color/type/spacing/radius/shadow/motion values, layout metrics. It does NOT read article text, user content, prices, PII, or any business data. State this scope to the ethics gate.
- One page load per host per run. No crawl, no pagination. Respect the rate limit even for a single navigation.

### 2. Navigate

`browser_navigate(<url>)`. Then wait for the page to settle:

- `browser_evaluate("() => document.fonts.ready.then(() => true)")` — fonts loaded before reading type tokens.
- Give late-loading CSS a beat; if the page is a heavy SPA, wait for the main landmark to exist before extracting.

### 3. Extract design tokens — `browser_evaluate` token-extraction payload

Run one `browser_evaluate` call with a JS payload that walks the rendered DOM, calls `getComputedStyle()` on a representative sample of nodes, and aggregates. This is the DevTools-equivalent capture mechanism. Extract and aggregate:

- **Color** — frequency map of every distinct `color`, `background-color`, `border-color`, `fill`, `stroke`, and gradient stop actually used. Rank by pixel-area-weighted frequency so the dominant palette surfaces. Separate neutrals from accents.
- **Typography** — set of `font-family` stacks; set of `font-weight` values actually rendered; the `font-size` scale (distinct sizes, sorted); `line-height` set; `letter-spacing` set. Note which family is display vs body.
- **Spacing** — distinct `margin` / `padding` / `gap` values; infer the base rhythm unit (4 / 8 / custom) and whether spacing is consistent or ad hoc.
- **Radius** — set of `border-radius` values; classify the personality (sharp ~0-4px / soft ~6-16px / pill ≥9999 or fully round).
- **Shadow** — set of `box-shadow` values; note depth strategy (flat / single soft / layered / colored / inset / none).
- **Motion** — set of `transition` and `animation` declarations: properties animated, duration values, easing curves. Note if motion is essentially absent.
- **Layout** — `max-width` of main container(s); column/grid metrics (`grid-template-columns`, flex usage); section rhythm; whether composition is symmetric-grid, asymmetric, editorial, dense, or spacious.
- **Components** — computed styles for representative `button`, `card`/panel, `input`: their radius, padding, shadow, border, color, font-weight, height.

Keep the payload defensive — wrap node access in try/catch, cap the node sample (e.g. first ~2000 elements) so it never hangs, return a plain JSON object.

### 4. Screenshots

- `browser_take_screenshot({ fullPage: true })` — full-page desktop at 1440 viewport width.
- `browser_take_screenshot()` — above-the-fold desktop viewport.
- Resize to 390 width, repeat both for mobile.
- Save alongside the corpus file: `docs/design/corpus/<product-type>/<host>-desktop-full.png`, `-desktop-fold.png`, `-mobile-full.png`, `-mobile-fold.png`.

### 5. Classify product type

Assign exactly one product type from: `saas`, `marketplace`, `fintech`, `devtools`, `mobile-consumer`, `internal-admin`, `content`, `ecommerce`. This is the corpus segmentation key — `/design-trend-compare` and `/anti-generic-design-check` query per type. If a product spans two, pick the dominant surface that was captured.

### 6. Write the capture file

Write to `docs/design/corpus/<product-type>/<host>.md`. One host per file. If the file exists, see Re-run Behavior.

## Output Format

`docs/design/corpus/<product-type>/<host>.md`:

```markdown
---
host: stripe.com
url: https://stripe.com/
product-type: fintech
captured: 2026-05-13
viewport: [1440, 390]
---

# Design capture — stripe.com (fintech)

## Color
| Role | Token | Usage |
|---|---|---|
| neutral-bg | #0a0e27 | dominant background |
| accent | #635bff | primary CTA, links |
| ... | | |
Palette read: <saturation range, light/dark, accent strategy>

## Typography
| Role | Family | Weights | Sizes | Line-height |
|---|---|---|---|---|
| display | Söhne | 600, 700 | 48/64/80 | 1.1 |
| body | Söhne | 400, 500 | 14/16/18 | 1.5 |
Type read: <display/body pairing, scale ratio, weight spread>

## Spacing
Base unit: 8px. Scale: 4/8/12/16/24/32/48/64/96. Rhythm: <consistent | ad hoc>.

## Radius & Shadow
Radius set: 4/8/12px — personality: soft.
Shadow set: <values> — strategy: layered + colored.

## Motion
Transitions: <properties, durations, easings>. Presence: <rich | minimal | absent>.

## Layout
Max-width: 1080px. Composition: <symmetric-grid | asymmetric | editorial | dense | spacious>.
Component metrics: button <radius/padding/height>, card <radius/shadow/border>, input <...>.

## Screenshots
- desktop full: stripe.com-desktop-full.png
- desktop fold: stripe.com-desktop-fold.png
- mobile full: stripe.com-mobile-full.png
- mobile fold: stripe.com-mobile-fold.png

## Design personality
<One paragraph: what this product's design says, what's distinctive, what's leading-edge for its type. The "steal-worthy" read.>
```

## Boundaries

- **Design data only.** Computed styles, color/type/spacing/radius/shadow/motion tokens, layout metrics, screenshots. NEVER scrape article text, copy, prices, user content, PII, or business data.
- **No auth bypass.** No login walls, no CAPTCHA solving, no anti-bot defeat. If `/scraper-ethics-pre` flags it, abort.
- **One host per file**, one page load per host per run. No crawling, no pagination.
- **Captures, does not decide.** This skill records what a product does. Picking the "best" direction is `/design-trend-compare`. Auditing your own output is `/anti-generic-design-check`.
- Respect the rate limit from `/scraper-ethics-pre` even for a single navigation.

## Re-run Behavior

- **Corpus file exists for this host:** overwrite if re-capturing intentionally (design changes over time — note the new `captured:` date). Otherwise skip and tell the user it's already captured.
- **New host, same product type:** new file in the same `corpus/<product-type>/` directory — extends the corpus.
- Re-running across many hosts builds the corpus breadth `/design-trend-compare` needs (≥2 same-type captures minimum).

## Auto-chain

- **Before (mandatory):** `/scraper-ethics-pre` — runs first, gates the capture.
- **After (≥2 same-type captures in corpus):** `/design-trend-compare` — auto-picks the modern direction for that product type.
- **Feeds:** `/anti-generic-design-check` (corpus is its benchmark half), `/design-system`, `/visual-mood-board`, `/typography-hierarchy-spec`, `/motion-direction-spec` — all consume the corpus.

## Example Trigger

> "Capture the design off linear.app and vercel.com so we have a real devtools reference before we build the design system."

→ Run `/scraper-ethics-pre` for each host; navigate; extract token payloads; screenshot desktop + mobile; classify both as `devtools`; write `docs/design/corpus/devtools/linear.app.md` and `docs/design/corpus/devtools/vercel.com.md`; auto-chain `/design-trend-compare` since 2 same-type captures now exist.
