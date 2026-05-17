---
name: gtm-motion-pick
description: Pick GTM motion — PLG / inbound-marketing / outbound-sales / channel-partner / community-led. Outputs to `docs/inception/gtm-motion-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "GTM motion", "go-to-market", "/gtm-motion-pick", or before sales hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /gtm-motion-pick — GTM Motion Decision

## Why you'd care

Hiring an enterprise AE for a PLG product (or running PLG for a deal that needs a sales motion) burns the first year of go-to-market spend on the wrong machine. Pick the motion before the first GTM hire, not after.

Invoke as `/gtm-motion-pick`. Motion follows ACV. <$1k = self-serve. >$25k = sales-led. Mismatch kills.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pricing-<project>.md` + `buyer-persona-<project>.md`.

## Inputs
- ACV (annual contract value).
- Buyer persona (IC / manager / VP / C-suite).
- Sales cycle (days).
- Founder skill (sales? marketing? product?).

## Process
1. **ACV → motion fit matrix**:

| ACV | Motion | Sales cycle | Touch level |
|---|---|---|---|
| <$100/yr | Pure PLG | minutes | self-serve |
| $100–$1k | PLG + light inbound | hours-days | low-touch |
| $1k–$10k | PLG + inbound nurture | weeks | mid-touch |
| $10k–$50k | Inbound + inside sales | 1–3 mo | high-touch |
| $50k–$250k | Outbound + AE + SE | 3–9 mo | very high |
| >$250k | Enterprise + field sales | 6–18 mo | extreme |

2. **Persona → motion fit**:
   - IC (developer, designer) → PLG
   - Manager → PLG + champion-led
   - VP → outbound + champion-led
   - C-suite → enterprise outbound

3. **Founder fit** — solo founder:
   - Sales-led if extrovert + B2B network
   - PLG if technical + can build self-serve
   - Mismatch = hire complement or pivot

4. **Hybrid motions** (common):
   - PLG-then-sales (Slack, Notion model)
   - Marketing-led + inside sales (HubSpot model)
   - Channel + direct (enterprise SaaS)

5. **Mistake patterns**:
   - $50k ACV with PLG = prospects can't buy without procurement
   - $20/mo ACV with sales rep = unit economics broken
   - Outbound with no SDR/AE = founder bottlenecked

## Output
Write `docs/inception/gtm-motion-<project>.md`:

```markdown
# GTM Motion — <project>
**Date:** <YYYY-MM-DD> | **ACV:** $<X> | **Persona:** <X>

## Chosen motion
**<PLG / Inbound / Outbound / Hybrid X+Y / Channel / Community-led>**

## Rationale
- ACV $<X> → motion = <Y>
- Persona <Z> → buys via <channel>
- Sales cycle: <N days>
- Founder fit: <how>

## Operating model
### Pre-launch (0–6mo)
- Channels: <list per `/channel-fit-matrix`>
- Founder time: <% on sales vs product>
- First hires: <SDR / DevRel / no-hire>

### Scale (6–18mo)
- Trigger to hire AE: ≥$X MRR consistent
- Trigger to hire SDR: ≥3 inbound qualified/wk
- Trigger to hire DevRel: ≥1k DAU community

## Anti-pattern check
- ✗ ACV-motion mismatch?
- ✗ Founder skill mismatch?
- ✗ Channel mix realistic given budget?

## Hybrid handoff (if hybrid)
- PLG signup → sales touch trigger: <event>
- Sales-qualified threshold: <criteria>
- Pricing visible self-serve up to: $<X>; above = sales call

## CAC target
- Per chosen motion: <$X target>
- LTV/CAC ≥3 required
- Payback months ≤<Y>

## Verdict
**MOTION-FIT (clear PMF/ACV/persona alignment) / RISKY (mismatch flag) / UNCERTAIN (need ACV evidence first)**
```

## Verification
- ACV → motion mapped per matrix.
- Persona → motion mapped.
- Founder fit assessed honestly.
- Hire triggers quantified.
- Anti-pattern check applied.
