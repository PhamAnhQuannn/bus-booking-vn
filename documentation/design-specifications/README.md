# Design Specifications

Data model, API contract, and system design specifications for the BusBooking platform. Each specification synthesizes decisions from [Architecture Decision Records](../architecture-decisions/) and requirements from [Business Documentation](../business/).

## Specifications

### Core Data & API Layer

| Spec | Status | Scope |
|------|--------|-------|
| [DS-001: Data Model](DS-001-data-model/) | CURRENT | PostgreSQL 16+ schema (Prisma 7.x), 40+ entities across 15 bounded contexts, state machines, indexes, invariants |
| [DS-002: Migration Strategy](DS-002-migration-strategy/) | CURRENT | Forward-only Prisma migrations, raw-SQL fallback, two-phase destructive changes, retention rules |
| [DS-003: API Contract](DS-003-api-contract/) | CURRENT | ~115 endpoints across customer/operator/admin/webhook/cron realms, auth, CSRF, rate limiting, error contract |
| [DS-004: API Versioning](DS-004-api-versioning/) | CURRENT | Stability tiers (S1/S2/S3), S1-frozen contracts, two-phase breaking changes, deprecation windows |
| [DS-005: Webhook Design](DS-005-webhook-design/) | CURRENT | Inbound MoMo/VNPay payment callbacks, 8-step pipeline, HMAC verification, idempotency, ledger writes |
| [DS-006: Background Jobs](DS-006-background-jobs/) | CURRENT | Vercel Cron + database-as-queue, 16 cron jobs, hybrid after()/cron pattern, FOR UPDATE SKIP LOCKED |

### Payment & Financial

| Spec | Status | Scope |
|------|--------|-------|
| [DS-007: Refund Flow](DS-007-refund-flow/) | NEW | Refund state machine, PSP refund API (MoMo/VNPay), cancellation policy, Art. 29 3-day right, retry cron |
| [DS-008: ZaloPay Adapter](DS-008-zalopay-adapter/) | NEW | ZaloPay AIO v2 integration, HMAC-SHA256, webhook handler, adapter normalization, settlement terms |
| [DS-009: Split-Settlement Migration](DS-009-split-settlement/) | NEW | Central collection → PSP marketplace model, per-operator sub-merchant, IPS license elimination |
| [DS-010: Chargeback Design](DS-010-chargeback-design/) | NEW | Chargeback state machine, VNPay 45-90 day window, reserve fund model, operator clawback, admin API |
| [DS-011: Tax Withholding](DS-011-tax-withholding/) | NEW | Decree 117/2025 individual operator withholding, calcWithholding BigInt math, FCT for foreign contractors |
| [DS-013: VietQR Reconciliation](DS-013-vietqr-reconciliation/) | CURRENT | Bank transfer via SePay webhook (push-based, 5-30s), VietQR QR code generation, BankTransferAdapter, booking ref matching |

### Compliance & Regulatory

| Spec | Status | Scope |
|------|--------|-------|
| [DS-012: Transport E-Invoice Fields](DS-012-transport-einvoice/) | NEW | Decree 70/2025 transport fields (vehicle plate, departure/destination, MST), MISA XML mapping |
| [DS-014: Complaint & Support API](DS-014-complaint-support/) | NEW | Law 19/2023 complaint handling, 3-day/30-day SLA, state machine, complaintSlaMon cron |
| [DS-015: DSAR & Privacy API](DS-015-dsar-privacy/) | NEW | PDPL 2025 data subject rights, export bundle, deletion flow, piiAnonymization cron, consent architecture |

### Infrastructure

| Spec | Status | Scope |
|------|--------|-------|
| [DS-017: Deployment Portability](DS-017-deployment-portability/) | NEW | Provider-agnostic deployment contract, Vercel Pro primary / FPT Cloud backup, cron sidecar, reverse proxy, migration playbook, cost comparison |

### Customer Experience

| Spec | Status | Scope |
|------|--------|-------|
| [DS-016: Promotions & Vouchers](DS-016-promotions-vouchers/) | NEW | Promo codes (percentage/fixed/cashback), I7-compliant server-side discount, anti-fraud, ledger integration |

### Frontend Design (in [`../frontend-design/`](../frontend-design/))

| Spec | Status | Scope |
|------|--------|-------|
| [DS-018 / FD-001: Design System](../frontend-design/FD-001-design-system/) | CURRENT | Base-UI + Tailwind v4, OKLCH color system, Be Vietnam Pro typography, 50+ component inventory |
| [DS-019 / FD-002: Navigation Pattern](../frontend-design/FD-002-navigation-pattern/) | CURRENT | Three portals (customer/operator/admin), collapsible sidebar, mobile bottom nav, Cmd+K palette |
| [DS-020 / FD-003: Page Inventory](../frontend-design/FD-003-page-inventory/) | CURRENT | 24 customer + 28 operator + 11 admin pages, booking layout guards, error pages |
| [DS-021 / FD-004: Form Design](../frontend-design/FD-004-form-design/) | CURRENT | Base-UI value/onValueChange API, Zod validation, CSRF, SearchForm, Calendar, ContactBookingForm |
| [DS-022 / FD-005: Motion & Interaction](../frontend-design/FD-005-motion-interaction/) | CURRENT | CSS-only animations, scroll-driven reveal, prefers-reduced-motion guards, HoldTimer state |
| [DS-023 / FD-006: I18n Design](../frontend-design/FD-006-i18n-design/) | CURRENT | Vietnamese-only (hardcoded), UTC+7 timezone, VND currency, date-fns vi locale |
| [DS-024 / FD-007: Responsive & Mobile](../frontend-design/FD-007-responsive-mobile/) | CURRENT | Mobile-first 390px+, 3 breakpoints, 44px touch targets, operator nav viewport split |
| [DS-025 / FD-008: Accessibility](../frontend-design/FD-008-accessibility/) | CURRENT | ARIA, focus-visible ring, keyboard nav, reduced motion, color contrast, Base-UI foundation |
| [DS-026 / FD-009: State Management](../frontend-design/FD-009-state-management/) | NEW | Zustand stores catalog, persistence, hydration patterns, state boundaries |
| [DS-027 / FD-010: Error & Loading States](../frontend-design/FD-010-error-loading-states/) | NEW | Error boundaries, loading skeletons, empty states, API error→UI mapping, toasts |
| [DS-028 / FD-011: Data Fetching](../frontend-design/FD-011-data-fetching/) | NEW | RSC vs client, self-fetch prohibition, Suspense streaming, cache, auth context |
| [DS-029 / FD-012: Authentication](../frontend-design/FD-012-authentication/) | NEW | 3 auth realms (customer OTP, operator TOTP, admin TOTP), lockout, session expiry, CSRF |
| [DS-030 / FD-013: Search & Results UX](../frontend-design/FD-013-search-results/) | NEW | Route autocomplete, trip card anatomy, sort/filter, SEO URLs, trust signals |
| [DS-031 / FD-014: Hold Timer](../frontend-design/FD-014-hold-timer/) | NEW | 10-min countdown, expiry handling, per-phone hold cap, timer persistence |
| [DS-032 / FD-015: Payment Checkout](../frontend-design/FD-015-payment-checkout/) | NEW | Guest vs auth, PSP selection (bank transfer/cash/MoMo/VNPay), payment failure recovery |
| [DS-033 / FD-016: Booking Confirmation](../frontend-design/FD-016-booking-confirmation/) | NEW | Payment polling, confirmation page, legal content, ticket display, e-invoice link |
| [DS-034 / FD-017: Booking Lifecycle](../frontend-design/FD-017-booking-lifecycle/) | NEW | 8 booking states, My Bookings, status badges, per-state actions |
| [DS-035 / FD-018: Cancellation & Refund](../frontend-design/FD-018-cancellation-refund/) | NEW | Art. 29, fee preview, refund tracking, auto-refund on trip cancellation |
| [DS-036 / FD-019: Consent & PDPL](../frontend-design/FD-019-consent-privacy/) | NEW | Consent banner, DSAR self-service, preference center, account deletion |
| [DS-037 / FD-020: Complaint Tracking](../frontend-design/FD-020-complaint-tracking/) | NEW | Law 19/2023 complaint form, status tracking, response thread |
| [DS-038 / FD-021: Operator Onboarding](../frontend-design/FD-021-operator-onboarding/) | NEW | KYB wizard, document upload, status states, resubmission, license alerts |
| [DS-039 / FD-022: Operator Fleet & Trips](../frontend-design/FD-022-operator-fleet-trips/) | NEW | Bus/route/trip CRUD, templates, manifest, check-in/no-show |
| [DS-040 / FD-023: E-Invoice](../frontend-design/FD-023-einvoice/) | NEW | Invoice download, operator management, Decree 70/2025, MISA status |
| [DS-041 / FD-024: Operator Dashboard](../frontend-design/FD-024-operator-dashboard/) | NEW | Dashboard stats, revenue reports, payout T+1, withdrawal, commission |
| [DS-042 / FD-025: Operator Branding](../frontend-design/FD-025-operator-branding/) | NEW | Logo, public SEO page, verified badge, amenity badges, shareable links |
| [DS-043 / FD-026: Admin Console](../frontend-design/FD-026-admin-console/) | NEW | KYB queue, operator lifecycle, refund queue, payout settlement, audit log |
| [DS-044 / FD-027: Performance Budget](../frontend-design/FD-027-performance-budget/) | NEW | Core Web Vitals, bundle budgets, font loading, image optimization |
| [DS-045 / FD-028: Portal Architecture](../frontend-design/FD-028-portal-architecture/) | NEW | RSC vs client, self-fetch prohibition, import safety, Suspense, auth context |
| [DS-046 / FD-029: Notifications](../frontend-design/FD-029-notifications/) | NEW | Toast system, notification center, polling strategy, SMS/ZNS, Zalo OA |
| [DS-047 / FD-030: Staff Console](../frontend-design/FD-030-staff-console/) | NEW | Staff RBAC, manifest check-in, trip actions, offline resilience |

## Cross-Reference Map

### By ADR

| ADR | Design Specs |
|-----|-------------|
| ADR-005 Payment | DS-001, DS-003, DS-005, DS-006, DS-007, DS-008, DS-009, DS-010, DS-011, DS-013 |
| ADR-006 Pricing | DS-001, DS-003, DS-005, DS-006, DS-011, DS-016 |
| ADR-008 Security | DS-003, DS-005, DS-015 |
| ADR-010 Booking | DS-001, DS-003, DS-005, DS-007, DS-010, DS-016 |
| ADR-012 Background Jobs | DS-006, DS-013, DS-014, DS-015 |
| ADR-020 Deployment | DS-006, DS-017 |
| ADR-014 Compliance | DS-011, DS-012, DS-015 |
| ADR-019 State Machines | DS-001, DS-005, DS-007, DS-010, DS-014 |

### By Regulatory Driver

| Regulation | Design Specs |
|-----------|-------------|
| Decree 70/2025 (E-Invoice Transport) | DS-012 |
| Decree 117/2025 (Tax Withholding) | DS-011 |
| Law 19/2023 (Consumer Protection) | DS-007, DS-014 |
| PDPL 2025 (Data Privacy) | DS-015 |
| Decree 52/2024 (Payment Intermediary) | DS-009 |
