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

## Operator Acquisition Playbook

### Phase 1 (Month 0-3): Beachhead — 10-20 Operators in One Corridor

- **Target**: Small-to-medium operators on beachhead corridor **Thanh Hoa ↔ TPHCM** (labor migration, underserved by VeXeRe, high avg ticket 875K-1,750K VND)
- **Value prop**: "Compliant e-invoicing from day one + your own branded booking page + T+1 settlement (faster than any competitor)"
- **Acquisition channel**: Direct sales — visit bus stations, meet operator managers in person. Vietnamese B2B sales is relationship-driven.
- **Offer**: 6% default commission (admin can adjust per operator during pilot)

### Phase 2 (Month 3-6): Tourist Corridor Expansion — 50+ Operators

- **Target**: Operators on tourist routes (higher AOV, tech-savvier customers)
- **Value prop**: "Your buses are already on 12Go/Bookaway for foreign tourists — BB gives you a branded channel for Vietnamese customers too"
- **Acquisition channel**: Direct sales + referral from Phase 1 operators

### Phase 3 (Month 6-12): Regional Scale — 200+ Operators

- **Target**: Provincial operators too small for VeXeRe's attention
- **Value prop**: "VeXeRe ignores operators with fewer than 10 buses. BB was built for you."
- **Acquisition channel**: Zalo OA campaigns, Facebook groups for bus operators, industry association partnerships

### Phase 4 (Month 12+): Distribution Partnerships

- Negotiate MoMo/ZaloPay distribution (BB operators' inventory in super-app booking flows)
- Build 12Go/Bookaway API integration (BB operators' routes visible to international tourists)
- Launch agent/reseller program

## Customer Acquisition Channels (Ranked by ROI)

| # | Channel | CAC Estimate | Priority | Notes |
|---|---|---|---|---|
| 1 | **Operator's own channels** (Facebook page, Zalo group, station signage) | Near zero | HIGHEST | BB's structural advantage — operators send existing customers to branded BB page |
| 2 | **Google SEO — route-specific long-tail keywords** | Low (content investment, 12-24 month payoff) | HIGH | "ve xe Sapa Ha Noi," "ve xe Da Lat TPHCM" etc. Long-tail provincial routes undercontested |
| 3 | **Zalo OA / ZNS campaigns** | $3-5 USD first-booking CAC | HIGH | 25-35% lower CAC than Facebook for local services |
| 4 | **MoMo/ZaloPay distribution** | Near zero marginal CAC | HIGHEST (when available) | FUTA reached tens of millions through MoMo without users downloading FUTA app |
| 5 | **Facebook/Meta ads** | $5-8 USD first-booking CAC | MEDIUM | Good for awareness; algorithm changes hurt organic reach |
| 6 | **Google SEM** | $5-10 USD | MEDIUM | Expensive on VeXeRe branded keywords; better ROI on long-tail route terms |
| 7 | **Referral program** | $2-4 USD (referral reward cost) | MEDIUM | Build after initial user base exists |
