# Strategic Roadmap — Prioritized Actions

> For detailed regulatory sequencing and legal blocking dependencies, see [`regulatory/compliance-timeline.md`](../regulatory/compliance-timeline.md). This roadmap covers business + product actions; regulatory items below are summarized, not canonical.

## Pre-Launch (Do Now)

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | **Build customer cancellation & refund flow** | #1 user complaint. Every competitor has it. Reputation death sentence without it. | M |
| 2 | **Obtain IPS license legal opinion** | T+1 may be illegal without license. Go/no-go determination for current payment architecture. | S (legal consultation) |
| 3 | **~~Resolve data localization for PII~~** **RESOLVED (2026-06-19)** | ~~Decree 53/2022 violation. Vercel sin1 (Singapore) does not comply.~~ **FPT Cloud (Vietnam) chosen as primary host. All data stays in Vietnam. CDTIA eliminated.** See ADR-020 D7, DS-017. Remaining: provision FPT Cloud VPS, deploy Docker stack, configure Nginx + SSL, set up cron sidecar. | M |
| 4 | **Build round-trip booking flow** | All major competitors have it. Missing it doubles booking friction. Paired-return infrastructure exists (Issue 013); customer-facing search/checkout needs completion. | M |
| 5 | **Add Zalo ZNS for booking confirmations** | Email-only insufficient for Vietnamese users. Zalo 70M+ users, ZNS higher open rates than SMS, lower cost. VeXeRe BMS uses ZNS. | S-M |
| 6 | **Build "My Bookings" page** | Every platform with accounts has this. Data exists — read-only UI. | S |

## Pre-Launch: Hosting Migration (Added 2026-06-19)

| # | Action | Why | Effort |
|---|---|---|---|
| 3a | **Provision FPT Cloud VPS + managed services** | Contact FPT sales for quote. Provision Cloud Server (4vCPU/8GB), Managed PG, Managed Redis. | S |
| 3b | **Deploy Docker Compose stack on FPT Cloud** | Docker image + PgBouncer + cron sidecar (supercronic) + Nginx + Let's Encrypt. See DS-017 §4-6. | M |
| 3c | **Migrate database from current host** | `pg_dump` → `pg_restore` to FPT Managed PG. Verify data integrity. | S |
| 3d | **DNS cutover + PSP webhook URL update** | Point domain to FPT Cloud. Update MoMo/VNPay IPN callback URLs. Verify e2e payment flow. | S |

## Month 1-3

| # | Action | Why | Effort |
|---|---|---|---|
| 7 | **Complete regulatory filings** | MOIT e-commerce notification, DPO appointment, DPIA filing, standard-form contract registration. ~~Cross-border transfer dossier~~ **no longer needed** (FPT Cloud hosting eliminates CDTIA). | M (administrative) |
| 8 | **Build promo code / discount voucher engine** | Vietnamese consumers extremely price-sensitive and promotion-responsive. 20-50k VND micro-discounts significantly shift conversion. | M |
| 9a | **Add MoMo + VNPay as payment methods** | MoMo covers e-wallet users (40M+); VNPay covers cards, QR, international. Launch uses bank transfer + cash (zero registration). | S-M |
| 9b | **Add ZaloPay as payment method** | 20M active users, embedded in Zalo (70M+ users), growing rapidly. Expands payment coverage. | S-M |
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

---

## Operator Acquisition Playbook

> Consolidated from business-model.md. Phases aligned with roadmap timeline above.

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

---

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
