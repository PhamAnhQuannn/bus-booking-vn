---
name: assumption-register
description: Maintain a living register of every load-bearing assumption — what we believe, evidence level, kill condition. Outputs to `docs/inception/assumption-register-<project>.md`. Use when user says "assumptions", "leap of faith", "what are we betting on", "/assumption-register", or weekly during inception.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /assumption-register — Name Every Bet Before It Names You

## Why you'd care

Assumptions that aren't tracked don't go away — they expire silently and take a quarter of work with them. A living register with explicit kill conditions means you'll catch a bad bet at week three instead of after the next funding round.

Most startup failures come from unexamined assumptions. List them, rate evidence, set kill conditions.

## Pre-flight
Run after `/lean-canvas` or `/problem-statement-doc`. Pairs with `/riskiest-assumption-test`, `/risk-register`.

## Inputs
- Lean canvas / business model canvas / PRD.
- Customer interviews so far.
- Founder mental model (what feels obvious — those are usually assumptions).

## Process
1. **Category buckets** — surface assumptions across:
   - **Problem** — does the pain exist + matter?
   - **Customer** — who exactly + how reachable?
   - **Solution** — does the approach actually solve it?
   - **WTP** — will they pay this amount?
   - **Channel** — can we acquire them affordably?
   - **Retention** — will they keep using it?
   - **Team** — do we have the right skills/time?
   - **Market** — is this the right time + size?
2. **Evidence rating per assumption:**
   - **L0** — gut feel, no data
   - **L1** — anecdote (1-2 people said so)
   - **L2** — pattern (5+ interviews agree)
   - **L3** — survey / quant test
   - **L4** — paying customer evidence
   - **L5** — repeatable, predictable
3. **Sort by criticality × evidence-gap** — biggest risk = high criticality + low evidence.
4. **Kill condition per top-5** — what observation would force us to pivot/kill.
5. **Owner + date per assumption** — who tests it, by when.
6. **Re-review weekly** — assumptions move L0 → L5 over time. New ones surface.

## Output
Write `docs/inception/assumption-register-<project>.md`:

```markdown
# Assumption Register — <project>
**Date:** <YYYY-MM-DD>
**Last review:** <YYYY-MM-DD>
**Owner:** Founder A

## Top 5 critical assumptions (biggest bets)
| # | Assumption | Category | Evidence | Critical? | Kill if | Owner | Test by |
|---|------------|----------|----------|-----------|---------|-------|---------|
| 1 | Ops leaders at 50-500 person co's lose 5+ hrs/wk to coordination | Problem | L2 (8 interviews agree) | ⭐⭐⭐⭐⭐ | < 3 hrs/wk in survey n=50 | Founder A | June 1 |
| 2 | They'd pay $24k/yr for purpose-built tool | WTP | L1 (3 said yes in interview) | ⭐⭐⭐⭐⭐ | < 30% buy intent at $24k in VW survey | Founder A | June 15 |
| 3 | Content + community will source 50% of pipeline | Channel | L0 (founder guess) | ⭐⭐⭐⭐ | CAC > $400 at month 6 | Founder B | Sept 1 |
| 4 | We can build the MVP in 4 months solo | Team | L1 (founder's prior pace) | ⭐⭐⭐⭐ | > 6 months elapsed, < 60% done | Founder A | continuous |
| 5 | Customers stay 24+ months (retention) | Retention | L0 (no data, pre-launch) | ⭐⭐⭐⭐⭐ | Cohort 3-mo churn > 8% | Founder A | post-launch M3 |

## All assumptions (working list)
### Problem
- P1: Ops leaders lose 5+ hrs/wk (L2, top-5)
- P2: This pain is top-3 in their 2026 priorities (L1)
- P3: Current tools (Notion + Slack) feel "duct-taped" (L2)

### Customer
- C1: Buyer = VP Ops, not CTO (L2)
- C2: Reachable via LinkedIn + ops newsletters (L1)
- C3: Decision cycle is < 90 days (L0)

### Solution
- S1: Cross-functional automation is the right wedge (L1)
- S2: Async standups > sync meetings for ops teams (L2)
- S3: Slack-native > standalone web app (L1)

### WTP
- W1: $24k/yr Pro tier viable (L1, top-5)
- W2: Annual prepay accepted (L0)
- W3: Per-seat metric will work (L1)

### Channel
- Ch1: Content sources 50% of pipeline (L0, top-5)
- Ch2: Lenny + 3 niche newsletters → enough reach (L0)
- Ch3: Outbound + paid backup at 30% (L0)

### Retention
- R1: 24-month avg lifetime (L0, top-5)
- R2: NRR > 110% from seat expansion (L0)
- R3: Champions drive renewal (L1)

### Team
- T1: 4-month MVP build solo (L1, top-5)
- T2: First eng hire month 4 unlocks scale (L0)
- T3: Founders cover sales + product for 12mo (L1)

### Market
- M1: Async ops tools = ~$2B market by 2028 (L1 — third-party report)
- M2: Notion isn't moving into our wedge (L1)
- M3: AI doesn't commoditize this category (L0)

## Assumption movement log
| Date | Assumption | From → To | Source |
|------|-----------|-----------|--------|
| 2026-04-10 | P1 | L0 → L2 | 8 customer interviews |
| 2026-04-15 | S2 | L0 → L2 | Pattern in interviews |
| 2026-04-20 | W1 | L0 → L1 | 3 of 10 "yes" to $24k |

## New assumptions surfaced this week
- (Track here, then move up to category lists)

## Weekly review template
1. Which assumptions moved up an evidence level?
2. Which got killed?
3. Any new assumptions surfaced from this week's work?
4. Is any top-5 still untested? Why?

## Pitfalls flagged
- [ ] Top-5 critical assumptions named
- [ ] Each has explicit kill condition
- [ ] Each has owner + test date
- [ ] Evidence rated L0-L5
- [ ] Weekly review cadence on calendar
- [ ] Movement log kept (not just current state)

## Next
- Test the riskiest first → `/riskiest-assumption-test`
- Inception gate review → `/inception-gate-review`
- Risk register pairing → `/risk-register`
```

## Verification
- Assumptions categorized (8 buckets).
- Each rated L0-L5.
- Top-5 has kill condition + owner + date.
- Movement log kept.
- Weekly review cadence.
