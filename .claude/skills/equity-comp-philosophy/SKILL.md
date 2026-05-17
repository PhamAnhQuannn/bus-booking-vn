---
name: equity-comp-philosophy
description: Equity compensation philosophy — grant philosophy (top-of-market vs broad vs founder-rich), grant grid by role × level × stage, ISO vs NSO vs RSU vs RSA pick, vesting + cliff + acceleration, early-exercise, refresh grants, secondary policy, communication. Outputs to `docs/inception/equity-comp-philosophy-<project>.md`. Use when user says "equity grant", "stock options", "ISO", "NSO", "RSU", "vesting", "equity compensation", "/equity-comp-philosophy", or before first non-founder grant.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /equity-comp-philosophy — Equity Is The Single Most-Expensive Currency You Print. Spend It With A Stated Philosophy, Not Per Hire.

## Why you'd care

Equity is "guess what feels fair" if you don't have a stated philosophy — and that means hire #4 negotiates 1.5% because they pushed, hire #5 lands 0.4% because they didn't, and hire #6 finds out at lunch six months later. Founder dilution compounds at every round, but the bigger damage is the morale collapse when the equity grid leaks across the team. Writing the policy before grant #1 is what makes "what's my offer" a one-document answer instead of a negotiation that sets a precedent for every hire to come.

Equity ≠ "guess what feels fair". Equity = a finite cap-table that compounds founder dilution + signal to every hire + delta between joining you vs Stripe / OpenAI / Anthropic. Without a written philosophy you make 10 individual decisions, each negotiated, each landed differently, each becoming the reference point for the next ask. Write the policy before grant #1.

## Pre-flight
Run before first non-founder grant, before option pool sized, before first investor reviews cap table. Pairs with `/first-hire-plan`, `/option-pool-sizing`, `/vesting-schedule`, `/cap-table-design`, `/409a-precheck`, `/dilution-scenarios`, `/contractor-vs-employee-decision`.

## Inputs
- Stage (pre-seed / seed / Series A / B / C+).
- Option pool size (current + planned refresh).
- 409A valuation (current; see `/409a-precheck`).
- Existing grants outstanding (founder + advisor + employee).
- Geography of hires (US / EU / UK / global).
- Comp benchmark sources (Carta / Pave / Option Impact / AngelList Talent / Levels.fyi).
- Cash compensation philosophy (top-of-market / market / below-market with equity-richer).

## Process
1. **Pick philosophy** — top-of-market cash vs equity-rich vs balanced; broad-grant vs top-heavy.
2. **Pick instrument** — ISO vs NSO vs RSA vs RSU vs phantom by stage + jurisdiction.
3. **Build grant grid** — role × level × stage with % range + dollar value at 409A + share count.
4. **Vesting policy** — 4-yr / 1-yr cliff standard + acceleration rules.
5. **Early exercise + 83(b)** — allow or not; document election window.
6. **Refresh grant policy** — annual top-up, promotion grant, retention grant.
7. **Acceleration policy** — single-trigger vs double-trigger; per-role.
8. **Post-termination exercise window** — 90 days vs extended (10-yr).
9. **Secondary policy** — tender offers, founder secondary, employee liquidity.
10. **Communication framework** — offer letter equity section + grant explainer + annual value statement.

## Output
Write `docs/inception/equity-comp-philosophy-<project>.md`:

```markdown
# Equity Compensation Philosophy — <project>
**Owner:** founder / People / counsel
**Date:** <YYYY-MM-DD>
**Stage:** <pre-seed / seed / Series A / B / C+>
**Current 409A FMV:** $<X> / share
**Option pool:** <X%> current; <Y%> refresh planned at next round

## Why a written philosophy
- Cap table compounds — every grant decision affects future dilution
- Without written policy, every hire negotiates individually → drift + inequity + cap-table chaos
- Top performers compare against Stripe/OpenAI/Anthropic — need consistent answer "why us"
- Diligence reviews cap-table grants; ad-hoc grants raise red flags
- Refresh policy is what retains 3-yr+ employees (vesting cliff already crossed)
- Acceleration policy is what gets early hires through M&A — they read it before signing

## Core philosophy pick (1 of 3)

### A) Top-of-market cash, market equity
- Pay 75-90th percentile cash for stage
- Equity at 50th percentile band
- Pros: attracts senior IC who already have equity bags
- Cons: highest burn; weaker retention if equity small relative to wage
- Pick if: well-funded + competing with FAANG / late-stage for senior talent

### B) Market cash, top-of-market equity (recommended for early-stage)
- Pay 50-65th percentile cash
- Equity 75-90th percentile for stage
- Pros: aligns hires to outcome; conserves cash; equity-rich grants reward early risk
- Cons: candidates from late-stage cos may pass on cash gap; explainer needed
- Pick if: pre-seed / seed; need to stretch cash + signal-up-by-equity

### C) Below-market cash, founder-rich equity (rare)
- Pay 25-40th percentile cash
- Equity 90-99th percentile
- Pros: ultra-founder-aligned; very early-stage feel
- Cons: lose mid-career candidates with families; hits diversity
- Pick if: 2-3 person team in pre-seed only; phase out at seed

**Our philosophy:** <pick + rationale>

## Distribution shape

### Top-heavy (skewed to senior + early)
- First 5 hires get 0.5%-3% each (3-15% total to first 5)
- Hires 6-20 average 0.1-0.5% each
- Late hires (post-Series B) average 0.02-0.1%
- Pros: rewards founding risk; aligns leadership
- Cons: junior hires feel under-rewarded; engagement drift

### Broad (flatter)
- First 5 hires get 0.3-1% each (2-5% total to first 5)
- Hires 6-30 average 0.2-0.5%
- Pros: cultural fairness; broad ownership
- Cons: leadership feels under-rewarded; senior hires negotiate up

### Hybrid (recommended)
- First 5 get founding-band grants (top-heavy element)
- Hires 6+ get role-band grants from grid (broad element)
- Refresh + promotion grants smooth the curve over time

**Our distribution:** Hybrid.

## Instrument pick

| Instrument | Worker type | Stage typical | Key features |
|------------|-------------|---------------|--------------|
| **ISO (Incentive Stock Option)** | W-2 employee (US) | Pre-IPO | $100k/yr vesting cap; AMT risk; tax-favorable at exercise IF held 2yr/1yr |
| **NSO (Non-qualified Stock Option)** | Any worker (US + global) | Any | Ordinary income at exercise (FMV − strike); flexible; no $100k cap |
| **RSA (Restricted Stock Award)** | Founder + earliest employees | Pre-seed only | Buy at FMV today; 83(b) within 30 days mandatory; capital gains on appreciation |
| **RSU (Restricted Stock Unit)** | Employee | Pre-IPO late / public | Vests = ordinary income; double-trigger common pre-IPO (vest + liquidity) |
| **Phantom stock / SAR** | Any (incl. global) | Any | Cash settlement; no real shares; tax at payout |
| **Profits interest** | LLC entities only | LLC structure | Catch-up at exit; capital gains; complex 83(b)-like Rev Proc 93-27 |
| **EMI option (UK)** | UK employee | UK Ltd qualifying | Capital gains on exercise + sale; max £250k per individual; entrepreneurs' relief |
| **BSPCE (France)** | French employee | Qualifying SAS | Favorable French tax treatment |
| **VSOP / Phantom (DE)** | Germany employee | Any | Synthetic option; tax at payout; no actual shares |

**Stage default:**
- Pre-seed (cap-table founders + 1-2 first hires): RSA for first 1-2 employees if FMV low; ISO/NSO after
- Seed onward: ISO for US W-2; NSO for advisors / non-US / executives over $100k cap
- Pre-IPO mature: RSU (double-trigger) for new grants; existing ISO/NSO continue

**Our instrument default:** <pick + carve-outs>

## Grant grid (% of fully-diluted shares)

### Engineering
| Stage | Senior IC | Staff IC | Principal IC | Eng manager | Eng director | VP eng |
|-------|-----------|----------|--------------|-------------|--------------|--------|
| Pre-seed | 1.0-2.5% | 1.5-3.0% | 2.0-4.0% | 1.5-3.0% | 2.0-4.0% | 3.0-6.0% |
| Seed | 0.3-1.0% | 0.5-1.5% | 1.0-2.5% | 0.75-1.5% | 1.0-2.5% | 1.5-3.5% |
| Series A | 0.15-0.5% | 0.25-0.75% | 0.5-1.25% | 0.35-0.85% | 0.5-1.25% | 0.75-2.0% |
| Series B | 0.08-0.25% | 0.15-0.4% | 0.25-0.6% | 0.2-0.5% | 0.3-0.75% | 0.5-1.25% |
| Series C+ | 0.04-0.12% | 0.08-0.2% | 0.12-0.3% | 0.1-0.25% | 0.2-0.4% | 0.3-0.75% |

### Product / design
| Stage | Senior PM/designer | Staff PM/designer | Director | VP product/design |
|-------|---------------------|-------------------|----------|---------------------|
| Pre-seed | 0.75-2.0% | 1.0-2.5% | 1.5-3.5% | 2.5-5.0% |
| Seed | 0.25-0.85% | 0.4-1.25% | 0.75-2.0% | 1.25-3.0% |
| Series A | 0.12-0.4% | 0.2-0.6% | 0.4-1.0% | 0.6-1.5% |
| Series B | 0.07-0.2% | 0.12-0.3% | 0.25-0.6% | 0.4-1.0% |
| Series C+ | 0.03-0.1% | 0.06-0.15% | 0.15-0.35% | 0.25-0.6% |

### Sales / GTM
| Stage | AE | Senior AE | Sales lead | VP sales | CRO |
|-------|-----|-----------|------------|----------|-----|
| Pre-seed | 0.25-0.75% | 0.5-1.5% | 1.0-3.0% | 2.0-5.0% | 3.0-7.0% |
| Seed | 0.1-0.4% | 0.2-0.75% | 0.5-1.5% | 1.0-3.0% | 1.5-4.0% |
| Series A | 0.05-0.2% | 0.1-0.4% | 0.25-0.85% | 0.5-1.5% | 0.75-2.5% |
| Series B | 0.03-0.1% | 0.06-0.2% | 0.15-0.5% | 0.3-0.85% | 0.5-1.5% |
| Series C+ | 0.015-0.06% | 0.03-0.1% | 0.08-0.25% | 0.2-0.5% | 0.3-0.85% |

### Operations / G&A
| Stage | Senior ops | Director ops | VP ops | Head of finance | CFO |
|-------|------------|--------------|--------|------------------|------|
| Pre-seed | 0.3-1.0% | 0.75-2.0% | 1.5-3.5% | 1.0-2.5% | 2.0-5.0% |
| Seed | 0.15-0.5% | 0.4-1.0% | 0.75-2.0% | 0.5-1.25% | 1.0-3.0% |
| Series A | 0.07-0.25% | 0.2-0.5% | 0.4-1.0% | 0.25-0.75% | 0.6-1.75% |
| Series B | 0.04-0.12% | 0.1-0.3% | 0.25-0.6% | 0.15-0.4% | 0.4-1.0% |
| Series C+ | 0.02-0.06% | 0.06-0.15% | 0.12-0.35% | 0.08-0.2% | 0.25-0.6% |

### Benchmarks
- Carta State of Compensation
- Pave Comp Benchmarks
- Option Impact (AngelList)
- Compa
- Levels.fyi (cash + RSU at later-stage)

Update grid quarterly with latest benchmark refresh. Don't reinvent — anchor to data.

### Conversion to share count
- Grant % × fully-diluted shares = share count
- Strike price = current 409A FMV
- Total option grant value (paper) at grant = (FMV − strike) × shares = $0 at grant (FMV = strike)
- Communicate as % AND share count AND scenario-based exit-value table (zero / fair / win)

## Vesting policy

### Standard (default for all employee grants)
- 4-year vesting
- 1-year cliff (25% on first anniversary)
- Monthly thereafter (1/48 per month after cliff)
- Stop vesting on termination (whether voluntary or involuntary, with carve-outs below)

### Advisor grants (see `/advisor-equity-grid`)
- 2-year vesting typically
- Monthly from day 1 (no cliff) OR 6-month cliff
- Total: 0.1-1.0% depending on tier

### Founder grants
- 4-year vesting
- 1-year cliff
- Mutual single-trigger acceleration on change of control common
- Reset on Series A typically — even if founders already vested some pre-financing

### Refresh / promotion grants
- 4-year fresh vesting
- No cliff (already crossed in original grant)
- Monthly from grant date

## Acceleration policy

### Single-trigger (acceleration on change of control alone)
- Common for: founders + most-senior executives
- Argument for: aligns founder + ensures buyer gets aligned leadership through transition
- Argument against: acquirer hates it; can complicate sale price

### Double-trigger (acceleration on change of control + involuntary termination within X months post-close)
- Common for: VPs + most employees with acceleration
- Standard: 12-month or 18-month post-close window
- Industry default → use double-trigger as employee baseline; reserve single-trigger for founders only

### Acceleration grant by role
| Role | Acceleration |
|------|--------------|
| Founder / co-founder | Single-trigger 100% OR double-trigger 100% (negotiable) |
| C-suite | Double-trigger 100%, 12-month window |
| VP | Double-trigger 50-100%, 12-month window |
| Director / senior IC | Double-trigger 25-50%, optional |
| IC / junior | None |

**Our acceleration policy:** <define per tier>

## Early exercise + 83(b)

### Early exercise allowed?
- **Yes (preferred):**
  - Hire can exercise before vesting (still subject to repurchase right if leaves)
  - Starts long-term cap gains clock early (1-yr hold) + 5-yr QSBS clock
  - Best when FMV low (pre-seed / seed) → minimal cash outlay
  - 83(b) election must be filed within 30 days (mandatory, hard deadline, no exceptions)
- **No:**
  - Standard option exercise post-vest
  - Tax event at each exercise (NSO ordinary income on spread; ISO AMT risk)
  - Simpler admin

**Our policy:** <allow / not> + 83(b) reminder workflow

### 83(b) election workflow
- Day 0: grant signed
- Day 1-30: 83(b) filing window (postmark by day 30)
- Cap-table admin (Carta / Pulley) generates 83(b) form
- Employee mails to IRS (certified mail, return receipt)
- Copy to company
- Copy to employee's tax return

**Missed 83(b) = no fix.** Employee pays ordinary income at each vesting milestone if RSA / early-exercised options.

## Post-termination exercise window

### Standard: 90 days
- Industry default
- ISO statutory requirement (90 days to retain ISO status)
- Forces employee to write big check OR forfeit vested options
- Optics: tough on employees with little cash; equity becomes "indentured servitude" without it

### Extended: 5-10 years (Pinterest / Quora / Asana model)
- More employee-friendly
- ISO converts to NSO after 90 days automatically
- Trade-off: orphan equity in cap table for years
- Trend: increasingly common at later stage; Series B+ common

**Our policy:** <90 days standard / extended at <stage>>

## Refresh / retention grant policy

### Annual refresh (top-up)
- Year 2+ employees get 25-50% of original grant size annually
- Vests 4 yrs fresh from each refresh grant date
- Smooths the "vesting cliff drop" at year 4

### Promotion grant
- On promotion: new grant at next-level band minus already-granted at current-level
- Bridges the level-up without retroactive adjustment

### Retention grant
- Discretionary, for key employees at risk of attrition
- Approval: founder + comp committee (if exists)

### Performance grant
- Tied to milestone (revenue, product, hiring)
- Vests on achievement, not time
- Use sparingly — most equity should be time-vested

## Secondary policy (employee liquidity)

### Tender offers
- Company-organized secondary; investors buy shares from employees
- Typical at Series B+ when valuation enables it
- Eligibility: employees vested ≥X% AND tenure ≥2 yrs
- Cap: employees can sell ≤10-25% of vested

### Founder secondary
- At fundraise rounds; founder takes some cash off table
- Typical: $1-5M at Series A; $5-20M at Series B
- Investor approval; disclosed to board

### Direct secondary
- Discouraged early; ROFR (right of first refusal) on transfers
- Allowed in tender or with board approval

**Our policy:** <define eligibility + cadence>

## Communication framework

### Offer letter equity section
```
You will be granted an option to purchase <X> shares of common stock
(equivalent to <Y>% of fully-diluted equity as of <date>).

Strike price: $<Z> per share (current 409A FMV)
Vesting: 4-year vesting, 1-year cliff, monthly thereafter
Acceleration: <single / double / none>
Post-termination exercise window: <90 days / 10 years>
Early exercise: <permitted / not permitted>

This grant is subject to board approval and the equity incentive plan terms.
A separate equity grant explainer will accompany this letter.
```

### Equity grant explainer (separate doc)
- Plain-English: what a stock option is
- Strike vs FMV vs eventual exit price
- Vesting schedule with example dates
- Tax events (grant vs exercise vs sale; ISO vs NSO)
- Three-scenario value table (zero / fair / win)
- 83(b) election explained if applicable
- Post-termination exercise window
- Acceleration if applicable
- "Talk to a tax advisor" line
- Q&A

### Annual equity value statement
- Each employee gets annual: current 409A × vested shares = current paper value
- Plus: % of company they own (vested + unvested)
- Plus: scenario value at hypothetical exits
- Carta / Pulley generate these automatically

## Cap-table admin

### Software
| Tool | Strength | Pricing |
|------|----------|---------|
| **Carta** | Industry standard, full lifecycle | $2.8-12k/yr seed → enterprise |
| **Pulley** | Founder-friendly UX, modern | $1.2-6k/yr early-stage |
| **AngelList Stack** | Bundled with AngelList Venture | Bundled |
| **Capdesk** | EU strength | €1-5k/yr |
| **Ledgy** | EU + UK + DACH | €1.5-6k/yr |
| **Vestd (UK)** | EMI option automation | £1-3k/yr |
| **Shoobx / Fidelity Private Stock** | Enterprise pre-IPO | Custom |

**Our pick:** <tool>

### 409A valuation cadence
- Annual minimum
- Refresh on: material event (financing round, M&A discussion, secondary)
- Vendor: tied to cap-table tool (Carta 409A / Pulley 409A) OR independent (Aranca / Andersen / Scalar / Carta Independent / Andersen Tax)
- Cost: $2-8k early-stage, $5-20k mature
- Refresh impact on strike: see `/409a-precheck`

## Anti-patterns
- ❌ Negotiate equity individually without grid — drift + inequity
- ❌ Grant ISOs to non-employees → invalid grants
- ❌ Issue RSA without 83(b) filing → massive ordinary income at vest
- ❌ Promise "1% of company" verbally → ambiguity, lawsuits
- ❌ Skip 409A refresh after material event → cheap-stock penalty + 409A waterfall
- ❌ Acceleration single-trigger for everyone → buyer hates it, kills M&A
- ❌ No refresh policy → 4-yr cliff = mass attrition wave
- ❌ Hide equity policy from candidates → trust loss
- ❌ 90-day exercise window without alternative → employees walk away from vested options
- ❌ Skip equity explainer → candidate doesn't understand → declines or under-values
- ❌ Mix instruments inconsistently — ISO some, NSO some, no policy → audit nightmare
- ❌ Founder accelerates self without board → governance breach
- ❌ Late-grant existing employees ("you were under-granted") without documentation
- ❌ Issue grants without board approval → invalid grant
- ❌ No fully-diluted % shown to candidates → trust gap when they Carta-up

## Founder mistakes to anticipate
1. Negotiate each grant individually → cap-table chaos
2. Promise % without specifying fully-diluted vs current
3. Issue RSA without explaining 83(b) → employee tax shock
4. Default 90-day exercise window without considering 10-yr alternative
5. Single-trigger acceleration for everyone → kills M&A optionality
6. No refresh grants → 4-yr attrition wave
7. Skip board approval → invalid grant + diligence flag
8. Forget to refresh 409A annually → cheap-stock penalty
9. Verbal promise of equity to advisor without paper → lawsuit risk
10. Grant ISO to international employee → invalid for non-US-tax-resident

## Stage-by-stage philosophy evolution

### Pre-seed (0-5 employees)
- RSA for founders + first 1-2 employees if FMV minimal
- Top-heavy distribution
- 4yr / 1yr cliff
- Single-trigger acceleration for founders only
- Allow early exercise + 83(b)
- No refresh yet
- 10-yr exercise window OK

### Seed (5-20 employees)
- ISO for US employees; NSO for advisors + international
- Grid established
- Standard 4yr/1yr cliff
- Double-trigger acceleration for VPs+
- Early exercise still allowed
- Annual refresh starts year 2
- 10-yr exercise window or 90-day at-stage choice

### Series A (20-50 employees)
- ISO/NSO mix
- Grid tightened with benchmark data
- Refresh policy operational
- Acceleration: double-trigger VPs+, single-trigger founders only
- 409A refreshes annual minimum
- Consider tender offer policy

### Series B+ (50-200+)
- RSU shift starts (double-trigger pre-IPO)
- Refresh + retention grants formal
- Tender offers possible
- 409A quarterly common
- Equity value statements annual

## Pre-launch checklist
- [ ] Philosophy picked (top-of-cash vs equity-rich vs founder-rich)
- [ ] Distribution shape decided (top-heavy / broad / hybrid)
- [ ] Instrument default picked (ISO/NSO/RSA/RSU)
- [ ] Grant grid drafted (role × level × stage)
- [ ] Vesting standard set (4yr/1yr cliff)
- [ ] Acceleration policy by tier
- [ ] Early exercise + 83(b) workflow
- [ ] Post-termination exercise window decided
- [ ] Refresh policy
- [ ] Secondary policy
- [ ] Cap-table tool selected
- [ ] 409A vendor + cadence
- [ ] Offer letter equity section template
- [ ] Equity grant explainer doc
- [ ] Board approval workflow for grants
- [ ] Annual equity statement workflow

## Hand-off
- Option pool sizing → `/option-pool-sizing`
- Vesting schedule template → `/vesting-schedule`
- 409A → `/409a-precheck`
- Dilution scenarios → `/dilution-scenarios`
- Cap-table design → `/cap-table-design`
- First hire planning → `/first-hire-plan`
- Contractor vs employee classification → `/contractor-vs-employee-decision`
- Founders agreement (must be clean before grants) → `/founders-agreement`
- Advisor equity → `/advisor-equity-grid`
- IP assignment → `/ip-assignment-agreement`
- Employee handbook → `/employee-handbook-skeleton`
```

## Verification
- Philosophy picked (cash/equity balance + distribution shape).
- Instrument default + carve-outs decided.
- Grid drafted: role × level × stage % bands.
- Vesting standard (4yr/1yr cliff) + carve-outs.
- Acceleration policy per tier (single-trigger founders, double-trigger VP+).
- Early exercise + 83(b) workflow.
- Post-termination exercise window decided.
- Refresh policy.
- Cap-table tool + 409A vendor + cadence.
- Communication framework (offer letter + explainer + annual statement).
