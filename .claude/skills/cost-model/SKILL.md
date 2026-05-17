---
name: cost-model
description: COGS + opex projection per customer + per month. Outputs to `docs/inception/cost-model-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "cost model", "COGS", "burn rate", "/cost-model", or before pricing.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /cost-model — Cost Modeling

## Why you'd care

LLM-heavy products that look 80% margin on the slide deck quietly turn 17% margin once a single power user 10x's their token spend — and you only find out the month payroll lands on a thinner runway than expected. Itemizing COGS plus the scaling step-functions before pricing is what stops you from selling a product whose unit economics break the day it succeeds.

Invoke as `/cost-model`. Know costs before pricing. Hidden costs kill margins.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- Stack (cloud / DB / 3rd-party APIs).
- Per-customer compute / storage / API call estimates.
- Headcount + comp.

## Process
1. **Per-customer COGS** — variable cost per active user/month:
   - Compute (CPU, GPU)
   - Storage
   - Egress bandwidth
   - 3rd-party API (LLM tokens, payments, email, SMS)
   - Support (avg minutes × loaded cost)
2. **Fixed monthly opex**:
   - Founder salary (or opportunity cost)
   - Tools (productivity, dev, monitoring)
   - Hosting baseline
   - Legal/accounting retainers
   - Marketing/content tools
3. **Scaling triggers** — when does cost step:
   - 100 users → upgrade DB
   - 1k users → CDN
   - 10k users → dedicated infra
4. **Break-even computation** — fixed / (price − COGS-per-user) = users needed.
5. **Margin sensitivity** — LLM-heavy products: token cost dominates; check at 10x usage.

## Output
Write `docs/inception/cost-model-<project>.md`:

```markdown
# Cost Model — <project>
**Date:** <YYYY-MM-DD>

## Per-customer COGS (monthly)
| Item | Unit cost | Per customer | Notes |
|---|---|---|---|
| Compute (Vercel/Render) | $0.0001/req | $0.50 | 5k req/mo avg |
| Storage (S3) | $0.023/GB | $0.05 | 2GB avg |
| LLM API (OpenAI) | $0.005/1k token | $2.50 | 500k tokens/mo |
| Email (Resend) | $0.001/email | $0.10 | 100 emails |
| Stripe fees | 2.9% + $0.30 | varies | excl below |
| Support cost | 5min × $1/min | $5.00 | for Pro tier |
| **Total COGS / user** | | **$8.15** | |

## Fixed monthly opex
| Item | Cost |
|---|--:|
| Founder salary (or opp cost) | $8000 |
| Tools (Notion, Linear, Sentry, etc.) | $300 |
| Hosting baseline | $100 |
| Legal/accounting retainer | $500 |
| **Total fixed** | **$8900** |

## Scaling step-function
| Trigger | New cost | Item |
|---|---|---|
| 100 users | +$200/mo | DB upgrade |
| 1k users | +$500/mo | CDN |
| 10k users | +$3000/mo | dedicated infra + 1 SRE |

## Break-even
- Pricing assumed: $40/mo
- Per-user contribution = $40 − $8.15 = $31.85
- Users to break even = $8900 / $31.85 = **280 paying users**

## Margin sensitivity (LLM-heavy)
| Scenario | LLM tokens/user | COGS/user | Margin @ $40 |
|---|--:|--:|--:|
| Base | 500k | $8.15 | 80% |
| Heavy use 5x | 2.5M | $20.65 | 48% |
| Heavy use 10x | 5M | $33.15 | 17% |

## Verdict
**MARGINS-SAFE / MARGIN-RISK (heavy use kills) / UNECONOMIC**

## Mitigations if margin-risk
- Caps on LLM usage per tier
- Cheaper model tier (Haiku vs Opus)
- Cache + retrieval to cut tokens
- Self-host model at scale
```

## Verification
- COGS broken to ≥5 line items.
- Fixed opex includes founder time.
- Scaling step-functions named.
- Break-even computed.
- Sensitivity for dominant cost.
