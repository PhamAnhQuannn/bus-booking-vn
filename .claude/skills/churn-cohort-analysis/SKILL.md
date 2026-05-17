---
name: churn-cohort-analysis
description: Monthly cohort retention + churn analysis so you see whether new cohorts are getting better or worse. Outputs to `docs/product/churn-cohorts.md`. Reads `/project-classify` to skip XS. Use when user says "cohort analysis", "retention curve", "churn rate", "monthly cohort", "/churn-cohort-analysis", or after first 3 months of paying customers.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 8h
---

# /churn-cohort-analysis — Monthly Cohort Retention

## Why you'd care

Aggregate retention masks a deteriorating product — new cohorts can be churning faster while older cohorts hold the average up. Cohort retention is the only view that tells you whether the product is actually getting better or just running on inherited goodwill.

Invoke as `/churn-cohort-analysis`. Aggregate retention lies. Cohort retention tells the truth: are users acquired in month N still around in month N+K? Is it getting better?

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Signup date + last-active or last-paid date tracked per user.
3. ≥3 cohorts of data (≥90 days of users).

## Inputs
- Churn definition (cancel? non-renewal? no login in 30d?)
- Cohort grain (monthly default; weekly for high-velocity)
- Segment splits (plan, channel, persona)
- Retention curve baseline (industry: B2B SaaS 90%+ MoM; B2C 60-80%; mobile games 20%)

## Process

1. **Define "retained" precisely** — not the same as "active":

   | Product type | Retained means |
   |---|---|
   | Paid SaaS | active subscription this month |
   | Freemium | logged in + did key action this month |
   | Marketplace | completed transaction this month |
   | Content / consumer | session this month |

   Pick one definition; document it; never change without re-baselining.

2. **Cohort matrix** — rows = signup month, cols = months since signup:

   |  | M0 | M1 | M2 | M3 | M6 | M12 |
   |---|---|---|---|---|---|---|
   | Jan-2026 | 100% | 60% | 45% | 38% | 30% | 25% |
   | Feb-2026 | 100% | 65% | 50% | 42% | 32% | — |
   | Mar-2026 | 100% | 70% | 55% | 45% | — | — |
   | Apr-2026 | 100% | 68% | 52% | — | — | — |
   | May-2026 | 100% | 72% | — | — | — | — |

   Read diagonally (each cohort improving) AND vertically (M1 trend up = better activation).

3. **Smile curve check** — does retention flatten?
   - Healthy: drops fast then flattens (you found product-market fit; the retained users stay)
   - Unhealthy: drops linearly forever (no PMF; everyone leaves eventually)
   - Plot retention vs months-since-signup; look for asymptote
   - Asymptote level = your "core user" rate (often 20-40% in B2C; 70-90% in B2B SaaS)

4. **Churn rate** — multiple flavors:

   | Metric | Formula | Use |
   |---|---|---|
   | Logo churn | cancelled accounts / starting accounts | volume signal |
   | Revenue churn (gross) | $ lost / $ starting | $-impact |
   | Revenue churn (net) | ($ lost - $ expansion) / $ starting | true MRR motion |
   | NRR (net retention rate) | 1 - net churn | best one-number health |

   NRR ≥ 100% = expansion offsets churn = compounding growth.

5. **Segment cohort cuts** — same matrix per segment:
   - By plan (free, pro, enterprise) — enterprise should retain better
   - By channel (organic, paid, referral) — refs usually retain best
   - By persona (if known) — early-adopter vs mainstream
   - By onboarding completion (activated vs not) — gap reveals activation ROI

6. **Churn reason interviews** — top 10 monthly churners:
   - Cancellation reason on the way out (multi-select + free text)
   - Email 10 randoms within 7d: "what could we have done?"
   - Tag reasons: no-value / wrong-fit / price / bug / competitor / job-change
   - Bug/wrong-fit/price = product action; job-change = uncontrollable

7. **Trend over time** — month-over-month deltas:
   - M1 retention by cohort, last 12 cohorts → improving or flat?
   - If flat: activation work isn't moving the needle
   - If improving: lock and continue
   - If degrading: new sign-ups worse than old; channel mix shifting?

8. **Action triage**:

   | Symptom | Action |
   |---|---|
   | M1 retention low (<40%) | activation problem; run `/activation-funnel-diag` |
   | M3-M6 cliff | habit-loop missing; investigate engagement triggers |
   | Long-tail churn (M6+) | expansion / value-delivery issue |
   | Logo churn ok, revenue churn high | losing big customers; CS focus |
   | Negative NRR | structural; pricing or fit |

9. **Anti-patterns**:
   - Aggregate churn rate as the only KPI — masks cohort improvement
   - "Churn rate 5%" without window — monthly? annual? per-segment?
   - One cohort interpreted as trend — need 3+
   - Mixing free + paid in same matrix — different products effectively
   - No reason data — can't act on root cause
   - Surveying only survivors — survivorship bias

## Output

Write `docs/product/churn-cohorts.md`:

```markdown
# Cohort Retention — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/growth>

## Definitions
- Retained: <precise definition>
- Cohort: signup month
- Churn: complement of retained

## Cohort matrix (logo)
|  | M0 | M1 | M2 | M3 | M6 | M12 |
|---|---|---|---|---|---|---|
| Jan | 100% | x% | x% | x% | x% | x% |
| Feb | 100% | x% | x% | x% | x% | — |
| ... |

## Churn metrics (trailing 90d)
- Logo churn: x%
- Gross revenue churn: x%
- Net revenue churn: x%
- NRR: x%

## Curve shape
- M0→M3 slope, M3→M12 slope
- Asymptote estimate (core user rate)
- Healthy / unhealthy

## Segment cuts
| Segment | M1 | M3 | M6 |
|---|---|---|---|
| Free | x | x | x |
| Pro | x | x | x |
| Enterprise | x | x | x |

## Top churn reasons (last 30 churners)
| Reason | Count | % |
|---|---|---|
| Wrong fit | 12 | 40% |
| Price | 6 | 20% |
| Bug / friction | 5 | 17% |
| Job change | 4 | 13% |
| Competitor | 3 | 10% |

## Trend
- M1 retention by cohort, last 12: <chart link>
- Direction: improving / flat / degrading

## Actions
- Top: <intervention> based on <evidence>
- Owner + decision date
```

## Verification
- Retention defined precisely; same definition over time.
- Cohort matrix rendered (not just aggregate).
- Logo + revenue + NRR all reported.
- Segment cuts present.
- Reason data captured from at least last 30 churners.
- Trend over ≥3 cohorts read for direction.
- Action item with owner + date.
