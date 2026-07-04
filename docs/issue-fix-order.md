# Issue Backlog — Product Progress Order

**Updated:** 2026-07-04  
**Open issues:** 20 (2 launch blockers, 16 phase-2, 2 phase-3)  
**Launch scope:** Guest booking (no customer sign-in), bank transfer only, operator + admin portals live

---

## Launch Status

All P0/P1 code bugs and security issues are **CLOSED** (batches 1–5 completed 2026-07-03/04).  
Production deployment is a manual infra task (no GitHub issue — placeholder #182 was empty).

## Launch Blockers

| # | Title | Fix |
|---|-------|-----|
| [#242](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/242) | TICKET_SECRET missing from env → generate-ticket-pdfs 500 | Add dev fallback + .env.example + CI env (~15 min) |
| [#243](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/243) | PAYMENTS_STUB=false requires VNPay creds for bank-transfer-only launch | Split env validation per PSP (~30 min) |

---

Current codebase is launch-ready for the defined scope (after #242):
- ✅ Guest booking flow (search → hold → bank transfer → confirmation)
- ✅ Operator portal (routes, trips, buses, bookings, payouts, staff)
- ✅ Admin portal (operators, system config, audit, TOTP)
- ✅ Email OTP (replaces phone/SMS for customer auth when enabled)
- ✅ Security hardened (CSRF, rate-limit, XFF validation, encryption)
- ⏸️ Customer sign-in (proxy 410 gate — phase 2)
- ⏸️ Multi-payment (MoMo/VNPay/ZaloPay — phase 2)

---

## Phase 2 — Growth (~1K bookings/day, 10+ operators)

### Customer Auth Enablement

When ready to enable customer accounts, remove proxy 410 gate + restore nav links.

| # | Title | Priority | Labels |
|---|-------|----------|--------|
| [#168](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/168) | No token refresh in customer flow — 15-min JWT expires silently | P2 | bug, blocked |
| [#170](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/170) | Customer logout button missing + auth state in volatile vars | P2 | blocked |
| [#169](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/169) | No UI path to customer auth pages | P2 | blocked |
| [#241](https://github.com/PhamAnhQuannn/bus-booking-vn/issues/241) | E2E specs phone→email update (3 specs) | P2 | e2e-fix |

### Payment Expansion

| # | Title | Priority | Blocker |
|---|-------|----------|---------|
| [#138](https://github.com/PhamAnhQuannn/Bus-Booking/issues/138) | MoMo + VNPay real PSP credentials | P2 | vendor contracts |
| [#142](https://github.com/PhamAnhQuannn/Bus-Booking/issues/142) | Multi-payment method selection UI | P2 | after #138 |
| [#139](https://github.com/PhamAnhQuannn/Bus-Booking/issues/139) | Chargeback model + admin UI (DS-010) | P2 | after payment expansion |

### Compliance (Vietnam law)

| # | Title | Priority | Regulation |
|---|-------|----------|------------|
| [#132](https://github.com/PhamAnhQuannn/Bus-Booking/issues/132) | Tax withholding in calcPayout | P2 | Decree 117/2025 |
| [#133](https://github.com/PhamAnhQuannn/Bus-Booking/issues/133) | Split-settlement payment model | P2 | Decree 52/2024 |
| [#134](https://github.com/PhamAnhQuannn/Bus-Booking/issues/134) | E-invoice transport fields | P2 | Decree 70/2025 |
| [#135](https://github.com/PhamAnhQuannn/Bus-Booking/issues/135) | E-invoice MISA API integration | P2 | Circular 78/2021 |
| [#136](https://github.com/PhamAnhQuannn/Bus-Booking/issues/136) | Complaint & support ticket system | P2 | Law 19/2023 |
| [#137](https://github.com/PhamAnhQuannn/Bus-Booking/issues/137) | DSAR privacy API | P2 | PDPL 2025 |
| [#146](https://github.com/PhamAnhQuannn/Bus-Booking/issues/146) | DPA agreements with sub-processors | P2 | PDPL 2025 |

### Infrastructure

| # | Title | Priority | Notes |
|---|-------|----------|-------|
| [#143](https://github.com/PhamAnhQuannn/Bus-Booking/issues/143) | Observability (BetterStack + Sentry) | P2 | external service setup |
| [#144](https://github.com/PhamAnhQuannn/Bus-Booking/issues/144) | eSMS brandname registration | P2 | for operator SMS notifications |

---

## Phase 3 — Scale (~5K bookings/day, 50+ operators)

| # | Title | Priority |
|---|-------|----------|
| [#140](https://github.com/PhamAnhQuannn/Bus-Booking/issues/140) | ZaloPay adapter completion | P3 |
| [#141](https://github.com/PhamAnhQuannn/Bus-Booking/issues/141) | Promotions & voucher system | P3 |

---

## Closed (reference)

Issues #193–#198 (P3 features: S3 adapter, B2B invoicing, micro-deposit, waitlist, i18n, TOTP backup) were closed as NOT_PLANNED — reopen with proper spec when phase 3 begins.
