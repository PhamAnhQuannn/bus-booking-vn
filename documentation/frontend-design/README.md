# Frontend Design Specifications

UI/UX specifications for the BusBooking platform. Originally numbered DS-018–025 as part of the [Design Specifications](../design-specifications/) series; extended to DS-047 as FD-001–030.

## Specifications

### Foundation (FD-001–011)

| FD | DS | Title | Scope |
|----|-----|-------|-------|
| [FD-001](FD-001-design-system/) | DS-018 | Design System | Base-UI + Tailwind v4, OKLCH color (orange primary), Be Vietnam Pro, warm shadows, 50+ components |
| [FD-002](FD-002-navigation-pattern/) | DS-019 | Navigation Pattern | 3 portals, operator sidebar/bottom-nav, Cmd+K palette, config-driven routing |
| [FD-003](FD-003-page-inventory/) | DS-020 | Page Inventory | 24 customer + 28 operator + 11 admin pages, booking layout guard, error pages |
| [FD-004](FD-004-form-design/) | DS-021 | Form Design | value/onValueChange API, Zod validation, CSRF deep-import rule, SearchForm, Calendar |
| [FD-005](FD-005-motion-interaction/) | DS-022 | Motion & Interaction | CSS-only keyframes, scroll-driven reveal, prefers-reduced-motion, HoldTimer/HoldExpiryModal |
| [FD-006](FD-006-i18n-design/) | DS-023 | I18n Design | Vietnamese-only hardcoded, Asia/Ho_Chi_Minh (UTC+7), VND minor-unit, date-fns vi locale |
| [FD-007](FD-007-responsive-mobile/) | DS-024 | Responsive & Mobile | Mobile-first 390px+, breakpoints sm/md/lg, 44px touch targets, operator nav viewport split |
| [FD-008](FD-008-accessibility/) | DS-025 | Accessibility | ARIA usage, focus-visible ring, keyboard nav, reduced motion, color contrast, Base-UI foundation |
| [FD-009](FD-009-state-management/) | DS-026 | State Management | Zustand stores catalog, persistence strategies, hydration patterns, state boundaries |
| [FD-010](FD-010-error-loading-states/) | DS-027 | Error & Loading States | Error boundaries, loading skeletons, empty states, API error mapping, toast notifications |
| [FD-011](FD-011-data-fetching/) | DS-028 | Data Fetching | RSC vs client, self-fetch prohibition, Suspense streaming, cache strategy, auth context |

### P0 — Launch Blockers (FD-012–023)

| FD | DS | Title | Scope |
|----|-----|-------|-------|
| [FD-012](FD-012-authentication/) | DS-029 | Authentication & Account Security | 3 auth realms (customer OTP, operator password+TOTP, admin TOTP), lockout, session expiry, CSRF |
| [FD-013](FD-013-search-results/) | DS-030 | Search & Results UX | Route autocomplete, trip card anatomy, sort/filter, SEO URLs, empty state, trust signals |
| [FD-014](FD-014-hold-timer/) | DS-031 | Hold Timer & Seat Selection | 10-min countdown, expiry handling, per-phone hold cap, timer persistence |
| [FD-015](FD-015-payment-checkout/) | DS-032 | Booking Review & Payment Checkout | Guest vs auth, price transparency, PSP selection (bank transfer/cash/MoMo/VNPay), payment failure recovery |
| [FD-016](FD-016-booking-confirmation/) | DS-033 | Post-Payment & Booking Confirmation | Payment status polling, confirmation page, legal content, ticket display, e-invoice link |
| [FD-017](FD-017-booking-lifecycle/) | DS-034 | Booking Lifecycle & Status UI | 8 booking states, My Bookings tabs, status badges, per-state actions, ticket re-download |
| [FD-018](FD-018-cancellation-refund/) | DS-035 | Cancellation & Refund UX | Art. 29 compliance, fee preview, refund tracking timeline, trip-cancelled auto-refund |
| [FD-019](FD-019-consent-privacy/) | DS-036 | Consent, Privacy & PDPL Compliance | Consent banner, DSAR self-service, consent preference center, account deletion |
| [FD-020](FD-020-complaint-tracking/) | DS-037 | Complaint Submission & Tracking | Law 19/2023 complaint form, status tracking, response thread, footer compliance |
| [FD-021](FD-021-operator-onboarding/) | DS-038 | Operator Onboarding & KYB | Multi-step KYB wizard, document upload, status states, resubmission, license expiry alerts |
| [FD-022](FD-022-operator-fleet-trips/) | DS-039 | Operator Trip & Fleet Management | Bus/route/trip CRUD, trip templates, manifest, check-in/no-show, paired return |
| [FD-023](FD-023-einvoice/) | DS-040 | E-Invoice Display & Compliance | Customer invoice download, operator invoice management, Decree 70/2025 fields, MISA status |

### P1 — Launch Quality (FD-024–030)

| FD | DS | Title | Scope |
|----|-----|-------|-------|
| [FD-024](FD-024-operator-dashboard/) | DS-041 | Operator Dashboard & Revenue | Dashboard stats, revenue reports, payout T+1, withdrawal flow, commission transparency |
| [FD-025](FD-025-operator-branding/) | DS-042 | Operator Branding & Public Profile | Logo/amenities, public SEO page, verified badge, trip card branding, shareable links |
| [FD-026](FD-026-admin-console/) | DS-043 | Admin Operations Console | KYB queue, operator lifecycle, customer management, refund queue, payout settlement, audit log |
| [FD-027](FD-027-performance-budget/) | DS-044 | Performance Budget & Loading Strategy | Target devices, Core Web Vitals, bundle budgets, font loading, image optimization, streaming SSR |
| [FD-028](FD-028-portal-architecture/) | DS-045 | Portal Architecture & RSC/Client Boundaries | RSC vs client decision tree, self-fetch prohibition, import safety, Suspense placement, auth context |
| [FD-029](FD-029-notifications/) | DS-046 | Notification & Real-Time UX | Toast system, operator notification center, polling strategy, SMS/ZNS triggers, Zalo OA |
| [FD-030](FD-030-staff-console/) | DS-047 | Staff & Conductor Console | Staff RBAC, manifest check-in, trip departure/completion, offline resilience, PDF download |

## Cross-References

### To Architecture Decisions

| FD | Related ADRs |
|----|-------------|
| FD-001 Design System | ADR-001 (stack), ADR-016 (client-safe imports) |
| FD-004 Form Design | ADR-008 (CSRF, input validation), ADR-015 (error shapes) |
| FD-006 I18n | ADR-006 (VND minor-unit display) |
| FD-012 Authentication | ADR-003 (auth architecture), ADR-008 (security) |
| FD-013 Search | ADR-011 (search availability) |
| FD-014 Hold Timer | ADR-009 (concurrency/seat holding) |
| FD-015 Payment | ADR-005 (payment architecture), ADR-006 (pricing) |
| FD-017 Booking Lifecycle | ADR-010 (booking lifecycle), ADR-019 (state machines) |
| FD-018 Cancellation | ADR-010 (booking lifecycle) |
| FD-019 Consent | ADR-008 (security), ADR-014 (compliance) |
| FD-020 Complaints | ADR-014 (compliance) |
| FD-023 E-Invoice | ADR-014 (e-invoice compliance) |
| FD-028 Portal Architecture | ADR-001 (stack), ADR-016 (module boundaries) |

### To Design Specifications

| FD | Related DS |
|----|-----------|
| FD-015 Payment | DS-005 (webhook), DS-007 (refund flow) |
| FD-018 Cancellation | DS-007 (refund flow) |
| FD-019 Consent | DS-015 (DSAR privacy) |
| FD-020 Complaints | DS-014 (complaint support) |
| FD-023 E-Invoice | DS-012 (transport e-invoice) |
| FD-024 Revenue | DS-011 (tax withholding) |
| FD-032 Promotions (P2) | DS-016 (promotions & vouchers) |

### To Business Documentation

| FD | Related Business Docs |
|----|----------------------|
| FD-013 Search | Personas (customer journeys), Ubiquitous Language (route/place terms) |
| FD-015 Payment | Regulatory/payment.md, Regulatory/consumer-protection.md, Invariants (I7) |
| FD-021 Operator Onboarding | Personas (operator segments), Regulatory/transport.md |
| FD-025 Operator Branding | Competitive advantages, Operator sentiment |

## Cross-Cutting Concerns

These are not standalone specs — they are constraints referenced by all relevant FD docs.

| ID | Concern | Applies To |
|----|---------|-----------|
| CC-1 | **Vietnamese Copy Standards** — formal Quý khách, diacritics, domain glossary from ubiquitous-language.md | Every spec with UI text |
| CC-2 | **Trust & Safety Signals** — verified badge, route permit, secure payment indicator | FD-013, FD-015, FD-016, FD-025 |
| CC-3 | **Performance Budget** — JS <150KB gz/route, LCP <2.5s, CLS <0.1, INP <200ms | Every page spec (FD-027) |
| CC-4 | **VND Currency Display** — dot-separator (250.000 đ), no decimals, "Miễn phí" not "0 đ" | Every spec showing money |
| CC-5 | **Legal Footer** — business registration, MST, cancellation policy link | All customer-facing pages |
| CC-6 | **Self-Fetch Prohibition** — server components call lib functions, never own API routes | FD-028, all page specs |

## Known Gaps (P2 — Post-Launch)

| Spec | Scope |
|------|-------|
| FD-031 | Charter Request Flow |
| FD-032 | Promotions & Credits |
| FD-033 | Round-Trip Booking UX |
| FD-034 | Tet & High-Traffic UX |
| FD-035 | Analytics & Funnel Instrumentation |
| FD-036 | Admin Privacy & DSAR Management |
| FD-037 | Admin Complaint & Content Moderation |
| FD-038 | Admin Finance & Compliance Dashboard |
| — | Dark theme (deferred to Phase A) |
| — | UI testing patterns |
