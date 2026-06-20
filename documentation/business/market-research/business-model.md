# Business Model — Commission, Unit Economics, Acquisition

## Commission Structure

| Model | Rate | Rationale |
|---|---|---|
| **Default commission** | **6%** of ticket value | Below VeXeRe's estimated ~8-12% and redBus's 10-20%. Configurable per operator via admin panel. |
| Floor | 5% | Below this, unit economics negative after payment processing (1.5-2.5%) and support costs |
| Ceiling | 20% | Code-enforced maximum (MAX_FEE_OVERRIDE_PPM = 200,000) |
| **Promotional override** | Admin-configurable per operator | Can lower/raise within floor-ceiling for pilot periods, volume deals, or corridor-specific incentives |

Commission absorbed by operator, invisible to customer. Any visible booking fee drives price-sensitive Vietnamese users to call operator directly.

## Unit Economics (6% Commission on 400,000 VND Average Ticket)

```
Commission revenue:           24,000 VND
Payment processing (2%):      -8,000 VND
Notification costs (ZNS/SMS): -1,000 VND
Customer support (est.):      -3,000 VND
Blended CAC (amortized):     -10,000 VND
Infrastructure (amortized):   -2,000 VND
Net margin per booking:         ~0 VND (breakeven at 6% on 400K ticket)
```

At 6% on 400K VND avg ticket, unit economics are tight. Profitable paths: (a) higher AOV corridors like Thanh Hoa ↔ TPHCM (875K-1,750K VND → 52.5K-105K commission), (b) admin raises rate for established operators, (c) SaaS tier adds subscription revenue. Break-even depends heavily on corridor mix and CAC efficiency.

## Key Unit Economics Targets

| Metric | Target |
|---|---|
| Average ticket value | 350,000-500,000 VND |
| Blended commission rate | 6% default (admin-configurable) |
| Payment processing cost | 1.5-2.5% of ticket |
| Net margin per booking | 4-6% of ticket value |
| Monthly bookings to break even | 50,000-100,000 |
| Operator count to reach target volume | 100-200 active operators |
| Customer LTV (annual) | 4-6 bookings x 400k VND x 6% commission = 96-144k VND |
| Target CAC | < 80,000 VND (~$3 USD), must be < 50% of first-year LTV |

## Dual Pricing Model

Offer operators a choice:
- **Commission model**: 0 VND/month subscription, 6% per booking (admin-configurable). Best for low-volume operators testing the platform.
- **SaaS model**: 1-2M VND/month subscription, 3-5% per booking. Best for higher-volume operators who want lower variable costs.

Mirrors "Shopify Basic vs. Shopify Plus" structure. Validated by VeXeRe's dual BMS/commission model.

## Additional Revenue Streams (Ranked by Feasibility)

| # | Revenue Stream | Feasibility | Revenue Potential | When |
|---|---|---|---|---|
| 1 | **Operator SaaS subscription** (console without marketplace commission) | HIGH — product already built | 500k-2M VND/month per operator | Launch |
| 2 | **Promoted/featured listings** (operator pays for top placement) | HIGH — standard marketplace monetization | 1-5M VND/month per operator | Month 3-6 |
| 3 | **Travel insurance add-on** (Bao Viet or equivalent) | MEDIUM — requires insurance partner | 6,000-8,000 VND per conversion (30-40% of 20k VND premium) | Month 6-12 |
| 4 | **Promo/voucher co-funding** (operators co-fund platform promotions) | MEDIUM | Variable | Month 3-6 |
| 5 | **Agent/reseller network** (AMS for travel agents) | LOW near-term | CPS commission 2-8% | Month 12+ |
| 6 | **Data/analytics products** (route demand, occupancy optimization) | LOW near-term | Premium SaaS tier | Month 12+ |

## Acquisition Strategy

> Detailed operator acquisition playbook (4-phase beachhead → scale plan) and customer acquisition channels (ranked by ROI) are in [`strategic-roadmap.md`](strategic-roadmap.md). Summary below.

**Operator acquisition**: Beachhead corridor (Thanh Hoa ↔ TPHCM) → tourist corridors → regional scale → distribution partnerships. Direct sales first; Zalo OA/Facebook groups for scale.

**Customer acquisition**: Operator's own channels (near-zero CAC) is BB's structural advantage. Supplemented by Google SEO (long-tail route keywords), Zalo OA/ZNS campaigns, and MoMo/ZaloPay distribution partnerships.

**Target CAC**: < 80,000 VND (~$3 USD), must be < 50% of first-year LTV.
