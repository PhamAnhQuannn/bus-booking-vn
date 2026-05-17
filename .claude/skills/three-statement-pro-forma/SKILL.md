---
name: three-statement-pro-forma
description: P&L + balance sheet + cash flow 3-yr projection. Outputs to `docs/inception/pro-forma-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "pro forma", "3 statements", "financial model", "/three-statement-pro-forma", or for fundraise / L+ planning.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /three-statement-pro-forma — 3-Statement Model

Invoke as `/three-statement-pro-forma`. L+ / fundraise. Linked P&L + BS + CF, monthly Y1, quarterly Y2–3.

## Why you'd care

Investors at L+ rounds expect linked P&L + balance sheet + cash flow, not a one-tab revenue model. Building it once means due diligence answers come in hours instead of weeks.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (overhead too heavy; use `/runway-model` + `/cost-model`)
2. Read `docs/inception/unit-economics-<project>.md` + `cost-model-<project>.md` + `pricing-<project>.md`.

## Inputs
- Revenue assumptions (new logos/mo, ACV, churn, upsell).
- COGS per unit.
- Headcount plan + comp.
- Capex (rare for SaaS).
- Funding raised + when.

## Process
1. **P&L (income statement)** — monthly Y1, quarterly Y2–3:
   - Revenue (new + retained − churned + expansion)
   - COGS
   - Gross profit + margin %
   - Opex (S&M, R&D, G&A)
   - EBITDA
   - D&A
   - EBIT
   - Tax
   - Net income
2. **Balance sheet** — end-of-period:
   - Cash, AR, prepaid (current assets)
   - Equipment net (PPE)
   - AP, accrued, deferred revenue (current liabs)
   - LT debt, equity, retained earnings
3. **Cash flow** — direct method preferred for SaaS:
   - Operating: collections − payments
   - Investing: capex
   - Financing: debt + equity raises − repayments
   - Ending cash → BS cash
4. **Linkages** — net income → retained earnings; CF ending cash → BS cash; deferred revenue → recognized revenue over time.
5. **Scenarios** — base / bull / bear (revenue ±30%, churn ±50%).
6. **Outputs for investors** — ARR ramp, gross margin trend, burn multiple, months to default-alive.

## Output
Write `docs/inception/pro-forma-<project>.md`:

```markdown
# 3-Statement Pro Forma — <project>
**Date:** <YYYY-MM-DD> | **Horizon:** 3 yr

## Key assumptions
- Starting MRR: $<X>
- New logos / mo: <Y>
- Avg ACV: $<Z>
- Monthly logo churn: <W>%
- Net dollar retention: <V>%
- Gross margin: <U>%
- Headcount Y1 / Y2 / Y3: <a>/<b>/<c>
- Avg loaded comp: $<X>/yr

## P&L summary (annual)
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| Revenue | $<X> | $<Y> | $<Z> |
| COGS | | | |
| Gross profit | | | |
| Gross margin % | <%> | <%> | <%> |
| S&M | | | |
| R&D | | | |
| G&A | | | |
| EBITDA | | | |
| Net income | | | |

(Detailed monthly Y1 / quarterly Y2–3 in linked spreadsheet)

## Balance sheet summary (end of period)
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| Cash | | | |
| Total assets | | | |
| Deferred revenue | | | |
| Total liabs | | | |
| Equity | | | |

## Cash flow summary (annual)
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| CFO (operating) | | | |
| CFI (investing) | | | |
| CFF (financing) | | | |
| Net change in cash | | | |
| Ending cash | | | |

## SaaS metrics
| Metric | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| ARR end of period | | | |
| LTV/CAC | | | |
| CAC payback (mo) | | | |
| Burn multiple (net burn / ARR added) | | | |
| Months to default-alive | | | |
| Rule of 40 (growth + margin) | | | |

## Scenarios
| Scenario | Y3 ARR | Y3 cash | Default-alive month |
|---|--:|--:|--:|
| Bear (-30% rev, +50% churn) | | | |
| Base | | | |
| Bull (+30% rev, -25% churn) | | | |

## Funding ask (if any)
- Round: <Seed / A>
- Amount: $<X>
- Use of funds: <breakdown>
- Runway extended: <months>
- Default-alive after raise: <yes by month X / no>

## Verdict
**MODEL-BANKABLE / NEEDS-ASSUMPTIONS-WORK / INFEASIBLE**
```

## Verification
- 3 statements linked (NI → RE; CF → BS cash).
- Monthly Y1 + quarterly Y2–3 detail in spreadsheet (.xlsx linked).
- Scenarios bear/base/bull.
- SaaS metrics (or sector equivalents) included.
- Funding ask explicit if raising.
