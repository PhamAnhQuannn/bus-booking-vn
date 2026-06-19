# Architecture Decision Records

| ADR | Status | Scope |
|-----|--------|-------|
| [ADR-001: Stack Pick](ADR-001-stack-pick/) | ACCEPTED | Framework, DB, ORM, hosting, edge vs origin, monorepo vs polyrepo |
| [ADR-002: NFR Targets](ADR-002-nfr-targets/) | ACCEPTED | Latency targets, availability SLA, concurrent users, data retention, backup RPO/RTO |
| [ADR-003: Auth Architecture](ADR-003-auth-architecture/) | ACCEPTED | OTP-based customer, operator password+OTP, JWT vs session, CSRF, refresh flow |
| [ADR-004: Multi-Tenancy Design](ADR-004-multi-tenancy/) | ACCEPTED | Operator isolation, row-level operatorId scope, middleware enforcement, data leak prevention |
| [ADR-005: Payment Architecture](ADR-005-payment-architecture/) | ACCEPTED | VNPay, MoMo, cash, webhook verification, idempotency, ledger double-entry, reconciliation |
| [ADR-006: Pricing & Currency](ADR-006-pricing-currency/) | ACCEPTED | VND integer minor-unit, BigInt fee math, no floating point money |
| [ADR-007: Observability Design](ADR-007-observability/) | ACCEPTED | Structured logging, PII redaction, error boundaries, health checks |
| [ADR-008: Security Posture](ADR-008-security-posture/) | ACCEPTED | Rate limiting, OWASP top 10, secrets management, RBAC, input validation boundaries |
| [ADR-009: Concurrency & Seat Holding](ADR-009-concurrency-seat-holding/) | ACCEPTED | Hold-then-pay, timeout release, double-booking prevention, SELECT FOR UPDATE strategy |
| [ADR-010: Booking Lifecycle](ADR-010-booking-lifecycle/) | ACCEPTED | State machine, transition invariants, side-effects, idempotency rules |
| [ADR-011: Search & Availability](ADR-011-search-availability/) | ACCEPTED | Real-time seat counts, route+date indexing, maintenance-window filtering, caching |
| [ADR-012: Background Jobs](ADR-012-background-jobs/) | ACCEPTED | Hold expiry, T+3 payouts, reminder crons, cleanup sweeps, infra choice |
| [ADR-013: Notification Architecture](ADR-013-notification-architecture/) | ACCEPTED | OTP delivery, booking confirmations, departure reminders, channel routing, retry |
| [ADR-014: E-Invoice & Compliance](ADR-014-einvoice-compliance/) | ACCEPTED | MISA e-invoice, Vietnam data residency, tax withholding |
| [ADR-015: Error Contract & API Standards](ADR-015-error-contract/) | ACCEPTED | Error response shape, HTTP status code semantics, discriminated results, thin routes, cursor pagination |
| [ADR-016: Module Boundaries](ADR-016-module-boundaries/) | ACCEPTED | Barrel files as public API, layer direction rule, client component import safety, lint enforcement |
| [ADR-017: Migration Safety](ADR-017-migration-safety/) | ACCEPTED | Forward-only migrations, two-phase destructive changes, dual index declaration, NOT NULL checklist |
| [ADR-018: Testing Strategy](ADR-018-testing-strategy/) | ACCEPTED | Test pyramid, real DB integration tests, mock hygiene, error code coverage, timezone rules |
| [ADR-019: State Machine Enforcement](ADR-019-state-machines/) | ACCEPTED | 8 state machines, LEGAL_TRANSITIONS maps, row locking, timestamp+status coupling, discriminated results |
| [ADR-020: Deployment & Infrastructure](ADR-020-deployment/) | ACCEPTED | Vercel sin1 + Docker self-hosted, env validation, stub/real mode, staged evolution |
