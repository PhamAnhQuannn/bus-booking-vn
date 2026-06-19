# Feature Benchmark — Table Stakes + Gaps vs Competitors

## Table Stakes Features (MUST HAVE — Launch Blockers)

| Feature | Why Table Stakes | Our Status | Priority |
|---|---|---|---|
| Route search (origin + destination + date) | Every platform has it; users cannot book without it | ✅ DONE | — |
| Visual seat map with exact seat selection | VeXeRe, FUTA, redBus all have it; Vietnamese users expect to choose exact seat/berth | ✅ DONE (hold flow) | — |
| Online payment — VNPay | Dominant domestic QR/bank payment; covers bank-transfer-preferring segment | ✅ DONE | — |
| Online payment — MoMo | 68% e-wallet market share, 31M users; the payment method 18-34 demo uses | ✅ DONE | — |
| E-ticket delivery by email | Standard across all platforms | ✅ DONE (Resend) | — |
| Instant booking confirmation | Trust signal; immediate confirmation separates trusted platforms from "takes payment and disappears" | ✅ DONE | — |
| Pickup/drop-off point selection | Every platform offers; Vietnamese buses use pickup points, not just terminal departures | ✅ DONE | — |
| Multiple bus types displayed | Sleeper/seat/limousine differentiation is how Vietnamese travelers choose | ✅ DONE | — |
| Mobile-responsive web | 65-73% of bookings are mobile | ✅ DONE | — |
| **Customer cancellation & refund flow** | **Every competitor has it. #1 complaint across all platforms is slow/missing refunds. Launching without it will destroy trust.** | **❌ MISSING** | **P0 LAUNCH BLOCKER** |
| **Round-trip booking** | **VeXeRe, FUTA, redBus, Traveloka, Baolau, 12Go all have it. Vietnamese travelers frequently book return legs.** | **❌ MISSING** | **P0 LAUNCH BLOCKER** |
| **SMS/Zalo booking confirmation** | **Vietnamese users expect SMS. Email open rates low. Zalo notification acceptable substitute but email alone is not.** | **⚠️ PARTIAL (email only)** | **P1** |
| **Customer booking history ("My Bookings")** | **Every platform with user accounts has this. Users need to retrieve ticket, check status, reference booking details.** | **❌ MISSING** | **P1** |
| Cash payment option | Meaningful portion of travelers won't pre-pay online. "Reserve online, pay cash to driver/at counter" supported by FUTA. | ⚠️ PARTIAL (cash flow exists, customer-facing UX unclear) | P1 |

## Feature Gaps — Prioritized

### P0 — Build Before Launch

**1. Customer Cancellation & Refund Flow**
- **What**: Self-service cancellation with automated refund to original payment method within 24-48h
- **Who has it**: VeXeRe (one-touch in app), FUTA, redBus (up to 6h before departure, online), Traveloka
- **Impact if missing**: HIGH — #1 pain point. Users who cannot cancel will not book. Negative reviews accumulate immediately.
- **Effort**: MEDIUM — requires refund API integration with VNPay/MoMo, operator-side cancellation policy configuration, T+1 settlement clawback mechanism
- **Recommendation**: BUILD NOW — non-negotiable launch blocker

**2. Round-Trip Booking**
- **What**: Book outbound + return in a single transaction
- **Who has it**: All major platforms
- **Impact if missing**: MEDIUM-HIGH — forces users to make two separate bookings, increasing friction and abandonment
- **Effort**: MEDIUM — paired-return trip infrastructure exists (Issue 013), customer-facing round-trip search/checkout flow may need completion
- **Recommendation**: BUILD NOW

### P1 — Build for Launch or Immediately After

**3. SMS/Zalo Notification (ZNS)**
- **What**: Booking confirmation + trip reminder via SMS or Zalo message
- **Who has it**: VeXeRe (ZNS), FUTA, redBus, MoMo, ZaloPay
- **Impact if missing**: MEDIUM-HIGH — email-only confirmation feels unreliable to Vietnamese users. ZNS has higher open rates than SMS and is cheaper.
- **Effort**: SMALL for SMS (eSMS integration); SMALL-MEDIUM for ZNS (Zalo OA registration + API integration)
- **Recommendation**: BUILD NOW — ZNS preferred over SMS (higher open rates, lower cost, 70M Zalo users)

**4. Customer Booking History**
- **What**: "My Bookings" page showing past and upcoming trips with ticket details
- **Who has it**: Every platform with user accounts
- **Impact if missing**: MEDIUM
- **Effort**: SMALL — data already exists; read-only UI
- **Recommendation**: BUILD NOW

**5. English Language Support**
- **What**: UI in English for international tourists and English-speaking Vietnamese
- **Who has it**: VeXeRe, redBus, Traveloka, Baolau, 12Go
- **Impact if missing**: MEDIUM — locks out international tourist segment. Less critical for operator SaaS angle. Matters for tourist routes (Sapa, Ha Long, Da Lat, Mui Ne, Nha Trang).
- **Effort**: MEDIUM — i18n framework + translation
- **Recommendation**: BUILD MONTH 1-3

### P2 — Build Month 1-6

**6. Promo Code / Discount Voucher Engine**
- **What**: Platform-level and operator-configurable discount codes, flash sales, early-bird pricing
- **Who has it**: VeXeRe (FlashSale up to 50%), redBus (up to 40%), MoMo (most aggressive), FUTA
- **Impact if missing**: MEDIUM — Vietnamese extremely price-sensitive and promotion-responsive. 20-50k VND cashback significantly increases conversion.
- **Effort**: MEDIUM
- **Recommendation**: BUILD MONTH 1-3

**7. Push Notifications / Trip Reminders**
- **What**: Departure reminders, gate changes, delay notifications
- **Who has it**: VeXeRe (ZNS), FUTA, redBus, ZaloPay
- **Impact if missing**: MEDIUM
- **Effort**: SMALL (incremental if ZNS already integrated)
- **Recommendation**: BUILD MONTH 1-3

**8. Operator Ratings & Reviews**
- **What**: Post-trip star ratings and text reviews visible on search results
- **Who has it**: VeXeRe, redBus, Traveloka, Baolau, 12Go
- **Impact if missing**: MEDIUM — growing trust signal, but operators may resist public ratings
- **Effort**: MEDIUM
- **Recommendation**: BUILD MONTH 3-6

### P3 — Build Month 6+ or Skip

**9. Native Mobile App (iOS + Android)**
- **What**: Dedicated app with home screen presence, push notifications, offline ticket access
- **Who has it**: VeXeRe, FUTA, redBus, Traveloka
- **Impact if missing**: MEDIUM — mobile web viable (Baolau/12Go prove it for tourist audiences), but domestic mass-market repeat users benefit from native app or super-app distribution
- **Effort**: LARGE
- **Recommendation**: DEFER — pursue MoMo/ZaloPay distribution first. Consider PWA as intermediate step. Evaluate at month 6.

**10. Live GPS Bus Tracking (Passenger-Facing)**
- **What**: Real-time bus location visible to passengers post-booking
- **Who has it**: VeXeRe (live tracking + shareable link), redBus, FUTA, Gobus
- **Impact if missing**: LOW-MEDIUM — requires operator hardware (GPS on every bus). Inconsistent due to hardware variability among small operators.
- **Effort**: LARGE
- **Recommendation**: SKIP for now

**11. Travel Insurance Add-On**
- **What**: Optional insurance at checkout (20,000 VND/ticket, Bao Viet partnership)
- **Who has it**: VeXeRe only
- **Impact if missing**: LOW — only one competitor has it, not yet user expectation
- **Effort**: MEDIUM (insurance partner negotiation + checkout integration)
- **Recommendation**: BUILD MONTH 6+ — clearest margin-expansion opportunity with no competitive crowding. OTA earns 30-40% of premium (6,000-8,000 VND per conversion).

**12. Multi-Modal Booking (Bus + Train + Flight)**
- **What**: Combined search across transport modes
- **Who has it**: VeXeRe, Traveloka, Baolau, 12Go
- **Impact if missing**: LOW — marketplace feature, not relevant to BB's operator SaaS positioning
- **Effort**: LARGE
- **Recommendation**: SKIP

**13. Agent/Reseller Network (AMS)**
- **What**: B2B tool for travel agents to access multi-operator inventory
- **Who has it**: VeXeRe (5,000+ agents)
- **Impact if missing**: LOW near-term, HIGH long-term — agents are nearly CAC-free offline distribution
- **Effort**: LARGE
- **Recommendation**: BUILD MONTH 12+ — needs sufficient operator inventory first
