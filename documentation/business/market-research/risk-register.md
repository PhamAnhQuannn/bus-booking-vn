# Risk Matrix

> Research date: 2026-06-17. Multi-agent synthesis (4 Sonnet researchers + 1 Opus synthesizer).
> Vietnam-specific risks marked with [VN].

## Top 15 Risks (Likelihood x Impact)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 1 | **[VN] Operating central-collection payment model without SBV intermediary license (Decree 52/2024)** | CERTAIN | CRITICAL (illegal; shutdown risk) | **CRITICAL** | Restructure to PSP split-settlement (each operator = own merchant account; payment splits at source). Decision required before any live payment key (blocks issue 094). | CEO + Legal |
| 2 | **[VN] E-commerce platform registration missing (Decree 52/2013 + 85/2021)** | HIGH | HIGH (fines, shutdown) | **HIGH** | Complete VSIC 2025 amendment, then register at online.gov.vn. Requires: rules of operation, ToS, privacy policy. Budget ~5 business days for MoIT approval. | CEO + Legal |
| 3 | **PSP refund not implemented** | CERTAIN | HIGH (no customer refund possible with real keys) | **HIGH** | DS-007 (Refund Flow) fully specifies 5 refund triggers, PSP APIs (MoMo/VNPay/manual), refundRetry cron, and ledger integration. Implementation status: verify code matches spec before issue 094 go-live. | CTO |
| 4 | **Tet surge (3-10x normal volume; 260% confirmed at major stations, higher on specific corridors) breaks system** | HIGH | HIGH (permanent customer defection) | **HIGH** | Load test at 2,000+ concurrent booking attempts; issue 099 (PgBouncer) prerequisite; pre-provision Redis; test Vercel cold-start scaling; virtual waiting room if threshold exceeded. | CTO |
| 5 | **[VN] PDPD 2023 non-compliance (no DPIA; no breach runbook)** | MEDIUM | HIGH (fines, data deletion orders) | **HIGH** | **Cross-border transfer risk ELIMINATED by FPT Cloud hosting decision (2026-06-19)** — all data stays in Vietnam, CDTIA not required. Remaining: complete DPIA; add data residency disclosure in Privacy Policy; create 72h breach notification runbook; implement Booking PII anonymization sweeper (issue 090). See ADR-020 D7, DS-017 §3.1. | CEO + DPO |
| 6 | **No customer support channel** | CERTAIN | HIGH (chargebacks as only recourse; social media spirals) | **HIGH** | Minimum viable: email on ticket + Contact Support link routing to Zalo OA. Must exist before go-live. | Product + Ops |
| 7 | **Chicken-and-egg: no operators = no trips = no customers** | HIGH | HIGH (platform fails to launch) | **HIGH** | 30-day LOI kill-switch. Start hyper-local (one corridor). Seed first 10 operators with white-glove onboarding. Default 6% fee; admin can lower per operator during pilot. | CEO + Ops |
| 8 | **VietQR payment reconciliation failure (memo truncation, user mistype)** | HIGH | HIGH (money received but no ticket = worst CX) | **HIGH** | Keep orderRef under 25 chars; build reconciliation dashboard in admin; issue 095 recon sweeper must flag unmatched payments. | CTO + Finance |
| 9 | **[VN] Operator transport license not verified in KYB** | MEDIUM | HIGH (MoT enforcement if unlicensed operator onboarded) | **HIGH** | Add transport license (Giay phep kinh doanh van tai) as required KYB doc; add license expiry field; cron alert 60 days before expiry. | Ops + Legal |
| 10 | **Operator churn with outstanding future bookings** | MEDIUM | HIGH (customers stranded, refund obligation) | **HIGH** | Monitor booking velocity; outreach when bookings drop to zero for 14 days; block deactivation if future paid bookings exist; admin emergency refund-all tool. | Ops + CTO |
| 11 | **[VN] MISA e-invoice: unclear who is VAT seller (platform or operator?)** | MEDIUM | HIGH (GDT audit, penalties) | **HIGH** | Obtain tax ruling from GDT on platform-as-agent vs platform-as-principal. E-invoice must be issued no later than payment confirmation. | CEO + Finance + Legal |
| 12 | **External monitoring absent** | CERTAIN | MEDIUM (downtime discovered by users, not team) | **MEDIUM-HIGH** | Implement external uptime monitoring with PagerDuty-equivalent alerts before go-live. 2-minute detection target. **Note (2026-06-19):** FPT Cloud hosting has no built-in dashboard (unlike Vercel); external monitoring (BetterStack/UptimeRobot) and cron health checks (`JobRunLog` gap detection) must be set up explicitly. See DS-017 §5.4. | CTO |
| 13 | **Redis rate-limit silently fails open when UPSTASH_REDIS_REST_URL not set** | MEDIUM | MEDIUM (OTP abuse, hold flooding, DDoS) | **MEDIUM** | Make rate-limiter fail-closed or make Redis URL a hard startup requirement. | CTO |
| 14 | **[VN] Operator fee resistance (6% cuts into margins vs. station cash sales)** | HIGH | MEDIUM (operators redirect customers to pay cash, bypass platform) | **MEDIUM** | Reduced pilot fee (3-4%); quantify value prop (digital manifest saves 1-2h/trip); QR boarding makes side-cash difficult. | CEO + Sales |
| 15 | **[VN] Bus station managers refuse to honor platform QR codes** | MEDIUM | MEDIUM (major corridor broken) | **MEDIUM** | Negotiate MOU with top 5 terminals before Tet; offer station read-only manifest portal. | CEO + Ops |
| 16 | **FPT Cloud vendor dependence (pricing opacity, service maturity)** | MEDIUM | MEDIUM (cost surprise or service gap blocks deployment) | **MEDIUM** | Provider-agnostic Docker deployment contract (ADR-020 D8) ensures migration to Viettel IDC/CMC Cloud/AWS in 2-4 hours. Get sales quote before committing. FPT Managed PG/Redis fallback: self-hosted in Docker Compose on same VPS. See DS-017 §9.1. | CTO |

## Gaps & Future Features (Ranked by Urgency)

| # | Gap | Urgency | Who Demands It | Domain Extension Needed | Recommendation |
|---|---|---|---|---|---|
| 1 | **Customer support / complaint channel** | **BUILD NOW** | All customers, Consumer Protection Law 2023 (No. 19/2023/QH15) | ContentReport model exists; add customer form + admin queue | Must ship before go-live |
| 2 | **English UI (i18n)** | **6 MONTHS** | Foreign tourists (17.5M/yr), 12Go/Baolau overlap | No schema change; Next.js i18n routing + message files | Tourist corridor capture |
| 3 | **Delay notification** | **6 MONTHS** | All travelers | `Trip.delayMinutes`, `Trip.delayNotifiedAt`; trigger SMS to paid bookings | Low cost, high CX impact |
| 4 | **Operator luggage/ancillary policy** | **6 MONTHS** | Families, business travelers | OperatorPolicy table or `Operator.policyJson` | Reduces surprise charges |
| 5 | **Ratings and reviews** | **DEFER (50+ ops)** | All customers | `Review { bookingId, customerId, operatorId, rating, comment }` | Gate on completed booking |
| 6 | **Child/infant/senior pricing** | **DEFER (v2)** | Families | `passengerBreakdown` on Booking; PriceModifier per operator | Count-based works for v1 |
| 7 | **Seat selection / seat map** | **DEFER (REMODEL)** | Limousine/sleeper customers | `seatNumbers[]` on Hold/Booking; seatMap on Trip | Ratified "not this version" |
| 8 | **Multi-leg journeys** | **DEFER (v2)** | Tourist corridor travelers | ConnectionBooking with leg FKs | High complexity, low urgency |
| 9 | **Dynamic / surge pricing** | **DEFER (v2)** | Operators (Tet), platform (GMV) | `maxPriceVnd` on FeeConfig; anti-cancel-relist policy | v2+ |
| 10 | **Real-time GPS tracking** | **NEVER (v1-v3)** | Tech-savvy travelers | Hardware GPS on each bus | Not feasible without operator HW |
| 11 | **Round-trip bundling** | **DEFER (v3)** | Repeat travelers | RoundTripBundle entity | pairedReturn flagged for deletion |
| 12 | **Cancellation insurance** | **NEVER** | Risk-averse travelers | InsurancePolicy entity | Requires licensed partner |
