---
name: crowdfund-feasibility
description: Test whether crowdfunding (Kickstarter / Indiegogo / RegCF equity / RegA+) fits the product, audience, and timeline. Outputs to `docs/inception/crowdfund-feasibility-<project>.md`. Use when user says "Kickstarter", "Indiegogo", "RegCF", "equity crowdfund", "Wefunder", "/crowdfund-feasibility", or before launching a campaign.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /crowdfund-feasibility — Most Crowdfunds Fail. Decide Before Burning A Year.

## Why you'd care

The median Kickstarter project raises $0 because the founder assumed the platform would supply the audience — and the campaign goes live to an email list of 40 friends and family. Pre-launch list size, not product quality, is the single strongest predictor of Day-1 conversion; modeling that honestly before you commit to a fulfillment timeline is what separates a funded launch from a public failure that haunts the company narrative for a year.

Top-decile reward campaigns raise $250k+. Median raises $0 — they fall apart before launch. Run the feasibility before the campaign.

## Pre-flight
Run after `/bootstrap-vs-vc-decision`. Pairs with `/waitlist-strategy`, `/launch-channel-plan`.

## Inputs
- Product type (hardware, software, game, creative, cause).
- Audience size + reachability today (email list + social).
- Pre-existing community evidence.
- Manufacturing / fulfillment readiness (for physical goods).

## Process
1. **Pick platform candidate:**
   - **Kickstarter** — rewards-based, hardware/creative bias, 5% fee
   - **Indiegogo** — rewards + flexible funding, hardware bias
   - **Wefunder / Republic / StartEngine** — RegCF equity, $5M cap
   - **SeedInvest** — equity, accredited + RegCF, higher curation
   - **GoFundMe** — donation, not investment
2. **Product-fit test:**
   - Tangible / visual → reward platforms strong
   - SaaS / service → equity crowdfund only (rewards rarely work)
   - Cause / community → donation or equity
3. **Audience-reachability test** — top campaigns convert 5-30% of an existing list on Day 1.
   - Need list of (target raise / avg pledge / 0.10 conversion) to hit 30% in 48hrs
   - $50k target ÷ $50 pledge ÷ 0.10 = 10,000-person list needed
4. **Pre-launch community evidence:**
   - Waitlist of 500+ "tell me when you launch" emails
   - Subreddit / Discord with 200+ active members
   - 5+ creator collabs lined up
5. **Manufacturing + fulfillment readiness** (hardware):
   - Tooling-ready prototype (not concept)
   - Manufacturer quote + lead time + MOQ
   - Fulfillment partner (Easyship / ShipBob / direct)
   - Customs + import math (don't get blindsided by VAT/duty)
6. **Legal + compliance:**
   - Trademark search on name
   - Patent-pending if novel
   - RegCF: Form C filing, audited financials if > $1.07M raise
   - RegA+: $75M cap but $50k+ legal cost
7. **Campaign math:**
   - Pre-launch list × conversion → Day 1 raise
   - Day 1 raise / total target ≥ 30% → likely to succeed
   - Platform fee + payment processing fee (~8-10% combined)
   - Rewards fulfillment cost (avg 20-40% of pledge)
8. **Go / no-go.**

## Output
Write `docs/inception/crowdfund-feasibility-<project>.md`:

```markdown
# Crowdfund Feasibility — <project>
**Date:** <YYYY-MM-DD>
**Product:** <e.g., hardware peripheral / SaaS / book>
**Target raise:** $<X>
**Platform candidate:** <Kickstarter / Wefunder / etc>

## Product-fit check
- Type: hardware (tangible)
- Visual: yes, can demo on video
- ✓ Reward platform fit
- ✗ Equity platform overkill for $50k

## Audience reachability
| Metric | Current | Needed | Gap |
|--------|---------|--------|-----|
| Email list | 1,200 | 10,000 | 8,800 |
| Twitter followers | 800 | 5,000 | 4,200 |
| Subreddit subscribers | 0 | 500 | 500 |
| YouTube subs | 50 | 2,000 | 1,950 |

→ List is **8.3× too small** for $50k Day 1 momentum
→ Pre-launch growth needed: 6-9 months

## Day 1 math
- 1,200 list × 5% conv × $50 pledge = $3,000 (target $15k for Day 1)
- ❌ Will not hit 30%-of-goal on Day 1
- Probability of campaign success at current list: ~20%

## Pre-launch community evidence
| Signal | Status |
|--------|--------|
| Waitlist 500+ | ❌ at 1,200 email but not waitlist (cold list) |
| Subreddit / Discord 200+ active | ❌ none |
| Creator collabs | ❌ 0 lined up |
| Press warm intros | ❌ 0 |

→ Community signal too weak

## Manufacturing + fulfillment (hardware path)
| Check | Status |
|-------|--------|
| Tooling-ready prototype | ❌ still 3D-printed |
| Manufacturer quote | ⚠ verbal only, no LOI |
| MOQ + lead time | unknown |
| Fulfillment partner | none |
| Import / customs math | not done |

## Legal + compliance
| Check | Status |
|-------|--------|
| Trademark cleared | ❌ not searched |
| Patent-pending | n/a |
| Form C / audited financials | n/a (rewards path) |
| ToS / refund policy | ❌ not drafted |

## Campaign cost math (assume $50k raise, hardware)
| Item | $ |
|------|---|
| Platform fee (5%) | $2,500 |
| Stripe (3%) | $1,500 |
| Reward production (35%) | $17,500 |
| Shipping & fulfillment (15%) | $7,500 |
| Marketing pre-launch | $5,000 |
| Video production | $3,000 |
| **Total cost** | **$37,000** |
| **Net to project** | **$13,000** |

→ Net is 26% of gross — match expectation

## Decision
**Go / No-go: NO-GO at current state**

**Why:**
- List 8× too small
- No community evidence
- Manufacturing unready
- Net $13k is too thin for 6-month effort

**Reversal conditions (6-month plan):**
1. Build email list to 8,000+ via SEO + creator collabs
2. Launch Discord, hit 500 active members
3. Lock manufacturer LOI with MOQ + price
4. Run trademark search + file intent-to-use
5. Re-run this feasibility at month 6

## Pitfalls flagged
- [ ] List size vs target raise reality-checked
- [ ] Day 1 momentum math computed
- [ ] Manufacturing + fulfillment honestly assessed
- [ ] Net-to-project (after all fees) computed
- [ ] No-go criteria explicit
- [ ] Community signal independent of email list

## Next
- If go: pre-launch list → `/waitlist-strategy`
- If no-go: revisit funding → `/bootstrap-vs-vc-decision`
- If go: launch channels → `/launch-channel-plan`
```

## Verification
- Platform candidate picked with reason.
- Product-fit + audience-reachability tests done.
- Day 1 momentum math computed.
- Manufacturing + fulfillment readiness audited (if physical).
- Net-to-project after all fees calculated.
- Explicit go / no-go decision with reversal conditions.
