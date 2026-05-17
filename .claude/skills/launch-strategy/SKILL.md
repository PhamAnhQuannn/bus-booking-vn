---
name: launch-strategy
description: Pick launch type — soft / hard / waitlist drip / Product Hunt / Hacker News / press embargo. Outputs to `docs/inception/launch-strategy-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "launch type", "launch strategy", "/launch-strategy", or 30 days pre-launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /launch-strategy — Launch Type Decision

## Why you'd care

Choosing the wrong launch type (hard launch when you needed a waitlist drip, or vice versa) burns the one-shot attention window forever. The strategy doc forces the pick before the comms calendar locks.

Invoke as `/launch-strategy`. Wrong launch type = wasted shot. Match type to product class + audience size.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/distro-advantage-<project>.md` + `waitlist-<project>.md` if exist.

## Inputs
- Product class.
- Audience size (waitlist + founder reach).
- Press / analyst relationships.
- Product readiness (rough vs polished).

## Process
1. **Match type to context**:
   - **Soft launch** (no announcement, friends only) — pre-PMF, want quiet feedback
   - **Hard public** (PH + HN + press one day) — polished, broad consumer/SMB
   - **Waitlist drip** (release in cohorts) — capacity-constrained or ops-heavy
   - **Product Hunt only** — niche tech / dev audience
   - **Hacker News only** — dev-tools, infra
   - **Press embargo** (TechCrunch / Verge etc.) — well-funded or unique angle
   - **Industry conference** (B2B vertical) — enterprise narrow audience
   - **Stealth → big bang** (≥6mo silent then everywhere) — well-funded or category-creating
2. **Cost per type**:
   - Soft: $0
   - Hard public: time + assets + PR
   - Waitlist drip: ops bandwidth
   - Press embargo: PR retainer ($5k–$15k/mo)
   - Big bang: large marketing budget
3. **Risk per type**:
   - Hard public: damp squib if not enough audience
   - Press embargo: if press kills story, bigger damage
   - Big bang: huge sunk cost
4. **Decision criteria** — class × audience × readiness:

| Class | Audience <500 | 500–5000 | 5000+ |
|---|---|---|---|
| S | Soft / IH | PH + soft | Hard public |
| M | Soft + waitlist | Waitlist drip | Hard public |
| L | Design partner | Press embargo | Press + conf |
| XL | Conf + ABM | Press + conf | Big bang |

5. **Anti-pattern**: hard public launch with <100 waitlist = embarrassing flop.

## Output
Write `docs/inception/launch-strategy-<project>.md`:

```markdown
# Launch Strategy — <project>
**Date:** <YYYY-MM-DD> | **Class:** <X> | **Audience:** <N>

## Chosen launch type
**<Soft / Hard / Waitlist drip / PH / HN / Press / Conference / Big bang>**

## Rationale
- Class: <X>
- Audience: <N> qualified
- Readiness: <rough/polished>
- Founder edge: <distribution>

## Key dates
- Soft beta: <date>
- Pre-launch nurture: <date range>
- Launch day: <date>
- Post-launch retrospective: <date>

## Asset checklist (per type)
### If Hard public:
- Landing page polished
- PH assets (logo, GIF, hero, tagline)
- HN Show HN draft
- Press release (if embargo)
- Social media kit (Twitter, LinkedIn, IG)
- Demo video ≤90s

### If Waitlist drip:
- Cohort schedule (week 1 = top 10%, etc.)
- Nurture emails per cohort
- Capacity gating logic

## Success criteria
- Signups: <X>
- Activation: <Y>%
- Paid conversion: <Z>%
- Press mentions: <N>
- Top-of-PH/HN: <yes/no/aspirational>

## Failure scenario plan
- If <50% of signup target → <pivot to>
- If site crashes → <plan>
- If press kills story → <fallback>

## Anti-pattern check
- ✗ Hard public with <100 waitlist
- ✗ Press embargo without unique angle
- ✗ Big bang without budget
```

## Verification
- Launch type matches class × audience × readiness matrix.
- Asset checklist specific to chosen type.
- Failure scenario explicit.
- Anti-pattern check applied.
