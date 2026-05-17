---
name: content-moat-plan
description: Plan content as long-term distribution moat — pillar pages, ungoogleable insights, proprietary data. Outputs to `docs/inception/content-moat-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "content moat", "content strategy", "/content-moat-plan", or after `/seo-keyword-recon`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /content-moat-plan — Content as Moat

## Why you'd care

Generic "10 tips" listicles get out-published in a week by anyone with a ChatGPT subscription, so the SEO traffic disappears the moment Google reweights its model. Proprietary data and a real POV are the only content assets that can't be copied by a competitor with a bigger content budget — that's what makes it a moat instead of a treadmill.

Invoke as `/content-moat-plan`. Generic blog ≠ moat. Proprietary data + POV = moat.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/seo-recon-<project>.md` if exists.

## Inputs
- Founder's unique perspective / 10-year experience areas.
- Proprietary data accessible (your usage data, customer data, scraped public data).
- Buyer's information needs (from interviews).

## Process
1. **Moat-content classification** — every piece must be ≥1:
   - Proprietary data (only-we-have)
   - Unique POV (founder's contrarian take)
   - Original research (survey, study, benchmark)
   - Deep how-to (10x more thorough than competitors)
   - Aggregation/curation (definitive list)
2. **Pillar architecture** — 3–5 pillar topics × 5–10 supporting pages each.
3. **Cadence & format mix**:
   - Long-form (≥2000 words) = SEO + authority
   - Short-form (Twitter/LinkedIn) = distribution
   - Video/podcast = trust + repurposable
4. **Distribution loop per piece** — every long-form spawns 5 short-form.
5. **Compounding metrics** — track organic traffic, branded search, backlinks earned.

## Output
Write `docs/inception/content-moat-<project>.md`:

```markdown
# Content Moat Plan — <project>
**Date:** <YYYY-MM-DD>

## Moat type (chosen)
- ✓ Proprietary data: <our usage stats / customer benchmarks>
- ✓ Unique POV: <founder's 10-year contrarian view>
- ✗ Original research: not yet
- ✓ Deep how-to: <area>
- ✗ Aggregation: not differentiated

## Pillars (3–5)
| Pillar | Supporting pages | Moat type |
|---|--:|---|
| <topic A> | 8 | proprietary data |
| <topic B> | 6 | deep how-to + POV |
| <topic C> | 5 | benchmarks |

## 90-day content slate
| Wk | Format | Title | Pillar | Moat-type | Distribution |
|---|---|---|---|---|---|
| 1 | long | <X> benchmark report 2026 | A | data | + 5 tweet thread |
| 2 | long | how to <Y> in production | B | how-to | + LinkedIn carousel |
| ... | ... | ... | ... | ... | ... |

## Distribution loop
Each long-form → 5 derivatives:
- Tweet thread
- LinkedIn post
- Newsletter blurb
- Podcast talking point
- Conference-talk slide

## Compounding metrics (90-day baseline)
- Organic traffic: <X> sessions/mo target
- Branded search: <Y>/mo
- Backlinks: <Z> from DR ≥30
- Newsletter sub conversion: <W>%

## Anti-pattern check
- ✗ Generic listicles ("10 tips for X")
- ✗ AI-spun thin content
- ✗ Keyword-stuffed pages with no POV
- ✗ Posting without distribution plan

## Verdict
**MOAT-PLAUSIBLE (≥1 strong moat type, 3+ pillars) / GENERIC (kill or refocus)**
```

## Verification
- Each pillar mapped to ≥1 moat type.
- 90-day slate has format + distribution per piece.
- Anti-pattern checklist explicit.
- Compounding metrics quantified.
