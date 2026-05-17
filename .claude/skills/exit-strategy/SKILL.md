---
name: exit-strategy
description: Declare exit ambition — lifestyle / acqui-hire / strategic acq / PE / IPO / hold-forever. Outputs to `docs/inception/exit-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "exit", "acquisition", "IPO", "/exit-strategy", or before raising VC.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /exit-strategy — Exit Declaration

## Why you'd care

A founder who wants a $10M lifestyle business takes VC money "because everyone does" and finds five years later that the board needs a $500M outcome to make the math work — meanwhile a founder targeting IPO bootstraps for two years and runs out of capital just before product-market fit. Stating the exit ambition honestly at inception is what aligns funding, hiring, governance, and pace — and the alternative is mismatched expectations between founder and capital that surface as terminal disagreement at exactly the worst moment.

Invoke as `/exit-strategy`. Exit aspiration shapes funding, hiring, governance. Be honest at start.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/funding-<project>.md` if exists.

## Inputs
- Founder ambition (money / impact / ownership / freedom).
- Market size (TAM ceiling).
- Time horizon comfortable.

## Process
1. **Exit type taxonomy**:
   - **Hold forever (lifestyle)** — never sell, dividend / cashflow
   - **Lifestyle exit** ($1M–$10M, ~5 yr) — small acquirer / founder buyout
   - **Acqui-hire** ($1M–$10M for team) — common when product fails
   - **Strategic acquisition** ($10M–$1B) — incumbent buys for product/team/customers
   - **PE buyout** ($50M–$500M) — recurring revenue, mature
   - **IPO** ($1B+ valuation) — large TAM, growth, public-ready
   - **SPAC** — generally avoid 2024+
   - **Secondary** (founder partial liquidity) — at later rounds, no full exit
2. **Decision per type**:
   - TAM ceiling? <$100M = no IPO.
   - Capital required? $50M+ raise = must IPO/large acq to return investors.
   - Founder horizon? <5 yr = lifestyle/quick acq.
   - Public-readiness needs? IPO = compliance, audits, governance ≥2 yr prep.
3. **Strategic acquirers list** — if acq path:
   - 5–10 likely buyers
   - Their M&A history + appetite
   - Relationship-build plan (years not months)
4. **Investor-alignment check** — VC needs $1B+ outcomes; if your exit ceiling is $100M, don't take VC.
5. **Reverse-engineer milestones** — from exit valuation back to revenue/growth needed.

## Output
Write `docs/inception/exit-<project>.md`:

```markdown
# Exit Strategy — <project>
**Date:** <YYYY-MM-DD>

## Founder ambition
- Primary motivation: <money / impact / ownership / freedom>
- Time horizon: <X years>
- Lifestyle preference: <work-from-anywhere / NYC office / remote>

## Chosen exit path
**<Hold forever / Lifestyle / Acqui-hire / Strategic acq / PE / IPO>**

## Rationale
- TAM: $<X> → ceiling supports <Y>
- Capital required to PMF: $<Z>
- Time horizon: <X yr> → fits <path>

## Path-specific plan

### If Strategic Acquisition
**Likely acquirers (5–10)**
| Acquirer | Strategic fit | Recent M&A | Relationship status |
|---|---|---|---|
| Salesforce | high | bought Tableau, Slack | none yet |
| HubSpot | med | bought Clearbit | partner conv started |
| Adobe | low | mostly verticals | none |
| ... | | | |

**Relationship build plan**
- Year 1: get on radar (analysts, partners)
- Year 2: integration partnership
- Year 3: BD conversations
- Year 4–5: exit conversations

### If IPO path
- Required ARR at IPO: $200M+
- Required growth: ≥40% YoY at $100M
- Compliance buildout start: $50M ARR
- Audit (Big-4): yr 3
- S-1 prep: 12+ mo before filing

### If Lifestyle / Hold
- Owner distributions: target $X/yr at $Y revenue
- No exit calendar
- Succession plan: <X>

## Investor-alignment
- Funding path: <bootstrap / angel / VC>
- Investor expectation: <return ceiling matches>
- Pact: <terms align — e.g. 1x liquidation preference enables small exit>

## Reverse-engineered milestones
| Year | Revenue needed | Growth | Key event |
|---|---|---|---|
| Y1 | $1M ARR | — | PMF |
| Y2 | $5M ARR | 5x | repeatable GTM |
| Y3 | $15M ARR | 3x | Series A |
| Y4 | $40M ARR | 2.7x | Series B / acq conv |
| Y5 | $80M ARR | 2x | exit window |

## Anti-pattern
- ✗ Take VC, then change mind to lifestyle
- ✗ "Maybe IPO maybe acq, let's see" — vague hurts decisions
- ✗ Acq-only with no acquirer list / relationship
- ✗ IPO ambition with $50M TAM
```

## Verification
- Exit type chosen explicitly.
- Rationale ties to TAM + capital + horizon.
- If acq: ≥5 acquirers named.
- If IPO: revenue milestones + compliance plan.
- Investor-alignment checked.
- Anti-pattern explicit.
