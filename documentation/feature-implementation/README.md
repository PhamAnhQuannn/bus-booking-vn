# Feature Implementation

> Synthesized reference for each product feature — connects architecture decisions, design specs, frontend design, business rules, and regulatory constraints into per-feature documentation.

## Feature Index

| # | Feature | Description | Key Dependencies |
|---|---------|-------------|-----------------|
| 1 | [FI-001: Core Auth](FI-001-core-auth/README.md) | Customer OTP, Operator password, Admin TOTP authentication | ADR-003, ADR-008, DS-001, FD-012 |
| 2 | [FI-002: Operator Onboarding](FI-002-operator-onboarding/README.md) | KYB pipeline, operator approval lifecycle, document upload | ADR-004, ADR-014, DS-001, FD-021 |
| 3 | [FI-003: Fleet Management](FI-003-fleet-management/README.md) | Bus CRUD, maintenance windows, capacity management | ADR-004, ADR-009, DS-001, FD-022 |
| 4 | [FI-004: Route Management](FI-004-route-management/README.md) | Route CRUD, pickup/dropoff points, paired returns | ADR-004, DS-001, FD-022 |
| 5 | [FI-005: Trip Management](FI-005-trip-management/README.md) | Trip CRUD, departure/completion lifecycle, bus assignment | ADR-009, ADR-019, DS-001, FD-022 |
| 6 | [FI-006: Search & Discovery](FI-006-search-discovery/README.md) | Public search API, availability, filters, SEO | ADR-011, DS-001, DS-003, FD-013 |
| 7 | [FI-007: Booking Flow](FI-007-booking-flow/README.md) | Hold -> Book -> Pay -> Confirm lifecycle, concurrency guards | ADR-009, ADR-010, DS-001, FD-014/016/017 |
| 8 | [FI-008: Payment Integration](FI-008-payment-integration/README.md) | MoMo/VNPay/VietQR webhooks, payment lifecycle, stub gateway | ADR-005, DS-005, DS-007, FD-015 |
| 9 | [FI-009: Operator Console](FI-009-operator-console/README.md) | Dashboard, booking management, manifests, revenue reports | ADR-004, DS-001, DS-003, FD-024 |
| 10 | [FI-010: Payout System](FI-010-payout-system/README.md) | T+1 settlement, withdrawal, ledger, BigInt math | ADR-005, ADR-006, DS-009, DS-011 |
| 11 | [FI-011: Staff Management](FI-011-staff-management/README.md) | Operator staff RBAC, role assignment, driver management | ADR-004, DS-001, FD-030 |
| 12 | [FI-012: Admin Console](FI-012-admin-console/README.md) | Platform admin tools, operator approval, system monitoring | ADR-004, DS-003, FD-026 |
| 13 | [FI-013: Customer Account](FI-013-customer-account/README.md) | Profile, booking history, consent, DSAR, account deletion | ADR-008, DS-015, FD-019 |
| 14 | [FI-014: Notifications](FI-014-notifications/README.md) | SMS/email dispatch, templates, notification log, cron jobs | ADR-013, DS-006, FD-029 |
| 15 | [FI-015: E-Invoice](FI-015-e-invoice/README.md) | MISA integration, Decree 70/2025, tax compliance | ADR-014, DS-012, FD-023 |

## Cross-Cutting Concerns

All FI specs enforce:
- **Module boundaries** ([ADR-016](../architecture-decisions/ADR-016-module-boundaries/README.md)): barrel imports cross-domain, deep imports intra-domain
- **Multi-tenancy** ([ADR-004](../architecture-decisions/ADR-004-multi-tenancy/README.md)): `operatorId` FK on all operator-scoped tables, `withOperatorScope` wrapper
- **Testing** ([SI-005](../scaffolding-infra/SI-005-testing-strategy/README.md)): real-DB integration tests, mock hygiene, E2E with CSRF
- **Vietnamese UX** (FD-001 CC-1): formal "Quy khach", proper diacritics, domain glossary
- **VND currency** (FD-001 CC-4): dot-separator `250.000 d`, no decimals, "Mien phi" not "0 d"
- **Self-fetch prohibition** (FD-001 CC-6): server components call lib functions, not own API routes
