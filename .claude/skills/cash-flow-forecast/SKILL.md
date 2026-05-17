---
name: cash-flow-forecast
description: Month-by-month cash flow projection (collections vs payments). Deeper than runway-model. Outputs to `docs/inception/cash-flow-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "cash flow", "AR", "collections timing", "/cash-flow-forecast", or for B2B with invoicing.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /cash-flow-forecast — Cash Flow Detail

## Why you'd care

A profitable B2B startup with 60-day AR and 30-day AP can still die in the gap. Month-by-month collections-vs-payments modeling surfaces the cash trough before you sign the customer who'd otherwise tip you over it.

Invoke as `/cash-flow-forecast`. Cash ≠ revenue. AR/AP timing kills B2B startups.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (Stripe-instant, no invoicing)
2. Read `docs/inception/runway-<project>.md` + `cost-model-<project>.md`.

## Inputs
- Revenue plan (when invoiced).
- Collection terms (NET-30, NET-60).
- Vendor payment terms.
- Payroll schedule.
- Tax payment dates (estimated quarterly).

## Process
1. **Cash inflows by month**:
   - Subscription (Stripe instant) — collected mo of charge
   - Annual prepay — collected upfront, recognized over 12
   - Invoiced (NET-X) — collected X days after delivery; build aging
   - Refunds and chargebacks (3–5% reserve)
2. **Cash outflows by month**:
   - Payroll (bi-weekly or monthly)
   - Vendor payments (per terms)
   - Estimated quarterly tax (US: Apr 15, Jun 15, Sep 15, Jan 15)
   - Annual fees (insurance, software annual, audit)
   - Capex (rare)
3. **AR aging buckets** — current / 30 / 60 / 90+ — model bad debt at 90+.
4. **Working capital crunch points** — when payroll due before AR collected.
5. **Mitigation** — annual prepay discount, factoring, line of credit, milestone billing.

## Output
Write `docs/inception/cash-flow-<project>.md`:

```markdown
# Cash Flow Forecast — <project>
**Date:** <YYYY-MM-DD> | **Horizon:** 12 mo

## Month-by-month (12 mo)
| Mo | Revenue earned | Cash collected | Outflows | Net cash | Cum cash |
|---|--:|--:|--:|--:|--:|
| M1 | $5000 | $3000 (60% Stripe) | -$10000 | -$7000 | $43000 |
| M2 | $7000 | $7000 (M1 invoice) | -$10500 | -$3500 | $39500 |
| M3 | $9000 | $5000 (Stripe) + $4000 (M1 prepay) | -$11000 | -$2000 | $37500 |
| ... | ... | ... | ... | ... | ... |
| M12 | $35000 | $32000 | -$22000 | +$10000 | $45000 |

## AR aging projection (M6 example)
| Bucket | Amount | Bad debt risk |
|---|--:|--:|
| Current | $15000 | 0% |
| 30-day | $8000 | 2% |
| 60-day | $3000 | 10% |
| 90+ | $1000 | 50% (reserve $500) |

## Outflow timing (12-mo grid)
| Item | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Payroll | $5k | $5k | $5k | $5k | $5k | $5k | $5k | $5k | $5k | $5k | $5k | $5k |
| Tools | $0.5k | | | $0.5k | | | $0.5k | | | $0.5k | | |
| Annual ins | $0.8k | | | | | | | | | | | |
| Q-tax | | | | $2k | | $2k | | | $2k | | | $2k |
| ... | | | | | | | | | | | | |

## Working capital crunch points
| Month | Issue | Mitigation |
|---|---|---|
| M3 | Tax payment + payroll same wk | bridge from M2 cash buffer |
| M7 | Annual software renewal $5k | negotiate quarterly billing |
| M9 | Big invoice NET-60 due M11; payroll M9-M10 | line of credit $20k |

## Cash safety threshold
- Minimum cash buffer: 3-mo opex = $30k
- Trigger to act if cash <$30k: <action>

## Mitigation tactics
- Annual prepay discount (10% off) → encourages upfront cash
- Stripe Capital / Brex for short-term LOC
- Factoring (Bluevine, Kabbage) for invoices NET-60+
- Milestone billing for enterprise (50% upfront / 50% on go-live)

## Verdict
**CASH-FLOW-HEALTHY / TIGHT / FRAGILE (one slow-pay = miss payroll)**
```

## Verification
- Month-by-month grid shows collections separate from revenue earned.
- AR aging modeled.
- Outflow timing grid shows lumpy items (tax, annual).
- Crunch points identified.
- Mitigation tactics named.
