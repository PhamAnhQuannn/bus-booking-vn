# 00 — Project Structure

Full directory and file map of the Bus-Booking platform. Last updated: 2026-06-21.

---

## Root-Level Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, lint-staged config |
| `pnpm-lock.yaml` | Lockfile |
| `pnpm-workspace.yaml` | Workspace config |
| `tsconfig.json` | TypeScript config (ES2017 target, `@/*` path alias) |
| `next.config.ts` | Next.js 16 config (standalone output, Turbopack) |
| `next-env.d.ts` | Next.js type declarations |
| `eslint.config.mjs` | Flat ESLint config (boundaries, import-x, no-cycle) |
| `postcss.config.mjs` | PostCSS config (Tailwind v4) |
| `vitest.config.ts` | Unit test config (happy-dom, excludes `*.int.test.ts`) |
| `vitest.integration.config.ts` | Integration test config (node env, 30s timeout) |
| `vitest.setup.ts` | Unit test setup (dummy `DATABASE_URL`) |
| `vitest.integration.setup.ts` | Integration test setup (loads `.env.local`) |
| `playwright.config.ts` | E2E config (chromium + mobile, web server :3001) |
| `proxy.ts` | Edge middleware — auth guards, rate-limit, CSRF |
| `instrumentation.ts` | Next.js instrumentation hook |
| `prisma.config.ts` | Prisma client config |
| `docker-compose.dev.yml` | Dev infra: pg:5432, shadow:5434, redis:6379 |
| `docker-compose.prod.yml` | Production compose |
| `Dockerfile` | 3-stage production build (node:20-alpine) |
| `vercel.json` | Deployment: region sin1, 11 cron schedules |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |
| `.gitleaks.toml` | Secret detection config |
| `CLAUDE.md` | AI assistant instructions |
| `AGENTS.md` | Agent rules + Mistake Log |
| `README.md` | Project readme |

---

## Top-Level Directory Tree

```
D:\Bus-Booking\
├── __tests__/              3 files     Global proxy middleware tests
├── app/                    338 files   Next.js pages + API routes
│   ├── (customer)/                     Customer portal (route group)
│   ├── admin/                          Admin console
│   ├── api/                            REST API endpoints
│   ├── dev/                            Dev-only pages
│   ├── op/                             Operator console
│   ├── privacy/                        Static pages
│   ├── terms/
│   └── verify/
├── components/             69 files    React components (15 subdirs)
├── documentation/          127+ dirs   Spec library (7 series + business)
├── e2e/                    19 specs    Playwright end-to-end tests
├── issues/                 20 files    Issue specifications
├── lib/                    487 files   Business logic (42 domains)
├── node_modules/                       Dependencies
├── prisma/                             Schema + 67 migrations + seed
├── public/                 5 files     Static assets (SVGs)
├── scripts/                41 files    CLI tools, dev utils, smoke tests
└── test/                   1 file      Test stubs
```

---

## app/ — Pages & API Routes

### Customer Portal (`app/(customer)/`)

```
(customer)/                         URL: /
├── page.tsx                        /                   Landing page
├── layout.tsx                                          Customer layout
├── search/
│   └── page.tsx                    /search             Trip search results
├── routes/
│   └── page.tsx                    /routes             Browse routes
├── trips/
│   └── [id]/
│       └── page.tsx                /trips/:id          Trip detail
├── booking/
│   ├── layout.tsx                                      Booking flow layout
│   ├── customer/
│   │   └── page.tsx                /booking/customer   Contact info form
│   ├── review/
│   │   └── page.tsx                /booking/review     Review & pay
│   ├── confirmation/
│   │   └── [token]/
│   │       └── page.tsx            /booking/confirmation/:token
│   └── result/
│       └── [token]/
│           └── page.tsx            /booking/result/:token
├── auth/
│   ├── login/page.tsx              /auth/login         OTP login
│   ├── register/page.tsx           /auth/register      Sign up
│   ├── forgot-password/page.tsx    /auth/forgot-password
│   └── reset-password/page.tsx     /auth/reset-password
├── account/
│   ├── layout.tsx                                      Account layout
│   ├── bookings/
│   │   ├── page.tsx                /account/bookings   Booking history
│   │   └── [id]/page.tsx           /account/bookings/:id
│   └── settings/page.tsx           /account/settings   Profile
├── lien-he-dat-xe/
│   ├── page.tsx                    /lien-he-dat-xe     Charter form
│   └── confirmation/page.tsx       /lien-he-dat-xe/confirmation
└── charter/
    └── status/
        └── [ref]/page.tsx          /charter/status/:ref
```

### Operator Console (`app/op/`)

```
op/
├── (console)/                      Layout group (sidebar + header)
│   ├── layout.tsx                  Console shell layout
│   ├── dashboard/page.tsx          /op/dashboard
│   ├── bookings/
│   │   ├── page.tsx                /op/bookings        Booking queue
│   │   └── [id]/page.tsx           /op/bookings/:id    Booking detail
│   ├── buses/
│   │   ├── page.tsx                /op/buses           Fleet list
│   │   ├── new/page.tsx            /op/buses/new       Add bus
│   │   └── [id]/
│   │       ├── page.tsx            /op/buses/:id       Bus detail
│   │       └── maintenance/page.tsx
│   ├── routes/
│   │   ├── page.tsx                /op/routes          Route list
│   │   ├── new/page.tsx            /op/routes/new      Add route
│   │   └── [id]/
│   │       ├── page.tsx            /op/routes/:id      Route detail
│   │       └── edit/page.tsx       /op/routes/:id/edit
│   ├── trips/
│   │   ├── page.tsx                /op/trips           Trip list
│   │   ├── new/page.tsx            /op/trips/new       Schedule trip
│   │   └── [id]/page.tsx           /op/trips/:id       Trip detail + manifest
│   ├── reports/
│   │   ├── revenue/page.tsx        /op/reports/revenue
│   │   └── payouts/page.tsx        /op/reports/payouts
│   ├── staff/
│   │   ├── page.tsx                /op/staff           Staff list
│   │   └── new/page.tsx            /op/staff/new       Hire staff
│   ├── charter/page.tsx            /op/charter         Charter requests
│   ├── profile/page.tsx            /op/profile         Operator profile
│   └── settings/page.tsx           /op/settings
├── first-login/page.tsx            /op/first-login     Force password change
├── login/page.tsx                  /op/login
├── register/page.tsx               /op/register        Onboarding
├── forgot-password/page.tsx        /op/forgot-password
└── staff/
    └── (console)/                  Staff-specific console
        ├── layout.tsx
        ├── dashboard/page.tsx      /op/staff/dashboard
        ├── trips/page.tsx          /op/staff/trips
        └── scan/page.tsx           /op/staff/scan      Check-in scanner
```

### Admin Console (`app/admin/`)

```
admin/
├── login/page.tsx                  /admin/login
└── (console)/
    ├── layout.tsx                  Admin console shell
    ├── page.tsx                    /admin              Dashboard
    ├── approvals/page.tsx          /admin/approvals    Operator approvals
    ├── operators/
    │   ├── page.tsx                /admin/operators    Operator list
    │   └── [id]/page.tsx           /admin/operators/:id
    ├── users/
    │   └── [kind]/
    │       └── [id]/page.tsx       /admin/users/:kind/:id
    ├── finance/page.tsx            /admin/finance      Ledger + payouts
    ├── moderation/page.tsx         /admin/moderation   Reports + content
    ├── charter/page.tsx            /admin/charter      Charter dispatch
    └── system/page.tsx             /admin/system       Flags + admins
```

### API Routes (`app/api/`)

```
api/
├── auth/                   Customer auth (login, register, OTP, logout, refresh)
├── account/                Customer account (name, phone, password, delete)
├── bookings/               Booking initiation
│   └── initiate/
├── holds/                  Seat holds (create, detail)
│   └── [id]/
├── charter/                Charter requests (create, cancel)
│   └── [ref]/cancel/
├── trips/                  Trip search
│   └── search/
├── payments/               Payment webhooks
│   └── momo/webhook/
├── geo/                    Geographic data
├── health/                 Health check
│
├── op/                     Operator endpoints (54 routes)
│   ├── auth/               Login, logout, refresh, forgot-password
│   ├── register/           Onboarding registration
│   ├── resubmit/           KYB resubmission
│   ├── profile/            Profile management
│   ├── kyb/                KYB document upload
│   ├── buses/              Fleet CRUD + maintenance
│   │   └── [id]/
│   │       ├── deactivate/
│   │       └── maintenance/
│   │           └── [mid]/
│   ├── routes/             Route CRUD + pickup areas
│   │   └── [id]/
│   │       └── pickup-areas/
│   ├── trips/              Trip CRUD + lifecycle
│   │   └── [id]/
│   │       ├── depart/
│   │       ├── complete/
│   │       ├── cancel/
│   │       ├── paired-return/
│   │       ├── reassign-bus/
│   │       └── patch-price-lock/
│   ├── bookings/           Booking queue + check-in + no-show
│   │   └── [id]/
│   │       ├── check-in/
│   │       └── no-show/
│   ├── staff/              Staff CRUD
│   │   └── [id]/
│   ├── charter/            Charter claim/accept/decline
│   │   └── [id]/
│   ├── money/              Withdrawals + payout account
│   │   └── withdraw/
│   ├── activity/           Activity feed
│   └── scan/               QR scan endpoint
│
├── admin/                  Admin endpoints (29 routes)
│   ├── auth/               Login, logout, refresh, TOTP, step-up
│   ├── operators/          Approve, reject, suspend, reinstate, fee-override, KYB
│   │   └── [id]/
│   ├── customers/          Suspend, reinstate
│   │   └── [id]/
│   ├── finance/            Fee config, chargeback, refund, ledger adjustment, payouts
│   ├── moderation/         Reports, routes, trips (disable/enable/resolve)
│   ├── charter/            Assign, publish, reject
│   │   └── [id]/
│   └── system/             Flags, admins, audit, health
│       └── admins/
│           └── [id]/revoke/
│
├── cron/                   Scheduled jobs (11 endpoints)
│   ├── sweep-holds/
│   ├── close-sales/
│   ├── complete-trips/
│   ├── send-reminders/
│   ├── dispatch-notifications/
│   ├── generate-ticket-pdfs/
│   ├── generate-trips/
│   ├── process-payouts/
│   ├── charter-expiry/
│   ├── retention/
│   └── reconcile-payments/
│
└── dev/                    Dev-only stubs (payment, SMS, storage)
```

---

## lib/ — Business Logic Domains

42 domains, 487 source files. Dependency flow: `app/` → `lib/<domain>/` → `lib/core/`.

### Domain Inventory

| Domain | Files | Purpose |
|--------|-------|---------|
| `account` | 10 | Customer account management, anonymization, password/phone change |
| `admin` | 27 | Admin service layer: operators, moderation, audit, users, finance |
| `analytics` | 4 | Funnel tracking, admin metrics |
| `api` | 9 | HTTP client helpers, fetch wrappers |
| `audit` | 3 | Admin audit log, field redaction |
| `auth` | 27 | 3-realm auth: JWT, OTP, CSRF, sessions, TOTP, passwords, guards |
| `booking` | 26 | Holds, bookings, refs, confirmations, check-in, transitions, ticket PDF |
| `catalog` | 23 | Buses, routes, pickup areas, capacity guard, maintenance windows |
| `charter` | 10 | Charter request flows, expiry, claiming |
| `config` | 2 | Environment config wrappers |
| `core` | 30 | Platform primitives (see below) |
| `einvoice` | 4 | Vietnamese e-invoice integration |
| `flags` | 3 | Feature flags (DB-backed) |
| `format` | 2 | Date/currency formatting (VN locale) |
| `geo` | 2 | Geolocation, admin unit lookup |
| `home` | 2 | Homepage data (popular routes, stats) |
| `jobs` | 15 | Background job queue, sweepers, cron logic |
| `ledger` | 19 | Append-only financial ledger, BigInt arithmetic, payout calc, fees, CSV |
| `notification` | 5 | SMS (eSMS), email (Resend), dispatch queue |
| `observability` | 3 | Structured logging, tracing |
| `onboarding` | 10 | Operator KYB, identity verification, application flow |
| `op` | 13 | Operator-specific queries, dashboard data |
| `payment` | 6 | Payment gateway adapters: MoMo, VNPay, stub |
| `places` | 3 | Address/place lookup |
| `ratelimit` | 1 | Rate limiter factory (Redis-backed) |
| `reports` | 3 | Revenue reports, operator reports |
| `search` | 3 | Trip search/availability engine |
| `security` | 2 | Hold cookie signing, security utilities |
| `seo` | 1 | SEO utilities |
| `staff` | 9 | Operator staff management, permissions |
| `state` | 3 | Client-side Zustand stores (hold timer, search, booking) |
| `storage` | 5 | File/document storage abstraction |
| `stores` | 2 | Zustand store setup |
| `text` | 2 | Text formatting helpers |
| `ticketing` | 4 | PDF ticket generation, manifests |
| `trips` | 21 | Trip CRUD, lifecycle, paired returns, search, templates, bus overlap |
| `utils` | 2 | Shared utility functions |

### lib/core/ — Platform Primitives

```
core/
├── config/          Environment config (48 vars, typed)
├── db/              Prisma client, connection pool, tenantScope, holdRepo
├── errors/          Domain error types (tagged unions)
├── http/            HTTP response helpers
├── id/              CUID generation
├── jobs/            Job queue type definitions
├── logger/          Structured logger (45+ PII redaction paths)
├── money/           Currency arithmetic (BigInt, half-even rounding)
├── result/          Result<T,E> type helpers
├── time/            Timezone utilities (Asia/Ho_Chi_Minh)
└── validation/      Zod schemas (hold, search, phone, booking)
```

---

## components/ — React Components

69 files across 15 subdirectories. Built with React 19, @base-ui/react, Tailwind v4.

| Directory | Files | Contents |
|-----------|-------|---------|
| `ui/` | 18 | Primitives: Button, Input, Dialog, Select, Tabs, Card, Badge, Table, Calendar, DatePicker, Combobox, Checkbox, RadioGroup, Alert, Skeleton, Sparkline, Toast, Label |
| `op/` | 20 | Operator console: Nav, ConsoleHeader, DataTable, FilterBar, KpiTile, CommandPalette, ConfirmDialog, ActivityFeed, etc. |
| `home/` | 6 | Homepage: IntroBanner, FeatureHighlights, PopularTrips, RouteDirectory, TrustStrip, ContractCarRental |
| `search/` | 5 | SearchForm, SearchFormWrapper, SearchFilters, SearchStoreHydrator, BookButton |
| `booking/` | 2 | BookingSteps, BookingSummaryRail |
| `layout/` | 2 | SiteHeader, SiteFooter |
| `admin/` | 1 | AdminNav |
| `auth/` | 1 | AuthSplitLayout |
| `brand/` | 1 | Logo |
| `charter/` | 1 | CancelCharterButton |
| `contact/` | 1 | ContactBookingForm |
| `geo/` | 1 | AdminUnitPicker |
| `ticket/` | 1 | TripDetailCard |
| root | 2 | HoldTimer, HoldExpiryModal |

---

## prisma/ — Data Layer

```
prisma/
├── schema.prisma           38 models, 19 enums, relations, indices, CHECK constraints
├── seed.ts                 Dev data seeding (operators, routes, buses, trips, bookings)
└── migrations/             67 forward-only migrations (2026-05-17 → 2026-06-16)
    ├── 20260517_init
    ├── 20260518_hold_model
    ├── 20260518_booking_v1
    ├── ...                 (auth, fleet, trips, finance, notifications, etc.)
    └── 20260616_vnpay_payment_method
```

---

## e2e/ — Playwright Tests

19 spec files + helpers directory.

```
e2e/
├── auth-otp-roundtrip.spec.ts      Customer OTP login flow
├── search.spec.ts                  Trip search + filters
├── hold-flow.spec.ts               Hold creation + expiry
├── stub-payment.spec.ts            Stub gateway → booking
├── momo-booking.spec.ts            MoMo payment flow
├── account-settings.spec.ts        Profile settings
├── account-password-reset.spec.ts  Password recovery
├── data-leak-smoke.spec.ts         Tenant isolation smoke
├── op-first-login.spec.ts          Force password change
├── op-fleet.spec.ts                Bus CRUD + maintenance
├── op-routes.spec.ts               Route CRUD + pickup areas
├── op-trips.spec.ts                Trip scheduling + lifecycle
├── op-booking-queue.spec.ts        Booking queue + check-in
├── op-reports.spec.ts              Revenue + payouts
├── op-staff.spec.ts                Staff management
├── op-staff-client.spec.ts         Staff console view
├── op-profile.spec.ts              Operator profile
├── op-forgot-password.spec.ts      Password reset
├── cron-recurring.spec.ts          Recurring trip generation
└── helpers/
    └── csrf.ts                     CSRF token extraction for API calls
```

---

## scripts/ — Automation

```
scripts/
├── admin/                  Platform admin CLI (7 files)
│   ├── _client.ts          Shared Prisma client
│   ├── bootstrapSuperAdmin.ts
│   ├── createOperator.ts
│   ├── disableOperator.ts
│   ├── listOperators.ts
│   ├── resetOperatorAdminPassword.ts
│   └── resetAdminTotpBreakGlass.ts
├── seed/                   Dev data seeding (5 files)
│   ├── seed-operator.ts
│   ├── seed-admin.ts
│   ├── seed-trips-range.ts
│   ├── admin-totp-code.ts
│   └── reset-operator-password.ts
├── dev/                    Dev utilities (10 files)
│   ├── createTestCustomer.ts
│   ├── create-test-operator.ts
│   ├── resetSeedOperator.ts
│   ├── capture-console.mjs
│   ├── probe-fonts.mjs
│   └── screenshot-*.mjs   (5 screenshot scripts)
├── smoke/                  Playwright crawls (7 files)
│   ├── operator-crawl.mts
│   ├── traveler-crawl.mts
│   ├── cross-persona-crawl.mts
│   ├── route-audit.mts
│   └── hero-shot.mjs, home-full.mjs, shot-el.mjs
├── audit/
│   └── data-leak-grep.sh
├── research/
│   └── vexere-operators.mjs
└── (root-level)
    ├── crawl-online-gov.mjs
    ├── generate-business-report.py
    ├── gen-legal-report.py
    ├── rebuild-blocked-seats.sql
    ├── fresh-boot-smoke.sh
    └── safe-delete-2026-06-05.ps1
```

---

## documentation/ — Spec Library

127+ directories across 7 series plus business context.

```
documentation/
├── architecture-decisions/     ADR-001 → ADR-020  (20 specs)
├── design-specifications/      DS-001 → DS-017    (17 specs)
├── frontend-design/            FD-001 → FD-030    (30 specs)
├── feature-implementation/     FI-001 → FI-015    (15 specs)
├── scaffolding-infra/          SI-001 → SI-006    (6 specs)
├── go-live/                    GL-001 → GL-005    (5 specs)
├── hardening/                  HD-001 → HD-012    (12 specs)
├── business/
│   ├── domain-model/
│   ├── personas/
│   ├── market-research/
│   ├── competitor-benchmark/
│   └── regulatory/
├── current-status/             This documentation set (28 files)
├── guides/                     Miscellaneous guides
└── README.md                   Spec library index
```

---

## Other Directories

### `__tests__/` — Global Tests

```
__tests__/
├── proxy.admin.test.ts         Admin auth guard in proxy.ts
├── proxy.ratelimit.test.ts     Rate-limit enforcement
└── proxy.requestId.test.ts     Request-ID propagation
```

### `test/` — Test Stubs

```
test/
└── stubs/
    └── server-only.ts          Mock for 'server-only' module
```

### `public/` — Static Assets

```
public/
├── file.svg
├── globe.svg
├── next.svg
├── vercel.svg
└── window.svg
```

### `issues/` — Issue Specifications

```
issues/
├── prd.md                      Product requirements document
├── 001-bootstrap-trip-search.md
├── 002-hold-buyer-info-countdown.md
├── 003-cash-booking-confirmation.md
├── ...                         (20 issue specs total)
└── 020-platform-admin-cli.md
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Root config files | 26 |
| `app/` source files | 338 |
| `lib/` source files | 487 |
| `lib/` domains | 42 |
| `components/` files | 69 |
| Prisma models | 38 |
| Prisma enums | 19 |
| Migrations | 67 |
| API route groups | 136 |
| Customer pages | 18 |
| Operator pages | 32 |
| Admin pages | 11 |
| E2E specs | 19 |
| Unit/integration test files | ~213 |
| Scripts | 41 |
| Documentation specs | 105 |
| Issue specs | 20 |

---

## Architectural Patterns

1. **Dependency flow:** `app/` + `components/` → `lib/<domain>/` → `lib/core/` — no reverse deps, no cycles
2. **Module boundaries:** Cross-domain imports via barrel (`lib/<domain>/index.ts`) only; intra-domain deep imports OK; `lib/core/` and `lib/utils/` exempt
3. **`'use client'` rule:** Client components deep-import client-safe modules (e.g., `@/lib/auth/csrfClient`), never domain barrels
4. **API grouping:** `/api/*` (customer), `/api/op/**` (operator), `/api/admin/**` (admin), `/api/cron/**` (scheduled)
5. **3 auth realms:** Customer (JWT + OTP), Operator (JWT + password), Admin (JWT + TOTP) — isolated, no cross-realm tokens
6. **Financial integrity:** Append-only `LedgerEntry`, BigInt currency math, immutability DB triggers
7. **Multi-tenancy:** `withOperatorScope()` injects `operatorId` filter on all operator-scoped queries
