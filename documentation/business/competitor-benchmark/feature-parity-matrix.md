# Feature Parity Matrix

> BB vs VeXeRe vs redBus vs FUTA. Legend: ✅ Available, 🔶 Partial, ❌ Missing, ❓ Unknown. Research date: 2026-06-17.

| Category / Feature | BB | VeXeRe | redBus | FUTA |
|---|---|---|---|---|
| **Search / Discovery** | | | | |
| Multi-operator search | ✅ | ✅ 2000+ ops | ✅ major routes | ❌ single operator |
| Seat map preview | ❌ DEFERRED (count-based model) | ✅ (operator-dependent) | ✅ live | ✅ |
| Filter by bus type | ✅ | ✅ | ✅ | 🔶 own fleet only |
| Multimodal (train/flight) | ❌ bus only | ✅ bus+train+flight | 🔶 bus+ferry | ❌ bus only |
| **Booking Flow** | | | | |
| Seat selection | ❌ DEFERRED (count-based, no seat map) | ✅ | ✅ | ✅ |
| Round-trip booking | 🔶 paired return (op-side) | ✅ | ❓ | ❓ |
| E-ticket | ✅ | ✅ SMS+email | ✅ M-ticket | 🔶 app-based |
| Deposit hold (peak) | ❌ | ❓ | ✅ Tet deposit | ❓ |
| **Payment Methods** | | | | |
| Visa/MC/JCB | ✅ | ✅ | ✅ | ✅ |
| Domestic ATM/NAPAS | ✅ | ✅ | ✅ | ✅ |
| MoMo | ✅ | ✅ | ✅ | ✅ |
| ZaloPay | 🔶 planned | ✅ | ✅ | ✅ |
| VNPay | ✅ | ✅ | ✅ | ✅ |
| ShopeePay/AirPay | ❌ | ✅ | ❓ | ❓ |
| Cash at convenience store | ❌ | ✅ | ❌ | ❌ |
| Installment payment | ❌ | ✅ HD SAISON | ❌ | ❌ |
| **Post-Booking** | | | | |
| Self-service cancel | ❌ deferred (legal opinion needed on CPL Art. 29) | ✅ one-touch | ✅ | ❓ |
| Refund to original method | ❌ (PSP refund API not implemented) | ✅ 2-7 days | 🔶 wallet preferred | ❓ |
| 150% guarantee | ❌ | ✅ 100% cash + 50% voucher | ✅ 1.5x refund | ❌ |
| Modify booking | 🔶 cancel+rebook | 🔶 train only (20k fee) | 🔶 FlexiTicket | ❓ |
| **Operator Tools** | | | | |
| Operator dashboard | ✅ deep RBAC + MISA e-invoice | ✅ full BMS/AMS + manager app | ✅ dashboard | ❌ internal only |
| API integration | 🔶 planned | ✅ | ✅ | ❌ |
| White-label site/app | ❌ | ✅ VeXeRe infra | ❌ | ❌ |
| Fleet/driver management | ❌ | ✅ GPS + driver app | ❓ | ✅ internal |
| Agent/reseller management | ❌ | ✅ AMS 5000+ resellers | ❓ | ❌ |
| **Customer Communication** | | | | |
| SMS confirmation | ✅ | ✅ | ✅ | 🔶 hotline-centric |
| Email | ✅ | ✅ | ✅ | ❓ |
| Push notifications | 🔶 web-only | ✅ app push | ✅ app push | 🔶 |
| Live bus tracking | ❌ | ✅ shareable link | ✅ | ❓ |
| **Mobile** | | | | |
| Native app | ❌ PWA/responsive | ✅ iOS 4.8★ (22K reviews) | ✅ iOS 4.6★ (1.4K reviews) | ✅ iOS 3.2★ (4.5K reviews) |
| **Loyalty / Promotions** | | | | |
| Points/rewards | ❌ | ❓ Xu system unconfirmed | ❌ | ✅ confirmed |
| Flash sales | ❌ | ✅ up to 50% off | ✅ up to 30% | 🔶 |
| Referral | ❌ | ✅ | ❓ | ✅ driver referral 200k VND |
| **Multi-language** | | | | |
| Vietnamese | ✅ | ✅ | ✅ | ✅ |
| English | ✅ | 🔶 partial/uneven | ✅ best of three | 🔶 partial |
| **Accessibility (WCAG)** | 🔶 design-system level | ❌ | ❌ | ❌ |

### BB's Key Feature Gaps vs. Incumbents

- Native mobile app
- Live bus tracking
- Loyalty/points system
- Flash sale infrastructure
- Convenience store cash payment
- Agent/reseller management
- Multimodal (train/flight)

### BB's Potential Differentiators

- **Accessibility (WCAG)** -- no competitor does this
- **Deep RBAC operator console** -- role-based access control beyond what VeXeRe exposes
- **MISA e-invoice automation** -- built-in, not bolted on
- **Operator brand ownership** -- vs VeXeRe's platform-brand-first approach
- **Transparent T+1 settlement** -- published terms, fastest in market

---

## Feature Gap Analysis — Prioritized

> Consolidated from market research. Detailed impact/effort/recommendation per gap.

### P0 — Build Before Launch

**1. Customer Cancellation & Refund Flow**
- **What**: Self-service cancellation with automated refund to original payment method within 24-48h
- **Who has it**: VeXeRe (one-touch in app), FUTA, redBus (up to 6h before departure, online), Traveloka
- **Impact if missing**: HIGH — #1 pain point. Users who cannot cancel will not book. Negative reviews accumulate immediately.
- **Effort**: MEDIUM — requires refund API integration with VNPay/MoMo, operator-side cancellation policy configuration, T+1 settlement clawback mechanism

**2. Round-Trip Booking**
- **What**: Book outbound + return in a single transaction
- **Who has it**: All major platforms
- **Impact if missing**: MEDIUM-HIGH — forces users to make two separate bookings, increasing friction and abandonment
- **Effort**: MEDIUM — paired-return trip infrastructure exists (Issue 013), customer-facing round-trip search/checkout flow may need completion

### P1 — Build for Launch or Immediately After

**3. SMS/Zalo Notification (ZNS)**
- **What**: Booking confirmation + trip reminder via SMS or Zalo message
- **Who has it**: VeXeRe (ZNS), FUTA, redBus, MoMo, ZaloPay
- **Impact if missing**: MEDIUM-HIGH — email-only confirmation feels unreliable to Vietnamese users
- **Effort**: SMALL for SMS (eSMS integration); SMALL-MEDIUM for ZNS (Zalo OA registration + API integration)

**4. Customer Booking History**
- **What**: "My Bookings" page showing past and upcoming trips with ticket details
- **Who has it**: Every platform with user accounts
- **Impact if missing**: MEDIUM
- **Effort**: SMALL — data already exists; read-only UI

**5. English Language Support**
- **What**: UI in English for international tourists and English-speaking Vietnamese
- **Who has it**: VeXeRe, redBus, Traveloka, Baolau, 12Go
- **Impact if missing**: MEDIUM — locks out international tourist segment. Matters for tourist routes (Sapa, Ha Long, Da Lat, Mui Ne, Nha Trang).
- **Effort**: MEDIUM — i18n framework + translation

### P2 — Build Month 1-6

**6. Promo Code / Discount Voucher Engine**
- **What**: Platform-level and operator-configurable discount codes, flash sales, early-bird pricing
- **Who has it**: VeXeRe (FlashSale up to 50%), redBus (up to 40%), MoMo (most aggressive), FUTA
- **Impact if missing**: MEDIUM — Vietnamese extremely price-sensitive and promotion-responsive. 20-50k VND cashback significantly increases conversion.
- **Effort**: MEDIUM

**7. Push Notifications / Trip Reminders**
- **What**: Departure reminders, gate changes, delay notifications
- **Who has it**: VeXeRe (ZNS), FUTA, redBus, ZaloPay
- **Impact if missing**: MEDIUM
- **Effort**: SMALL (incremental if ZNS already integrated)

**8. Operator Ratings & Reviews**
- **What**: Post-trip star ratings and text reviews visible on search results
- **Who has it**: VeXeRe, redBus, Traveloka, Baolau, 12Go
- **Impact if missing**: MEDIUM — growing trust signal, but operators may resist public ratings
- **Effort**: MEDIUM

### P3 — Build Month 6+ or Skip

**9. Native Mobile App (iOS + Android)** — LARGE effort. Pursue MoMo/ZaloPay distribution first. Consider PWA as intermediate step. Evaluate at month 6.

**10. Live GPS Bus Tracking** — LARGE effort, requires operator hardware. SKIP for now.

**11. Travel Insurance Add-On** — Clearest margin-expansion opportunity (30-40% of premium). BUILD month 6+.

**12. Multi-Modal Booking (Bus + Train + Flight)** — LARGE. Not relevant to BB's operator SaaS positioning. SKIP.

**13. Agent/Reseller Network (AMS)** — Agents are nearly CAC-free offline distribution. BUILD month 12+ (needs sufficient operator inventory first).

### Table Stakes Checklist

| Feature | Status | Notes |
|---|---|---|
| Route search (origin + destination + date) | ✅ DONE | — |
| Visual seat map with exact seat selection | ✅ DONE (hold flow) | — |
| Online payment — MoMo | ✅ DONE (code ready) | **Phase 2** (requires merchant approval) |
| Online payment — VNPay | ✅ DONE (code ready) | Enabled Month 1-3 (cards, QR, international) |
| E-ticket delivery by email | ✅ DONE (Resend) | — |
| Instant booking confirmation | ✅ DONE | — |
| Pickup/drop-off point selection | ✅ DONE | — |
| Multiple bus types displayed | ✅ DONE | — |
| Mobile-responsive web | ✅ DONE | — |
| Customer cancellation & refund | ❌ MISSING | **P0 LAUNCH BLOCKER** |
| Round-trip booking | ❌ MISSING | **P0 LAUNCH BLOCKER** |
| SMS/Zalo confirmation | ⚠️ PARTIAL (email only) | **P1** |
| Customer booking history | ❌ MISSING | **P1** |
| Cash payment option | ⚠️ PARTIAL | P1 |
