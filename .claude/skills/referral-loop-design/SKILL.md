---
name: referral-loop-design
description: Design viral/referral loop — k-factor, cycle time, incentive. Outputs to `docs/inception/referral-loop-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "viral", "referral", "k-factor", "/referral-loop-design", or for product-led growth.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /referral-loop-design — Viral Loop

Invoke as `/referral-loop-design`. k>1 = viral. k 0.3–0.7 = amplifier (not viral).

## Why you'd care

A K-factor below 1.0 isn't a referral loop — it's a leak in disguise. Modeling the cycle time and incentive before launch is what separates real virality from a feature nobody uses.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- Product type (multi-player? single-player?).
- Natural sharing moments in workflow.
- Competitor referral programs.

## Process
1. **Loop type pick** (one or more):
   - **Word-of-mouth organic** (Slack, Notion, Figma) — sharing built into product use
   - **Incentivized referral** (Dropbox, PayPal) — give-X-get-X
   - **Content viral** (Loom, Calendly) — recipient sees branded artifact
   - **Network-effect viral** (multi-sided marketplace) — invite to transact
   - **Brag-worthy artifact** (Strava, Wordle) — output begs to share
2. **Loop math**:
   - Invitations per user (i)
   - Conversion of invite (c)
   - **k = i × c**
   - Cycle time (T) — invite to activated invitee
   - Daily growth ≈ k^(1/T)
3. **Incentive design** (if incentivized):
   - Reward for sender + recipient (two-sided beats one-sided)
   - Trigger: aha-moment, not signup
   - Limit gaming (referral fraud)
4. **Friction removal** — one-click share, prefilled templates, deep links.
5. **Measurement plan** — attribution, viral-sourced cohort vs paid cohort retention.

## Output
Write `docs/inception/referral-loop-<project>.md`:

```markdown
# Referral Loop Design — <project>
**Date:** <YYYY-MM-DD>

## Chosen loop type
**<Word-of-mouth / Incentivized / Content viral / Network / Brag artifact>**

## Loop mechanics
1. User reaches <aha moment>
2. Product surfaces share prompt: "<copy>"
3. User shares via <channel: link/email/SMS>
4. Recipient lands on <page>
5. Recipient activates → loop repeats

## Loop math (target)
| Metric | Target | Measure-by |
|---|--:|---|
| Invites per active user (i) | 3 | event log |
| Invite conversion (c) | 0.15 | UTM + signup |
| **k-factor** | **0.45** | i × c |
| Cycle time (T) | 7 days | invite → activate |
| Implied weekly growth | ~13% | (1+k)^(1/T) |

## Incentive structure (if any)
- Sender: <reward>
- Recipient: <reward>
- Trigger: <aha moment>
- Anti-fraud: <limit>

## Friction-removal design
- ✓ One-click share button at aha moment
- ✓ Prefilled message
- ✓ Deep link to relevant page (not generic landing)
- ✓ No login required to view shared artifact

## 90-day measurement
- Baseline k = ?
- Target k = 0.45
- Test variants: copy A/B, incentive A/B, trigger placement A/B

## Verdict
**VIRAL (k≥1) / AMPLIFIER (0.3–0.7) / NOT-VIRAL (<0.3, just direct CAC)**
```

## Verification
- k-factor math explicit (i × c).
- Cycle time named.
- Sharing trigger = aha moment, not signup.
- Friction-removal checklist applied.
