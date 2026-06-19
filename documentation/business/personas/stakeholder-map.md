# Stakeholder Map

> Research date: 2026-06-17. Multi-agent synthesis (4 Sonnet researchers + 1 Opus synthesizer).

## Primary Stakeholders (Direct Users)

| Name | Interest | Influence | Attitude | Platform Obligation | Risk if Ignored |
|---|---|---|---|---|---|
| **Domestic Travelers (budget/student/family)** | Cheapest price, reliable seat confirmation, instant QR ticket on phone, no hidden fees | HIGH collectively (revenue engine) | Supportive | Real-time availability; atomic multi-seat hold; QR within 60s of payment; Vietnamese UI; works on low-end Android/4G | Price comparison loss to VeXeRe; double-sell trust collapse; Tet surge failure = permanent defection |
| **Business Travelers** | MISA e-invoice for expense claims, premium bus types, last-minute booking | MEDIUM-HIGH (higher avg ticket value) | Supportive but demanding | E-invoice issued on payment (Circular 78/2021); VAT breakdown on receipt | No invoice = cannot expense = lose corporate repeat segment entirely |
| **Large Corporate Operators (e.g. Phuong Trang/FUTA)** | High volume, low fee %, real-time manifest, T+1 payout, brand control | VERY HIGH -- single large operator leaving takes 30-50% of inventory | Cautious -- own platforms exist | Negotiable fee (FeeConfig effective-dated); T+1 settlement with ledger visibility; bulk trip import; fast KYB (48h) | Fee resentment = inventory pulled; payout delay = trust rupture; no QR scanner = operator blames platform |
| **Small/Family-Run Operators** | Access to wider customer base, simple setup, Zalo-friendly notifications, low fixed cost | LOW individually, MEDIUM collectively (long-tail supply) | Willing but capability-limited | Vietnamese operator console; SMS/Zalo booking notification; license verification gate; assisted onboarding | Complex onboarding = abandonment = supply gap on secondary routes; missed booking notification = double-sell |
| **Platform Admin/Ops Staff** | Operator approval tools, dispute investigation, refund processing, payout batch management, audit logs | HIGH (daily operational nerve center) | Strongly supportive | Admin console with RBAC; immutable audit log; one-click refund with ledger reversal; payout dashboard | Payout tool failure = mass operator churn; no dispute workflow = slow resolution = customer churn |
| **Operator Drivers / Ticket Agents** | Simple QR scanner on personal phone, clear manifest, no training burden | LOW on strategy, HIGH on execution (last-mile trust point) | Neutral; resistant to anything slowing boarding | QR scanner works offline/3G; manifest downloadable as PDF; single-purpose UI | Driver refuses digital ticket = customer friction = platform brand damage |

## Secondary Stakeholders (Enablers)

| Name | Interest | Influence | Attitude | Platform Obligation | Risk if Ignored |
|---|---|---|---|---|---|
| **NAPAS / VietQR** | Transaction volume growth, correct standard usage | CRITICAL infrastructure | Supportive | Payment reconciliation sweep; webhook idempotency (jti); graceful fallback if VietQR unavailable | VietQR webhook not reconciled = money received but no ticket = worst customer experience |
| **MoMo Wallet** | Volume, correct IPN integration, co-brand compliance | HIGH (31M+ users; "MoMo accepted" is a trust signal) | Supportive | Exact FAILURE_RESULT_CODES per spec (never vendor-doc supersets); HMAC-verified IPN; MoMo logo per co-brand requirements | IPN failure codes mis-mapped = legitimate payments marked failed = revenue loss |
| **VNPay Gateway** | Volume, correct integration per VNPay spec, NHNN compliance | HIGH (domestic + international card payments) | Supportive | Return URL + IPN dual confirmation; settlement reconciliation in payout pipeline | Incorrect return URL handling = payment confirmed by VNPay but booking never updated = double charges on retry |
| **eSMS** | Message volume, A2P compliance | MEDIUM (SMS = OTP + ticket delivery) | Supportive | SMS delivery status callback (not fire-and-forget); fallback to email if SMS fails after 60s; key rotation runbook | eSMS downtime during Tet = ticket delivery fails at peak = mass complaints |
| **MISA e-Invoice** | Correct API usage, invoice volume | MEDIUM (mandatory for VAT compliance) | Supportive | Invoice on payment confirmation (async, not blocking checkout); amount = exact payment with VAT breakdown; retry queue | Invoice not issued in time = GDT non-compliance = penalty |
| **Ministry of Transport (Bo GTVT)** | No unlicensed transport facilitated; operator license compliance (Decree 10/2020) | VERY HIGH -- can mandate platform shutdown | Neutral to cautious | Hard license gate in KYB; annual re-verification; reporting capability for regulatory requests | Unlicensed operator onboarded = MoT enforcement = potential forced deactivation of ALL operators |
| **General Dept of Taxation (Tong cuc Thue)** | VAT collected and remitted; e-invoices per Circular 78/2021; platform CIT compliance | HIGH -- can freeze accounts | Neutral | VAT registration; MISA integration for 100% of paid bookings; accounting model documented (platform as agent) | E-invoice gap = audit trigger; fee revenue not declared = CIT exposure |
| **Ministry of Public Security / PDPD Authority** | Lawful data processing; data residency; 72h breach notification | HIGH -- increasing enforcement | Active | Data Processing Agreement; lawful basis per data category; cross-border transfer mechanism (VN to SG); logger PII redaction; breach notification runbook | Data breach without 72h notification = maximum penalty; phone numbers in logs = regulatory concern |

## Tertiary Stakeholders (Ecosystem)

| Name | Interest | Influence | Attitude | Platform Obligation | Risk if Ignored |
|---|---|---|---|---|---|
| **VeXeRe** (primary competitor) | Protect market position, poach operators | HIGH (market reference for operators comparing fees/features) | Hostile | Maintain fee competitiveness; faster payout (T+1 vs their estimated T+7-14); superior QR boarding UX | Operator multi-homes then delists; VeXeRe FUD about regulatory compliance |
| **FutaBus/Phuong Trang** (vertically integrated) | Direct-to-consumer; own booking site | VERY HIGH (commands major inter-city route share) | Resistant to third-party listing | Offer incremental demand they cannot reach alone; API integration; brand-safe listing | FUTA refuses = supply gap on busiest corridors = uncompetitive on south-central routes |
| **redBus Vietnam** (MakeMyTrip-backed) | Expand from India playbook, promotion-driven acquisition | MEDIUM-HIGH (capital depth for sustained burn) | Competitive | Compete on trust/quality, not price; central collection eliminates gate-price-surprise | Sustained 40%-off promotions poach price-sensitive customers |
| **Bus Station Managers (Ben xe)** | Revenue from platform-originated passengers; manifest verification | MEDIUM | Cautiously resistant (ticket offices lose commission) | Formal MOU with top 5 terminals; station manager read-only manifest access | Station refuses to honor QR = passengers turned away on major corridors |
| **Foreign Tourists** | English UI, international cards, tourist corridor coverage | LOW individually, HIGH reputationally | Neutral | English toggle (i18n); international card via VNPay; pickup point geo-coordinates | Negative English-language reviews propagate to global travel community |
| **Angel Investors / Seed Fund** | Revenue growth, regulatory compliance, path to Series A | HIGH on strategic direction | Supportive | Monthly update: booking volume, GMV, operator count, payout success rate, uptime | Regulatory non-compliance in diligence = term sheet pulled |

## Top 5 Make-or-Break Stakeholders

1. **Large Corporate Operators** -- Without their inventory, platform has nothing to sell. One large operator leaving removes 30-50% of supply. Fee negotiation, T+1 payout, and manifest quality are non-negotiable retention tools.

2. **Ministry of Transport (Bo GTVT)** -- Can shut platform down entirely. KYB license gate is both legal requirement and competitive moat vs. unlicensed informal channels. Must establish relationship before reaching 10 operators.

3. **Domestic Travelers (collective)** -- The demand engine. A single Tet surge failure causes permanent defection. No brand equity buffer yet -- one viral complaint thread on Facebook/Zalo can kill adoption.

4. **NAPAS/VietQR + MoMo** -- Payment infrastructure. If VietQR webhooks fail silently (money received, no ticket issued) or MoMo IPN codes are mis-mapped, platform loses both money and trust simultaneously.

5. **Platform CTO / Tech Lead** -- Only person who can enforce Mistake Log rules, maintain ledger immutability, and ensure code quality that prevents catastrophic failures (double-sell, money loss, PII leak).

## Vietnam-Specific Stakeholders Western Teams Miss

- **Bus Station Managers (Ben xe)**: Independent entities that charge operators terminal fees. Veto power over which platforms can operate within their premises. Can simply refuse to honor platform QR codes.
- **Provincial Transport Departments (So GTVT, 63 provinces)**: Route approvals are provincial, not national. A route crossing three provinces needs approval from all three. No central registry exists.
- **Zalo**: Vietnam's dominant messaging platform (100M+ users). Small operators use Zalo, not email. VeXeRe has already integrated as booking layer within Zalo. Booking notifications should support Zalo OA as a channel.
- **Informal/Unlicensed Operators**: ~20-30% of inter-provincial trips operate informally. They will try to onboard. Admitting them creates regulatory liability; rejecting them is correct but shrinks addressable supply side.
