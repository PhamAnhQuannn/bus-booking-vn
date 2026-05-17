---
name: betalist-ph-pre-launch
description: Pre-launch on BetaList / Product Hunt Coming Soon / Indie Hackers to gather waitlist signal from maker communities. Outputs to `docs/inception/betalist-ph-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "betalist", "product hunt coming soon", "PH launch prep", "/betalist-ph-pre-launch".
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /betalist-ph-pre-launch — Maker-Community Pre-Launch

## Why you'd care

A cold Product Hunt launch with zero signal pre-built lands at #14 and dies by lunch. Pre-seeding via BetaList + PH Coming Soon + Indie Hackers buys you the early-adopter waitlist that makes launch day actually rank.

Invoke as `/betalist-ph-pre-launch`. Cheap waitlist + early-adopter pool.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/landing-test-<project>.md` or `solution-mockup-<project>.md` — need visual.

## Inputs
- Tagline (≤60 char).
- Description (≤200 char).
- Hero image / mockup screenshot.
- Landing URL with email capture.
- Maker bio + Twitter/X handle.

## Process
1. **Pick channels** (rec: all 3 maker channels):
   - BetaList (paid expedited or free 4-6 wk wait)
   - Product Hunt → Coming Soon page
   - Indie Hackers → product page + post
   - (Optional: HN Show, Hacker Noon, Launching Next)
2. **Asset prep** — tagline / description / 3 screenshots / 30s demo video / maker headshot.
3. **Submit** — match each channel's required format exactly.
4. **Community engagement** — comment on 10 other launches before/during yours (reciprocity).
5. **Drive traffic** — own social, mailing list, niche subreddits.
6. **Capture metrics** — visits / upvotes / followers / waitlist signups per channel.
7. **Convert** — email waitlist within 48h with concrete next step.

## Output
Write `docs/inception/betalist-ph-<project>.md`:

```markdown
# BetaList / PH Pre-Launch — <project>
**Date:** <YYYY-MM-DD> | **Channels:** <list>

## Assets
- Tagline: <text>
- Desc: <text>
- Hero: <link>
- Demo video: <link>

## Submissions
| Channel | Submitted | Live date | URL |
|---|---|---|---|
| BetaList | YYYY-MM-DD | YYYY-MM-DD | <link> |
| PH Coming Soon | YYYY-MM-DD | YYYY-MM-DD | <link> |
| Indie Hackers | YYYY-MM-DD | YYYY-MM-DD | <link> |

## Results (per channel)
| Channel | Visits | Upvotes | Followers | Signups | Conv % |
|---|--:|--:|--:|--:|--:|
| BetaList | 800 | — | — | 60 | 7.5% |
| PH Coming Soon | 1200 | 230 | 180 | 90 | 7.5% |
| IH | 400 | 30 | 20 | 25 | 6.3% |

## Top-of-funnel signal
- Total signups: N
- "Replied to follow-up": N
- "Asked for early access ASAP": N
- "Would pay $X": N (verbatim quotes)

## Verdict
**SIGNAL-STRONG / WEAK / NO-SIGNAL**

## Next
- STRONG → /pre-sale-test or build → schedule full PH launch in 4-8 wk
- WEAK → revise tagline + image + retry one channel
- NO-SIGNAL → /idea-kill-list (community indifferent)
```

## Verification
- ≥2 channels submitted (single = noise).
- Conversion % per channel (aggregate hides bad channel).
- Follow-up reply rate logged (signup ≠ intent).
- Did not buy upvotes (trash signal).
