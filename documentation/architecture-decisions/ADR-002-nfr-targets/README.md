# ADR-002: Non-Functional Requirements Targets

## Status

ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Four forces make explicit NFR targets critical for this platform:

1. **Tet surge** — 30-40% of annual intercity bus volume concentrates into ~2 weeks. The Thanh Hoa ↔ TPHCM beachhead corridor sees the single highest demand spike in the country (10-20x normal load). System failure during Tet = permanent customer defection + operator churn to VeXeRe.

2. **Payment reliability in a cash-dominant market** — Every failed digital payment reinforces the customer instinct to "just call the operator directly." The platform's entire take-rate model depends on digital payments completing. A 3% payment failure rate (PSP SLA ceiling) is the upper bound before unit economics break.

3. **Regulatory deadlines** — 72-hour breach notification to MPS (PDPL 2025), 24-month PII retention minimum (Decree 53/2022), 3-year booking record retention (Decree 158/2024 transport licensing). These are law, not engineering preferences.

4. **Series A gate** — Investor KPIs (see `documentation/business/personas/investor-kpis.md`) directly map to NFR targets: <0.1% overbooking, <2% refund rate, 99.5%+ uptime, 8-15% search-to-booking conversion.

**Source**: All numbers below derived exclusively from `documentation/business/**` files — market research, regulatory analysis, competitor benchmarks, and investor KPI targets.

---

## Decisions

### A. Availability / Uptime

**Target: 99.5% monthly** (escalate to 99.9% during Tet 2-week window)

#### Options Considered

| Option | Monthly Downtime | Pros | Cons |
|--------|-----------------|------|------|
| 99.0% | ~7.3 hours | Cheapest; no redundancy needed | A single Tet evening (3hr peak booking window 7-10PM) could go down entirely. Unacceptable for payment-dependent platform |
| **99.5% (chosen)** | ~3.6 hours | Achievable with serverless (Vercel auto-scales) without HA database; covers 1 planned maintenance window + 1 unplanned incident/month | Cannot survive extended DB outage; still allows one ~3hr outage/month |
| 99.9% | ~43 minutes | Industry benchmark for PSPs (VNPay SLA); inspires investor confidence | Requires multi-AZ database, automated failover; adds $200-500/mo infra cost; ROI negative at Phase 1 revenue (~$220/day from ~200 bookings/day × 400K VND × 10% take) |
| 99.95% | ~22 minutes | Enterprise-grade (Grab/Gojek territory) | Budget exceeds entire Phase 1 infrastructure spend |

#### Why 99.5%

- **Too low (99.0%)**: 7.3 hours/month means a full Tet evening peak window could go down with budget remaining. One 3-hour outage strands 500-1,000 customers mid-booking, triggers Facebook group complaints (user-insights.md: Vietnamese customers post instantly to social media), permanently damages operator trust.
- **Too high (99.9%)**: At Phase 1 (200 bookings/day), the expected lost bookings from the delta between 99.5% and 99.9% = ~8 bookings/month (~$15 revenue). HA infrastructure cost ($200-500/mo) far exceeds the revenue impact.
- **Sweet spot (99.5%)**: Vercel serverless provides this at the compute layer essentially for free. The database (single PG instance + daily backups) is the single point of failure. At Phase 1-2 traffic, the 3.6hr monthly budget covers a planned maintenance window (schema migration) plus one unplanned incident without requiring HA database infrastructure.
- **Tet override**: During the 2-week Tet window, target escalates to 99.9%. Pre-provision read replica, freeze deployments, activate 2-minute detection monitoring.

---

### B. Latency

| Endpoint Class | p95 Target | Alert Threshold | Rationale |
|----------------|-----------|-----------------|-----------|
| Customer pages (LCP) | ≤ 2.5s | ≤ 4.0s | Core Web Vital "good" threshold |
| Trip search API | ≤ 300ms | ≤ 500ms | Below 400ms human "waiting" threshold |
| Hold creation API | ≤ 200ms | ≤ 400ms | Critical financial path — "instant" click feel |
| Payment webhook processing | ≤ 500ms | ≤ 1000ms | Server-to-server; PSP timeout 5-15s |
| Operator console CRUD | ≤ 200ms | ≤ 400ms | Internal tool, fewer concurrent users |

#### Why 300ms for Trip Search

| Option | Verdict |
|--------|---------|
| ≤ 100ms | Requires Redis/Elasticsearch cache layer. Search query joins Trip + Bus + Route + Operator, filters maintenance windows, computes remaining capacity. Achievable only with pre-computed materialized view — premature for Phase 1 where query planner handles it in 50-150ms on warm PG |
| **≤ 300ms (chosen)** | Below 400ms human "waiting" threshold (Nielsen Norman Group). 95% of users experience no perceptible wait. Achievable with B-tree indexes on (routeId, departureAt, status, salesClosed) without a cache layer |
| ≤ 500ms | Three searches × 500ms = 1.5s perceived sluggishness. Pushes search-to-booking conversion below 5% vs. 8-15% target (investor-kpis.md). VeXeRe mobile responds in ~200ms — competitive disadvantage |

#### Why 200ms for Hold Creation

Hold creation is the critical financial path (acquires two advisory locks, conditional INSERT with capacity check). At 200ms server + 50ms network RTT + 100ms client render = 350ms total. User perceives "instant." At 400ms server-side, total rises to 550ms — noticeable wait on a "Book Now" button, creating anxiety about whether the click registered. In a market where users are primed to "just call the operator" at any friction (user-insights.md), this matters.

#### Why 500ms for Payment Webhook

Webhooks are server-to-server with no user waiting. The PSP expects HTTP 200 within their timeout (5-15 seconds). 500ms gives ample headroom for the transaction (SELECT FOR UPDATE on booking, status transition, ledger entry creation, capacity recount). Going below 200ms would require removing the capacity-guard recount from the webhook path, weakening oversell protection. Alert at 1000ms because approaching PSP retry-timeout threshold risks webhook retry storms.

---

### C. Throughput / Concurrency

**Target: 2,000 concurrent booking attempts (hold creation + payment) during Tet**

#### Options Considered

| Option | Concurrent Users | Verdict |
|--------|-----------------|---------|
| 500 | Phase 2 adequate | At Phase 3 Tet (500 bookings/day × 20x surge), PgBouncer pool (30 connections) becomes bottleneck. 30 connections × (1000ms/200ms) = 150 holds/second sustained. At 500 concurrent with bursts, queue depth exceeds pool → connection timeout → 503 during Tet = defection |
| **2,000 (chosen)** | Phase 3 Tet survival | 5-10x headroom over derived Phase 3 Tet peak. Matches risk-matrix.md load test target verbatim. Covers traffic spikes within peak hour + PSP retry storms |
| 5,000 | Multi-corridor scale | Advisory locks serialize on TRIP row. 500 queued per hot trip × 200ms = 100s wait for last in line. Architecture cannot handle without sharding or queue-based processing |

#### Why 2,000 — The Derivation

Phase 3 = 500 bookings/day normal. Concentrated in 8 peak hours = 62 bookings/hour.

Tet surge = 20x (upper bound, risk-matrix.md) = 1,250 bookings/hour peak.

Hold-to-book lifecycle = 10 minutes (hold TTL). Steady-state concurrent active holds at peak: `1,250/hr × (10min / 60min) ≈ 208 concurrent`.

But: traffic is not evenly distributed within the peak hour. A viral "all tickets selling out!" Facebook post (common during Tet, per user-insights.md) drives a 3-5x micro-burst within the hour. 208 × 5 = ~1,040.

Add PSP retry storms if a gateway has a momentary blip = 2x replay. 1,040 × 2 = ~2,080.

2,000 target provides adequate headroom. Implicitly assumes distribution across ~50-100 trips (20-40 concurrent per trip), which matches business reality (multiple departure times across multiple operators on one corridor).

---

### D. Hold TTL

**Target: 10 minutes**

#### Options Considered

| Option | Capacity Impact (40-seat bus, 30% abandonment, 2 tickets/hold) | Verdict |
|--------|--------------------------------------------------------------|---------|
| 5 minutes | ~3 phantom seats (7.5% capacity reduction) | Too short for MoMo payment flow. App switch + PIN + confirmation = 60-90s best case. Add slow 4G, phone call interruption, elderly user (persona "Bà Hoa") = 3-4 minutes. Creates 10-20% "expired before use" rate → support tickets |
| **10 minutes (chosen)** | ~6 phantom seats (15% capacity reduction) | Enough for worst-case MoMo flow (3-4 min) + 6 min slack. Industry standard: Traveloka 15min, Booking.com 10-15min. 15% temporary capacity reduction is acceptable |
| 15 minutes | ~9 phantom seats (22.5% capacity reduction) | Extra 7.5% = ~3 fewer sellable seats per bus during Tet. On Thanh Hóa ↔ TPHCM at 875K VND/seat = ~2.6M VND/bus/cycle lost to phantom holds |
| 30 minutes | ~12 phantom seats (30% capacity reduction) | Window shopping enabler. 4 phantom holds × 4 seats = 16 seats blocked for 30min. 40-seat bus appears "sold out" for an entire search session |

#### Why 10 Minutes — Payment Flow Timing

Bank transfer flow (launch PSP): user selects "Chuyển khoản" → QR display page → customer scans VietQR with banking app → SePay webhook confirms (5-30s). MoMo app-switch flow (Phase 2 PSP): user clicks "Pay" → redirect to MoMo → authenticate (PIN or biometric) → confirm → redirect back.

- Best case: 45 seconds
- Median (user reads amount, checks balance): 90 seconds
- Worst case (slow 4G, app reloading, re-authentication): 3-4 minutes

10 minutes provides 6-9 minutes of slack after worst-case payment initiation. This covers "I need to ask my spouse about this trip" (common for budget persona "Chị Lan" — provincial worker, family decision-making) without enabling window shopping.

---

### E. PSP Window (Awaiting-Payment Capacity Reservation)

**Target: 20 minutes (PSP_WINDOW_MINUTES = 20)**

#### What This Number Means

After a hold is consumed and payment initiated, the booking enters `awaiting_payment` status. It MUST continue to occupy seat capacity during this window because the customer may already have been charged by the PSP. Releasing the seat and selling it to another customer while the original payment webhook is in flight creates an oversell — the worst possible customer experience (charged but no ticket).

#### Options Considered

| Option | Verdict |
|--------|---------|
| 10 minutes (= hold TTL) | Payment initiated at minute 9 of hold. PSP has only 1 minute to process + deliver webhook. MoMo webhook retry schedule: 1, 3, 5, 10, 15 minutes. Last retry at +15min exceeds the 10-min window. Result: customer charged but capacity released → seat sold to someone else → oversell |
| 15 minutes | MoMo's 15-minute retry arrives precisely AT the boundary. Network jitter + server processing time = race condition. Approximately 1-3% of final retries would arrive after window closes |
| **20 minutes (chosen)** | 15min (last MoMo retry) + 5min buffer for network jitter and server processing. Full PSP retry schedule completes safely within window |
| 30 minutes | 30 minutes of phantom capacity reservation per abandoned payment. During Tet rush: 10 abandoned payments × 2 tickets × 30min = 20 phantom seats for 30 minutes on a 40-seat bus. Revenue loss unacceptable |

#### Why Not 15 or 25

- **Not 15**: MoMo's documented retry schedule (1, 3, 5, 10, 15 min after initial call) has the final retry at exactly +15 minutes. At a 15-minute window, the webhook arrives AT the boundary. Server processing time (up to 500ms per latency target above) plus network transit means ~1-3% of final retries would land at +15 min and 1-5 seconds — after the window has closed and the seat has been released. This creates a non-zero oversell rate from a timing race.
- **Not 25**: Every additional minute beyond safety extends the phantom-capacity period unnecessarily. During Tet peak, each extra 5 minutes × 30% payment abandonment rate × average 2 seats per abandoned booking = ~3 additional phantom seats per bus. The marginal safety benefit past 20 minutes is negligible (PSP infrastructure outages lasting 20+ minutes are covered by our own monitoring and circuit-breaker, not by extending the window).

---

### F. Settlement Delay

**Target: T+1 (operator revenue available for withdrawal 1 day after trip completion)**

#### Options Considered

| Option | Verdict |
|--------|---------|
| T+0 (instant) | Zero time for dispute resolution. Fraudulent operator scenario: create phantom trip → mark complete → withdraw immediately → disappear. No defense window. Also: customer who discovers wrong drop-off point 2 hours post-trip cannot get refund if operator already withdrew |
| **T+1 (chosen)** | Competitive advantage vs VeXeRe (T+3 to T+7 estimated, per pricing-comparison.md). Operator value prop: "Your money, next day." 24 hours covers same-day disputes (wrong vehicle, wrong time, no-show), platform automated fraud detection (trip duration < route duration, no check-ins), and oversold-race refund processing (automated, completes within minutes) |
| T+3 | Standard PSP settlement cycle. But Vietnamese operators run on thin margins (10-15% net), daily cash cycle (fuel, driver wages, tolls). Holding 3 days = operator must front 3 days operating costs. Small operators (1-3 buses, 60-70% of market per operator-personas.md) often cannot |
| T+7 | VeXeRe-slow territory. operator-sentiment.md: settlement speed is top-3 operator concern. "My money stuck in platform" sentiment |
| T+14 | Dealbreaker. Equivalent to "platform using my money as float." Immediate operator churn |

#### Why T+1 and Not T+0

Chargeback risk acceptance calculation:
- VND transactions are primarily domestic (MoMo, VietQR) — no international card network chargebacks
- Average ticket = 400K VND (~$16, per business-model.md)
- Chargeback rate target <0.1% (investor-kpis.md)
- Expected monthly chargeback loss at Phase 3 (500 bookings/day): 500 × 30 × 0.001 × $16 = ~$240/month
- Platform absorbs this as cost of T+1 competitive positioning

#### Why T+1 and Not T+3

pricing-comparison.md explicitly positions "faster settlement than VeXeRe" as the primary operator acquisition talking point. T+3 erases the single most tangible differentiator from the market leader. Combined with the 5% intro commission (vs VeXeRe's ~8-12%), T+1 settlement makes the "switch to BB" decision easy for operators.

---

### G. OTP Security Thresholds

| Parameter | Options Considered | Chosen | Why This Number |
|-----------|-------------------|--------|-----------------|
| **OTP TTL** | 2min / 5min / 10min | **5 minutes** | *2min*: eSMS delivery P99 on Vietnamobile/Gmobile = 30-60s (telecom-sms.md). User gets only 60-90s to type after delivery. Creates 10-20% expiry rate. *10min*: Shoulder-surfing in bus stations (literal platform use case — customer-personas.md describes station-based booking). 10-minute window gives attacker ample time to use observed code. *5min*: 300s total − 60s worst-case delivery = 240s for user to read and type 6 digits. Accommodates 2 interruptions (notification check, re-read code) |
| **Auth max attempts** | 3 / 5 / 10 | **5** | *3*: Punishes fat-finger typos on small phone keyboards (budget persona "Chị Lan" uses older phone). 6-digit code on a cramped virtual keyboard → 1-2 typos expected. *10*: Allows meaningful brute-force at scale (10/1,000,000 per OTP, but botnets target thousands of phones simultaneously). *5*: 5/1,000,000 brute-force probability per OTP while tolerating 2 typos before cap |
| **Account mgmt attempts** | 3 / 5 / 10 | **3** | Higher-risk operations (phone number change, account deletion). If attacker has stolen a session token and is attempting OTP for phone-change: fewer attempts = better. Legitimate user making 3 typos on a 6-digit code should re-request a fresh OTP |
| **Lockout duration** | 5min / 15min / 30min / 1hr | **15 minutes** | *5min*: Bot retries after 5min, sustains automated attack indefinitely. *30min+*: Punishes legitimate user who fat-fingered 3 times (elderly persona "Bà Hoa"). *15min*: Long enough to deter manual brute-force (attacker must wait 15min between 5-attempt sets = 20 codes/hour max), short enough that frustrated legitimate user can retry after getting a glass of water |
| **OTP send rate limit** | 1/5min / 3/15min / 5/30min | **3 per 15 minutes per phone** | Prevents OTP flooding (eSMS cost = ~500 VND per message; 100 flood messages = 50K VND cost to platform). 3 in 15min covers: initial request + "didn't receive" re-request + one more retry. More than 3 in 15 minutes indicates either bot behavior or a delivery problem that more messages won't solve |

---

### H. Capacity Guard Timing

#### Bus Overlap Buffer: 60 minutes

| Option | Verdict |
|--------|---------|
| 0 minutes (back-to-back) | Bus delayed 5 minutes = cascading delay on next trip. No time for cleaning, refueling, driver handoff. Creates operational chaos that reflects badly on platform reputation |
| 30 minutes | Vietnamese intercity buses average 10-15 minute delays. 30min buffer − 20min delay = 10min turnaround. NOT enough for overnight sleeper cleaning (30+ berths on Thanh Hóa ↔ TPHCM sleepers), refueling, luggage unloading |
| **60 minutes (chosen)** | Covers: typical delay (10-15min) + turnaround (20-30min for cleaning/refueling of sleeper bus) + passenger boarding (10-15min). Matches physical reality of overnight sleeper bus operations |
| 120 minutes | Over-conservative. Thanh Hóa ↔ TPHCM is 18-20 hours; adding 2hr buffer means a bus can only do 1 round trip per 40+ hours. Significantly reduces operator revenue for operators who physically CAN turn faster (e.g., daytime short-haul routes) |

**Why 60 and not 45**: A Thanh Hóa ↔ TPHCM bus arriving after 18-20 hours needs: driver rest (legally mandated), interior cleaning (30+ berths), refueling, luggage unloading. Industry interviews (operator-sentiment.md) confirm minimum turnaround for responsible operators is 45-60 minutes. 60 provides the smallest viable safety margin.

#### Hold Expiry Cron Batch Size: 500

| Option | Verdict |
|--------|---------|
| 50 | At Tet peak (2,000 abandoned holds during mass payment failures from PSP outage), requires 40 iterations × 1-min interval = 40 minutes to clear backlog. Stale capacity blocked for 40 extra minutes |
| **500 (chosen)** | Clears Tet-peak backlog (~2,000 expired holds) in 4 iterations = 4 minutes. `FOR UPDATE SKIP LOCKED` means concurrent hold-consumption is not blocked. Acceptable transaction duration |
| 1,000 | Transaction duration risk. 1,000 rows locked = increased deadlock potential with concurrent hold-creation advisory locks. Large transactions expensive to rollback on failure. Marginal benefit (2 iterations vs 4) doesn't justify risk |

---

### I. Monitoring & Alerting

**Target: 2-minute detection for critical service incidents**

#### Options Considered

| Option | Verdict |
|--------|---------|
| 30 seconds | Expensive APM required (Datadog, custom metrics with 15s scrape). Generates alert fatigue from transient network blips. Overkill for Phase 1 |
| 1 minute | Aggressive. Some monitoring probes have 1-minute minimum interval on free tiers. 2 consecutive failures = 2 minutes anyway |
| **2 minutes (chosen)** | risk-matrix.md: "2-minute detection target" (Risk #12). External probe every 60s, alert after 2 consecutive failures = 120s detection. At Tet peak (~10 bookings/minute), 2 minutes undetected = ~20 lost booking attempts. Painful but survivable. BetterStack/UptimeRobot free tier supports this |

> **CONFLICT**: References BetterStack as monitoring platform, but ADR-007 D1 confirms neither Sentry nor BetterStack is deployed. Only stdout JSON logs exist. 2-minute detection target has no tooling to enforce it. See ADR-007 IMPLEMENTATION STATUS.
| 5 minutes | 50 lost bookings during Tet peak + Facebook group complaint spiral starts within 3 minutes of outage (user-insights.md: Vietnamese customers escalate to social media immediately) |
| 15 minutes | By the time alert fires, customers have already called operators directly and bypassed platform permanently. Reputation damage irreversible |

#### Additional Monitoring Targets

| Metric | Target | Source |
|--------|--------|--------|
| **Breach notification** | ≤ 72 hours to MPS | PDPL 2025, data-privacy.md |
| **Payment anomaly detection** | ≤ 5 minutes | Webhook volume drop > 50% from 15-min rolling average |
| **Operator payout failure rate** | Alert at > 5% | Payout processor SLA |

---

### J. Financial Precision

**Target: All currency math that multiplies integer minor-unit (VND) by fractional rate uses BigInt arithmetic**

#### Options Considered

| Option | Verdict |
|--------|---------|
| IEEE 754 Number (native JS) | `400000 * 0.06 = 23999.999999999996` in some cases. At 100K bookings/month (break-even target, business-model.md), cumulative rounding = non-deterministic. Ledger sum ≠ PSP sum ≠ operator payout sum. Reconciliation impossible. Series A auditors flag any non-deterministic financial arithmetic |
| **BigInt (chosen)** | Exact integer arithmetic. Encode 6% as `BigInt(6) / BigInt(100)`. No representation drift. Half-even rounding on exact ties is deterministic. ES2017 target requires `BigInt(n)` constructor calls (not `n` literal) |
| Decimal.js library | Overkill — VND has no fractional subunit (1 VND is smallest unit). External dependency for a problem solvable natively. Bundle size increase for hot payment paths |
| Integer-only basis points | 6% = 600 bps; `amount * 600 / 10000`. Works for round percentages. Loses flexibility for non-round rates (e.g., 6.33% after promo adjustment). This is effectively what BigInt approach does internally with more precision |

#### Why Not Native Number

At scale (Phase 3 Tet: 500 trips/day × 40 seats × 1,750,000 VND = 35B VND daily aggregate), representation drift from IEEE 754 multiplication causes non-deterministic rounding. The error per transaction averages ~0.5 VND (negligible individually), but the error is NON-DETERMINISTIC — some round up, some down, unpredictably. This means:
- Ledger sum ≠ PSP settlement sum (always off by a few VND per batch)
- Reconciliation report shows discrepancy every single day
- Series A due diligence auditor flags "financial arithmetic produces inconsistent results"
- Even $2/month total error is unacceptable because it's UNPREDICTABLE, not because of magnitude

---

## Additional Number Decisions

| Number | What It Means | Why This Value and Not Another |
|--------|--------------|-------------------------------|
| **MIN_WITHDRAW_THRESHOLD_VND = 100,000** (~$4) | Minimum amount an operator can withdraw | Processing cost of bank transfer = ~2,000-5,000 VND. At 100K threshold: processing = 2-5% (acceptable). At 10K: processing = 20-50% (platform loses money on micro-withdrawals). At 500K: small operators earning ~200K VND/day (micro operator persona, 60-70% of market) cannot withdraw daily — friction |
| **Commission 8-10%** | Platform take rate per ticket | Below VeXeRe ~12% and redBus 10-20% (pricing-comparison.md). Floor 5%: below this, unit economics negative after payment processing 1.5-2.5% + notification costs 1K VND + support 3K VND. Ceiling 15%: above this, operators bypass platform for direct bookings (operator-sentiment.md: commission rate is top concern) |
| **5% introductory rate** (3 months) | Operator acquisition incentive | No incumbent matches publicly (pricing-comparison.md). Combined with T+1 settlement = strongest operator value prop. 3 months chosen because: operator needs ~60 days to evaluate platform value (2 booking cycles, including at least one weekend peak). Shorter (1 month): not enough data for operator to decide. Longer (6 months): platform bleeds money during growth phase without converting to sustainable rate |

> **CORRECTION** (2026-06-18): Commission "8-10%" and "5% introductory" → actual default is 6% (`ratePpm=60000`), admin-configurable. Ceiling is 20%, not 15%. No hardcoded introductory rate exists — commission is set per-operator by admin. See ADR-004 D4, ADR-006 D1 for same correction.
| **CONCURRENT_HOLD_CAP** (per phone) | Maximum simultaneous active holds across all trips for one phone number | Prevents bot-driven seat hoarding. Too low (1): family booking requires parent to hold seats on multiple trips simultaneously while comparing options — creates friction. Too high (10): single compromised phone can block 10 × 4 seats = 40 seats across hot trips. Sweet spot (3-5): covers legitimate comparison shopping (2-3 trip options) while limiting abuse |
| **Overbooking < 0.1%** | Maximum acceptable oversell rate | investor-kpis.md: "any overbooking is trust-destroying." At 500 bookings/day: 0.1% = 1 oversell every 2 days. Each oversell = stranded customer at bus station (worst possible CX in a market where trust is already low per user-insights.md). At 1%: 5 oversells/day = social media crisis within a week |
| **Refund rate < 2% GMV** | Maximum acceptable refund volume | investor-kpis.md target. At 10% take rate on 400K VND avg ticket, each refunded booking costs platform 8K VND in non-recoverable payment processing fees + operational cost. At 2% refund rate with 15,000 bookings/month: 300 refunds × 8K = 2.4M VND/month. Above 2%: the refund processing cost alone exceeds support staff budget |
| **Conversion 8-15%** (search → booking) | Target funnel completion rate | investor-kpis.md: "<5% indicates pricing or UX problem." Google Search travel CVR = 3-5%, but platform traffic is higher intent (user already decided to take a bus, just choosing which). 8% achievable. 15% optimistic (requires repeat users with saved preferences). Below 8% after 90 days: investigate search UX, pricing display, hold creation friction |
| **Support < 20 per 1,000 bookings** | Customer support ticket ratio | investor-kpis.md target. At Phase 3 (500 bookings/day): 10 tickets/day. One support agent handles ~50 tickets/day. <20/1000 means <1 FTE support needed at Phase 3 volume — sustainable unit economics. Above 20: every 1,000 additional daily bookings requires a new support hire |
| **Payment failure < 3%** | Failed payment attempts as % of total | investor-kpis.md target. PSP uptime SLA = 99.9% (≈0.1% infra-side failures). Remaining 2.9% = user-side failures (insufficient balance, wrong PIN, timeout). Above 3%: indicates gateway configuration issue, UX friction in payment flow, or PSP degradation requiring escalation |
| **VND 100M e-wallet monthly cap** | MoMo/ZaloPay per-user monthly spending limit | Regulatory ceiling (Decree 52/2024, payment.md). Individual tickets (100-500K VND) = no impact. Business travelers booking 200+ tickets/month (persona "Anh Minh") or group bookings could hit cap. Platform must detect approaching-cap scenarios and offer bank transfer fallback before checkout failure |

---

## Known Gaps (as of 2026-06-18)

- **No RPO/RTO targets documented**: Recovery Point Objective and Recovery Time Objective for database/infrastructure failure are not specified. Critical for Tet surge planning and disaster recovery runbook.
- **No load test results**: 2,000 concurrent target exists but no load testing infrastructure or historical test results documented. Pre-Tet validation path undefined.
- **Monitoring tooling absent**: All monitoring targets (§I) reference BetterStack but no monitoring platform is deployed. See ADR-007.

---

## Consequences

### Positive

- Every NFR has a measurable target, an alert threshold, and a measurement method — enabling automated regression detection
- Tet surge targets (2,000 concurrent, 99.9% during 2-week window) explicitly documented, preventing "forgot to load test" scenario
- Settlement delay (T+1) is a defined competitive advantage backed by financial analysis and competitor benchmarking, not an arbitrary engineering choice
- Hold TTL (10 min) and PSP window (20 min) derived from Vietnamese carrier delivery times and MoMo webhook retry schedules — not copied from foreign platforms operating in different markets
- Financial precision requirement (BigInt) prevents reconciliation drift before it becomes a Series A audit finding

### Negative

- 99.5% uptime accepts ~3.6 hours/month potential downtime — if concentrated during Tet peak, consequences severe (mitigated by Tet-window escalation to 99.9%)
- T+1 settlement exposes platform to chargeback risk for transactions older than 24 hours (mitigated: launch PSPs — bank transfer and cash — have zero chargeback mechanism; VNPay international card chargebacks are the only real vector, added in Phase 2 when international tourist volume is still near-zero)
- 10-minute hold TTL may cause abandonment for users interrupted by phone calls or those on extremely slow connections (mitigated: hold can be re-created if expired; 10 min is generous compared to 5 min alternatives)
- 2,000 concurrent target requires PgBouncer tuning and load testing infrastructure that adds operational complexity

### Review Cadence

- All NFR targets reviewed quarterly
- Post-Tet retrospective updates targets based on actual surge data (first Tet is the critical data-gathering event)
- Pre-Series A audit validates all targets are met or have documented remediation timelines
- Any target breach lasting >24 hours triggers immediate review and potential target adjustment
