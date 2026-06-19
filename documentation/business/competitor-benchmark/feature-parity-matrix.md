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
