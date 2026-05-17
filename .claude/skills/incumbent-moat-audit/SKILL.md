---
name: incumbent-moat-audit
description: Audit the moats of incumbents you'd be displacing — switching cost, network, data, brand, regulatory. Outputs to `docs/inception/incumbent-moat-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "incumbent moat", "why won't they kill us", "/incumbent-moat-audit", or after `/competitor-scan`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /incumbent-moat-audit — Threat Mapping

## Why you'd care

Founders consistently underestimate switching costs and over-estimate their own differentiation, then get crushed when the incumbent ships the obvious response. The audit forces the honest answer to 'why won't they just kill us' before commit-to-build.

Invoke as `/incumbent-moat-audit`. Why hasn't incumbent already done this?

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/competitor-scan-<project>.md`.

## Inputs
- Top 3 incumbents from competitor-scan.
- Public data: financials, customer counts, integrations, patents.

## Process
1. **Per incumbent moat scoring** — 0–10:
   - Switching cost (data lock-in, integrations, training)
   - Network effects (more users = more value)
   - Data moat (proprietary dataset)
   - Brand / trust
   - Regulatory / compliance certifications
   - Distribution lock (partnerships, channel exclusives)
   - Cost advantage (scale economies)
2. **"Why don't they do this?" answer** — for each moat:
   - They will → you must outpace before they react
   - They can't (innovator's dilemma) → exploit
   - They won't (segment too small for them) → niche safe
3. **Defensive thesis** — what stops incumbent retaliation when you're at $1M ARR?
4. **Wedge resilience** — does your wedge erode their moat or skirt it?

## Output
Write `docs/inception/incumbent-moat-<project>.md`:

```markdown
# Incumbent Moat Audit — <project>
**Date:** <YYYY-MM-DD>

## Per-incumbent scoring
| Incumbent | Switch | Network | Data | Brand | Regulatory | Distribution | Cost | Total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Salesforce | 9 | 7 | 6 | 9 | 7 | 8 | 6 | 52 |
| HubSpot | 7 | 5 | 5 | 8 | 5 | 6 | 5 | 41 |
| Pipedrive | 5 | 3 | 3 | 6 | 3 | 4 | 4 | 28 |

## "Why haven't they?" per incumbent
**Salesforce**
- They will: probably, in 18mo if we hit $5M ARR
- They can't: innovator's dilemma — would cannibalize $X enterprise revenue
- They won't: segment too small ($X TAM doesn't move needle)

**HubSpot**
- They will: monitoring; could ship in 6mo
- ...

## Defensive thesis
At $1M ARR, our defense:
- <network effect we'll have built>
- <integrations they don't have>
- <data we own that they don't>

At $10M ARR, defense:
- <X>

## Wedge resilience
- Our wedge erodes <moat X> by <Y>
- Our wedge skirts <moat Z> by serving non-buyers

## Verdict
**WEDGE-DEFENSIBLE / VULNERABLE-EARLY / WILL-BE-CRUSHED**
```

## Verification
- ≥3 incumbents scored.
- "Will / can't / won't" answered per incumbent.
- Defense at $1M and $10M both addressed.
- Innovator's-dilemma logic explicit (not hand-wave).
