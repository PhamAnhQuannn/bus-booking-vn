---
name: unit-economics-model
description: CAC, LTV, payback, gross margin per customer cohort. Outputs to `docs/inception/unit-economics-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "unit economics", "CAC LTV", "/unit-economics-model", or before raising.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /unit-economics-model — Unit Economics

Invoke as `/unit-economics-model`. LTV/CAC ≥3 + payback ≤12mo = healthy. Else broken.

## Why you'd care

Without CAC, LTV, payback, and gross margin per cohort, you can't tell whether growth is creating value or burning cash faster. Unit economics is the math that converts "we're growing" into "and it's worth growing."

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pricing-<project>.md` + `cost-model-<project>.md` if exist.

## Inputs
- ACV / ARPU (annual revenue per customer).
- Gross margin % (revenue − COGS).
- CAC by channel (paid spend / signups × conversion).
- Monthly/annual churn % (logo + revenue).

## Process
1. **CAC computation per channel**:
   - Paid: ad spend / paying conversions
   - Inbound: (content + tooling + time-cost) / paying conversions
   - Outbound: SDR+AE comp / paying conversions
   - Blended: total S&M cost / total new paying customers
2. **LTV computation**:
   - Simple: ARPU × Gross margin / monthly churn
   - Cohort: actual revenue retained over 12/24/36 mo
3. **Payback period**:
   - CAC / (ARPU × Gross margin / 12) = months
4. **Health thresholds**:
   - LTV/CAC ≥3 (≥5 great)
   - Payback ≤12 mo (≤6 great)
   - Gross margin ≥70% SaaS / ≥40% physical
   - Net dollar retention ≥100% (≥120% great)
5. **Sensitivity** — if churn doubles or CAC doubles, still healthy?

## Output
Write `docs/inception/unit-economics-<project>.md`:

```markdown
# Unit Economics — <project>
**Date:** <YYYY-MM-DD>

## Inputs
- ACV: $<X>
- Gross margin: <Y>%
- Monthly churn: <Z>%
- Net dollar retention: <W>%

## CAC by channel
| Channel | Spend | Paying conversions | CAC |
|---|--:|--:|--:|
| SEO/content | $0 (time) | 20 | $0 |
| SEM | $3000 | 6 | $500 |
| Outbound | $4000 (SDR comp) | 4 | $1000 |
| **Blended** | $7000 | 30 | **$233** |

## LTV
- Simple: $X × <gm> / <churn> = $<LTV>
- Cohort 24-mo actual: $<Y>

## Key ratios
| Metric | Value | Threshold | Status |
|---|--:|--:|---|
| LTV/CAC | 4.5 | ≥3 | ✓ |
| Payback (mo) | 8 | ≤12 | ✓ |
| Gross margin | 78% | ≥70% | ✓ |
| NDR | 105% | ≥100% | ✓ |
| Monthly churn | 4% | ≤5% | ✓ |

## Sensitivity
| Scenario | LTV/CAC | Payback | Verdict |
|---|--:|--:|---|
| Base | 4.5 | 8 | healthy |
| Churn 2x | 2.3 | 8 | broken |
| CAC 2x | 2.3 | 16 | broken |
| Both 2x | 1.1 | 16 | dead |

## Verdict
**HEALTHY / FRAGILE / BROKEN**
- Healthy: LTV/CAC ≥3 + payback ≤12 mo + survives 1 stress
- Fragile: meets base but breaks under stress
- Broken: base fails

## Action if BROKEN
1. Raise price (test elasticity)
2. Reduce CAC (channel mix shift)
3. Reduce churn (onboarding, success)
4. Increase ARPU (upsell, NDR push)
```

## Verification
- CAC per channel + blended.
- LTV computed simple + cohort if data.
- All 5 ratios tabled.
- Sensitivity ≥2 stresses.
- BROKEN triggers action plan.
- Hand off to `/unit-econ-viability-gate` for hard verdict (VIABLE/TIGHT/UNVIABLE) before `/inception-gate-review`.
