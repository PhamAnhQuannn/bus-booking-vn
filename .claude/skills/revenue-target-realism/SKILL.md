---
name: revenue-target-realism
description: Stress-test revenue projections vs SOM, channel capacity, sales cycle. Outputs to `docs/inception/rev-realism-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "revenue target", "is this projection realistic", "/revenue-target-realism", or before plan commit.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /revenue-target-realism — Revenue Sanity Check

Invoke as `/revenue-target-realism`. 95% of plans wildly optimistic. Test against capacity.

## Why you'd care

Hockey-stick projections that ignore SOM, channel capacity, and sales-cycle length are how founders end up missing plan in Q2 and explaining it in the board meeting. A stress test now beats an explanation later.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/market-<project>.md` + `unit-economics-<project>.md` + `gtm-motion-<project>.md`.

## Inputs
- Y1 / Y2 / Y3 revenue plan.
- SOM (per market-sizing).
- Channel mix + sales cycle.
- Founder/team capacity.

## Process
1. **Bottom-up rebuild** — start fresh, don't read plan:
   - Channel capacity: realistic monthly leads per channel
   - Conversion %: industry benchmarks (cold outbound 1–3%, inbound 5–15%, PLG 1–5%)
   - Sales cycle: weeks/months from lead to paid
   - Logo retention + expansion
2. **Compare bottom-up vs plan** — if plan >2x bottom-up, plan is fantasy.
3. **SOM ceiling check** — Y3 revenue / SOM = market share. >5% in 3 yr = unrealistic for early-stage.
4. **Capacity bottlenecks**:
   - Sales: each AE closes ~$1M/yr — how many AEs by when?
   - Onboarding: each CSM serves ~$2M ARR — capacity?
   - Founder: hours/week on sales until first hire?
5. **Comparable company benchmark** — find 3 SaaS at similar stage; their revenue trajectory.
6. **Realistic re-projection** — what would defensible plan look like?

## Output
Write `docs/inception/rev-realism-<project>.md`:

```markdown
# Revenue Target Realism — <project>
**Date:** <YYYY-MM-DD>

## Plan revenue (per pro-forma)
| Year | ARR target | New logos | ACV |
|---|--:|--:|--:|
| Y1 | $1M | 200 | $5k |
| Y2 | $5M | 800 | $6.25k |
| Y3 | $15M | 2400 | $6.25k |

## Bottom-up rebuild (independent)
| Channel | Monthly leads | Conv % | Cycle (mo) | Monthly closes | Annual |
|---|--:|--:|--:|--:|--:|
| SEO | 200 | 3% | 1 | 6 | 72 |
| Outbound (1 SDR) | 400 | 2% | 2 | 8 | 96 |
| Referral | 30 | 20% | 0.5 | 6 | 72 |
| **Total Y1** | | | | | **240 logos** |

@ ACV $5k = **Y1 ARR $1.2M** ← matches plan ✓

## SOM share check
- SOM (per market-sizing): $200M
- Y3 plan: $15M = 7.5% market share
- Verdict: aggressive but plausible if no large competitor moves; **moderate risk**

## Capacity bottlenecks
| Constraint | Capacity | Y1 plan | Y2 plan | Bottleneck? |
|---|---|---|---|---|
| AE quota ($1M/yr) | 1 AE | $1M ✓ | $5M needs 5 AE | Yes Y2 — must hire |
| CSM ($2M/CSM) | 0 (founder) | OK | needs 2.5 CSM | Yes Y2 |
| Onboarding hr | founder 20hr | 200 logos × 1hr | 800 logos × 1hr = unworkable | Yes Y2 |

## Comparable benchmarks
| Company | Y1 ARR | Y2 ARR | Y3 ARR | Source |
|---|--:|--:|--:|---|
| Webflow | $1M | $4M | $11M | public S-1 |
| Notion (SMB) | $0.5M | $3M | $10M | reported |
| Plan target | $1M | $5M | $15M | — |
- → Plan is **upper-quartile** vs comparables. Achievable but requires near-flawless execution.

## Realistic re-projection
- Conservative (50% of plan): Y1 $0.6M, Y2 $2.5M, Y3 $8M
- Plan (50/50 odds)
- Stretch (75% odds of missing): keep as upside

## Verdict
**REALISTIC / STRETCH-BUT-DEFENSIBLE / FANTASY**
- Realistic: bottom-up matches plan ±25%
- Stretch: plan = top quartile of comparables
- Fantasy: bottom-up < 50% of plan, or SOM share >10%

## Action if FANTASY
1. Cut Y2/Y3 to 60% of plan
2. Identify 3 channels that would break the bottleneck
3. Re-test in 90 days with actual data
```

## Verification
- Bottom-up rebuilt independently, channel by channel.
- SOM share check explicit.
- Capacity bottlenecks per role.
- ≥3 comparable companies cited.
- Realistic re-projection offered if plan = stretch/fantasy.
