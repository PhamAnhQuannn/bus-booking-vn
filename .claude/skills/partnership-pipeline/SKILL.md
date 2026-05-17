---
name: partnership-pipeline
description: Pipeline partnership opportunities — tech integrations, channel resellers, co-marketing, strategic. Outputs to `docs/inception/partnership-pipeline-<project>.md`. Use when user says "partnership", "co-marketing", "tech integration", "channel partner", "/partnership-pipeline", or before committing partnership time.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /partnership-pipeline — 90% Of Partnership Conversations Go Nowhere

Partnerships are seductive (1+1=10 fantasy) and almost always 1+1=1.5 with massive overhead. Pipeline only the ones with a forcing function.

## Why you'd care

Partnerships consume founder time disproportionately to revenue — most go nowhere. A scored pipeline lets you say no to flattering coffee chats and yes to the one integration that actually moves the needle.

## Pre-flight
Run after `/gtm-motion-pick`, `/channel-partner-map`. Pairs with `/integration-roadmap`, `/co-marketing-plan`.

## Inputs
- Customer base data (which other tools they use).
- Top 20 tools mentioned in customer interviews.
- Capacity (who owns partnerships — founder side hustle or dedicated person).
- Goal: leads / integration depth / credibility / GTM amplifier.

## Process
1. **Categories** — pipeline by type, prioritize ruthlessly:
   - **Tech integrations** — API/SDK integration (Zapier, Stripe, Slack, HubSpot)
   - **Channel reseller** — they sell our product to their customers
   - **Co-marketing** — joint webinar / content / event
   - **Strategic** — equity / data / large customer flow
   - **Embedded / OEM** — we power their feature
2. **Scoring rubric** (each partner 1-5):
   - Customer overlap (do my customers want this?)
   - Strategic fit (do our roadmaps align?)
   - Effort to launch (low = good)
   - Revenue impact next 12mo
   - Reputational impact
3. **Drop anything below 15/25** — most partnerships die here, save time.
4. **Forcing function test** — does a customer specifically pay more / churn less if this exists? No forcing function = decoration.
5. **Mutual value statement** — 1 sentence: "<Partner> gets X, we get Y, customer gets Z."
6. **Pilot scope** — 90-day pilot before formal partnership; measure outcome.
7. **Legal lite** — MoU only at first. No MSA / no exclusivity / no rev-share until pilot result.
8. **Kill cadence** — review quarterly. Kill dormant partnerships (no activity 90 days = dead).

## Output
Write `docs/inception/partnership-pipeline-<project>.md`:

```markdown
# Partnership Pipeline — <project>
**Date:** <YYYY-MM-DD>
**Owner:** Founder A (50% of time Q2)
**Goal:** Tech integrations (depth) + 2 co-marketing wins

## Top 20 customer-mentioned tools
(from interviews, paying customer accounts, MRR-weighted)
1. Slack (95% use)
2. Notion (78%)
3. Linear (62%)
4. HubSpot (54%)
5. Salesforce (47%)
6. Zapier (43%)
7. Figma (39%)
8. GitHub (38%)
...

## Categorized + scored (top 10)
| Partner | Type | Cust overlap | Strat fit | Effort | Rev impact | Rep | Total | Verdict |
|---------|------|--------------|-----------|--------|------------|-----|-------|---------|
| Slack | Tech | 5 | 5 | 4 | 5 | 5 | 24 | ⭐ Build now |
| Notion | Tech | 5 | 4 | 3 | 4 | 5 | 21 | ⭐ Build Q2 |
| Linear | Tech | 4 | 5 | 4 | 3 | 4 | 20 | ⭐ Build Q2 |
| Zapier | Tech | 4 | 3 | 5 | 3 | 4 | 19 | ⭐ Build Q2 (table-stakes) |
| HubSpot | Tech + co-mkt | 3 | 4 | 2 | 4 | 4 | 17 | ⭐ Pilot |
| Salesforce | Tech | 3 | 3 | 1 | 4 | 5 | 16 | Pilot Q3 |
| Figma | Co-marketing | 4 | 3 | 4 | 2 | 4 | 17 | Co-webinar |
| GitHub | Tech | 4 | 2 | 3 | 2 | 3 | 14 | ❌ Drop |
| Asana | Tech | 2 | 3 | 4 | 2 | 3 | 14 | ❌ Drop |
| Microsoft Teams | Tech | 2 | 2 | 2 | 3 | 4 | 13 | ❌ Drop |

## Q2 active pipeline (4 partnerships)
| Partner | Mutual value statement | Status | Next step | Owner |
|---------|------------------------|--------|-----------|-------|
| Slack | We add a 5-channel app, they get more sticky users, customer gets in-Slack workflows | Building integration | Submit App Directory | Founder A |
| Notion | We build Notion DB sync, they get our customers, customer gets unified docs | Discovery | Eng spike Q2W3 | Founder B |
| Linear | We sync issues, they get expanded use, customer gets engineering-ops view | LOI signed | Pilot kickoff Q2W4 | Founder A |
| HubSpot | Co-webinar on ops automation; both lists co-promote | Scheduled | June 12 webinar | Founder A |

## Mutual value template (per partnership)
- **<Partner> gets:** <specific outcome>
- **We get:** <specific outcome>
- **Customer gets:** <specific outcome>
- **Forcing function:** <why customer signs up/churns less because of this>

Example — Slack:
- Slack gets: another sticky workflow app → more time in Slack
- We get: distribution in App Directory + integration moat
- Customer gets: standup updates in Slack channels (no context-switch)
- Forcing function: Customer told us "we'd switch to anyone with native Slack standup" (3 interviews)

## 90-day pilot template
- Pilot scope: <specific feature / co-marketing piece>
- Success criteria: <2-3 measurable outcomes>
- Decision date: <90 days from kickoff>
- Owner: <name on each side>
- Continue / pivot / kill at day 90

## Legal lite (Q2 only)
- MoU (1-page) — yes
- MSA — no
- Exclusivity — no
- Rev-share / referral fee — no (until 6 months proven)
- Logo / case-study usage — yes (with approval)

## Anti-patterns
- ❌ Co-founder of dying startup wants "strategic partnership" — no
- ❌ Big company "partner program" with 90-day form-filling — no
- ❌ Partner asks for exclusivity in exchange for "real commitment" — no
- ❌ Partner wants $50k for "co-marketing" — paid marketing, call it that
- ❌ Slack-only partnership ("we'll co-promote!") — no measurable outcome → no

## Kill cadence (quarterly review)
- 90 days no activity → kill
- 6 months no revenue / leads → kill
- Partner side disengaged → kill
- Always replaced with next pipeline candidate

## Pitfalls flagged
- [ ] Partners scored against customer signal (not vibes)
- [ ] Forcing function required for each partner
- [ ] Mutual value statement = 1 sentence each side
- [ ] 90-day pilot with success criteria
- [ ] No legal entanglement before pilot result
- [ ] Quarterly kill cadence on calendar
- [ ] < 5 active partnerships at once (focus)

## Next
- Co-marketing depth → `/co-marketing-plan`
- Integration roadmap → `/integration-roadmap`
- Reseller path → `/reseller-program-design`
```

## Verification
- Top 20 customer-mentioned tools sourced from real data.
- Scoring rubric across 5 dimensions.
- Forcing function required per partnership.
- Mutual value statement template.
- 90-day pilot scope + success criteria.
- Legal-lite stance before pilot.
- Kill cadence quarterly.
