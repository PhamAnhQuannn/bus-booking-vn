---
name: landing-page-test
description: Deploy single-page funnel + email/CC capture before build to measure intent conversion. Outputs to `docs/inception/landing-test-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "landing page test", "smoke test", "fake door", "/landing-page-test", or before code build.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /landing-page-test — Single-Page Demand Funnel

## Why you'd care

Building a product before testing intent is how startups discover six months in that nobody actually wants what they made. A landing page + capture rate is the cheapest signal you can buy.

Invoke as `/landing-page-test`. No product. Just promise + capture.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/positioning-statement-<project>.md` if exists.
3. Read `docs/inception/buyer-persona-<project>.md` — pull copy hooks.

## Inputs
- Headline (the promise).
- Sub-headline (mechanism).
- 3 benefits.
- CTA: "Get early access" / "Join waitlist" / "Pre-order $X".
- Traffic source: ads / outreach / community.

## Process
1. **Build page** — Carrd / Framer / Webflow / Vercel + Tailwind. Single page. <1 day.
2. **Set conversion goal** — email signup / CC pre-auth / waitlist join.
3. **Set benchmark** — ≥5% visitor→signup is signal; <2% = weak.
4. **Drive traffic** — ≥200 unique visits min for stat-meaning.
5. **Variant test** — A/B headline only.
6. **Follow-up** — email each signup within 48h. Reply rate = real intent.
7. **Score** — visitors / signups / replies / "would-pay" intent.

## Output
Write `docs/inception/landing-test-<project>.md`:

```markdown
# Landing Page Test — <project>
**Date:** <YYYY-MM-DD> to <YYYY-MM-DD>

## Page
- URL: <link>
- Headline: <text>
- Sub: <text>
- CTA: <text>
- Variant A: <X> | Variant B: <Y>

## Traffic sources
| Source | Cost $ | Visits | Signups | Conv % |
|---|--:|--:|--:|--:|
| Reddit organic | 0 | 80 | 4 | 5.0% |
| FB ads | 50 | 200 | 6 | 3.0% |
| Outreach DM | 0 | 30 | 9 | 30.0% |

## Aggregate
- Visitors: N
- Signups: N
- Conv rate: X%
- Benchmark hit: ✓/✗ (≥5%)

## Follow-up
- Emailed: N
- Replied: N
- "Yes I'd pay $X": N
- Quotes: "<verbatim>"

## A/B winner
- Headline X (conv X%) beat Y (Y%) — sample N

## Verdict
**SIGNAL-STRONG / SIGNAL-WEAK / NO-SIGNAL**

## Next
- STRONG → /pre-sale-test or /mvp-scope build
- WEAK → revise positioning + retry (1 more iteration max)
- NO-SIGNAL → /idea-kill-list (NO_DEMAND)
```

## Verification
- ≥200 visits (else stat-meaningless).
- ≥3 traffic sources (single = channel bias).
- Follow-up reply rate captured (signup ≠ paying intent).
- Benchmark stated PRE-test, not post-rationalized.
