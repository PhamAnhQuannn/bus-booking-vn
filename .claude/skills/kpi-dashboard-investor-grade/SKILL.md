---
name: kpi-dashboard-investor-grade
description: Investor-grade KPI dashboard — SaaS metrics canon (ARR/NDR/CAC/LTV/payback/magic-number/rule-of-40), strict booked-vs-billed-vs-recognized ARR discipline, cohort retention, NDR. Outputs to `docs/inception/kpi-dashboard-investor-grade-<project>.md` + `lib/metrics.ts`. Use when user says "investor metrics", "SaaS metrics", "ARR definition", "NDR", "rule of 40", "magic number", "investor-grade dashboard", "/kpi-dashboard-investor-grade", or before first board meeting / Series A diligence. Upstream: `/north-star-metric-pick`, `/unit-economics-model`. Downstream: `/investor-update-monthly`, `/board-deck-template`, `/data-room-prep`. Distinct from `/kpi-dashboard-investors` (lighter, picks 5–8 metrics) — this skill enforces SaaS-metrics-canon rigor for board/diligence use.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /kpi-dashboard-investor-grade — Define the Numbers Once, Defend Them in Diligence

## Why you'd care

Loose ARR definitions (booked vs billed vs recognized) blow up in diligence and either kill the round or force a price cut on the term sheet. Strict canon + cohort discipline is what investor-grade actually means.

Why you'd care: ARR is not one number. Booked ARR, billed ARR, recognized ARR, and committed ARR are four different definitions; founders who use the most generous one in updates and a different one in the board deck get torched in Series A diligence when investor analysts back-solve from Stripe exports and find a 23% gap. The SaaS metrics canon (Bessemer, OpenView, ChartMogul) exists because every metric has a hidden hand on the scale — denominator choice, time window, exclusions. This skill forces you to write down each definition once, defend it forever, and instrument it. Skip and you spend Series A diligence re-deriving numbers under stress instead of selling the company.

## Pre-flight
- Read `/north-star-metric-pick` — the NSM headlines the dashboard.
- Read `/unit-economics-model` — LTV, CAC, payback flow from there.
- Confirm a single source-of-truth system per metric (Stripe for billing, your DB for usage, Salesforce/HubSpot for pipeline).
- Confirm an analytics tool: Metabase, Hex, Mode, Looker, or even SQL + Sheets. **Not** PostHog alone — it can't compute ARR.

## Inputs
- Stripe (or payment processor) account access.
- Production database with subscription/usage data.
- Pipeline CRM if you have sales-led motion.
- Last 12 months of finance data (P&L, cash, headcount).
- Customer cohort table (signup date + retained? + expansion).

## Process

1. **Pick the NSM, in one sentence with no weasels.** A great NSM is: (a) a customer-value proxy, not vanity; (b) a leading indicator (moves before revenue moves); (c) directly influenceable by the team. Examples:
   - SaaS B2B: weekly active paid accounts using core feature
   - Marketplace: GMV
   - Devtools: weekly active developers using N+ API calls
   - Vertical SaaS: weekly active accounts where any user completed the killer workflow
   - Consumer social: 7-day-retained DAU

   Write the definition with numerator + denominator + window + exclusions. Lock it.

2. **The Booked vs. Billed vs. Recognized vs. Committed ARR distinction.** Define all four explicitly; pick which one headlines investor updates and stick to it. Most investors expect *Committed ARR* (signed contracts excluding trials and discounts) as the headline, with *Recognized ARR* shown alongside for accounting reconciliation.

   | Definition | What it means | When to use |
   |---|---|---|
   | **Booked ARR** | New contracts signed in period (incl. future-dated) | sales reporting only — flatters number |
   | **Billed ARR** | Invoices issued × annualized | finance reporting, AR matching |
   | **Recognized ARR** | Revenue recognized per ASC 606 × annualized | GAAP financials, auditor-aligned |
   | **Committed ARR** | Active paid subscriptions × annual price, excluding trials, refunds, paused | **investor headline default** |

   The cardinal sin: switching definitions mid-year. Investors back-solve from Stripe and the discrepancy ends trust.

3. **The 10-metric investor-grade canon (Bessemer / SaaStr / OpenView).** Lock these definitions:

   ```
   1. ARR (Committed)         = active_paid_subs × annual_price, excluding trial/refunded/paused
   2. New ARR                 = ARR from net-new logos this period
   3. Expansion ARR           = ARR upsell/upgrades within existing logos
   4. Contraction ARR         = ARR downgrades within existing logos
   5. Churned ARR             = ARR lost to logo churn
   6. Net New ARR             = New + Expansion - Contraction - Churned
   7. Gross Dollar Retention  = (start_ARR - churned - contraction) / start_ARR
   8. Net Dollar Retention    = (start_ARR + expansion - contraction - churned) / start_ARR
   9. Logo Churn              = churned_logos / starting_logos
   10. Gross Margin           = (revenue - COGS) / revenue, with COGS defined explicitly
   ```

   And the efficiency block:

   ```
   11. CAC                    = sales_marketing_spend / new_customers_acquired
   12. LTV                    = (ARPU × gross_margin) / customer_churn_rate
   13. LTV/CAC                = LTV / CAC
   14. CAC Payback (months)   = CAC / (ARPU × gross_margin / 12)
   15. Burn Multiple          = net_burn / net_new_ARR
   16. Magic Number           = (Q ARR added × 4) / prior_Q_S&M_spend
   17. Rule of 40             = growth_rate_% + free_cash_flow_margin_%
   ```

4. **Bessemer / SaaStr benchmark table (committed to memory by every diligence analyst):**

   | Metric | Bad | Acceptable | Good | Best-in-class |
   |---|---|---|---|---|
   | NDR (SMB) | <95% | 95–100% | 100–110% | >115% |
   | NDR (mid-market) | <100% | 100–115% | 115–130% | >130% |
   | NDR (enterprise) | <105% | 105–120% | 120–140% | >150% |
   | Gross margin (SaaS) | <60% | 60–70% | 70–80% | >80% |
   | LTV/CAC | <1 | 1–3 | 3–5 | >5 |
   | CAC payback | >24mo | 18–24mo | 12–18mo | <12mo |
   | Burn multiple | >3 | 2–3 | 1–2 | <1 |
   | Magic number | <0.5 | 0.5–0.75 | 0.75–1.0 | >1.0 |
   | Rule of 40 | <20 | 20–40 | 40–60 | >60 |
   | Logo churn (SMB monthly) | >3% | 2–3% | 1–2% | <1% |
   | Logo churn (ent annual) | >15% | 10–15% | 5–10% | <5% |

   Each metric in your dashboard shows actual + benchmark band. Investors will mentally do this anyway; show your work.

5. **Cohort retention tables.** Logo retention by signup-month cohort, 24-month rolling window. Dollar retention same shape. Two tables side-by-side. Patterns investors look for:
   - Logo retention curve flattens after month 6 → product is sticky
   - Dollar retention curve rises above 100% → land-and-expand works (the bull case)
   - Dollar retention drops below 80% by month 12 → churn problem dressed as a metrics problem

6. **NDR — the single most diagnostic SaaS metric.** Net Dollar Retention >100% means existing customers spend more over time without new acquisition; it's the math behind every Snowflake / Datadog / Cloudflare narrative. Compute it monthly cohort by cohort, then aggregate. Show the per-cohort and aggregate side-by-side. NDR >130% in SMB is suspicious — investigate (usually price-rises masking churn).

7. **Source-of-truth discipline.** For each metric, write down:
   - **Source system** (Stripe / DB / Salesforce / GA)
   - **SQL or extraction logic** (literal code)
   - **Time window** (calendar month UTC, fiscal quarter, trailing 90d)
   - **Exclusions** (internal accounts, trial accounts, refund-pending, etc.)
   - **Owner** (CFO / FP&A / founder)
   - **Last reconciled** (date)

   When investors push on a metric, you reply with the SQL. Inconsistency between SQL and headline number = trust dead.

8. **The exclusions matter most.** Almost every "ARR fight" with an investor is an exclusions fight:
   - Trialing accounts (Committed ARR excludes)
   - Test/internal accounts (always exclude)
   - Paid pilots <90 days (exclude; not stable)
   - Refund-pending (exclude until window closes)
   - Paused subs (exclude — they're churn-in-progress)
   - Free-grandfathered accounts (exclude — not paying)
   - Annual prepays (include at annualized value, not lump-sum)

9. **Cadence per metric.** Not every metric needs to refresh daily:

   | Metric | Cadence | Why |
   |---|---|---|
   | ARR (Committed) | daily (board pack pull is monthly) | trend-tracking |
   | Net New ARR | monthly | matches sales cycle |
   | NDR / GDR | monthly + quarterly | cohort math is monthly minimum |
   | Cohort retention | monthly | curve smoothing |
   | Logo churn | monthly | volume-sensitive |
   | CAC + payback | quarterly | S&M spend is quarterly noisy |
   | Magic number | quarterly | by definition |
   | Burn multiple | quarterly | by definition |
   | Rule of 40 | quarterly | by definition |
   | Gross margin | quarterly | COGS allocation is hard |

10. **Wire `lib/metrics.ts`.** Single typed module that computes every metric from the source-of-truth systems. Re-running it must be deterministic — same inputs, same outputs. Embed unit tests with golden-master data. Investors who probe a metric can be pointed at this file.

11. **Dashboard wiring.** Embed the live charts in the investor update (Visible pulls Metabase via API). Same chart in monthly update + board deck + data room = same definition, same number, every time. Stale dashboard during a board meeting = credibility hit.

12. **Anti-vanity exclusions.** Do NOT include in the investor-grade dashboard:
    - Cumulative signups (only goes up; meaningless)
    - Page views / unique visitors (not value proxy)
    - App downloads (without activation)
    - Social followers / press mentions (lagging vanity)
    - "Users" without an activation gate (the activation funnel lives elsewhere; cf. `/activation-funnel-diag`)
    - Hours saved / productivity claims without methodology

13. **Anti-patterns to forbid:**
    - Switching ARR definition between investor update, board deck, and data room.
    - Reporting "ARR" when the underlying number is Booked, not Committed.
    - Hiding metrics off-plan in the appendix.
    - Adding a new metric in a strong month and dropping it in a weak month.
    - Using different cohorts in different views (signup-month vs first-paid-month).
    - Manual spreadsheet number that doesn't tie to `lib/metrics.ts`.
    - Re-baselining silently after a data fix (announce it; don't hide it).
    - Rounding aggressively (87.3% NDR ≠ 88% NDR ≠ ~90% NDR in any diligence world).

## Output

Write `docs/inception/kpi-dashboard-investor-grade-<project>.md`:

```markdown
# Investor-Grade KPI Dashboard — <project>
**Owner:** CFO + CEO
**Source-of-truth systems:** Stripe (billing) + Postgres (usage) + Salesforce (pipeline) + Carta (cap table)
**Compute module:** `lib/metrics.ts` (deterministic, tested)
**Dashboard:** <Metabase / Hex / Mode / Looker> embedded in `/investor-update-monthly` + `/board-deck-template`

## North Star Metric
**<NSM>:** <one-sentence definition with numerator + denominator + window + exclusions>
- Why this metric: <customer-value proxy + leading indicator + team-influenceable>
- Source: <system>
- Cadence: <weekly internal / monthly external>

## ARR — the four definitions
| Definition | Used for | This month |
|---|---|---:|
| Booked ARR | sales internal only | $<X> |
| Billed ARR | AR / finance reporting | $<X> |
| Recognized ARR | GAAP / auditor | $<X> |
| **Committed ARR** (HEADLINE) | investor updates, board, diligence | $<X> |

## The 10-metric SaaS canon

### Revenue mechanics
| Metric | Formula | This month | Last month | Δ | vs benchmark |
|---|---|---:|---:|---:|:---:|
| Committed ARR | active_paid_subs × annual_price (exclusions below) | $<X> | $<X> | <%> | — |
| New ARR | ARR from net-new logos | $<X> | $<X> | <%> | — |
| Expansion ARR | upsell within existing logos | $<X> | $<X> | <%> | — |
| Contraction ARR | downgrades within existing logos | $<X> | $<X> | <%> | — |
| Churned ARR | ARR lost to logo churn | $<X> | $<X> | <%> | — |
| Net New ARR | New + Expansion - Contraction - Churned | $<X> | $<X> | <%> | — |

### Retention
| Metric | Formula | This month | Benchmark band | Status |
|---|---|---:|---|---|
| Gross Dollar Retention | (start - churn - contraction) / start | <X>% | SMB >90% / Mid >95% | <green/yellow/red> |
| Net Dollar Retention | (start + expansion - contraction - churn) / start | <X>% | SMB >100% / Mid >115% | <g/y/r> |
| Logo Churn (monthly) | churned_logos / starting_logos | <X>% | SMB <2% / Mid <1% | <g/y/r> |
| Gross Margin | (revenue - COGS) / revenue | <X>% | SaaS >70% | <g/y/r> |

### Efficiency
| Metric | Formula | This Q | Benchmark | Status |
|---|---|---:|---|---|
| CAC | S&M spend / new customers | $<X> | — | — |
| LTV | (ARPU × GM) / churn rate | $<X> | — | — |
| LTV/CAC | LTV / CAC | <X.x> | >3x | <g/y/r> |
| CAC Payback (mo) | CAC / (ARPU × GM / 12) | <X> mo | <12mo | <g/y/r> |
| Burn Multiple | net burn / net new ARR | <X.x> | <2 | <g/y/r> |
| Magic Number | (Q ARR added × 4) / prior_Q_S&M | <X.x> | >0.75 | <g/y/r> |
| Rule of 40 | growth% + FCF margin% | <X>% | >40 | <g/y/r> |

## Cohort retention tables

### Logo retention (by signup-month cohort)
| Cohort | M0 | M3 | M6 | M12 | M24 |
|---|---:|---:|---:|---:|---:|
| 2024-Q1 | 100% | 87% | 78% | 71% | 65% |
| 2024-Q2 | 100% | 89% | 82% | 75% | <> |
| ... | | | | | |

### Dollar retention (by signup-month cohort)
| Cohort | M0 | M3 | M6 | M12 | M24 |
|---|---:|---:|---:|---:|---:|
| 2024-Q1 | 100% | 102% | 108% | 117% | 124% |
| ... | | | | | |

## Source-of-truth per metric
| Metric | Source | SQL ref | Window | Exclusions | Owner | Last reconciled |
|---|---|---|---|---|---|---|
| Committed ARR | Stripe + DB | `lib/metrics.ts:committedArr()` | last day of UTC month | trial, refund-pending, paused, internal | CFO | <date> |
| Net New ARR | DB | `lib/metrics.ts:netNewArr()` | calendar month UTC | as above | CFO | <date> |
| NDR | DB | `lib/metrics.ts:ndr()` | monthly cohorts | as above | CFO | <date> |
| Logo Churn | DB | `lib/metrics.ts:logoChurn()` | calendar month UTC | as above + free-grandfathered | CFO | <date> |
| CAC | Salesforce + accounting | `lib/metrics.ts:cac()` | trailing quarter | inbound-only, paid-only | CFO | <date> |
| LTV | DB | `lib/metrics.ts:ltv()` | annual | as above | CFO | <date> |
| Burn Multiple | accounting | `lib/metrics.ts:burnMultiple()` | quarterly | one-time gains, M&A | CFO | <date> |
| Rule of 40 | accounting | `lib/metrics.ts:ruleOf40()` | trailing 12mo | M&A | CFO | <date> |

## Exclusions canon (apply uniformly)
- Trialing accounts: excluded from ARR until first paid invoice
- Test / internal accounts: always excluded (filter on `account.is_internal`)
- Paid pilots <90 days: excluded from Committed ARR (volatile)
- Refund-pending: excluded until refund window closes
- Paused subs: excluded (churn-in-progress)
- Free-grandfathered: excluded
- Annual prepays: counted at annualized value, not lump-sum

## Cadence per metric
| Metric | Refresh | Reporting |
|---|---|---|
| Committed ARR | daily | monthly to investors |
| Net New ARR | daily | monthly |
| NDR | monthly | monthly + quarterly |
| Cohort retention | monthly | quarterly to board |
| Logo churn | monthly | monthly |
| CAC, LTV, payback | quarterly | quarterly to board |
| Magic number, burn multiple | quarterly | quarterly |
| Rule of 40 | quarterly | quarterly |
| Gross margin | quarterly | quarterly |

## Anti-vanity exclusions
- ❌ Cumulative signups
- ❌ Page views / unique visitors
- ❌ App downloads (without activation gate)
- ❌ Social followers / press mentions
- ❌ "Users" without paid or activation gate
- ❌ Hours saved / productivity claims without methodology

## Discipline rules
- Same definition, same number, every venue (update / board / data room)
- New metric introduced = explain in update
- Metric dropped = explain in update (or it's a red flag)
- Re-baseline = announced explicitly (never silent)
- Stale dashboard during board = credibility hit

## Pitfalls flagged
- [ ] NSM picked + locked
- [ ] ARR definition picked (Committed default) + locked
- [ ] All 10 canon metrics defined with formulas
- [ ] Source-of-truth per metric
- [ ] Exclusions canonical and applied uniformly
- [ ] `lib/metrics.ts` deterministic + tested
- [ ] Dashboard embedded in monthly + board
- [ ] Cohort tables computed and refreshed monthly
- [ ] Benchmark bands shown alongside each metric

## Anti-patterns enforced
- ❌ Booked-ARR-as-headline switch in a strong month
- ❌ Switching ARR definition between venues
- ❌ Manual spreadsheet not tied to `lib/metrics.ts`
- ❌ Silent re-baseline after data fix
- ❌ Different cohorts in different views
- ❌ Aggressive rounding (87.3% ≠ 90%)

## References
- NSM: `/north-star-metric-pick`
- Unit econ inputs: `/unit-economics-model`
- Monthly update: `/investor-update-monthly`
- Board deck: `/board-deck-template`
- Data room: `/data-room-prep`
```

Write `lib/metrics.ts` scaffold:

```ts
// Single source of truth for all investor-grade KPI computation.
// Deterministic, tested. Same inputs → same outputs.

export type MetricWindow = { start: Date; end: Date };

export interface MetricsContext {
  db: Database;
  stripe: StripeClient;
  fiscalCalendar: FiscalCalendar;
}

export async function committedArr(ctx: MetricsContext, asOf: Date): Promise<number> {
  // active paid subscriptions × annual price
  // excludes: trial, refund-pending, paused, internal, free-grandfathered
  // ...
}

export async function netNewArr(ctx: MetricsContext, window: MetricWindow): Promise<number> {
  // newARR + expansionARR - contractionARR - churnedARR
  // ...
}

export async function ndr(ctx: MetricsContext, cohort: Date, periodMonths: number): Promise<number> {
  // (start_ARR + expansion - contraction - churn) / start_ARR
  // ...
}

export async function logoChurn(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
export async function cac(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
export async function ltv(ctx: MetricsContext, asOf: Date): Promise<number> { /* ... */ }
export async function cacPaybackMonths(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
export async function burnMultiple(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
export async function magicNumber(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
export async function ruleOf40(ctx: MetricsContext, trailingMonths = 12): Promise<number> { /* ... */ }
export async function grossMargin(ctx: MetricsContext, window: MetricWindow): Promise<number> { /* ... */ }
```

## Verification
- ARR definition is picked (Committed default), written down, and locked — same number across update / board / data room.
- All 10 canon metrics have a formula, source, SQL/code reference, window, exclusions, and owner.
- `lib/metrics.ts` is deterministic and has golden-master unit tests.
- Benchmark bands are shown alongside each metric in the dashboard.
- Cohort retention (logo + dollar) tables refresh monthly.
- Exclusions canon is applied uniformly; no off-the-shelf vanity metrics in the investor view.
- Dashboard embeds into `/investor-update-monthly` and `/board-deck-template` automatically.
- Re-baselining requires an explicit changelog entry in the dashboard doc.
