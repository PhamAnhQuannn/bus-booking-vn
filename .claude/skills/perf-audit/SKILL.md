---
name: perf-audit
description: Lighthouse + Core Web Vitals audit per page, gated against budgets in docs/nfr.md. Runs npx lighthouse one-shot (no permanent dep). Use when user says "perf audit", "lighthouse", "core web vitals", "LCP", "CLS", "INP", "TTFB", "/perf-audit", or before launch / after a perceived slowdown. Writes docs/qa/perf-audit-YYYYMMDD.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Perf Audit

Objective UX performance. Lighthouse for the headline score; Core Web Vitals (LCP, CLS, INP, TTFB, FCP) for the metrics that move SEO + real-user perceived speed. Budgets sourced from `docs/nfr.md`. PASS/FAIL per metric per page.

## Why you'd care

Slow pages don't just frustrate users — Core Web Vitals are an SEO ranking factor and a conversion-rate determinant. An audit against budgets catches the regression in the PR, not in the post-mortem.

## When This Skill Applies

Activate when:
- User says "perf audit", "lighthouse", "core web vitals", "CWV", "LCP", "CLS", "INP", "TTFB", "FCP", "/perf-audit"
- Pre-launch readiness gate.
- After a perceived slowdown reported by user / customer.
- Quarterly perf check.
- Before a marketing event / known traffic spike.
- After a major dep upgrade (Next.js, React, Prisma) that could regress.

## Prerequisites

- Dev server OR (preferred) production build running. Lighthouse against `pnpm dev` is noisy â€” prefer `pnpm build && pnpm start` or staging URL.
- `npx lighthouse` available (Node + npx; no permanent dep).
- `docs/nfr.md` exists with perf targets. If missing, fall back to Web Vitals "good" thresholds: LCP â‰¤ 2.5s, CLS â‰¤ 0.1, INP â‰¤ 200ms, TTFB â‰¤ 800ms, FCP â‰¤ 1.8s.
- List of pages to audit (default: home, search-results, booking, success, login).

## Steps

1. **Confirm build target**. If running against dev server, warn at top of report ("dev-mode numbers are not representative").
2. **Per page, run Lighthouse**:
   ```bash
   npx -y lighthouse "<url>" \
     --only-categories=performance,accessibility,best-practices,seo \
     --output=json \
     --output-path="./.tmp/lh-<slug>.json" \
     --chrome-flags="--headless=new --no-sandbox" \
     --quiet
   ```
3. **Parse JSON**. Extract:
   - `categories.performance.score` Ã— 100 â†’ headline.
   - `audits['largest-contentful-paint'].numericValue` â†’ LCP.
   - `audits['cumulative-layout-shift'].numericValue` â†’ CLS.
   - `audits['interaction-to-next-paint'].numericValue` â†’ INP (Lighthouse reports it; for real INP use field data).
   - `audits['server-response-time'].numericValue` â†’ TTFB.
   - `audits['first-contentful-paint'].numericValue` â†’ FCP.
   - `audits['total-blocking-time'].numericValue` â†’ TBT (lab proxy for INP).
4. **Compare each metric to budget** from `docs/nfr.md`. PASS / FAIL per metric.
5. **Top opportunities** â€” Lighthouse `audits` with `details.type === 'opportunity'`, sorted by `details.overallSavingsMs` desc. Take top 5 per page.
6. **Bundle size sanity** â€” `audits['total-byte-weight']` and `audits['unused-javascript']`. Flag if JS > 500KB transferred or > 30% unused.
7. **Aggregate** across pages: any page below 90 perf score â†’ FAIL gate.
8. **Write** `docs/qa/perf-audit-YYYYMMDD.md`.
9. **Auto-chain** per finding category.

## Output Format â€” `docs/qa/perf-audit-YYYYMMDD.md`

```markdown
---
audit-date: YYYY-MM-DD
target: https://staging.example.com
build-target: production | dev (warn) | staging
lighthouse-version: <from JSON>
status: pass | fail
---

# Perf Audit â€” YYYY-MM-DD

> âš ï¸ Audit run against `pnpm dev`. Numbers are inflated â€” re-run against `pnpm start` for promotion gate.

## Per-page summary

| Page | Perf | LCP | CLS | INP (TBT proxy) | TTFB | FCP | Verdict |
|------|------|-----|-----|-----------------|------|-----|---------|
| / | 92 | 1.8s | 0.04 | 80ms | 320ms | 1.1s | âœ… |
| /search | 78 | 3.1s | 0.18 | 240ms | 410ms | 1.4s | âŒ |
| /booking/123 | 84 | 2.4s | 0.06 | 210ms | 380ms | 1.3s | âš ï¸ |
| /booking/success | 95 | 1.2s | 0.02 | 50ms | 290ms | 0.8s | âœ… |
| /login | 96 | 1.0s | 0.0 | 40ms | 280ms | 0.7s | âœ… |

## Budget (from docs/nfr.md)

| Metric | Target | Source |
|--------|--------|--------|
| Perf score | â‰¥ 90 | nfr.md |
| LCP | â‰¤ 2.5s | nfr.md / CWV "good" |
| CLS | â‰¤ 0.1 | nfr.md / CWV "good" |
| INP (lab TBT proxy) | â‰¤ 200ms | CWV "good" |
| TTFB | â‰¤ 800ms | nfr.md |
| FCP | â‰¤ 1.8s | CWV "good" |

## âŒ Failures

### /search â€” perf 78, LCP 3.1s, CLS 0.18, INP 240ms
- **LCP** breach: 3.1s vs 2.5s budget. Likely cause: hero search-results image not preloaded, or RSC waterfall.
- **CLS** breach: 0.18 vs 0.1. Likely cause: ads/banner inserted late, or images without dimensions.
- **INP** breach: 240ms vs 200ms. Likely cause: filter-change re-renders entire results list.
- **Top opportunity** (Lighthouse): "Reduce unused JavaScript" â€” 180KB savings.

### /booking/123 â€” INP 210ms borderline
- **INP**: 210ms vs 200ms. Likely cause: seat-grid re-render on hover.
- Likely fix: memoize seat cell.

## âš ï¸ Warnings

| Page | Issue | Detail |
|------|-------|--------|
| / | unused-javascript | 230KB unused (next/dynamic boundaries loose) |
| /search | total-byte-weight | 1.2MB transferred â€” image-heavy results |

## Top opportunities (savings â‰¥ 100ms)

| Page | Audit | Estimated savings |
|------|-------|-------------------|
| /search | Reduce unused JavaScript | 180KB / ~600ms |
| /search | Properly size images | ~400ms |
| /search | Defer offscreen images | ~250ms |
| /booking/123 | Avoid long main-thread tasks | ~180ms |
| / | Preconnect to required origins | ~120ms |

## Verdict

**Status: âŒ FAIL gate.** /search below perf threshold; LCP + CLS + INP all breach budget.

Promotion-blocking items:
1. /search LCP â€” preload hero result image OR fix RSC waterfall.
2. /search CLS â€” explicit image dimensions OR `aspect-ratio` CSS.
3. /search INP â€” memoize result-card; debounce filter input.

Non-blocking but recommended:
4. Trim unused JS on home (`next/dynamic` audit).
5. Memoize seat-cell on booking page.
```

## Boundaries

- **Lighthouse is lab data**, not field. For RUM (real user metrics), wire Web Vitals SDK separately â€” out of scope.
- **One headless Chrome run = high variance**. For promotion gate, run 3Ã— and report median.
- **Don't gate on accessibility/best-practices/seo Lighthouse scores** â€” `/a11y-runtime` is the a11y gate; Lighthouse a11y is a noisy subset.
- **Don't run against `pnpm dev`** for promotion gate. Always note build target in report.
- **Budget lives in `docs/nfr.md`** â€” if missing, default to Web Vitals "good" thresholds and flag the missing NFR.
- **No code edits.** Findings route to fixes; this skill is a measurement.

## Re-run Behavior

- One report per date.
- Re-run after each promotion candidate.
- Track headline scores over time (manually) to spot drift.

## Auto-chain

- LCP breach â†’ `/cache-strategy` for the slow surface; check image-priority hints.
- CLS breach â†’ wireframe / design-system fix (image dimensions, font-display).
- INP / TBT breach â†’ component memoization; consider `React.memo` or splitting list.
- TTFB breach â†’ `/capacity-plan` (DB / API latency); `/cache-strategy` for edge caching.
- Bundle-size breach â†’ check `next/dynamic`, route-segment config; `/feasibility-spike` if dep is the culprit.
- Missing budgets â†’ `/nfr-template` to author them.

## Example Trigger

User: "run lighthouse on the search page, I think it got slower"
â†’ `npx lighthouse <url>` for /search, parse JSON, compare LCP/CLS/INP/TTFB to nfr.md, list top opportunities, write `docs/qa/perf-audit-YYYYMMDD.md`.
