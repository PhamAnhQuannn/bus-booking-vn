# 01 — Project Overview

Bus-Booking is a multi-tenant intercity bus booking platform for the Vietnam market. It serves three distinct user portals (customer, operator, admin) from a single Next.js deployment, backed by PostgreSQL, Redis, and Prisma ORM.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.6 |
| UI library | React | 19.2.4 |
| Language | TypeScript | ^5 (ES2017 target) |
| CSS | Tailwind CSS | v4 |
| ORM | Prisma | 7.8.0 |
| Database | PostgreSQL | 16 |
| Cache / rate-limit | Redis | 7 (ioredis + Upstash) |
| Package manager | pnpm | latest |
| Runtime | Node.js | 20+ |
| Testing | Vitest 4.1 + Playwright 1.60 | |
| Linting | ESLint 9 (flat config) + Prettier | |
| PDF | @react-pdf/renderer | 4.5 |
| Email | Resend | 6.12 |
| Auth tokens | jose (JWE/JWS) | 6.2 |
| Validation | Zod | 4.4 |
| State (client) | Zustand | 5.0 |
| Icons | Lucide React | 1.16 |
| Date handling | date-fns + date-fns-tz | 4.1 / 3.2 |
| Logging | Pino | 10.3 |
| UI primitives | @base-ui/react + shadcn | 1.4 / 4.7 |

## Architecture Diagram

```
                        +-----------+
                        |  proxy.ts |  (Edge middleware)
                        |  - auth   |  Layer 1: JWT guard + forced redirects
                        |  - rate   |  Layer 2: IP rate-limit (Upstash)
                        |  - csrf   |  Layer 3: double-submit CSRF
                        +-----+-----+
                              |
              +---------------+---------------+
              |               |               |
     app/(customer)/     app/op/         app/admin/
       18 pages          32 pages         11 pages
       (search,          (console,        (operators,
        booking,          fleet,           finance,
        account)          trips,           moderation,
                          reports)         system)
              |               |               |
              +-------+-------+-------+-------+
                      |               |
                  app/api/        app/api/cron/
                 136 routes        11 cron jobs
                      |
       +--------------+--------------+
       |              |              |
  lib/<domain>/  lib/<domain>/  lib/<domain>/
    auth          booking         catalog
    payment       ledger          trips
    notification  charter         ...
    (34 domains, 488 source files)
       |              |              |
       +--------------+--------------+
                      |
                 lib/core/
                   db/client (Prisma + pg adapter)
                   validation (Zod schemas)
                   logger (Pino, PII redaction)
                   config (env, feature flags)
```

## Dependency Flow

```
app/  and  components/
         |
         v  (import via barrel index.ts only)
    lib/<domain>/
         |
         v  (deep imports allowed)
      lib/core/   and   lib/utils/
```

**Rules enforced by ESLint (eslint-plugin-boundaries + eslint-plugin-import-x):**

1. `app/` and `components/` may import `lib/<domain>/` through barrel files (`index.ts`) only
2. `lib/<domain>/` must not import `app/` or `components/`
3. `lib/core/` must not import any `lib/<domain>/`
4. No import cycles (`import-x/no-cycle` at error level)
5. Intra-domain deep imports are allowed (within the same `lib/<domain>/`)
6. `lib/core/` and `lib/utils/` are exempt from barrel-only rule
7. `'use client'` files must deep-import client-safe modules (e.g., `@/lib/auth/csrfClient`, not `@/lib/auth`) to avoid pulling server-only transitives into the browser bundle

**Barrel exceptions for client components:** `csrfClient`, `safeReturnTo`, `consent`, `pickupSelection`, `statusLabels`, `formatRelativeVi` — these are pure/browser-safe modules that client components may deep-import directly.

## Three-Portal Structure

### Customer Portal — `app/(customer)/`

The public-facing booking experience. 18 pages covering:

- **Search and browse:** Trip search with filters, route directory, trip details
- **Booking flow:** Hold creation, customer info, payment review, confirmation
- **Account:** Registration (phone OTP), login, settings, booking history
- **Charter:** Group/charter booking requests with status tracking
- **Auth:** OTP-based login/register, password reset

### Operator Portal — `app/op/`

Multi-tenant operator console. 32 pages covering:

- **Auth:** Username/password login, first-login password change, forgot password
- **Fleet:** Bus CRUD, maintenance windows, capacity management
- **Routes:** Route CRUD, pickup area management
- **Trips:** Trip creation (single + paired return), lifecycle (depart/complete/cancel), templates
- **Bookings:** Booking queue, check-in, no-show marking, manifest view
- **Finance:** Revenue reports, payout account setup, withdrawal requests
- **Staff:** Staff user provisioning (admin/staff roles), service assignment
- **KYB:** Know-Your-Business document upload and verification status
- **Charter:** Claim/accept/decline charter requests from customers

### Admin Portal — `app/admin/`

Platform administration. 11 pages covering:

- **Operators:** Approval workflow (pending/under-review/approved/rejected/suspended), KYB document review, fee overrides
- **Customers:** Suspend/reinstate accounts
- **Finance:** Global fee configuration, ledger adjustments, payout approvals, chargebacks, refunds
- **Moderation:** Content reports, route/trip enable/disable
- **Charter:** Publish/reject/assign charter requests
- **System:** Feature flags, admin user management (RBAC: SUPER_ADMIN, FINANCE, SUPPORT), TOTP reset

## Auth Realm Summary

| Aspect | Customer | Operator | Admin |
|--------|----------|----------|-------|
| Login credential | Phone + OTP | Generated username + password | Username + password |
| 2FA | OTP per login (email/SMS) | OTP on password reset only | TOTP mandatory (RFC 6238) |
| JWT secret | `JWT_SECRET` | `JWT_OPERATOR_SECRET` | `JWT_ADMIN_SECRET` |
| Access token TTL | 900s (15 min) | 900s (15 min) | 600s (10 min) |
| JWT scope claim | `customer` | `operator` | `admin` |
| Role claim | (none) | `admin` or `staff` | `SUPER_ADMIN`, `FINANCE`, `SUPPORT` |
| Extra claims | -- | `operatorId`, `requiresPasswordChange` | `totpVerified` |
| Access cookie | `bb_access` | `bb_op_access` | `bb_admin_access` |
| Refresh cookie | `bb_refresh` | `bb_op_refresh` | `bb_admin_refresh` |
| Step-up re-auth | -- | -- | 5-min `admin_stepup` token |
| Middleware guard | -- | JWT decode + forced redirect | JWT decode + TOTP check |
| CSRF | Double-submit (`bb_csrf`) | Double-submit (`bb_csrf`) | Double-submit (`bb_csrf`) |

All three realms use HS256 JWTs via the `jose` library. Tokens are issued as HttpOnly cookies (except the CSRF token which is non-HttpOnly for JavaScript access). Cross-realm token reuse is blocked by the `scope` claim check in each guard.

## Booking Lifecycle

```
Search           Hold              Payment           Booking            Ticket
 trips    --->   create     --->   initiate    --->   confirmed   --->   PDF
                 (10 min           (momo |             + ledger          generated
                  expiry)           zalopay |          entries           by cron
                                    card)
                    |                  |                  |
                    v                  v                  v
                 expired           failed/           cancelled
                 (cron              expired            (refund
                  sweep)           (webhook)           flow)
```

1. **Search:** `GET /api/trips/search` — filters by origin, destination, date, passengers; excludes departed/cancelled/sales-closed trips; checks bus maintenance windows
2. **Hold:** `POST /api/holds` — reserves seats (capacity guard via `SELECT ... FOR UPDATE`); 10-minute TTL; cron sweep expires stale holds
3. **Payment:** `POST /api/bookings/initiate` — creates booking + initiates PSP payment (MoMo, VNPay, ZaloPay, card); idempotent; compensates on gateway failure
4. **Webhook:** `POST /api/payments/{provider}/webhook` — HMAC-verified callback; transitions booking to `paid` or `payment_failed`; creates ledger entries
5. **Confirmation:** Booking confirmed with unique ref (`BB-YYYY-xxxx-xxxx`); consent record stored; notification dispatched
6. **Ticket:** Cron job generates PDF tickets via `@react-pdf/renderer`; downloadable from booking detail
7. **Lifecycle:** Operator marks depart (blocks further bookings) then complete (triggers T+3 payout scheduling); cancel triggers refund flow

## Dev Setup

```bash
# 1. Infrastructure (PostgreSQL 16 + Redis 7)
docker compose -f docker-compose.dev.yml up -d

# 2. Environment
cp .env.example .env.local

# 3. Database
pnpm prisma migrate deploy
pnpm prisma db seed

# 4. Dev server (port 3001 — port 3000 is occupied)
pnpm dev
```

## Key Commands

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` (port 3001) |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Type-check | `pnpm tsc --noEmit` |
| Unit tests | `pnpm test` |
| Integration tests | `pnpm vitest:int` |
| All tests | `pnpm test:all` |
| E2E (Playwright) | `pnpm test:e2e` |
| Single unit test | `pnpm vitest run path/to/file.test.ts` |
| Single integration test | `pnpm vitest run --config vitest.integration.config.ts path/to/file.int.test.ts` |
| Seed trips | `pnpm seed:trips` |
| Seed operator | `pnpm seed:operator` |
| Seed admin | `pnpm seed:admin` |
| Bootstrap super admin | `pnpm admin:bootstrap-super-admin` |

Pre-commit hook runs `pnpm lint && pnpm tsc --noEmit` via Husky + lint-staged.

## Documentation Map

The `documentation/` directory contains 7 spec series plus business context:

| Prefix | Folder | Count | Coverage |
|--------|--------|-------|----------|
| ADR | `architecture-decisions/` | 20 | Stack, auth, payments, deployment decisions |
| DS | `design-specifications/` | 17 | Data model, APIs, payment flows, compliance |
| FD | `frontend-design/` | 30 | UI/UX specs per persona (customer, operator, admin) |
| FI | `feature-implementation/` | 15 | Per-feature synthesis linking ADR, DS, FD to code |
| SI | `scaffolding-infra/` | 6 | Toolchain, CI/CD, testing, deployment |
| GL | `go-live/` | 5 | Production readiness gates |
| HD | `hardening/` | 12 | Security, performance, compliance audits |
| -- | `business/` | -- | Market research, personas, domain model, regulatory |

Specs cross-reference each other by prefix ID (e.g., ADR-001, DS-006, FI-003).
