---
name: network-effect-design
description: Design network effects — direct, indirect, two-sided, data, local. Identify which apply and how to seed them. Outputs to `docs/inception/network-effects-<project>.md`. Use when user says "network effects", "flywheel", "two-sided market", "/network-effect-design", or before `/competitive-moat-analysis` for moat assessment.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /network-effect-design — Build A Defensible Flywheel

## Why you'd care

Products that claim network effects but haven't designed them get crushed by the first well-capitalized competitor with no moat. Identifying which effects actually apply and how to seed them is what turns the claim into reality.

A network effect is a moat that grows for free as you grow. Most startups claim them; few have them.

## Pre-flight
None. Pairs with `/competitive-moat-analysis`, `/viral-coefficient-model`.

## Inputs
- Product surface, user actions, who-touches-whom.

## Process
1. **Classify candidates** — which types could apply?
   - **Direct** (telephone): user N+1 makes product more valuable to user N (Slack, WhatsApp).
   - **Indirect** (two-sided): supply-side N+1 makes product more valuable to demand-side (Uber, Airbnb).
   - **Data**: more usage → better predictions → better product (Google, Spotify).
   - **Local / personal**: value scales within a city / team / household (Nextdoor, DoorDash).
   - **Bandwagon / social proof**: more users = more credibility (LinkedIn).
2. **Honest check** — for each candidate, ask: "if user count doubled, does product objectively get better, or does it just feel bigger?" Only "objectively better" counts.
3. **Cold-start strategy** — for each real effect, plan the seed:
   - Direct: pick a dense seed cluster (one team, one school).
   - Two-sided: pick which side to subsidize / over-supply first.
   - Data: how long until data > baseline? Use synthetic data?
   - Local: pick one geography to saturate first.
4. **Tipping point** — at what scale does effect become self-sustaining? Estimate the threshold.
5. **Defensibility decay** — what kills the effect? (multi-homing easy? identity not sticky?)
6. **Anti-network effect check** — does the product get WORSE at scale? (spam, noise, support load). Mitigation plan if so.

## Output
Write `docs/inception/network-effects-<project>.md`:

```markdown
# Network Effects — <project>
**Date:** <YYYY-MM-DD>

## Candidates
| Type | Applies? | Why / why not |
|------|----------|---------------|
| Direct | Y/N | <evidence> |
| Two-sided | Y/N | <evidence> |
| Data | Y/N | <evidence> |
| Local | Y/N | <evidence> |
| Social proof | Y/N | <evidence> |

## Honest test per candidate
For each "Y" above: "If user count doubled tomorrow, the product objectively gets <X> better because <mechanism>." If can't fill blank concretely → re-class as "no".

## Primary effect
**Type:** <name>
**Mechanism:** <one paragraph>
**Why this and not others:** <reasoning>

## Cold-start plan
- Seed cluster: <team / city / vertical / specific 50 users>
- Subsidy (if two-sided): <which side, what subsidy>
- Time to reach seed density: <weeks>
- Cost to seed: $<X>

## Tipping point
- Threshold: <N users / N transactions / N data points>
- ETA at current growth: <X months>
- Burn until tipping: $<X>

## Decay risks
- Multi-homing ease: <high / med / low>
- Switching cost: <see `/switching-cost-design`>
- Disintermediation risk: <high / med / low — does the network bypass you once formed?>

## Anti-network effects
- Spam / noise at scale: <Y/N, mitigation>
- Support load explosion: <Y/N, mitigation>
- Curation cost: <Y/N, mitigation>

## Next
- Cold-start tactics → `/community-building-plan`
- Viral math → `/viral-coefficient-model`
- Lock-in design → `/switching-cost-design`
- Moat full audit → `/competitive-moat-analysis`
```

## Verification
- Each candidate marked Y/N with reason.
- "Honest test" filled with concrete mechanism (not "scale = better").
- Cold-start plan has named seed cluster.
- Tipping-point threshold is a specific number.
- Anti-network risks addressed.
