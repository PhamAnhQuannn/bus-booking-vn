# SI-001: Project Scaffold -- Stack, Structure, and Foundational Patterns

> Status: DOCUMENTED | References: ADR-001, ADR-003, ADR-004, ADR-008, ADR-016, ADR-019, ADR-020

## Purpose

This document consolidates the foundational architectural decisions for the BenXe bus-booking platform into a single navigable reference. It is intended for new contributors who need to understand how the monorepo is structured, why the stack was chosen, how tenant isolation is enforced, and what patterns govern stateful operations. It does not duplicate the source ADRs but synthesises their decisions, cross-references them by decision ID, and surfaces the relationships between them that are otherwise scattered across four separate documents.

---

## 0. Toolchain Baseline

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required by Next.js App Router |
| pnpm | 9.x | Workspace root; `corepack enable` activates the pinned version |
| Docker / Docker Compose | 24+ | PostgreSQL + Redis dev containers; production image build |
| PostgreSQL | 16 | Neon serverless (prod); FPT Cloud managed (backup); Docker (dev) |
| Redis | 7 | Upstash serverless (prod); FPT Cloud managed (backup); Docker (dev) |

**Dev server port**: `3001` (not 3000 -- port 3000 is occupied by another application in the standard dev setup). All references to `localhost:3000` in this documentation suite are legacy and should read `localhost:3001` for local development.

**Environment validation**: the application validates all required environment variables at boot via Zod schemas with `superRefine` guards for credential minimum-length enforcement. Missing or malformed variables cause an immediate startup crash with a descriptive error -- there is no silent-fallback mode. See SI-002 for the full `.env.local` template and variable catalog.

**PgBouncer dual-URL pattern**: production uses PgBouncer (transaction mode, port 6432) for connection pooling. Two database URLs are configured: `DATABASE_URL` (pooled, port 6432) for application queries and `DIRECT_URL` (non-pooled, port 5432) for Prisma migrations. See SI-002 §4 and SI-006 §3 for details.

---

## 1. Stack Overview

BenXe is a Next.js (App Router) monolith backed by PostgreSQL, accessed through Prisma, cached with Redis, and managed via pnpm.

| Layer | Technology | Decision reference |
|---|---|---|
| Framework | Next.js (App Router) | ADR-001 D1 |
| Database | PostgreSQL (provider-agnostic) | ADR-001 D2 |
| ORM | Prisma (`$transaction` callback form) | ADR-001 D3 |
| Cache / rate-limit | Redis (`memory` / `ioredis` / `upstash` provider tripartite) | ADR-020 D8 |
| Package manager | pnpm (workspace root) | ADR-001 D6 |
| Edge gate | `jose` JWT + CSRF double-submit | ADR-003, ADR-008 |
| Static assets / CDN | Vercel Edge Network + Cloudflare (DNS/WAF) | ADR-001 D4 |

**Why Next.js App Router.** Server-side rendering is required to appear in Google search results -- the platform competes directly with VeXeRe's strong organic presence (ADR-001 D1). React Server Components (RSC) enforce two financial invariants: I7 (no client-originated price, because price derivation stays server-side) and I9 (no raw phone in payloads). The `after()` API enables post-commit side effects such as notification fan-out and overpay-refund scheduling without blocking the HTTP response (ADR-001 D1).

**Why PostgreSQL.** The append-only ledger, `SELECT FOR UPDATE` serialization, `BEFORE UPDATE/DELETE` immutability triggers, and eight state-machine ACID requirements all demand row-level locking across multi-table transactions. MongoDB cannot enforce ledger immutability; CockroachDB and PlanetScale (MySQL) lack adequate Vietnam hosting options. PostgreSQL is provider-agnostic -- the same schema runs on FPT Cloud managed PG, bare-metal Viettel IDC, or any standard PG 14+ instance without application changes (ADR-001 D2).

**Why Prisma.** `prisma/schema.prisma` is the single source of truth for the domain model. The `$transaction(async (tx) => { ... })` callback form (not the array form) enables a `tx.$queryRaw\`SELECT ... FOR UPDATE\`` escape hatch inside the same transaction handle -- critical for seat-hold concurrency and payout computations. Typed DTO mapping (`toTripDto.ts`, `toBookingDto.ts`) ensures the select whitelist matches exactly the UI contract fields with zero runtime guessing (ADR-001 D3).

**All monetary values are VND integers.** Ledger balances, platform fees, and payout amounts are stored as integer minor-unit values. Any multiplication by a fractional rate (e.g., the platform fee percentage) must be performed in the BigInt domain -- native Number multiplication produces representation drift before the 2^53 ceiling is reached and can flip half-even rounding to the wrong side. The `calcPayout` module encodes `platformFeePct` as `BigInt(Math.round(pct * 10^10))` and detects exact ties via `remainder * BigInt(2) === denominator` (ADR-001 D2 context; Mistake Log 2026-05-19 Issue 016).

---

## 2. Hosting Summary

Vercel Pro sin1 (Singapore) is the primary production host. FPT Cloud (Vietnam) is retained as a Docker self-hosted backup for data-residency-constrained scenarios. This pivot (2026-06-21) accepts CDTIA filing in exchange for ~$200-400/mo cost savings and zero-ops deployment (ADR-001 D4, ADR-020 D2/D11).

| Layer | Primary (Vercel stack) | Backup (FPT Cloud) |
|---|---|---|
| Compute | Vercel Pro sin1 ($20/mo) | FPT Cloud Server + Docker Compose |
| PostgreSQL | Neon Launch ap-southeast-1 ($19/mo) | FPT Managed PG |
| Redis | Upstash PAYG ap-southeast-1 ($0-2/mo) | FPT Managed Redis |
| Object Storage | Cloudflare R2 ($0-5/mo) | FPT Object Storage (MinIO) |
| Cron | Vercel Cron (vercel.json) | Supercronic sidecar |
| **Total** | **~$55-70/mo** | **~$340-520/mo** |

The deployment contract is provider-agnostic Docker: the application is a Docker image that accepts `DATABASE_URL`, `REDIS_URL`, and S3-compatible env vars. Migrating between providers is a DNS + connection-string change, estimated at 2-4 hours (ADR-020 D8; see SI-006 for full deployment architecture).

---

## 3. Monorepo Structure -- Single Next.js App with Route Groups

### 3.1 One App, Three Portals (ADR-001 D6)

The platform serves three user populations through one deployment:

```
app/
  (customer)/          <- customer-facing search, booking, OTP login
  op/                  <- operator console (fleet, trips, routes, reports)
  admin/               <- platform admin (operator moderation, payout queue, revenue)
  api/
    (customer)/        <- customer API routes
    op/                <- operator-scoped API routes (authz: operator JWT)
    admin/             <- admin-scoped API routes (authz: admin JWT + TOTP)
    payments/          <- PSP webhook handlers (VNPay, MoMo)
    cron/              <- cron-triggered sweepers
```

Route groups provide URL namespace separation (`/op/`, `/admin/`) and per-portal layout nesting without creating separate deployments or build pipelines.

### 3.2 Why Not Polyrepo or Turborepo Multi-Package

The bounded contexts (DS-001 enumerates 12+) share one PostgreSQL schema. A booking creation touches Payment, Fleet, and Notification in a single `$transaction` -- splitting these across services would require distributed transaction coordination (two-phase commit or saga orchestration) for what is today a one-line Prisma call (ADR-001 D6).

Pre-launch through month 12, a small team cannot absorb 3x CI/CD overhead, cross-service API contracts, and schema synchronisation. The Series A gate ($500K-2M GMV/month) requires maximising shipping velocity. The monorepo is the correct choice for this stage; the module boundary architecture (Section 4 below) ensures domains remain independently extractable when a polyrepo split becomes warranted (ADR-001 D6; ADR-016 D1).

---

## 4. Module Architecture -- Layered Domains with Barrel Public APIs

### 4.1 Four-Layer Import Direction (ADR-016 D2)

```
Experience Layer     app/
                      | imports from
Domain Layer         lib/<domain>/        (booking, payment, fleet, auth, ...)
                      | imports from
Core Layer           lib/core/  lib/utils/
                      | imports from
Infrastructure       PostgreSQL, Redis, S3, PSP adapters
```

Each layer imports only downward. Cross-domain imports are lateral (domain to domain) and are permitted only through the target domain's barrel. No layer may import upward.

### 4.2 Barrel Files as Public API (ADR-016 D1)

Each domain module exposes exactly one public API surface: `lib/<domain>/index.ts`. All cross-domain consumers import only from this barrel -- never from internal files within the domain.

```
lib/booking/index.ts                  <- public barrel (only file cross-domain consumers touch)
lib/booking/initiateOnlineBooking.ts  <- internal implementation
lib/booking/bookingRepo.ts            <- internal repository
lib/booking/__tests__/                <- internal test helpers
```

When an internal file is renamed, refactored, or split, no cross-domain consumer breaks -- they import the stable barrel. This is the prerequisite for future service extraction: the barrel IS the service interface (ADR-016 D1).

### 4.3 Cross-Domain Through Barrel, Intra-Domain Deep (ADR-016 D4)

| Import pattern | Allowed |
|---|---|
| `lib/booking/` imports from `lib/payment/` via barrel | Yes |
| `lib/booking/` deep-imports `lib/payment/processWebhook.ts` | No -- cross-domain must use barrel |
| `lib/booking/transitions.ts` imports `lib/booking/bookingRepo.ts` | Yes -- intra-domain deep import |
| `app/api/holds/route.ts` imports from `lib/booking/` barrel | Yes -- Experience to Domain barrel |

### 4.4 Client Components Must Deep-Import Client-Safe Modules (ADR-016 D3)

`'use client'` components must NOT import from domain barrels. Domain barrels re-export server-only siblings that transitively import `pg`, `prisma`, `server-only`, and `next/server`. Webpack/Turbopack cannot tree-shake these away from client bundles.

| Import | Safe |
|---|---|
| `import { readCsrfToken } from '@/lib/auth/csrfClient'` | Yes -- client-safe deep import |
| `import { readCsrfToken } from '@/lib/auth'` | No -- barrel pulls server-only graph into client bundle, causing 500 on every route |

This distinction caused a production-class incident where the entire operator portal returned 500 because `OperatorNav.tsx` (a `'use client'` layout component) imported from the `@/lib/auth` barrel (Mistake Log 2026-06-04 operator-smoke). See SI-004 Section 3 for the CI guard and codemod safety rules.

### 4.5 Exempt Modules (ADR-016 D5)

- `lib/core/` and `lib/utils/` -- shared primitives; imported by all layers with no barrel enforcement.
- `__tests__/` files -- may deep-import domain internals for unit testing.
- `app/dev/**` -- development tooling is boundary-exempt.

Some internal symbols (`_resetEnvCache`, `STUB_BLOBS`) intentionally remain deep-importable for test setup and dev tooling. These are the only legitimate exceptions to the barrel rule.

### 4.6 Lint Enforcement (ADR-016 D6)

| Tool | Rule | Mode |
|---|---|---|
| `eslint-plugin-boundaries` | `entry-point` -- cross-domain imports must use barrel | Error (not warning) |
| `eslint-plugin-import-x` | `import/no-cycle` -- no circular dependency chains | Error |

Both rules run in `pnpm lint` and are gated by CI and the pre-commit hook. See SI-004 for full linting details.

---

## 5. Multi-Tenancy Model -- Shared DB + Application-Level Scope

### 5.1 Three Auth Realms, Never Mixed (ADR-004 D7)

The platform has three completely separate authentication realms. They share cross-cutting infrastructure (`jwt.ts`, `password.ts`, `csrf.ts`, `refreshToken.ts`) but have distinct user models, session models, OTP models, auth services, and guard middleware.

| Realm | Login method | Session characteristics | Route prefix |
|---|---|---|---|
| Customer | Phone OTP | Long-lived (convenience); no tenant claim | `app/(customer)/` |
| Operator | Username + password | Short-lived (15 min); carries `operatorId` + `requiresPasswordChange` JWT claims | `app/op/` |
| Admin | Password + TOTP step-up | Elevated; finance actions require step-up re-auth | `app/admin/` |

The operator username format is `BRAND_ACRONYM-last4phone` (e.g., `FUTA-3456`). Operator and Customer are entirely distinct identity models -- an OperatorUser is not a Customer (ADR-004 D7).

### 5.2 Tenant Data Isolation -- `withOperatorScope` Guard (ADR-004 D6)

All data is stored in a single PostgreSQL database. Every operator-scoped model carries an `operatorId` foreign key. The `withOperatorScope(tx, operatorId)` function in `lib/core/db/tenantScope.ts` appends `WHERE operatorId = $operatorId` to every operator-side query.

The operator's JWT `operatorId` claim is the tenant identity that flows from the Edge auth gate through the route handler and down into `withOperatorScope`. The `operatorId` is NEVER accepted from the request body on operator-side routes -- it comes exclusively from the verified JWT (ADR-004 D6). `eslint-plugin-boundaries` enforces that operator-scoped service modules always receive `operatorId` from the auth guard.

**Isolation trade-off**: the isolation boundary is application-enforced, not database-enforced. A `withOperatorScope` bypass would expose cross-tenant data. This risk is mitigated by lint rules that prevent the bypass pattern from compiling cleanly (ADR-004 Negative Consequences).

### 5.3 Why Shared DB (ADR-004 D6)

Cross-tenant reads are a core product requirement, not an edge case:
- Customer search queries ALL operators' trips simultaneously.
- The `Place` registry is a global canonical table shared across all tenants.
- Admin reporting requires cross-operator aggregation (payout queue, ledger view, revenue reports).
- 60-70% of operators are micro-sized (1-5 buses) -- database-per-tenant would be wildly over-provisioned for the long tail.

### 5.4 `requiresPasswordChange` as JWT Claim (ADR-008 context; Mistake Log Issue 010)

The `requiresPasswordChange` flag is encoded inside the operator access JWT rather than requiring a per-request database lookup. Edge middleware reads this claim via `jose.jwtVerify` (no DB, no Prisma, Edge-safe) and redirects to `/op/first-login` when true. The allowlist of paths that bypass this redirect is an exact-match `Set` -- not a `startsWith` prefix -- to prevent bypass paths like `/op/first-login-bypass`. When the password-change route succeeds, it mints a fresh JWT with `requiresPasswordChange: false` in the same database transaction as the row update.

### 5.5 Marketplace Model and SBV License Avoidance (ADR-004 D1, D2)

The platform is classified as a technology/e-commerce intermediary (ADR-004 D11) -- it connects buyers (customers) and sellers (operators) but does not own or operate buses. This classification:
- Eliminates the SBV payment intermediary licence requirement (VND 50B capital) -- the platform never holds operator funds (ADR-004 D1).
- Preserves 100% foreign ownership eligibility under WTO technology-sector commitments (ADR-004 D11).
- Enables platform-issued e-invoices under Decree 123/2020 and Decree 70/2025 on behalf of operators -- platform integrates MISA once for all operators, which is a concrete operator acquisition lever for the 60-70% who have not implemented e-invoicing (ADR-004 D8).

> **Critical gap**: The documented payment model is PSP split-settlement (each operator opens their own VNPay/MoMo merchant account; payment splits at source). The actual implementation uses central collection via a single platform merchant account with software-ledger tracking. This matches the "Central collection then remit" pattern which ADR-004 D2 itself labels as likely requiring an SBV IPS licence. This is the highest-severity open gap and must be resolved before Issue 094 go-live. See ADR-004 D2 Implementation Status.

---

## 6. Key Architectural Patterns

### 6.1 Eight Canonical State Machines (ADR-019 D1)

Eight entities have formal state machines that govern all legal transitions, side effects, and visibility rules:

| Entity | Key states | Terminal states |
|---|---|---|
| **Trip** | `scheduled -> departed -> completed`; `scheduled -> cancelled` | `completed`, `cancelled` |
| **Booking** | `awaiting_payment -> paid -> completed`; paths to `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded` | All except `awaiting_payment`, `paid` |
| **Hold** | `active -> consumed / expired / cancelled_trip` | `consumed`, `expired`, `cancelled_trip` |
| **Payout** | `requested -> processing -> paid`; `processing -> failed -> requested` (retry) | `paid` |
| **Operator** | `PENDING_REVIEW -> UNDER_REVIEW -> APPROVED / REJECTED`; `APPROVED <-> SUSPENDED` | None (lifecycle) |
| **OTP** | Implicit: active -> consumed / expired / lockout-sentinel | `consumed`, `expired` |
| **EInvoice** | `pending -> issued -> sent`; `-> failed`; `-> cancelled` | `sent`, `failed`, `cancelled` |
| **CharterRequest** | `SUBMITTED -> ADMIN_REVIEW -> ASSIGNED_DIRECT / PUBLISHED -> ACCEPTED -> COMPLETED` | `COMPLETED`, `CANCELLED`, `REJECTED` |

Canonical transition tables, guards, and side-effect details are in `documentation/business/domain-model/state-machines.md`. When transition tables or enum values in this document diverge from DS-001 (Data Model), DS-001 is authoritative (ADR-019 preamble).

### 6.2 `LEGAL_*_TRANSITIONS` Maps (ADR-019 D2)

Each state machine has a `LEGAL_<ENTITY>_TRANSITIONS` constant that enumerates all valid `(fromStatus, toStatus)` pairs. No code may write a new status without checking the current status against this map. The map is the auditable single source of truth -- one glance shows every legal move.

> Implementation status: Booking, CharterRequest, and Operator have explicit `LEGAL_*_TRANSITIONS` maps. Trip, Hold, Payout, OTP, and EInvoice use inline `WHERE status IN (...)` guards -- functionally equivalent but not centralised. Extraction is tracked as low-severity follow-up (ADR-019 D2).

### 6.3 Every Status Change Inside `$transaction` + `SELECT FOR UPDATE` (ADR-019 D3)

All state transitions follow this pattern:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Acquire row lock -- serializes concurrent transition attempts
  const [entity] = await tx.$queryRaw`SELECT ... FROM "Entity" WHERE id = ${id} FOR UPDATE`
  // 2. Check predecessor against LEGAL_*_TRANSITIONS
  // 3. Apply transition (status + timestamp in the same update call)
  await tx.entity.update({ where: { id }, data: { status: newStatus, <verb>At: now } })
  // 4. Fire atomic side effects (hold consumption, ledger entries, notification rows)
})
// 5. Fire async side effects post-commit via after() (notification dispatch, payout scheduling)
```

Without `FOR UPDATE`, two concurrent requests can both read `status = 'scheduled'`, both decide the transition to `cancelled` is legal, and both write -- the second write succeeds and fires duplicate side effects (double refund, double notification) (ADR-019 D3).

The `$transaction` callback form is mandatory (not the array form). The array form provides no `tx` handle for `tx.$queryRaw\`SELECT ... FOR UPDATE\``.

### 6.4 Timestamp + Status Written Together (ADR-019 D4)

Any `<verb>At` column write must include a sibling `status:` write in the same `tx.model.update` call:

| Timestamp | Required status |
|---|---|
| `departedAt` | `status: 'departed'` |
| `completedAt` | `status: 'completed'` |
| `cancelledAt` | `status: 'cancelled'` |

Writing the timestamp without the status leaves the entity in a logically inconsistent state. The greppable invariant: every `<verb>At` column write should appear within 3 lines of a `status:` write (ADR-019 D4).

### 6.5 DTO Status Union Extended in Same Commit (ADR-019 D5)

When a new status value is added to a state machine, three artefacts must land in the same commit: (1) the service function write, (2) the DTO type union extension, and (3) a positive test assertion on the new status value. A status in the database but not in the DTO causes a tsc error on the consumer; a status in the DTO but untested gives false confidence.

### 6.6 Idempotent Transitions Use Discriminated Result (ADR-019 D6)

Transitions that may be legally called more than once (cancel, complete, check-in) return a discriminated result rather than throwing a sentinel error:

```typescript
// Inside $transaction, after SELECT FOR UPDATE:
if (trip.status === 'cancelled') {
  return { trip: toTripDto(trip), alreadyCancelled: true, cancelledBookings: 0 }
}
```

The idempotency check runs inside the existing transaction (lock already held) -- never as a separate query after lock release. Throwing a sentinel error and catching it at the route layer loses the entity DTO that the success path returns and forces the route to fabricate a response body from the error path (ADR-019 D6).

### 6.7 Side Effects Tied to Transitions (ADR-019 D7)

Side effects are classified as **atomic** (must succeed with the transition) or **async** (best-effort, post-commit):

- **Atomic side effects** run inside the `$transaction`: hold consumption, ledger entry creation, notification-log row insertion. If any fails, the entire transition rolls back.
- **Async side effects** run after the transaction commits via `after()`: notification dispatch (SMS/email), payout job scheduling, e-invoice issuance. These are fire-and-forget from the transaction's perspective -- failures are retried by cron sweepers, not by re-running the transition.

The `after()` API (Next.js App Router) is the sole mechanism for post-commit async dispatch. It runs after the HTTP response is sent, so latency-sensitive side effects (e.g., SMS OTP) do not block the user-facing response.

### 6.8 Append-Only Ledger

The `LedgerEntry` table is append-only. `BEFORE UPDATE` and `BEFORE DELETE` triggers on the table raise an exception on any attempt to modify or delete a row. All balance derivation is via `SUM` over immutable rows -- no in-place edits, no soft-deletes. This enforces financial audit integrity independent of application logic (ADR-001 D2; ADR-004 D5 context).

Indexed predicate columns for cron-driven sweepers (e.g., `payout_scheduled` rows with `scheduledFor`) must be top-level columns with a composite `@@index([template, scheduledFor])`, never JSON-payload keys. JSON payload keys produce sequential scans and cannot be indexed.

---

## 7. Staged Evolution Path (ADR-020 D6)

The monolith is designed with explicit extraction seams. The module boundary architecture (Section 4) ensures each domain already has a stable public API (its barrel) that can become a service interface without refactoring consumers.

| Stage | Description | Trigger |
|---|---|---|
| **Stage 0** (current) | Single Next.js app, single PostgreSQL instance, all logic in-process | Pre-launch through ~200 bookings/day |
| **Stage 1** | Extract background workers (payout sweeper, notification dispatcher, cron jobs) into separate processes. API routes remain in the Next.js app. | Booking volume or Tet surge pressure exceeds single-process capacity |
| **Stage 2** | Extract high-volume domains (Search/Availability, Payment webhook processing) as separate services behind an internal API gateway | Series A scale; per-service scaling requirements diverge; team grows enough to own separate services |

The progression is pull-not-push: extraction happens when a specific bottleneck demands it, not on a schedule. SI-006 §10 provides the infrastructure-level detail for each stage, including FPT Cloud service mapping, cost estimates, and measurable trigger thresholds (e.g., cron latency >30s for Stage 1, >50% CPU sustained for Stage 2).

---

## 8. Testing Philosophy

This document does not duplicate the testing strategy (see SI-005) but establishes the principles that inform it:

- **Real-database integration tests** are mandatory. Mocked Prisma clients are prohibited at the integration layer -- they mask migration failures, constraint violations, and query planner behaviour (SI-005 §2).
- **Test toolchain**: Vitest (unit + integration), Playwright (E2E). The test pyramid biases toward integration tests that exercise `$transaction` + `SELECT FOR UPDATE` paths against a real PostgreSQL instance.
- **CSRF threading**: E2E specs that hit non-safe API routes must thread the `X-CSRF-Token` header via `primeCsrf()` -- see SI-005 §4 for the Playwright helper pattern.
- **Concurrency tests**: any service that uses `SELECT FOR UPDATE` or `pg_advisory_xact_lock` must have a concurrent-write test in the same commit as the lock (SI-005 §5).
- **Financial math**: BigInt currency tests must assert exact half-even tie-breaking, not just "close enough" floating-point comparison (SI-005 §6).

---

## 9. SDLC Process

Branch strategy, PR review gates, and CI pipeline details are in SI-003. Key points that affect daily contributor workflow:

- **Branch protection**: `master` requires PR with at least one approval, passing CI (`tsc --noEmit`, `pnpm lint`, `pnpm test`), and no force-push (SI-003 §9).
- **Security gates**: Gitleaks (secret detection), `pnpm audit` (dependency vulnerabilities), and OWASP header checks run in CI (SI-003 §2).
- **Migration safety**: new Prisma migrations must pass `prisma migrate diff` parity check and include rollback SQL (SI-003 §7).

---

## Cross-References

### Architecture Decision Records

- **ADR-001** -- Stack Pick: framework, database, ORM, hosting, monorepo vs polyrepo
- **ADR-003** -- Auth Architecture: JWT structure, refresh token rotation, CSRF double-submit, TOTP step-up
- **ADR-004** -- Multi-Tenancy: marketplace model, PSP split-settlement, three auth realms, `withOperatorScope`, e-invoice issuer role, beachhead corridor
- **ADR-008** -- Security Posture: five-layer security model, Edge gate, CSRF double-submit enforcement
- **ADR-009** -- Concurrency and Seat Holding: `SELECT FOR UPDATE` hold mechanics, capacity guard, TOCTOU prevention
- **ADR-010** -- Booking Lifecycle: booking state machine detailed transitions and side effects
- **ADR-016** -- Module Boundaries: barrel-as-public-API, layered direction rule, client-safe deep imports, lint enforcement
- **ADR-019** -- State Machine Enforcement: eight state machines, `LEGAL_*_TRANSITIONS` maps, `SELECT FOR UPDATE` pattern, discriminated idempotency, side-effect coupling, side-effect orchestration via `after()` (D7)
- **ADR-020** -- Deployment: FPT Cloud service mapping, Terraform IaC, Docker deployment contract, staged evolution (D6), provider-agnostic migration path

### Design Specifications

- **DS-001** -- Data Model: canonical entity schemas, column types, enum values for all state machine entities; authoritative when this document diverges
- **DS-002** -- Migration Strategy: forward-only migrations, schema invariant preservation (ledger triggers), rollback procedures
- **DS-003** -- API Contract: request/response shapes, error codes, pagination, the contract the module layers fulfill
- **DS-009** -- Split-Settlement Migration: the design spec that closes the PSP central-collection gap flagged in Known Gaps below
- **DS-017** -- Deployment Portability: the design spec above SI-006; Docker deployment contract, provider-agnostic env var surface

### Frontend Design

- **FD-028** -- Portal Architecture: frontend implementation of barrel rules, Suspense placement, Server Actions, client-safe deep-import patterns

### Scaffolding & Infrastructure

- **SI-002** -- Developer Environment Setup: local toolchain, env vars, stub modes, Prisma workflow
- **SI-003** -- CI/CD Pipeline: branch protection, security gates, migration safety, PR review workflow
- **SI-004** -- Linting and Formatting: module boundary lint enforcement details, client component guard
- **SI-005** -- Testing Strategy: test pyramid, real-DB mandate, concurrency tests, financial math tests
- **SI-006** -- Deployment Configuration: full hosting architecture, Docker Compose reference, cron sidecar, staged evolution details

### Business / Regulatory

- **`documentation/business/regulatory/`** -- Primary regulatory evidence for marketplace classification (§5.5): payment intermediary analysis, legal entity structure, transport licensing, VSIC code. Cross-Domain Conflict C2 independently confirms the PSP central-collection risk flagged in Known Gaps

---

## Known Gaps

- **PSP split-settlement not implemented**: the documented fund-flow model (ADR-004 D2) uses per-operator merchant accounts with PSP-level splitting. The actual implementation collects all payments into a single platform merchant account and tracks operator share in the software ledger -- the pattern ADR-004 D2 labels as likely requiring an SBV IPS licence. DS-009 is the design spec for closing this gap. Blocking for Issue 094 go-live.
- **`LEGAL_*_TRANSITIONS` maps incomplete**: Trip, Hold, Payout, OTP, and EInvoice use inline `WHERE status IN (...)` guards rather than centralised maps. Tracked as low-severity follow-up (ADR-019 D2).
- **SaaS subscription tier**: dual commission + SaaS pricing model is documented (ADR-004 D4) but no schema implementation exists for the SaaS subscription tier.
- **ZaloPay adapter**: listed as a Phase 3 payment option in business documentation but not yet implemented (ADR-001 Known Gaps).
- **Bank transfer adapter (VietQR + SePay)**: design complete in DS-013; implementation pending for the launch PSP path.
