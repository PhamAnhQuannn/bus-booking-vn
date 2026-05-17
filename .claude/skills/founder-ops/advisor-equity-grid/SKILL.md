---
name: advisor-equity-grid
description: Founder / CEO / head of talent responsibility — advisor equity grid — FAST template by level × stage, vesting, acceleration, pool budget. Outputs to `docs/inception/advisor-equity-grid-<project>.md`. Use when user says "advisor equity", "FAST grid", "advisor vesting", "advisor pool", "advisor grant", "head of talent advisor offer", "CEO advisor grant", "/advisor-equity-grid", or sizing advisor offers.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /advisor-equity-grid — Equity Is The Currency. Overpay = Cap Table Wreckage. Underpay = No Lean-In.

The FAST grid solves the negotiation. Use it. Don't reinvent. Don't free-form. Don't give a friend 1% because they "feel important".

## Why you'd care

Advisor grants done ad-hoc result in three advisors at 1% each delivering nothing measurable while a fourth at 0.25% changes the company. A grid by level and stage is what makes the grant proportional to the actual value.

## Pre-flight
Run with `/advisor-program-design`. Pairs with `/cap-table-bootstrap`, `/option-pool-sizing`.

## Inputs
- Stage (idea / startup / growth).
- Advisor level (Standard / Strategic / Expert).
- Pool budget (% reserved for advisors).
- Cap table headroom.

## Process
1. **Lock pool budget** — 0.5-1.5% total for ALL advisors.
2. **Tag each advisor level** (Standard / Strategic / Expert) by time commitment.
3. **Read grant off the FAST grid** — no freelancing.
4. **Set vesting** — 2-yr monthly, no cliff (or 1-yr cliff pre-seed).
5. **Decline acceleration** by default — single-trigger CoC only for senior advisors.
6. **Plan refresh** at next round for top performers.
7. **Cash-vs-equity** decision — bootstrap = cash; VC-track = equity.

## Output
Write `docs/inception/advisor-equity-grid-<project>.md`:

```markdown
# Advisor Equity Grid — <project>
**Stage:** <idea / startup / growth>
**Pool budget:** 0.5-1.5% total for advisors
**Vesting standard:** 2 yr monthly, no cliff

## The FAST grid (Founder/Advisor Standard Template)
Founder Institute's published standard. Battle-tested. Use as-is.

| Level | Time/mo | Idea stage | Startup stage | Growth stage |
|-------|---------|-----------|---------------|--------------|
| Standard | <2 hr | 0.25% | 0.20% | 0.15% |
| Strategic | 2-5 hr | 0.50% | 0.40% | 0.30% |
| Expert | 5+ hr | 1.00% | 0.80% | 0.60% |

### Level definitions
- **Standard:** monthly call + on-demand Slack. Light touch.
- **Strategic:** bi-weekly call + intros + deal review + decision input.
- **Expert:** weekly call + part-time-operator-level engagement.

### Stage definitions
- **Idea:** pre-product, pre-revenue. Highest risk → highest grant.
- **Startup:** product live, < $1M ARR. Moderate risk.
- **Growth:** $1M+ ARR, raised seed/A. Lowest risk → lowest grant.

## Pool budget guidance
| Total advisors | Pool % | Per-advisor avg |
|----------------|--------|----------------|
| 1 | 0.25 - 0.5% | 0.25 - 0.5% |
| 2-3 | 0.5 - 1.0% | 0.20 - 0.35% |
| 4-5 | 1.0 - 1.5% | 0.20 - 0.30% |
| 6+ | DON'T (see `/advisor-program-design`) | — |

Hard cap: 1.5% total. Beyond that = cap table damage with diminishing returns.

## Vesting schedule
| Stage | Schedule | Cliff | Why |
|-------|----------|-------|-----|
| Idea | 2 yr monthly | 1 yr cliff | High risk advisor walks early |
| Startup | 2 yr monthly | No cliff | Smooth, retention-aligned |
| Growth | 2 yr monthly | No cliff | Standard |

Monthly vest = 1/24 per month. After month 1, advisor has earned 1/24.

## Acceleration policy
| Trigger | Default | Override |
|---------|---------|----------|
| Single-trigger CoC | No | Yes for Expert-level only |
| Double-trigger CoC | No | Yes for Expert + IPO-track |
| Death / disability | Full vest | Standard |
| For-cause termination | Forfeit | Standard |
| No-cause termination | Vested only | Standard |

Default = NO acceleration. Acceleration negotiable only for Expert tier advisors who would walk without it.

## Cash vs equity decision
| Situation | Path | Why |
|-----------|------|-----|
| Bootstrapped, no fundraise plan | Cash retainer | Equity = no liquidity event |
| VC-track, pre-seed | Equity (FAST) | Cap table is cheap, cash isn't |
| VC-track, post-Series A | Equity smaller % | Pool more expensive |
| One-off advisor for 1 project | Cash or none | Don't pollute cap table |
| Customer-as-advisor (existing client) | Carefully (avoid conflict) | Maybe consulting agreement instead |

## Granting mechanics
1. Board approves grant (or written consent of stockholders pre-board)
2. NSO (non-qualified stock option) typically, not ISO — advisors aren't employees
3. Strike price = current 409A FMV
4. Sign FAST agreement + option grant notice
5. Update cap table (use Carta / Pulley / Capdesk)
6. Send signed copies to advisor

## 409A and tax wrinkles
- Advisor NSOs taxed on exercise (spread = ordinary income)
- Pre-409A: use last preferred round price as strike (safe-ish)
- Post-409A: 409A FMV is the floor
- Tell advisor to talk to their CPA before exercise

## Refresh and top-up
At next round or 2-yr renewal:
| Trigger | Action |
|---------|--------|
| Advisor over-delivered (10x value) | Top-up 0.10-0.25% additional grant |
| Advisor on-pace | Renew at same terms |
| Advisor under-delivered | End agreement, unvested forfeits |
| Major round (Series A+) | Anti-dilution NOT standard — advisor diluted |

Top-up grant = new option grant at then-current strike. Vests on its own 2-yr schedule.

## Per-advisor grant record
For each advisor, log:
```
Advisor: <name>
Level: <Standard / Strategic / Expert>
Stage at grant: <idea / startup / growth>
Grant %: <0.25%>
Share count: <X>
Strike price: <$Y>
Grant date: <YYYY-MM-DD>
Vesting start: <YYYY-MM-DD>
Cliff: <none / 1 yr>
Vesting schedule: 2 yr monthly
Acceleration: <none / single-trigger CoC>
FAST template version: <FAST 2.0>
Filed: <Carta / Pulley link>
```

## Common over-grant mistakes
| Mistake | Damage | Fix |
|---------|--------|-----|
| 1% for big-name advisor who never shows up | Cap table dead weight | Use FAST grid + kill clause |
| 0.5% × 8 advisors = 4% total | Founders + employees diluted | Cap at 5 advisors, 1.5% pool |
| No vesting (full grant day 1) | Advisor walks at month 2 | Always vest |
| 4-yr vesting | Advisor stalls past usefulness | 2-yr standard |
| Grant before trial period | Decorative advisor, can't cut | 60-90 day trial first |
| Grant to investor who's "also advising" | Conflict on next round | Investors don't get advisor grants |

## When to skip equity
- One-off intro / advice = thank-you note, not equity
- Customer who's just enthusiastic = NPS + reference, not equity
- Friend brain-pick = lunch, not equity
- Lawyer / accountant / vendor = pay them, not equity
- Already-an-investor = no double-dip

## Pool budget over time
| Round | Advisor pool target | Why |
|-------|--------------------|----|
| Pre-seed | 1.0 - 1.5% | Reserve while cheap |
| Seed | 1.0% (top up if used) | Refresh top performers |
| Series A | 0.5% remaining | Cap further grants |
| Series B+ | 0% new grants | Use employee pool only |

## Tracking sheet
| Advisor | Level | Stage | Grant % | Shares | Strike | Granted | Vested | Status |
|---------|-------|-------|---------|--------|--------|---------|--------|--------|
| <A> | Strategic | Startup | 0.40% | 40,000 | $0.10 | 2026-02 | 8% | Active |
| <B> | Standard | Startup | 0.20% | 20,000 | $0.10 | 2026-03 | 4% | Active |
| <C> | Expert | Idea | 1.00% | 100,000 | $0.05 | 2025-08 | 38% | Active |

## Pitfalls flagged
- [ ] Pool budget locked (≤ 1.5%)
- [ ] FAST grid grants used (no freelancing)
- [ ] Vesting 2-yr monthly
- [ ] No acceleration (default)
- [ ] Granted post-trial, not pre
- [ ] Per-advisor record filed
- [ ] No investor-also-advisor double-dip

## Anti-patterns
- ❌ 1% for name-on-deck advisor
- ❌ Full grant no vesting
- ❌ Pool > 1.5%
- ❌ 4-yr vesting (advisor stalls)
- ❌ Grant before 60-90 day trial
- ❌ Equity + cash retainer (pick one)
- ❌ Investor double-dipping as advisor

## Next
- Program design → `/advisor-program-design`
- Cap table → `/cap-table-bootstrap`
- Option pool → `/option-pool-sizing`
```

## Verification
- FAST grid stated.
- Pool budget cap (1.5%).
- Vesting schedule + cliff rules.
- Acceleration default off.
- Cash-vs-equity decision matrix.
- Refresh/top-up logic.
- Per-advisor grant record template.
