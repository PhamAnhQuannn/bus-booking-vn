# CAC/LTV Benchmarks

> Marketplace economics for Vietnam bus-booking. Constructed from channel cost data + ticket price + frequency estimates. Research date: 2026-06-17.

### Market Context

- Online travel market: $2.87B-$4B (2025), growing to $4.69B-$8B by 2030-31 (8.55-15% CAGR)
- 72.77% bookings via mobile; 46.12% via digital wallets
- 110M domestic tourist trips in 2024

### Bus Ticket Economics

| Route type | Avg ticket VND | USD |
|---|---|---|
| Short/medium (<5 hrs) | 100K-300K | $4-12 |
| Long-haul (HCMC-Da Lat) | 249K-500K | $10-20 |
| North-South overnight | 875K-1,750K | $35-70 |

Core demographic frequency: 3-6 trips/year. Tet = ~30-40% of annual volume in ~2 weeks.

### LTV Model

| Scenario | Avg ticket | Take rate | Trips/year | 3-year LTV | USD |
|---|---|---|---|---|---|
| Conservative | 250K | 8% | 3 | 180K VND | ~$7 |
| Base case | 350K | 10% | 4 | 420K VND | ~$17 |
| Optimistic (loyalty) | 450K | 12% | 6 | 972K VND | ~$39 |

Note: SaaS fees, insurance upsell, and accommodation cross-sell expand LTV 2-3x beyond pure commission.

### CAC by Channel

| Channel | CPM (VN) | CPC | Conversion | Best for |
|---|---|---|---|---|
| Google Search | -- | $0.25-1.92 | 3-5% (highest) | High-intent booking |
| Facebook | $1.83-3 | $0.16-0.25 | 3.95% travel CVR | Mid-funnel retargeting, 35-50yr |
| TikTok | $2.50-6 | $0.20-0.50 | Lower direct, high awareness | Brand, Tet campaigns, Gen Z |
| Zalo | Lower than FB | $0.05-0.15 est. | High for repeat | CRM, push, 75M users |
| Instagram | $1.90 | $0.21 | 0.21% CTR (low) | Niche upper-urban |

Implied funnel: CPM $2.50 -> CTR 1.5% -> CPC $0.17 -> Booking CVR 3-5% -> **Cost per booking $3.40-5.70**

### LTV:CAC Targets

| Metric | Target | BB Position |
|---|---|---|
| LTV:CAC | 3:1 min, 4:1-6:1 strong | At $5 CAC and $17 LTV: 3.4:1 (meets threshold) |
| CAC payback | <12mo healthy, <6mo strong | At $5 CAC and ~$3.50/yr margin: ~17mo (needs work) |
| Repeat booking | >50% within 12mo | No data yet; Tet seasonality helps |

The 17-month payback period is the primary concern. Mitigation paths: (a) reduce CAC via organic/SEO and Zalo CRM, (b) increase take rate toward 12% as value prop matures, (c) add SaaS revenue per operator to shift economics.

### Referral / Viral

- Sustainable viral factor: 0.15-0.25 (good), 0.4 (great), 0.7 (outstanding)
- Bus booking natural k-factor: 0.05-0.15 (SE Asia e-commerce benchmark; referral program not yet implemented). Aspirational target: 0.3 with referral program in Phase 2 (Tet family/group bookings, Zalo sharing)
- Levers: Tet group bookings, "book for someone else" flows, Zalo sharing integration

### Operator Acquisition Cost

| Segment | Estimated CAC | Sales cycle |
|---|---|---|
| Small (10-50 buses) | $50-200 (self-serve) | Days |
| Mid-tier (50-200 buses) | $300-1000 (field sales) | 2-6 weeks |
| Large (200+ buses) | $2000-10000 (enterprise) | 1-3 months |
