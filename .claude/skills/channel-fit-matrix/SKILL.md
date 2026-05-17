---
name: channel-fit-matrix
description: Score 19 acquisition channels (Bullseye Framework) for fit, cost, scale, and time-to-signal. Outputs to `docs/inception/channels-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "channels", "acquisition", "Bullseye", "/channel-fit-matrix", or before GTM build.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /channel-fit-matrix — Bullseye Channels

## Why you'd care

Founders default to the two channels they already know and miss the one that would actually work for this product. Scoring all 19 forces you to test outside your habit before you sink three months of GTM spend into the wrong place.

Invoke as `/channel-fit-matrix`. Traction (Weinberg/Mares) — pick 1 inner, 2 promising.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md` if exists.

## Inputs
- Product + ICP.
- Budget + time available.
- Founder's existing audience/network.

## Process
1. **Score 19 channels** — fit (0–10) × cost (low/med/high) × time-to-signal (days/wks/mos):
   - Targeting blogs, Publicity (PR), Unconventional PR, SEM, Social/display ads, Offline ads
   - SEO, Content marketing, Email marketing, Engineering as marketing
   - Viral marketing, Business development, Sales, Affiliate programs
   - Existing platforms, Trade shows, Offline events, Speaking engagements, Community building
2. **Outer ring** — all plausible channels.
3. **Middle ring** — 3–5 worth cheap test ($100–$500 each).
4. **Inner ring** — 1 channel after test data confirms fit.
5. **Test design per middle-ring** — falsifiable: "spend $X, expect Y signups in Z days".

## Output
Write `docs/inception/channels-<project>.md`:

```markdown
# Channel Fit Matrix — <project>
**Date:** <YYYY-MM-DD>

## Channel scoring (19)
| Channel | Fit 0–10 | Cost | Time-signal | Ring |
|---|--:|---|---|---|
| SEO | 8 | low | 3–6 mo | middle |
| Content marketing | 7 | med | 3–6 mo | middle |
| SEM (Google Ads) | 6 | high | days | middle |
| Cold outreach (sales) | 9 | low | days | inner |
| Community building | 5 | med | mo | outer |
| ... | ... | ... | ... | ... |

## Inner ring (1 channel)
**<channel>** — rationale, current evidence

## Middle ring tests (3–5)
| Channel | Test | Spend | Hypothesis | Decide-by |
|---|---|---|---|---|
| SEO | publish 5 keyword-targeted posts | $0 (time) | rank top 20 by D60 | D90 |
| SEM | $300 ad spend, 3 ad sets | $300 | ≥1% CTR, ≥3% conv | D14 |

## Outer ring (parked)
List + 1-line why parked

## Verdict
**INNER-CONFIRMED / TESTING / PRE-TEST**
```

## Verification
- All 19 channels scored.
- ≥3 middle-ring tests with falsifiable hypothesis.
- Inner ring chosen only after test data (or marked "PRE-TEST").
- Founder's existing-network channels weighted higher.
