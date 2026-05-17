---
name: success-metrics-baseline
description: Lock baselines + 30/60/90/180-day targets for all success metrics — NSM, AARRR, financials, retention. Outputs to `docs/inception/success-metrics-baseline-<project>.md`. Use when user says "success metrics", "targets", "KPI baseline", "AARRR", "/success-metrics-baseline", or before launch / fundraise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /success-metrics-baseline — A Target Without A Baseline Is A Hallucination

You can't say "good month" without "compared to what." Lock baselines now, even if they're zeros.

## Why you'd care

Targets set after launch are post-hoc rationalization. Locking baselines + 30/60/90/180-day targets up-front is what makes the metric a decision input instead of a vanity badge.

## Pre-flight
Run after `/north-star-metric-pick`, `/analytics-spec`. Pairs with `/kpi-dashboard-investors`, `/okr-tree`.

## Inputs
- NSM (already picked).
- Funnel stages (AARRR or custom).
- Financial model (LTV, CAC, runway).
- Comparable companies' public benchmarks.

## Process
1. **Categories of metrics:**
   - **NSM + inputs** — from `/north-star-metric-pick`
   - **AARRR funnel:**
     - Acquisition — signups / week, source mix
     - Activation — % of new users hitting aha moment
     - Retention — D7 / D30 / D90 retention curves
     - Revenue — MRR, ARPU, churn
     - Referral — referrals / customer, K-factor
   - **Financials** — MRR, ARR, burn, runway, gross margin
   - **Operational** — NPS, support ticket volume, time-to-first-response
2. **For each metric:**
   - Today's baseline (or honestly: "unknown / TBD")
   - 30-day target
   - 90-day target
   - 180-day target
   - Source (where measured — analytics tool, Stripe, manual)
3. **Honesty rule** — "TBD" is fine. "Estimated" is fine. Lying baselines kill the practice.
4. **Source of truth per metric** — one tool, not 5 conflicting dashboards.
5. **Public vs private** — what we share with investors / board / team.
6. **Benchmark adjacent companies** — public S-1s, Open Startups, Bessemer benchmarks.
7. **Counter-metrics** — every primary metric needs a guard (NSM gameable? track guard).
8. **Cadence:** daily auto (Slack), weekly review, monthly investor update.

## Output
Write `docs/inception/success-metrics-baseline-<project>.md`:

```markdown
# Success Metrics Baseline — <project>
**Date:** <YYYY-MM-DD>
**Source of truth:** PostHog (product) + Stripe (revenue) + manual sheet (financials)

## North-Star Metric
**WCAW** (workflows completed per account per week)

| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| WCAW (median) | 2.1 | 2.5 | 3.5 | 5.0 | PostHog |
| Total weekly workflows | 220 | 350 | 1,100 | 2,500 | PostHog |
| Workflow completion rate | 65% | 70% | 78% | 85% | PostHog |
| Time-to-3-workflows | 14 days | 10 days | 5 days | 3 days | PostHog |

## AARRR funnel
### Acquisition
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| Weekly signups | 25 | 40 | 100 | 200 | PostHog |
| % from content | 20% | 30% | 40% | 50% | UTM |
| % from referral | 5% | 10% | 15% | 20% | UTM |
| % from outbound | 60% | 40% | 25% | 15% | CRM |
| % paid | 15% | 20% | 20% | 15% | UTM |

### Activation
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| % hitting aha in 7d | 25% | 35% | 50% | 65% | PostHog |
| % signed up → trial started | 60% | 70% | 80% | 85% | PostHog |
| % trial → paid | 5% | 7% | 10% | 12% | Stripe |

### Retention
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| Account D7 retention | TBD | 60% | 65% | 70% | PostHog |
| Account D30 retention | TBD | 40% | 50% | 60% | PostHog |
| Account D90 retention | TBD | TBD | 35% | 50% | PostHog |
| Logo churn (monthly) | TBD | 8% | 5% | 3% | Stripe |
| Net dollar retention (NDR) | n/a | 100% | 105% | 115% | Stripe |

### Revenue
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| MRR | $20k | $25k | $50k | $100k | Stripe |
| ARR | $240k | $300k | $600k | $1.2M | Stripe |
| New MRR / month | $5k | $8k | $20k | $40k | Stripe |
| Expansion MRR / month | $500 | $1k | $5k | $15k | Stripe |
| ARPU | $200/mo | $200/mo | $250/mo | $300/mo | Stripe |
| Gross margin | 75% | 78% | 80% | 82% | Manual |

### Referral
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| Referrals per customer | 0.1 | 0.15 | 0.25 | 0.4 | PostHog |
| K-factor | 0.05 | 0.07 | 0.12 | 0.20 | derived |

## Financial
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| Burn / month | $35k | $35k | $50k | $60k | Manual |
| Runway (months) | 18 | 17 | 14 | 12 | Manual |
| LTV (gross) | $8k | $9k | $11k | $14k | derived |
| Blended CAC | $400 | $400 | $450 | $400 | derived |
| LTV:CAC | 20:1 (small n) | 20:1 | 24:1 | 35:1 | derived |
| Payback (months) | 4 | 4 | 3.5 | 3 | derived |

## Operational
| Metric | Today | 30d | 90d | 180d | Source |
|--------|-------|-----|-----|------|--------|
| NPS | TBD | 40 | 50 | 55 | Survey |
| Support ticket volume | 30/wk | 40/wk | 80/wk | 150/wk | Plain |
| Time-to-first-response | 4 hr | 2 hr | 1 hr | 30 min | Plain |
| Customer satisfaction (CSAT) | TBD | 85% | 90% | 92% | Plain |

## Counter-metrics (guards)
| Primary | Counter | Why |
|---------|---------|-----|
| WCAW | WCAW / active user | Guard against fake-user-create gaming |
| Signups | % active 7d post-signup | Don't celebrate inactive signups |
| MRR | NDR + churn breakout | MRR can grow on bad cohorts |
| Expansion MRR | NPS | Expansion without satisfaction = future churn |
| K-factor | report-spam rate on shares | Viral mechanics shouldn't be sleazy |

## Benchmarks (adjacent comps, public sources)
| Metric | Industry P50 | Industry P75 | Our 180d target |
|--------|--------------|--------------|------------------|
| D30 retention (B2B) | 35% | 55% | 60% |
| Logo churn (B2B SMB) | 5%/mo | 2%/mo | 3%/mo |
| LTV:CAC | 3:1 | 5:1 | 35:1 (small n caveat) |
| Payback | 14 mo | 8 mo | 3 mo |
| NDR | 105% | 115% | 115% |

## Cadence
| Cadence | Audience | Format |
|---------|----------|--------|
| Daily | Internal Slack | Auto-post NSM + top funnel |
| Weekly | Founders | Operating rhythm review |
| Monthly | Investors | Update email with full metric pack |
| Quarterly | Board | Pre-read + 30 min review |

## Public vs private
- **Public-share OK:** NSM, # customers, partner names (with permission)
- **Investor-only:** MRR, ARR, churn, runway, CAC, LTV
- **Confidential:** Cap table, individual customer revenue, employee comp

## Pitfalls flagged
- [ ] Baselines honest (TBD allowed, lying not)
- [ ] Targets at 30/60/90/180 days (not one)
- [ ] Source-of-truth tool per metric (no conflict)
- [ ] Counter-metrics defined
- [ ] Benchmarks from real comps
- [ ] Cadence + audience locked
- [ ] Public/private classification explicit

## Next
- Dashboard build → `/kpi-dashboard-investors`
- OKR scaffold → `/okr-tree`
- Analytics events → `/analytics-spec`
- Investor cadence → `/investor-update-cadence`
```

## Verification
- All metric categories covered (NSM, AARRR, financial, operational).
- Baselines honest (TBD if unknown).
- 30/90/180-day targets per metric.
- Source-of-truth tool per metric.
- Counter-metrics defined.
- Benchmarks from public comps.
- Cadence + audience locked.
