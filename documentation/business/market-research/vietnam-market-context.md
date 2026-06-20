# Vietnam Market Context & Entry Strategy

> Research date: 2026-06-17. Multi-agent synthesis (4 Sonnet researchers + 1 Opus synthesizer).

## Top 5 Actions for Next 90 Days

**1. Resolve payment intermediary license blocker (Week 1-2)**

Central-collection model is illegal without SBV license. Determines entire payment architecture. Fastest path: restructure to PSP split-settlement where each operator opens their own MoMo/VNPay merchant account and payment splits at source. Platform's 6% fee flows directly to platform account at payment time. Eliminates custody of operator funds, SBV license requirement, and T+1 payout obligation.

If split-settlement infeasible (small operators can't open merchant accounts), fallback is licensed escrow provider. Platform never holds funds in its own bank account.

This decision reshapes `lib/payment/`, `lib/ledger/`, and entire payout pipeline. Make it before building anything else.

**2. Secure 3 operator LOIs on one corridor (Week 1-4)**

30-day kill-switch is correct. Pick ONE corridor: **Thanh Hóa ↔ TPHCM** (high avg ticket price 875K-1,750K VND, massive labor migration demand, Tet spike = strongest in country, lower OTA competition than tourist corridors). Approach 3-5 operators with:
- 6% platform fee (vs. VeXeRe estimated 8-12%); admin can adjust per operator
- White-glove onboarding (set up their console for them)
- T+1 payout (or instant if split-settlement)

Target: 1-3 operators initially. Core demographic = migrant workers / laborers from Thanh Hóa working in TPHCM returning home for holidays — maps to "Chị Lan" budget domestic persona (price-sensitive 5/5, MoMo primary, 4-8 trips/year).

If 3 LOIs (Letter of Intent — Thư bày tỏ ý định hợp tác) do not materialize in 30 days, product-market fit hypothesis invalidated. Pivot before further investment.

**3. Close 5 go-live code blockers (Week 3-8)**

- Issue 094: Real payment keys (requires decision #1 first)
- `lib/payment/refund.ts`: Implement MoMo + VNPay refund API (currently throws `PspRefundNotImplementedError`)
- Issue 118: External monitoring (detect downtime in <2 minutes)
- Issue 095: Payment reconciliation sweeper (VietQR memo-match failures)
- Issue 101: Security/fraud gate (rate-limit fail-closed, hold cap enforcement)
- Minimum viable customer support (Contact Support link on booking confirmation -> Zalo OA)

**4. Complete regulatory filings (Week 4-12)**

See [regulatory/README.md](regulatory/README.md#consolidated-pre-launch-compliance-checklist) for full compliance checklist with domain-level detail. Key milestones:
- VSIC 2025 business license amendment — [regulatory/legal-entity.md](regulatory/legal-entity.md)
- E-commerce platform registration at online.gov.vn — [regulatory/legal-entity.md](regulatory/legal-entity.md)
- DPO + DPIA + CDTIA filings — [regulatory/data-privacy.md](regulatory/data-privacy.md)
- Tax ruling on e-invoice issuer role — [regulatory/einvoice-tax.md](regulatory/einvoice-tax.md)
- eSMS Brandname approval (2-4 week hard blocker) — [regulatory/telecom-sms.md](regulatory/telecom-sms.md)

**5. Negotiate MOUs with top 3 bus stations on chosen corridor (Week 6-12)**

Before first paid booking, ensure station managers at each terminal honor platform QR codes. Offer:
- Read-only manifest portal access (independent verification)
- Station logo + terminal map on trip detail page (brand value)
- Small per-boarding referral fee if needed to offset commission loss

## What to STOP

| Stop | Rationale |
|---|---|
| **Building for multi-operator scale before proving single-corridor viability** | 1 operator, ~200 bookings/day. Admin RBAC granularity, analytics dashboards, bulk import APIs are premature until 3+ operators actively booking. |
| **Treating pairedReturn as production-ready** | S15 ratified for deletion. Mistake Log Issue 013 documents spec conflict. Kill or freeze. |
| **Deferring payment model decision** | PAYMENTS_STUB on since inception. Every feature built on central-collection may need restructuring. Make the call now. |
| **Expanding charter before scheduled booking is live** | Charter = zero revenue (lead-gen). One working corridor with real payment > perfectly-engineered charter state machine. |

## What to START

| Start | Rationale |
|---|---|
| **Talking to Ministry of Transport before 10 operators** | Proactive meeting with Cuc Duong Bo establishes legitimacy + early warning. Wait until noticed = adversarial. |
| **Building English UI toggle** | Defer to Phase 2. Beachhead corridor (Thanh Hóa ↔ TPHCM) is domestic labor migration, not tourist. English UI becomes priority when adding tourist corridors (HCMC-Da Lat, HCMC-Nha Trang). |
| **Measuring SMS delivery rate by carrier** | eSMS sole provider. Vietnamobile/Gmobile have lower delivery. OTP/ticket SMS failure = locked out or ticketless customer. Instrument by carrier prefix. |
| **"Contact Support" minimum viable flow** | Consumer Protection Law 2023 (No. 19/2023/QH15) requires complaint channel. Email + Zalo OA link on booking confirmation satisfies legal requirement. |
| **Monthly VeXeRe competitive intel** | VeXeRe BMS locks ~300/550 operators. ~250 non-locked + ~1,500 not on VeXeRe = addressable supply. |

## Vietnam Market Entry Sequence

### Phase 1: Single Corridor Proof (Months 1-3)

- **Corridor**: Thanh Hóa ↔ TPHCM (high avg ticket 875K-1,750K VND, labor migration demand, overnight sleeper)
- **Target**: 1-3 operators, 20+ bookings/day
- **Customer**: Migrant workers, students, families — budget domestic persona ("Chị Lan"), price-sensitive, MoMo/cash primary
- **Payment**: Bank transfer (VietQR + SePay) + cash (launch); MoMo + VNPay added Phase 2
- **Language**: Vietnamese only
- **Charter**: OFF
- **Success metric**: 1-3 operators sustaining >10 bookings/day each for 30 consecutive days

### Phase 2: Adjacent Corridors + Tourist Routes (Months 4-6)

- **Add North-South trunk corridors**: Nghệ An ↔ TPHCM, Hà Tĩnh ↔ TPHCM (same labor migration pattern, adjacent to Phase 1 operators)
- **Add tourist corridor**: HCMC-Da Lat, HCMC-Nha Trang (limousine segment, international tourists)
- **Add English UI** for tourist segment on tourist corridors
- **Add VNPay** (international cards for tourists)
- **Enable charter** lead-gen on proven corridors
- **Target**: 10-15 operators, 200+ bookings/day
- **Success metric**: >15% of bookings from English-language sessions on tourist corridors

### Phase 3: Northern Hub + Scale (Months 7-12)

- **Add Hanoi corridors**: Hanoi-Sa Pa, Hanoi-Ha Long, Hanoi-Ninh Binh + Thanh Hóa ↔ Hà Nội (short-haul complement)
- **Target operators NOT on VeXeRe** (different regional players in North)
- **Load test for Tet** (January/February) — Thanh Hóa corridor is PEAK Tet demand
- **Build ratings/reviews** (enough volume by now)
- **Target**: 30-50 operators, 500+ bookings/day
- **Success metric**: Survive Tet with <1% booking failure rate

### Phase 4: Platform Effects (Year 2)

- Zalo integration (distribution channel)
- OTA white-label API (Traveloka, Klook, Agoda)
- Corporate/B2B shuttle contracts (industrial zones)
- Charter payment rail (graduate from lead-gen to transactional)
- **Target**: 100+ operators, Series A metrics

## What NOT to Do in Year 1

- **Mekong Delta provincial routes** -- cash-centric, low smartphone, low digital payment
- **Cross-border (Vietnam-Cambodia)** -- regulatory complexity, dominated by redBus/12Go
- **Seat maps** -- count-based model matches operator reality
- **Real-time GPS tracking** -- requires hardware operators don't have
- **Compete with FutaBus on HCMC-Can Tho** -- vertically integrated, always wins on price/reliability on own routes. Approach FUTA as supply partner via API, not direct competitor.
