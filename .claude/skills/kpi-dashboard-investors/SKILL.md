---
name: kpi-dashboard-investors
description: KPI dashboard for investors — pick the 5-8 metrics that matter, define formulas, set the cadence. Outputs to `docs/inception/kpi-dashboard-investors-<project>.md`. Use when user says "KPI dashboard", "investor metrics", "north-star metric", "metrics page", "/kpi-dashboard-investors", or pre-raise / post-raise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /kpi-dashboard-investors — Show 5 Numbers, Not 50. Wrong Number = Wrong Investor.

## Why you'd care

Sending investors 30 metrics produces no signal; sending 5–8 well-defined ones builds trust and earns follow-on capital. The dashboard forces the pick before the next update goes out.

Investor dashboard = signal you know what matters. 50 vanity metrics = you don't. Pick 5-8, defend the formula, ship monthly.

## Pre-flight
Run before first investor update. Pairs with `/investor-update-cadence`, `/north-star-metric-pick`.

## Inputs
- Product type (SaaS / consumer / marketplace / fintech).
- Stage (pre-revenue / early revenue / growth).
- North-star metric (from `/north-star-metric-pick`).
- Existing analytics (PostHog / Mixpanel / Stripe / DB).

## Process
1. **Pick North Star** — the single metric that proxies value delivered.
2. **Pick 4-7 input metrics** — what drives the NSM.
3. **Define formula per metric** — write the exact SQL or denominator.
4. **Pick cadence** — daily / weekly / monthly per metric.
5. **Set baseline + target** — investors care about delta, not absolute.
6. **Wire to dashboard** — Metabase / Hex / Mode / Google Sheets / Visible.
7. **Ship in monthly update** — same metrics, same order, every month.

## Output
Write `docs/inception/kpi-dashboard-investors-<project>.md`:

```markdown
# KPI Dashboard — <project>
**North Star:** <metric>
**Cadence:** weekly internal, monthly external
**Tool:** <Metabase / Hex / Mode / Sheets / Visible>

## North Star Metric
**<NSM name>:** <one-line definition>

Why this NSM:
- Proxies customer value (not vanity)
- Moves before revenue moves (leading indicator)
- Team can directly influence

Examples by product:
| Product type | North Star |
|--------------|-----------|
| SaaS | Paid weekly active accounts |
| Marketplace | GMV (gross merchandise value) |
| Consumer social | Weekly active users (7-day retained) |
| Dev tool | Weekly active developers using core feature |
| Fintech | Active accounts with > $X funded |
| E-commerce ops | Active stores × orders processed |

## The 5-8 metrics (investor view)

### Growth
| Metric | Formula | Cadence | Baseline | Target |
|--------|---------|---------|----------|--------|
| ARR | sum(active_paid_subs × annual_price) | M | $X | $Y |
| MRR | ARR / 12 | M | — | — |
| MoM growth | (this MRR - last MRR) / last MRR | M | — | 10-15% seed, 15-20% A |
| New logos | count(new_paid_customers_this_month) | M | — | — |

### Retention
| Metric | Formula | Cadence | Baseline | Target |
|--------|---------|---------|----------|--------|
| Logo churn | churned_logos / starting_logos | M | — | < 2% MoM SaaS |
| Net dollar retention | (start_MRR + expansion - churn - contraction) / start_MRR | M | — | > 100% SMB, > 120% mid-market |
| Cohort retention M3 | active_M3 / cohort_size | Q | — | varies by category |

### Acquisition
| Metric | Formula | Cadence | Baseline | Target |
|--------|---------|---------|----------|--------|
| CAC | sales_marketing_spend / new_customers | M | — | — |
| Payback | CAC / monthly_gross_margin_per_customer | Q | — | < 12 mo SMB |
| LTV/CAC | LTV / CAC | Q | — | > 3x |

### Efficiency
| Metric | Formula | Cadence | Baseline | Target |
|--------|---------|---------|----------|--------|
| Burn multiple | net_burn / net_new_ARR | Q | — | < 1 great, < 2 good, > 3 bad |
| Magic number | (Q ARR added × 4) / prev_Q_S&M_spend | Q | — | > 0.75 |
| Runway | cash / monthly_burn | M | — | > 18 mo always |

### Engagement (pre-revenue only)
| Metric | Formula | Cadence | Baseline | Target |
|--------|---------|---------|----------|--------|
| WAU | distinct_users_active_last_7_days | W | — | — |
| WAU/MAU | WAU / MAU | M | — | > 50% sticky |
| Activation rate | activated_users / signed_up | W | — | varies |

## Pick by stage
**Pre-revenue:** NSM + WAU + WAU/MAU + activation + waitlist size
**Early revenue (< $100k ARR):** NSM + ARR + new logos + MoM growth + logo churn + magic moment rate
**Seed-Series A ($100k-$1M ARR):** ARR + MoM growth + NRR + logo churn + CAC payback + burn multiple + runway
**Series A+ ($1M-$10M ARR):** ARR + NDR + magic number + burn multiple + gross margin + sales cycle + pipeline coverage

## Formula discipline
For each metric, write down:
- Numerator (exact SQL or definition)
- Denominator (exact SQL or definition)
- Time window
- Exclusions (free users, internal users, refunds)
- Source of truth (Stripe / DB / analytics tool)

Example:
> **MRR** = sum of active paid subscriptions × monthly_price as of last day of month. Excludes: trialing accounts, internal test accounts (org_id starts with 'internal-'), accounts with refund in past 30 days. Source: Stripe API.

Investors will probe formulas. Inconsistent definitions = trust gone.

## Dashboard wiring
| Tool | When |
|------|------|
| Google Sheets | < $100k ARR, manual update OK |
| Metabase | open-source SQL, free for solo |
| Visible | investor-update focused, paid |
| Hex | analyst-grade, paid |
| Mode | analyst-grade, paid |

Embed live charts in investor update where possible.

## Visualization rules
- One chart = one metric over time
- 12-month rolling window (or all of life if shorter)
- Mark milestones (launch, big customer, raise, hire)
- Annotate dips honestly
- No 3D charts, no pie charts for time series

## Anti-vanity metrics (do NOT include)
- ❌ Cumulative signups (always goes up)
- ❌ Page views (no value proxy)
- ❌ Social followers (no value proxy)
- ❌ Press mentions (lagging, low signal)
- ❌ App downloads (without activation)
- ❌ "Hours saved" without methodology

## Update discipline
- Same metrics, same order, every month
- Adding a new metric = explain why
- Dropping a metric = explain why (red flag if mid-trouble)
- Never re-baseline silently

## Pitfalls flagged
- [ ] NSM picked + defended
- [ ] 5-8 metrics max
- [ ] Formula per metric (numerator + denominator + window + exclusions)
- [ ] Stage-appropriate metric set
- [ ] Vanity metrics excluded
- [ ] Cadence per metric defined
- [ ] Dashboard live + linked in update

## Anti-patterns
- ❌ 30 metrics (signals you don't know what matters)
- ❌ Changing definitions month to month
- ❌ Showing only good-trending metrics
- ❌ No NSM (most common solo-founder mistake)
- ❌ Cumulative-only charts (mask trend)
- ❌ Different metric in deck vs update vs board

## Next
- Update cadence → `/investor-update-cadence`
- Reference prep → `/reference-call-prep`
- Diligence → `/diligence-checklist`
```

## Verification
- NSM picked.
- 5-8 metrics, no more.
- Formula per metric.
- Stage-appropriate set.
- Vanity excluded.
- Cadence + tool defined.
