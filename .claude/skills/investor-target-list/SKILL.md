---
name: investor-target-list
description: Investor target list — 100-200 ranked names matched to stage, sector, check size. Outputs to `docs/inception/investor-target-list-<project>.md`. Use when user says "investor list", "target investors", "who to pitch", "/investor-target-list", or pre-raise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /investor-target-list — Spray-And-Pray Is How You Burn 6 Months

## Why you'd care

Pitching the wrong investors (wrong stage, wrong sector, wrong check size) wastes the warm intros you can't get back. A ranked target list focuses the introductions where they actually convert.

Raise = bake list before first email. 100-200 names = enough top-of-funnel for 2-4% close rate.

## Pre-flight
Run after `/sequoia-deck-skeleton`, `/runway-model`. Pairs with `/warm-intro-map`, `/investor-crm-setup`.

## Inputs
- Stage (pre-seed / seed / Series A).
- Sector tags.
- Check size needed (lead vs follow).
- Geography.

## Process
1. **Sourcing:** Crunchbase, Signal NFX, OpenVC, Harmonic, AngelList, portfolio pages of 5 closest peers.
2. **Filter ruthlessly:** stage match, sector match, check size match, recent activity (<6 mo).
3. **Tiering:**
   - Tier 1 — perfect fit (sector + stage + lead): 20-30 names
   - Tier 2 — strong fit (sector OR strong stage): 50-80
   - Tier 3 — long-tail / opportunistic: 50-100
4. **Lead vs follow split** — at least 10 leads in Tier 1.
5. **Anti-portfolio check** — strike any with competing portfolio co.
6. **Warm path scout** — flag if mutual connections exist (LinkedIn).
7. **Personalize hook** — 1 sentence why each investor specifically.

## Output
Write `docs/inception/investor-target-list-<project>.md`:

```markdown
# Investor Target List — <project>
**Stage:** seed
**Round:** $1.5M @ $12M cap
**Target list size:** 150 (T1: 25, T2: 60, T3: 65)

## Sourcing channels used
- Crunchbase (filter: seed + sector + last check <6mo)
- Signal NFX
- OpenVC
- Harmonic
- Portfolio pages: <competitor A>, <peer B>, <peer C>
- AngelList syndicates
- YC alumni list (if applicable)

## Tiering rules
| Tier | Definition | Count |
|------|-----------|-------|
| T1 | Sector + stage + leads our check | 25 |
| T2 | Sector OR stage strong | 60 |
| T3 | Opportunistic / generalist / scout | 65 |

## Lead vs follow target
- Need 1 lead → at least 10 T1 leads in pipeline
- Followers: 30+ committed check writers

## Tier 1 — Perfect fit (sample row)
| Firm | Partner | Stage | Sector | Check | Lead? | Warm path | Hook |
|------|---------|-------|--------|-------|-------|----------|------|
| Acme Ventures | Jane Smith | seed | SMB SaaS | $500k-$2M | Yes | via Bob @ portfolio co | Led Round X — same playbook |
| BetaCap | John Doe | seed | ecommerce ops | $250k-$1M | Yes | LinkedIn 2nd-deg via Mary | Just wrote on returns thesis |

## Tier 2 — Strong fit (sample)
| Firm | Partner | Notes |
|------|---------|-------|
| Charlie Capital | A Lee | seed generalist, 3 SMB SaaS in portfolio |

## Tier 3 — Long-tail (sample)
| Firm | Partner | Notes |
|------|---------|-------|
| Scout fund X | individual scout | $25-50k checks, fast move |

## Anti-portfolio (DO NOT contact)
| Firm | Why | Conflicting portfolio co |
|------|-----|--------------------------|
| Foo Fund | Invested in <competitor> | Loop |
| Bar VC | Invested in <competitor> | AfterShip |

## Per-investor personalization hook
Every Tier 1 row gets:
- 1 sentence: why this fund specifically
- 1 mutual reference (warm path if known)
- 1 relevant portfolio company to mention

Generic blast → ignored. Personalized → 60%+ response.

## Sourcing-to-pipeline conversion (plan)
- 150 sourced → 90 intros requested (60%) → 60 meetings (70%) → 4-6 term sheets → 1-2 closes
- Plan for 100+ rejection. Normal.

## Outreach sequencing
1. Week 1 — fire T1 (25)
2. Week 2 — track replies, fire T2 wave 1 (30)
3. Week 3 — T2 wave 2 (30)
4. Week 4 — T3 long-tail (50)
5. Week 5-6 — close hot, ignore cold

## Pitfalls flagged
- [ ] Tier 1 ≥ 20 leads
- [ ] Anti-portfolio strikes done
- [ ] Personalization hook per T1
- [ ] Warm paths mapped for T1+T2
- [ ] No firm appears twice
- [ ] Recent check <6 mo verified

## Anti-patterns
- ❌ Mass-email 500 generic names
- ❌ No anti-portfolio check (waste meeting + tip competitor)
- ❌ All followers, no leads
- ❌ Targeting Series A funds at seed
- ❌ Ignoring scout funds (fast money, intros to partners)

## Next
- Warm intro map → `/warm-intro-map`
- CRM setup → `/investor-crm-setup`
- Deck → `/sequoia-deck-skeleton`
- Update cadence → `/investor-update-cadence`
```

## Verification
- 100-200 names tiered.
- T1 ≥ 20 with leads.
- Anti-portfolio scrubbed.
- Warm paths flagged.
- Personalization hook per T1.
- Outreach sequenced by week.
