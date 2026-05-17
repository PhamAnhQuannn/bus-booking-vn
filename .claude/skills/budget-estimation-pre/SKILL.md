---
name: budget-estimation-pre
description: Pre-build budget — 12-mo cash plan by category (product, ops, marketing, legal). Outputs to `docs/inception/budget-pre-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "budget", "spending plan", "/budget-estimation-pre", or before commit.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /budget-estimation-pre — 12mo Budget

## Why you'd care

Hidden costs — domain renewals, observability spend at the next traffic tier, the second SOC2 audit — eat runway nobody planned for. A bottom-up 12-month budget surfaces them at month zero instead of month nine.

Invoke as `/budget-estimation-pre`. Bottom-up budget. Hidden costs surface here.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/cost-model-<project>.md` + `runway-<project>.md` if exist.

## Inputs
- Funding/cash available.
- Stack + tools.
- Hires planned.

## Process
1. **Categories** (always cover):
   - Product: founder time, contractors, design
   - Infra: hosting, DB, CDN, monitoring
   - Tools: dev, productivity, support, analytics
   - Marketing: content, ads, events, swag
   - Sales (if applicable): SDR comp, CRM
   - Legal: incorporation, ToS/PP, contracts, IP
   - Accounting: bookkeeper, tax, audit
   - Office/equipment (if needed)
   - Insurance (E&O, cyber, GL)
   - Banking + fees
   - Founder comp / draw
   - Buffer (10–20%)
2. **Per category, 12-mo line items**:
   - Month 1–12 by line
   - Quarterly reviews built in
3. **Hidden cost flags** — common misses:
   - Domain renewal + premium TLD
   - SSL/cert costs (mostly free now)
   - State filing fees + franchise tax
   - Sales tax registration multi-state
   - Software annual contracts (vs monthly)
   - Conference travel + booth
   - Founder benefits / health insurance
4. **Buffer for unknowns** — 15% line item.

## Output
Write `docs/inception/budget-pre-<project>.md`:

```markdown
# Pre-Build Budget — <project>
**Date:** <YYYY-MM-DD> | **Horizon:** 12 mo

## Total budget summary
| Category | 12-mo total | % of total |
|---|--:|--:|
| Product (founder + contractors) | $X | % |
| Infra (hosting + monitoring) | $X | % |
| Tools (subscriptions) | $X | % |
| Marketing | $X | % |
| Legal (one-time + ongoing) | $X | % |
| Accounting | $X | % |
| Insurance | $X | % |
| Founder comp | $X | % |
| Buffer (15%) | $X | 15% |
| **TOTAL** | **$X** | 100% |

## Detailed line items

### Product
| Item | Mo cost | Annual | Notes |
|---|--:|--:|---|
| Founder time (opportunity) | $8000 | $96000 | base salary equiv |
| Designer contractor (Q1 only) | $5000 (3mo) | $15000 | brand + UI |
| Code review service | $200 | $2400 | weekly |

### Infra
| Item | Mo cost | Annual |
|---|--:|--:|
| Vercel (hosting) | $20 | $240 |
| PlanetScale (DB) | $40 | $480 |
| Sentry (errors) | $30 | $360 |
| Upstash Redis | $10 | $120 |
| Domain | — | $12 |

### Tools
| Item | Mo cost | Annual |
|---|--:|--:|
| Linear | $10 | $120 |
| Notion | $10 | $120 |
| GitHub Pro | $4 | $48 |
| Figma | $15 | $180 |
| 1Password | $8 | $96 |
| ... | | |

### Marketing
| Item | Mo cost | Annual |
|---|--:|--:|
| Newsletter (Beehiiv) | $0–$40 | $480 |
| SEO tool (Ahrefs Lite) | $99 | $1188 |
| Twitter Premium | $8 | $96 |
| Paid ads test (Q2) | — | $1500 |
| Conference (1, Q3) | — | $2000 |

### Legal (one-time + ongoing)
| Item | Cost | When |
|---|--:|---|
| Incorporation (DE C-Corp via Stripe Atlas) | $500 | one-time |
| Registered agent | $125/yr | annual |
| ToS/PP template (Termly) | $20/mo | recurring |
| Contract templates | $500 | one-time |
| Trademark filing (US, 1 class) | $350 | one-time Q2 |
| Annual report filing | $100 | annual |

### Accounting
| Item | Cost | When |
|---|--:|---|
| Bookkeeper (Bench/Pilot) | $200/mo | recurring |
| Tax filing (CPA) | $1500 | annual |
| Sales tax compliance (Stripe Tax) | included | with Stripe |

### Insurance
| Item | Annual |
|---|--:|
| E&O / cyber liability ($1M) | $800 |
| General liability | $400 |

### Hidden costs spotted
- Sales tax registration (MA, CA): $200 each
- Premium TLD if available .com: extra $5k aftermarket
- App Store fees if mobile: $99/yr Apple, $25 one-time Google
- GitHub Actions overage: budget $50/mo

## 12-mo cumulative cash burn
| Quarter | Budget spend | Cum |
|---|--:|--:|
| Q1 | $X | $X |
| Q2 | $X | $X |
| Q3 | $X | $X |
| Q4 | $X | $X |

## Decision triggers
- M3: revisit budget vs actual; flag overruns >10%
- M6: shut down low-ROI line items
- M9: scale up working categories

## Verdict
**BUDGET-FITS-CASH (covers 12mo) / TIGHT (covers 8–11mo) / OVER (re-plan)**
```

## Verification
- All 9+ categories budgeted.
- Hidden-cost checklist applied.
- Annual vs monthly clearly tagged.
- Quarterly cum shown.
- Verdict named.
