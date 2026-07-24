# 27 — Documentation Spec Index

Map of all existing spec documents in `documentation/`. Cross-references use prefix IDs (e.g., ADR-001, DS-006, FI-003).

---

## Series Overview

| Prefix | Directory | Count | Scope |
|--------|-----------|-------|-------|
| ADR | `architecture-decisions/` | 20 | Stack, auth, payments, deployment decisions |
| DS | `design-specifications/` | 17 | Data model, APIs, payment flows, compliance |
| FD | `frontend-design/` | 30 | UI/UX specs for customer, operator, admin |
| FI | `feature-implementation/` | 15 | Per-feature synthesis (links ADR→DS→FD→code) |
| SI | `scaffolding-infra/` | 6 | Toolchain, CI/CD, testing, deployment |
| GL | `go-live/` | 5 | Production readiness gates |
| HD | `hardening/` | 12 | Security, perf, compliance pre-release audits |
| — | `business/` | 2+ | Market research, regulatory context |

---

## ADR — Architecture Decisions (20)

| ID | Directory | Title |
|----|-----------|-------|
| ADR-001 | `ADR-001-stack-pick` | Stack Selection |
| ADR-002 | `ADR-002-nfr-targets` | Non-Functional Requirements |
| ADR-003 | `ADR-003-auth-architecture` | Authentication Architecture |
| ADR-004 | `ADR-004-multi-tenancy` | Multi-Tenancy Model |
| ADR-005 | `ADR-005-payment-architecture` | Payment Architecture |
| ADR-006 | `ADR-006-pricing-currency` | Pricing & Currency Handling |
| ADR-007 | `ADR-007-observability` | Observability Strategy |
| ADR-008 | `ADR-008-security-posture` | Security Posture |
| ADR-009 | `ADR-009-concurrency-seat-holding` | Concurrency & Seat Holding |
| ADR-010 | `ADR-010-booking-lifecycle` | Booking Lifecycle |
| ADR-011 | `ADR-011-search-availability` | Search & Availability |
| ADR-012 | `ADR-012-background-jobs` | Background Jobs |
| ADR-013 | `ADR-013-notification-architecture` | Notification Architecture |
| ADR-014 | `ADR-014-einvoice-compliance` | E-Invoice Compliance |
| ADR-015 | `ADR-015-error-contract` | Error Contract |
| ADR-016 | `ADR-016-module-boundaries` | Module Boundaries |
| ADR-017 | `ADR-017-migration-safety` | Migration Safety |
| ADR-018 | `ADR-018-testing-strategy` | Testing Strategy |
| ADR-019 | `ADR-019-state-machines` | State Machines |
| ADR-020 | `ADR-020-deployment` | Deployment |

---

## DS — Design Specifications (17)

| ID | Directory | Title |
|----|-----------|-------|
| DS-001 | `DS-001-data-model` | Data Model |
| DS-002 | `DS-002-migration-strategy` | Migration Strategy |
| DS-003 | `DS-003-api-contract` | API Contract |
| DS-004 | `DS-004-api-versioning` | API Versioning |
| DS-005 | `DS-005-webhook-design` | Webhook Design |
| DS-006 | `DS-006-background-jobs` | Background Jobs |
| DS-007 | `DS-007-refund-flow` | Refund Flow |
| DS-008 | `DS-008-zalopay-adapter` | ZaloPay Adapter |
| DS-009 | `DS-009-split-settlement` | Split Settlement |
| DS-010 | `DS-010-chargeback-design` | Chargeback Design |
| DS-011 | `DS-011-tax-withholding` | Tax Withholding |
| DS-012 | `DS-012-transport-einvoice` | Transport E-Invoice |
| DS-013 | `DS-013-vietqr-reconciliation` | VietQR Reconciliation |
| DS-014 | `DS-014-complaint-support` | Complaint Support |
| DS-015 | `DS-015-dsar-privacy` | DSAR Privacy |
| DS-016 | `DS-016-promotions-vouchers` | Promotions & Vouchers |
| DS-017 | `DS-017-deployment-portability` | Deployment Portability |

---

## FD — Frontend Design (30)

| ID | Directory | Title |
|----|-----------|-------|
| FD-001 | `FD-001-design-system` | Design System |
| FD-002 | `FD-002-navigation-pattern` | Navigation Pattern |
| FD-003 | `FD-003-page-inventory` | Page Inventory |
| FD-004 | `FD-004-form-design` | Form Design |
| FD-005 | `FD-005-motion-interaction` | Motion & Interaction |
| FD-006 | `FD-006-i18n-design` | i18n Design |
| FD-007 | `FD-007-responsive-mobile` | Responsive Mobile |
| FD-008 | `FD-008-accessibility` | Accessibility |
| FD-009 | `FD-009-state-management` | State Management |
| FD-010 | `FD-010-error-loading-states` | Error & Loading States |
| FD-011 | `FD-011-data-fetching` | Data Fetching |
| FD-012 | `FD-012-authentication` | Authentication UX |
| FD-013 | `FD-013-search-results` | Search Results |
| FD-014 | `FD-014-hold-timer` | Hold Timer |
| FD-015 | `FD-015-payment-checkout` | Payment Checkout |
| FD-016 | `FD-016-booking-confirmation` | Booking Confirmation |
| FD-017 | `FD-017-booking-lifecycle` | Booking Lifecycle |
| FD-018 | `FD-018-cancellation-refund` | Cancellation & Refund |
| FD-019 | `FD-019-consent-privacy` | Consent & Privacy |
| FD-020 | `FD-020-complaint-tracking` | Complaint Tracking |
| FD-021 | `FD-021-operator-onboarding` | Operator Onboarding |
| FD-022 | `FD-022-operator-fleet-trips` | Operator Fleet & Trips |
| FD-023 | `FD-023-einvoice` | E-Invoice |
| FD-024 | `FD-024-operator-dashboard` | Operator Dashboard |
| FD-025 | `FD-025-operator-branding` | Operator Branding |
| FD-026 | `FD-026-admin-console` | Admin Console |
| FD-027 | `FD-027-performance-budget` | Performance Budget |
| FD-028 | `FD-028-portal-architecture` | Portal Architecture |
| FD-029 | `FD-029-notifications` | Notifications |
| FD-030 | `FD-030-staff-console` | Staff Console |

---

## FI — Feature Implementation (15)

| ID | Directory | Title |
|----|-----------|-------|
| FI-001 | `FI-001-core-auth` | Core Authentication |
| FI-002 | `FI-002-operator-onboarding` | Operator Onboarding |
| FI-003 | `FI-003-fleet-management` | Fleet Management |
| FI-004 | `FI-004-route-management` | Route Management |
| FI-005 | `FI-005-trip-management` | Trip Management |
| FI-006 | `FI-006-search-discovery` | Search & Discovery |
| FI-007 | `FI-007-booking-flow` | Booking Flow |
| FI-008 | `FI-008-payment-integration` | Payment Integration |
| FI-009 | `FI-009-operator-console` | Operator Console |
| FI-010 | `FI-010-payout-system` | Payout System |
| FI-011 | `FI-011-staff-management` | Staff Management |
| FI-012 | `FI-012-admin-console` | Admin Console |
| FI-013 | `FI-013-customer-account` | Customer Account |
| FI-014 | `FI-014-notifications` | Notifications |
| FI-015 | `FI-015-e-invoice` | E-Invoice |

---

## SI — Scaffolding & Infrastructure (6)

| ID | Directory | Title |
|----|-----------|-------|
| SI-001 | `SI-001-project-scaffold` | Project Scaffold |
| SI-002 | `SI-002-dev-environment` | Dev Environment |
| SI-003 | `SI-003-ci-cd-pipeline` | CI/CD Pipeline |
| SI-004 | `SI-004-linting-formatting` | Linting & Formatting |
| SI-005 | `SI-005-testing-strategy` | Testing Strategy |
| SI-006 | `SI-006-deployment-config` | Deployment Config |

---

## GL — Go-Live Gates (5)

| ID | Directory | Title |
|----|-----------|-------|
| GL-001 | `GL-001-launch-checklist` | Launch Checklist |
| GL-002 | `GL-002-monitoring-setup` | Monitoring Setup |
| GL-003 | `GL-003-backup-dr` | Backup & Disaster Recovery |
| GL-004 | `GL-004-rollback-plan` | Rollback Plan |
| GL-005 | `GL-005-smoke-test-suite` | Smoke Test Suite |

---

## HD — Hardening Audits (12)

| ID | Directory | Title |
|----|-----------|-------|
| HD-001 | `HD-001-security-review` | Security Review |
| HD-002 | `HD-002-performance-audit` | Performance Audit |
| HD-003 | `HD-003-error-handling-audit` | Error Handling Audit |
| HD-004 | `HD-004-barrel-import-hygiene` | Barrel Import Hygiene |
| HD-005 | `HD-005-tenant-isolation-audit` | Tenant Isolation Audit |
| HD-006 | `HD-006-payment-webhook-security` | Payment Webhook Security |
| HD-007 | `HD-007-regulatory-compliance` | Regulatory Compliance |
| HD-008 | `HD-008-notification-channel` | Notification Channel |
| HD-009 | `HD-009-financial-integrity` | Financial Integrity |
| HD-010 | `HD-010-infrastructure-security` | Infrastructure Security |
| HD-011 | `HD-011-cron-resilience` | Cron Resilience |
| HD-012 | `HD-012-auth-attack-surface` | Auth Attack Surface |

---

## Business Context

| Directory | Title |
|-----------|-------|
| `business/market-research` | Market Research & Competitive Analysis |
| `business/regulatory` | Vietnam Regulatory Requirements (data privacy, payment regs, transport, tax, e-invoice, labor) |

---

## Cross-Reference Pattern

Specs reference each other by prefix ID:
- `ADR-009` (Concurrency) → referenced by `DS-001` (Data Model) and `FI-007` (Booking Flow)
- `DS-005` (Webhook Design) → referenced by `FI-008` (Payment Integration)
- `FD-014` (Hold Timer) → references `ADR-009` and `FI-007`

Each spec directory contains a `README.md` as primary document, some with supplementary files.
