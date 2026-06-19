# Strategic Roadmap — Prioritized Actions

## Pre-Launch (Do Now)

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | **Build customer cancellation & refund flow** | #1 user complaint. Every competitor has it. Reputation death sentence without it. | M |
| 2 | **Obtain IPS license legal opinion** | T+1 may be illegal without license. Go/no-go determination for current payment architecture. | S (legal consultation) |
| 3 | **Resolve data localization for PII** | Decree 53/2022 violation. Vercel sin1 (Singapore) does not comply. Vietnam-hosted PostgreSQL for PII. | M |
| 4 | **Build round-trip booking flow** | All major competitors have it. Missing it doubles booking friction. Paired-return infrastructure exists (Issue 013); customer-facing search/checkout needs completion. | M |
| 5 | **Add Zalo ZNS for booking confirmations** | Email-only insufficient for Vietnamese users. Zalo 70M+ users, ZNS higher open rates than SMS, lower cost. VeXeRe BMS uses ZNS. | S-M |
| 6 | **Build "My Bookings" page** | Every platform with accounts has this. Data exists — read-only UI. | S |

## Month 1-3

| # | Action | Why | Effort |
|---|---|---|---|
| 7 | **Complete regulatory filings** | MOIT e-commerce notification, DPO appointment, DPIA filing, standard-form contract registration, cross-border transfer dossier — all legally required. | M (administrative) |
| 8 | **Build promo code / discount voucher engine** | Vietnamese consumers extremely price-sensitive and promotion-responsive. 20-50k VND micro-discounts significantly shift conversion. | M |
| 9 | **Add ZaloPay as payment method** | 20M active users, embedded in Zalo (70M+ users), growing rapidly. Expands payment coverage. | S-M |
| 10 | **Build operator-shareable booking link + Facebook embed widget** | BB's biggest CAC advantage = operators drive traffic to their branded page. Give them tools to share on Facebook pages and Zalo groups. | S |
| 11 | **Add English language support** | Locks out international tourist segment entirely. Matters for tourist corridors (Sapa, Ha Long, Da Lat, Mui Ne, Nha Trang) — highest AOV routes. | M |

## Month 3-6

| # | Action | Why | Effort |
|---|---|---|---|
| 12 | **Pursue MoMo/ZaloPay distribution partnership** | Fastest path to customer volume without native app. FUTA reached tens of millions through MoMo. Higher leverage than building a native app. | M (biz dev + S-M API integration) |
| 13 | **Build operator-configurable flash sales/promotions** | VeXeRe BMS lets operators self-serve early-bird, last-minute, round-trip discount campaigns. Critical for filling buses on slow days. | M |
| 14 | **Build push notifications / trip reminders** | Reduces no-shows, improves customer experience. If ZNS already integrated, trip reminders are incremental. | S |
| 15 | **Implement operator ratings & reviews** | Growing trust signal. 69% of MoMo users regularly rate transactions. Helps customers choose between operators on same route. | M |

## Month 6-12

| # | Action | Why | Effort |
|---|---|---|---|
| 16 | **Negotiate travel insurance partnership** | Only VeXeRe has it. 20,000 VND/ticket, OTA earns 30-40% of premium (6,000-8,000 VND/conversion). Clearest margin-expansion opportunity with no competitive crowding. | M (partner negotiation + checkout integration) |
| 17 | **Build 12Go/Bookaway API integration** | BB operators' routes appear to international tourists without BB building tourist-facing marketing. Distribution multiplier for tourist corridors. | M |
| 18 | **Evaluate native app vs. PWA** | Mobile web viable for launch (Baolau/12Go prove it). Decision depends on whether MoMo/ZaloPay partnership materialized. If yes, defer native. If no, invest in PWA. | M-L |
| 19 | **Begin agent/reseller network** | VeXeRe's 5,000-agent network is nearly CAC-free offline distribution moat. Requires sufficient operator inventory (200+ operators). | L |
| 20 | **Explore Zalo mini-app** | No intercity bus platform has a Zalo mini-app. First-mover opportunity in 70M-user ecosystem. Validate demand signal from ZNS engagement metrics before committing. | M-L |
