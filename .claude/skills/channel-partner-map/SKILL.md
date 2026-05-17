---
name: channel-partner-map
description: Map channel/reseller/integration partners for indirect distribution. Outputs to `docs/inception/channel-partners-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "channel partner", "reseller", "integration partner", "/channel-partner-map", or for L+ B2B.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /channel-partner-map — Indirect Distribution

## Why you'd care

The right reseller or integration partner is a 10x multiplier on reach; the wrong one is a year of co-marketing meetings producing zero pipeline. Mapping who has the audience, the budget authority, and the incentive to actually sell you tells you which to chase.

Invoke as `/channel-partner-map`. Right partner = 10x reach. Wrong partner = wasted year.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (premature; direct first)
2. Read `docs/inception/gtm-motion-<project>.md` + `incumbent-moat-<project>.md`.

## Inputs
- Existing partner ecosystems in category (AWS Marketplace, Salesforce AppExchange, MS Partner Network, integrators, MSPs, agencies).
- Product API + integration surface.
- Margin available to share.

## Process
1. **Partner type taxonomy**:
   - **Tech/integration partners** — embed in their product, share customer
   - **Resellers** — they sell, get margin (15–40%)
   - **Referral partners** — they refer, get fee (10–20%)
   - **MSPs / agencies** — they implement + manage for customer
   - **Marketplace platforms** — listing + checkout (AWS, Azure, Salesforce)
   - **Strategic OEM** — your tech inside their product (white-label)
2. **Per partner candidate**:
   - Audience size + ICP overlap
   - Their motivation (margin, completeness of solution, customer retention)
   - Effort to enable (integration build, training, co-sell motion)
   - Conflict risk (competes with their products?)
3. **Marketplace strategy** — list when:
   - Customers procure through that cloud
   - Procurement friction reduction = real value
   - Marketplace fee (3–5%) ≤ alternative CAC
4. **Partner enablement requirements**:
   - Sales collateral (deck, demo)
   - Technical training (cert?)
   - Co-marketing (webinar, case study)
   - Deal registration system
5. **Anti-patterns** — partner program before product readiness, too many partners, no margin to share.

## Output
Write `docs/inception/channel-partners-<project>.md`:

```markdown
# Channel Partner Map — <project>
**Date:** <YYYY-MM-DD>

## Partner type strategy
| Type | Use? | Rationale | Priority |
|---|:--:|---|:--:|
| Tech/integration | ✓ | embed in 3 incumbent platforms | 1 |
| Resellers | ✗ | premature; need direct PMF first | — |
| Referral | ✓ | low-cost amplifier via consultants | 2 |
| MSP/agency | ✓ | enterprise implementation | 3 |
| Marketplace | ✓ | AWS/Azure for procurement-led buyers | 1 |
| OEM | ✗ | strategic, year 3+ | — |

## Tier-1 partner targets
| Partner | Type | Audience | ICP overlap | Effort | Conflict | Status |
|---|---|--:|--:|---|---|---|
| Salesforce AppExchange | marketplace | 150k orgs | 40% | 6mo cert | low | scoping |
| AWS Marketplace | marketplace | huge | 50% | 2mo | low | listing |
| <agency X> | MSP | 50 enterprises | 70% | 1mo | none | LOI |
| <SaaS Y> | tech integration | 10k orgs | 60% | 3mo build | medium | partner mgr eval |

## Per-partner enablement plan
### Salesforce AppExchange
- Cert: ISV cert (6mo path)
- Build: managed package
- Margin: 15% to SF
- Co-marketing: 2 webinars yr 1

### AWS Marketplace
- Listing: SaaS contract
- Margin: 3% to AWS
- Procurement integration: yes

## Margin economics
| Partner type | Margin to partner | Effective net | Notes |
|---|--:|--:|---|
| Reseller | 25% | 75% | high effort |
| Referral | 15% | 85% | low effort |
| Marketplace | 3–5% | 95% | platform fee |
| MSP | 30% | 70% | implementation included |

## Anti-pattern check
- ✗ Building partner program before $1M ARR
- ✗ More than 3 active partner types simultaneously
- ✗ Margin share that breaks unit economics
- ✗ Partners who compete with you in disguise

## 12-mo plan
- Q1: AWS Marketplace listing live
- Q2: 2 MSP partners signed
- Q3: SF AppExchange cert started
- Q4: 5 referral partners active

## Verdict
**PARTNER-READY (≥$1M ARR + clear targets) / TOO-EARLY (focus direct) / WRONG-MOTION**
```

## Verification
- Partner types triaged use/skip.
- Tier-1 targets named (not abstract).
- Margin economics worked through.
- Anti-pattern check applied.
- 12-mo plan with quarterly milestones.
