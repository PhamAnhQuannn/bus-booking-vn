# User Insights — Vietnamese Bus Travelers

## Cultural & Behavioral Factors

1. **Zalo is the communication backbone, not email.** 85% of Vietnamese use Zalo. For booking confirmations, trip reminders, and customer service, Zalo OA/ZNS is the expected channel. Email is for formal complaints, not transactional messaging.

2. **Cash is still king at the station.** A meaningful segment (elderly, rural, migrant workers) will not pre-pay online. "Reserve online, pay cash at boarding" is a flow that FUTA supports and BB should consider.

3. **Price sensitivity is extreme.** The word "gia re" (cheap price) appears in virtually every booking-related search. Any visible booking fee charged to the customer will drive price-sensitive users to call the operator directly. Commission must be absorbed by the operator or invisible to the customer.

4. **Tet is the make-or-break season.** Demand spikes 260% (3.6x) at major stations during Tet. Industry estimates range 3-10x depending on corridor and measurement method. Tickets sell out 1-3 months in advance. Operators earn a disproportionate share of annual revenue in the 2 weeks around Tet. BB must be live and stable before Tet season (typically late January/early February) or wait a full year for the next window.

5. **Trust in small operators is low.** Fake booking pages (Facebook impersonators) and no-show operators have trained Vietnamese users to distrust unknown brands. BB must provide trust signals: immediate booking confirmation, clear refund policy, operator license verification display.

6. **Facebook and Zalo are the discovery channels.** Small operators market primarily through Facebook pages and Zalo groups. BB should integrate with or complement these channels, not ask operators to abandon them.

7. **"Bait and switch" is a real fear.** Booking a VIP sleeper and being assigned an old standard bus is a widely reported complaint. BB's seat map and bus type display must be accurate and binding — display the actual vehicle assigned, not a generic category.

## Payment Ecosystem

| Payment Method | Market Position | BB Status | Priority |
|---|---|---|---|
| **MoMo** | 68% e-wallet share, 31M users, dominant for 18-34 age band | ✅ DONE | — |
| **VNPay** | Dominant for QR payments at retail, bank-transfer-preferring segment | ✅ DONE | — |
| **ZaloPay** | 20M active users, embedded in Zalo (70M+ users), growing rapidly | ❌ MISSING | P2 — month 1-3 |
| **Bank transfer (direct)** | Common for phone/Zalo bookings with small operators | ⚠️ via VNPay | — |
| **Cash at boarding** | Still dominant for station walk-up; critical for older/rural travelers | ⚠️ PARTIAL | P1 |
| **International cards (Visa/MC)** | Low penetration among core domestic demo; matters for tourist routes | Via VNPay | — |
| **ShopeePay** | Growing; VeXeRe supports it | ❌ MISSING | P3 |

Payment processing costs: VNPay/MoMo MDR ~1.5-2.5% domestic e-wallet, 2-3% card. On 400,000 VND booking → ~6,000-10,000 VND processing cost.

## Top 10 Insights → Product Implications

| # | Insight | Product Implication |
|---|---|---|
| 1 | **Refunds = #1 pain point across all platforms.** VeXeRe averages 2.7★ Trustpilot; "slow refund" dominant complaint. redBus "takes payment without reserving seats, then tells customers refund takes 14 days." | Build automated refund-to-original-payment within 24-48h. Make refund policy prominent on every booking confirmation. This alone can be a trust differentiator. |
| 2 | **Vietnamese users comparison-shop in parallel tabs.** VeXeRe's 10-minute hold window exists because users actively compare prices across platforms. | Hold-then-pay flow is correct architecture. Ensure hold duration competitive (10-15 min). Display "held for you for X minutes" countdown prominently. |
| 3 | **20,000-50,000 VND cashback converts first-time users.** MoMo and ZaloPay prove wallet-exclusive micro-discounts significantly shift behavior. | Build promo/voucher engine early (month 1-3). Platform-funded 20k VND first-booking discounts will have outsized conversion impact. |
| 4 | **Tet ticket scarcity is the most emotionally charged pain point.** Tickets sell out 1-3 months in advance. Workers and students get stranded or pay scalpers. | Robust inventory management, no overselling. Consider waitlist/notification for sold-out trips. Tet = strongest operator acquisition window (operators can't get listed on VeXeRe fast enough). |
| 5 | **Immediate booking confirmation is a trust signal.** Receiving confirmation within 60 seconds separates trusted platforms from "takes payment and disappears." | BB already sends email confirmation. Add Zalo/SMS within 60 seconds. Clear "Booking confirmed" screen with reference, seat number, pickup details. |
| 6 | **Growing premium segment (25-35, urban) pays 1.5-2x for limousine minibuses.** 9-16 seat, guaranteed seat, no pickup stops, faster. Underserved by price-first platforms. | Ensure operator console supports limousine/VIP bus types with distinct pricing tiers. Feature premium options prominently in search — higher AOV improves unit economics. |
| 7 | **Small operators market through Facebook pages and Zalo groups.** Phone/Zalo booking (call operator, transfer money, get Zalo confirmation) is still default for non-digitized operators. | BB's value prop should be "digitize what you already do on Zalo/Facebook" — not "abandon your existing channels." Feature: generate a booking link operator can share on their Facebook page or Zalo group. |
| 8 | **Bus safety is highly salient.** Viral social media reports of accidents cause demand shifts. Passengers choose operators partly based on perceived safety. | Display operator license verification status on booking pages. Consider "safety rating" or "verified operator" badge based on license currency and fleet age data. |
| 9 | **Post-booking communication is nearly absent.** If anything changes (delay, pickup moved, seat reassigned), customers have no way to find out except calling operator's unanswered hotline. | Build operator-to-passenger notification (Zalo/SMS). Even "your bus is delayed 30 minutes" would be genuine differentiator no small operator currently provides. |
| 10 | **Email has very low importance for typical bus traveler.** Used for formal complaints, not transactional messaging. Open rates low. | De-prioritize email as primary communication. Zalo (ZNS) primary, SMS secondary, email tertiary. Current email-only via Resend is a gap. |
