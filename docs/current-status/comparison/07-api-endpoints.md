# API Endpoints — Spec vs Reality

Comparison of DS-003 (API Contract), DS-007 (Refund), and other spec endpoint definitions against current-status route inventory (files 20-22).

---

## Customer/Public API — Specified vs Implemented

Source: DS-003 Sections 1-6 vs `current-status/20-api-customer-public.md`

### Authentication & Account
| Endpoint | Spec | Status |
|---|---|---|
| `POST /api/auth/otp/send` | DS-003 | IMPLEMENTED (soft-disabled via proxy Layer 0.5) |
| `POST /api/auth/otp/verify` | DS-003 | IMPLEMENTED (soft-disabled) |
| `POST /api/auth/login` | DS-003 | IMPLEMENTED (soft-disabled) |
| `POST /api/auth/logout` | DS-003 | IMPLEMENTED |
| `POST /api/auth/refresh` | DS-003 | IMPLEMENTED |
| `POST /api/auth/forgot-password` | DS-003 | IMPLEMENTED |
| `POST /api/auth/forgot-password/verify` | DS-003 | IMPLEMENTED |
| `POST /api/account/delete` | DS-003 | IMPLEMENTED |
| `PATCH /api/account/name` | DS-003 | IMPLEMENTED |
| `POST /api/account/password` | DS-003 | IMPLEMENTED |
| `POST /api/account/phone/init` | DS-003 | IMPLEMENTED |
| `POST /api/account/phone/confirm` | DS-003 | IMPLEMENTED |
| `GET /api/account/export` | FI-013 | NOT IMPLEMENTED (DSAR data export) |

### Search & Trips
| Endpoint | Spec | Status |
|---|---|---|
| `GET /api/trips/search` | DS-003 | IMPLEMENTED |
| `GET /api/trips/[id]` | DS-003 | IMPLEMENTED |
| `GET /api/trips/[id]/pickup-areas` | DS-003 | IMPLEMENTED |

### Booking Flow
| Endpoint | Spec | Status |
|---|---|---|
| `POST /api/holds` | DS-003 | IMPLEMENTED |
| `GET /api/holds/[id]` | DS-003 | IMPLEMENTED |
| `POST /api/bookings/initiate` | DS-003 | IMPLEMENTED |
| `GET /api/bookings/[ref]` | DS-003 | IMPLEMENTED |
| `POST /api/bookings/[id]/cancel` | DS-007 | NOT IMPLEMENTED (customer self-cancel) |
| `GET /api/customers/me/refunds` | DS-007 | NOT IMPLEMENTED (customer refund list) |

### Payments
| Endpoint | Spec | Status |
|---|---|---|
| `POST /api/payments/momo/webhook` | FI-008 | IMPLEMENTED (stub) |
| `POST /api/payments/vnpay/webhook` | FI-008 | IMPLEMENTED (stub) |
| `GET /api/payments/vnpay/return` | FI-008 | IMPLEMENTED (stub) |
| `POST /api/payments/bank_transfer/webhook` | DS-013 | NOT IMPLEMENTED (SePay) |
| `POST /api/payments/zalopay/webhook` | DS-008 | NOT IMPLEMENTED (Phase 3) |
| `POST /api/payments/card/webhook` | FI-008 | IMPLEMENTED (stub) |

### Charter
| Endpoint | Spec | Status |
|---|---|---|
| `POST /api/charter` | DS-003 | IMPLEMENTED |
| `GET /api/charter/[ref]` | DS-003 | IMPLEMENTED |

---

## Operator API — Specified vs Implemented

Source: DS-003 Sections 7-8 vs `current-status/21-api-operator.md`

### Auth & Profile
| Endpoint | Status |
|---|---|
| `POST /api/op/auth/register` | IMPLEMENTED |
| `POST /api/op/auth/refresh` | IMPLEMENTED |
| `POST /api/op/auth/forgot-password/*` | IMPLEMENTED |
| `GET/PATCH /api/op/profile` | IMPLEMENTED |
| `POST /api/op/kyb/submit` | IMPLEMENTED |
| `GET /api/op/kyb/upload-url` | IMPLEMENTED |

### Fleet Management (54 routes total documented)
| Category | Route Count | Status |
|---|---|---|
| Buses CRUD + lifecycle | ~8 routes | IMPLEMENTED |
| Routes CRUD + pickup areas | ~6 routes | IMPLEMENTED |
| Trips CRUD + lifecycle (depart/complete/cancel/reassign/sales-toggle) | ~10 routes | IMPLEMENTED |
| Trip templates | ~4 routes | IMPLEMENTED |
| Bookings queue + check-in + manifest | ~6 routes | IMPLEMENTED |
| Staff CRUD + assign-service | ~5 routes | IMPLEMENTED |
| Charter lifecycle | ~4 routes | IMPLEMENTED |
| Pickup areas CRUD | ~4 routes | IMPLEMENTED |
| Finance (payout-account, withdraw, reports) | ~6 routes | IMPLEMENTED |
| Activity feed, scan, register | ~3 routes | IMPLEMENTED |

**Gap:** None significant. Operator API is substantially complete per spec.

---

## Admin API — Specified vs Implemented

Source: DS-003 Sections 9-10 vs `current-status/22-api-admin.md`

### Auth
| Endpoint | Status |
|---|---|
| `POST /api/admin/auth/login` | IMPLEMENTED |
| `POST /api/admin/auth/logout` | IMPLEMENTED |
| `POST /api/admin/auth/refresh` | IMPLEMENTED |
| `POST /api/admin/auth/totp/*` | IMPLEMENTED |
| `POST /api/admin/auth/step-up` | IMPLEMENTED |

### Operator Management
| Endpoint | Status |
|---|---|
| `GET /api/admin/operators` | IMPLEMENTED |
| `POST /api/admin/operators/[id]/approve` | IMPLEMENTED |
| `POST /api/admin/operators/[id]/reject` | IMPLEMENTED |
| `POST /api/admin/operators/[id]/suspend` | IMPLEMENTED |
| `POST /api/admin/operators/[id]/reinstate` | IMPLEMENTED |
| `POST /api/admin/operators/[id]/fee-override` | IMPLEMENTED |
| `GET /api/admin/operators/[id]/kyb` | IMPLEMENTED |

### Customer Management
| Endpoint | Status |
|---|---|
| `POST /api/admin/customers/[id]/suspend` | IMPLEMENTED |
| `POST /api/admin/customers/[id]/reinstate` | IMPLEMENTED |

### Finance
| Endpoint | Status |
|---|---|
| `POST /api/admin/finance/chargeback` | IMPLEMENTED |
| `GET/POST /api/admin/finance/fee/global` | IMPLEMENTED |
| `POST /api/admin/finance/ledger/adjustment` | IMPLEMENTED |
| `GET /api/admin/finance/payouts/[id]/*` | IMPLEMENTED |
| `POST /api/admin/finance/refund-out` | IMPLEMENTED |

### Missing Admin Endpoints (from DS-007)
| Endpoint | Spec | Status |
|---|---|---|
| `GET /api/admin/refunds` | DS-007 | NOT IMPLEMENTED (admin refund list) |
| `POST /api/admin/refunds/[id]/retry` | DS-007 | NOT IMPLEMENTED (retry failed refund) |
| `POST /api/admin/refunds/[id]/complete` | DS-007 | NOT IMPLEMENTED (manual completion) |
| `POST /api/admin/einvoice/[id]/retry` | FI-015 | NOT IMPLEMENTED (e-invoice retry) |

### Moderation, Charter, System
| Category | Status |
|---|---|
| Moderation (reports, routes, trips enable/disable) | IMPLEMENTED |
| Charter (assign-direct, publish, reject) | IMPLEMENTED |
| System (admins CRUD, audit/export, flags) | IMPLEMENTED |

---

## Summary

| API Scope | Specified | Implemented | Missing | Coverage |
|---|---|---|---|---|
| Customer/Public | ~25 endpoints | ~19 | ~6 | 76% |
| Operator | ~54 endpoints | ~54 | 0 | 100% |
| Admin | ~33 endpoints | ~29 | ~4 | 88% |
| Cron | 16 jobs | 11-12 | 4-5 | 75% |
| **Total** | ~128 | ~114 | ~14 | 89% |

**Key missing endpoints:**
1. `POST /api/bookings/[id]/cancel` — customer self-cancel (CRITICAL, CPL 2023)
2. `POST /api/payments/bank_transfer/webhook` — SePay webhook (CRITICAL, Phase 1 payment)
3. `GET /api/account/export` — DSAR data export (HIGH, PDPL 2025)
4. `GET /api/customers/me/refunds` — customer refund list (HIGH)
5. `GET /api/admin/refunds` — admin refund management (HIGH)
6. `POST /api/admin/refunds/[id]/retry` — retry failed refund (MEDIUM)
7. `POST /api/admin/refunds/[id]/complete` — manual refund completion (MEDIUM)
8. `POST /api/admin/einvoice/[id]/retry` — e-invoice retry (MEDIUM)
