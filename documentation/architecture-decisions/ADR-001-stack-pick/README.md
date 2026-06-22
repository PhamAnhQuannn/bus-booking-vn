# ADR-001: Stack Pick

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking is a Vietnam-market bus ticket marketplace connecting operators (nhà xe) with travelers. The platform serves three distinct user groups through a single product surface: customer booking, operator console, and admin portal.

Key business constraints driving stack decisions (sourced from `documentation/business/`):

- **Vietnam data localization** (Decree 53/2022, Decree 147/2024): PII must reside on servers physically in Vietnam. Application serving may remain offshore if DB is onshore. (regulatory-compliance.md, data-privacy.md)
- **Tet surge resilience**: 10-20x normal traffic in a 2-3 week window; permanent customer defection on failure. (risk-matrix.md)
- **Financial integrity**: append-only ledger, `SELECT FOR UPDATE` serialization, BigInt currency math, 8 state machines with ACID requirements. (invariants-catalog.md, state-machines.md)
- **Speed to market**: small team, pre-launch through month 12; Series A gate = $500K-2M GMV/month. (investor-kpis.md, strategic-roadmap.md)
- **SEO + accessibility**: compete with VeXeRe's Google presence; WCAG compliance is a stated differentiator vs all competitors. (feature-benchmark.md, feature-parity-matrix.md)
- **Multi-channel notifications**: Zalo ZNS primary, SMS fallback (eSMS), email (Resend); brandname SMS requires carrier approval. (telecom-sms.md)
- **Payment integration**: Bank transfer (VietQR + SePay) + cash (launch), MoMo + VNPay (Phase 2), ZaloPay (Phase 3); marketplace model where PSP settles directly to operator to avoid SBV payment intermediary license. (payment.md, psp-contract-terms.md)
- **E-invoice compliance**: MISA integration mandatory under Decree 123/2020 + Decree 70/2025. (einvoice-tax.md)

---

## Decisions

### 1. Framework — Next.js (App Router)

| Option | Pros | Cons |
|--------|------|------|
| **Next.js (App Router)** | SSR/SSG for SEO; React Server Components keep sensitive logic server-side; `after()` for post-commit side effects; built-in i18n routing; native Vercel deployment; largest React ecosystem for a11y tooling | Vendor coupling to Vercel for optimal DX; App Router still evolving (breaking changes across versions) |
| Remix | Nested routing; progressive enhancement; good SSR | Smaller ecosystem; no native Vercel edge integration; weaker i18n story |
| Nuxt.js (Vue) | Good SSR; Vue's simpler mental model | Vue ecosystem smaller for enterprise patterns; fewer a11y component libraries; team would need Vue expertise |
| SvelteKit | Excellent performance; small bundle | Smallest ecosystem; limited enterprise UI component options; hiring pool in Vietnam near zero |
| Express + React SPA | Maximum flexibility; no framework lock-in | No SSR without extra setup = poor SEO; client-side routing exposes sensitive logic; manual i18n; manual deployment pipeline |

**Choice**: Next.js (App Router)

**Reasons**:
- SSR required for search/booking page SEO — VeXeRe dominates Google results; client-rendered SPA invisible to crawlers (competitive-landscape.md)
- React Server Components enforce I7 (no client-originated price) and I9 (no raw phone in payloads) by keeping sensitive logic server-side (invariants-catalog.md)
- `after()` API enables post-commit side effects (overpay refund, notification fan-out) without blocking response (bounded-contexts.md)
- Built-in i18n routing supports English UI expansion on 6-month horizon for tourist corridors (risk-matrix.md)
- Vercel-native = zero-config serverless deployment with auto-scaling for Tet surge (risk-matrix.md)
- React ecosystem has strongest WCAG a11y tooling — accessibility is a declared competitive differentiator vs VeXeRe/redBus/FUTA (feature-parity-matrix.md)

---

### 2. Database — PostgreSQL

| Option | Pros | Cons |
|--------|------|------|
| **PostgreSQL** | Row-level locking (`SELECT FOR UPDATE`); `BEFORE UPDATE/DELETE` triggers; `::text` casts for BigInt; mature PgBouncer pooling; provider-agnostic (portable to Vietnam IDC) | Requires managed hosting or self-administration; no built-in global distribution |
| MySQL | Widely deployed in Vietnam; good tooling | Weaker trigger support; no native `FOR UPDATE SKIP LOCKED`; less capable JSON operators |
| MongoDB | Flexible schema; easy horizontal scaling | No ACID multi-document transactions (pre-5.0); append-only ledger invariant unenforceable; no row-level locking |
| CockroachDB | Distributed SQL; global availability | Overkill for single-region; higher latency for serializable transactions; limited Vietnam hosting options |
| Supabase Postgres | Managed PG; built-in auth/realtime | Singapore-only = cross-border transfer violation (data-privacy.md); vendor lock-in on auth layer |
| Neon Postgres | Serverless PG; branching for dev | Singapore/US regions only = data localization violation (data-privacy.md) |
| PlanetScale (MySQL) | Serverless MySQL; branching | MySQL limitations above; no Vietnam region; Vitess layer adds complexity for `SELECT FOR UPDATE` |

**Choice**: PostgreSQL (provider-agnostic; production target = Vietnam-hosted instance)

**Reasons**:
- `SELECT FOR UPDATE` serialization (I1 invariant) is the foundation of seat-hold concurrency — PG's row-level locking is the most battle-tested implementation (invariants-catalog.md)
- `BEFORE UPDATE/DELETE` triggers enforce ledger immutability (`ledger_entry_immutable`) and audit log immutability — not expressible in application code alone (bounded-contexts.md, invariants-catalog.md)
- 8 state machines (Trip, Booking, Hold, Payout, Operator, OTP, EInvoice, Charter) require ACID transactions spanning multiple tables (state-machines.md)
- Data localization (Decree 53/2022) requires PII on servers physically in Vietnam — provider-agnostic PG is portable to Viettel IDC / VNPT / FPT Telecom without migration; Supabase/Neon flagged as non-compliant (regulatory-compliance.md, data-privacy.md)
- PgBouncer connection pooling handles Tet surge database connection pressure (risk-matrix.md)
- `::text` casts for BigInt balance derivation in ledger queries (event-flows.md)

---

### 3. ORM — Prisma

| Option | Pros | Cons |
|--------|------|------|
| **Prisma** | Schema-as-source-of-truth; typed client generation; migration system; `$transaction` callback form with raw SQL escape hatch; PgBouncer `directUrl` support | Generated client size; Edge runtime limitations (needs `@prisma/adapter-*`); breaking changes across major versions |
| Drizzle | Lightweight; SQL-like syntax; Edge-compatible | Newer ecosystem; migration tooling less mature than Prisma's at evaluation time; no equivalent of `$transaction(async tx => ...)` callback with raw SQL escape hatch |
| TypeORM | Decorator-based; Active Record + Data Mapper | Heavy; poor TypeScript inference; migration reliability issues; declining maintenance |
| Knex.js | Query builder; flexible; lightweight | No type generation from schema; manual migration management; no automatic relation loading |
| Raw pg driver | Zero abstraction overhead; full SQL control | No type safety; no migration system; manual connection management; every query hand-written |

**Choice**: Prisma

**Reasons**:
- Schema file (`prisma/schema.prisma`) is the single source of truth for the domain model — ubiquitous language definitions extracted directly from it (ubiquitous-language.md)
- `$transaction(async (tx) => {...})` callback form enables serializable operations (capacity guard, cancel-trip, payout computation) while `tx.$queryRaw` provides escape hatch for `SELECT ... FOR UPDATE`, partial indices, and raw SQL that Prisma DSL cannot model (invariants-catalog.md)
- Typed DTO mapping (`toTripDto.ts`, `toBookingDto.ts`) from Prisma model rows ensures select whitelists match exactly the UI contract fields (bounded-contexts.md)
- `directUrl` PgBouncer configuration already proven — handles connection pooling for serverless environment (regulatory-compliance.md)
- Migration system has supported 70+ shipped issues with schema changes, including raw SQL migrations for CHECK constraints and partial indices

> **CORRECTION** (2026-06-18): Drizzle Cons originally overstated limitations. Drizzle's ecosystem has matured since evaluation; the primary rejection reason was migration tooling maturity and the lack of a `$transaction` callback form with raw SQL escape hatch at evaluation time, not ecosystem size per se. Cons text updated to reflect accurate rationale.

---

### 4. Hosting — Vercel (Singapore, sin1)

| Option | Pros | Cons |
|--------|------|------|
| **Vercel sin1** | Auto-scaling serverless (zero capacity planning); Next.js-native; global CDN/Edge Network; zero-config deploys | Singapore = cross-border data transfer (requires CDTIA filing); cold-start latency; vendor lock-in; +5-15ms latency to Vietnam DB |
| AWS (EC2/ECS/Lambda) | Vietnam region possible (no current ap-southeast region covers VN); full infrastructure control | Manual scaling; complex deployment pipeline; significant DevOps overhead for small team |
| GCP Cloud Run | Serverless containers; good auto-scaling | No Vietnam region; less Next.js-native than Vercel |
| Self-hosted VPS (Vietnam) | Full data residency compliance; lowest latency to Vietnam DB | Manual scaling; no CDN; DevOps burden; single point of failure; Tet surge risk |
| **FPT Cloud (Vietnam)** | **Full data residency; eliminates CDTIA entirely; managed PG/Redis/K8s/S3; Tier III DCs (PCI DSS, ISO 27001/27017/27018); lowest latency to Vietnamese users** | **No serverless (no Lambda equivalent); pricing opaque (contact sales); smaller ecosystem vs Vercel; no edge middleware** |
| Fly.io | Edge deployment; can run in Singapore | Less mature; no native Next.js optimizations; limited enterprise support |
| Railway | Simple deployment; good DX | No Vietnam/SEA region; less auto-scaling capability |

**Choice**: Vercel Pro sin1 (Singapore) — primary production host. FPT Cloud (Vietnam) — retained as Docker self-hosted backup.

> **2026-06-19 Pivot**: Vercel sin1 demoted from primary to staging-only. FPT Cloud promoted to primary. See ADR-020 D2/D7.
>
> **2026-06-21 Pivot**: FPT Cloud demoted back to backup. Vercel Pro sin1 restored as primary. See ADR-020 D2/D11.

**Reasons** (2026-06-21 pivot):
- **Cost decisive**: Vercel + Neon + Upstash stack = ~$55-140/mo vs FPT Cloud = ~$340-520/mo. CDTIA filing (~$2-5K one-time) is acceptable vs $200-400/mo ongoing savings
- **Zero ops**: no Docker, Nginx, SSL, PgBouncer, or cron sidecar to manage. Push-to-deploy from Git
- **Neon replaces managed PG**: serverless PostgreSQL 16 with built-in pooler (replaces PgBouncer), branching for preview DBs, PITR backup. `DATABASE_URL`/`DIRECT_URL` split works identically
- **Upstash replaces managed Redis**: already wired via `REDIS_PROVIDER=upstash`. HTTP REST transport works on Vercel Edge
- **Cloudflare R2 for storage**: S3-compatible, zero egress fees, wires via `STORAGE_ENDPOINT` env var
- **FPT Cloud gaps unresolved**: PG 16 / Redis 7 versions unconfirmed; DBProxy transaction mode unconfirmed; all pricing requires sales quotation
- **Escape hatch preserved**: provider-agnostic Docker contract (ADR-020 D8) means reverting to FPT Cloud = DNS + connection string change (~2-4 hours)
- **CDTIA accepted**: one-time filing with MPS A05 within 60 days. Does not block technical deployment

---

### 5. Edge vs Origin — Hybrid

| Option | Pros | Cons |
|--------|------|------|
| Edge-first | Zero cold start; lowest latency for all requests | Cannot connect to PostgreSQL; cannot run Prisma; cannot execute `$transaction` |
| Origin-only | Full DB access; simplest mental model | Cold-start latency on every request; auth/CSRF checks pay serverless boot cost |
| **Hybrid** | Edge handles stateless gates (JWT verify, CSRF); Origin handles DB-heavy operations | Two runtime targets; must track which code runs where; Edge API surface limited |

**Choice**: Hybrid (Edge middleware + Origin route handlers)

**Reasons**:
- JWT verification and CSRF double-submit validation are stateless, cryptographic operations — run at Edge with zero cold start using `jose` (no DB needed) (invariants-catalog.md)
- `SELECT FOR UPDATE`, ledger writes, state machine transitions, and `$transaction` blocks require PostgreSQL connection — must run at Origin (invariants-catalog.md, state-machines.md)
- Payment webhook handlers (VNPay/MoMo) need HMAC verification (Edge-safe) + DB writes (Origin-required) — route handlers run at Origin (bounded-contexts.md)
- Edge middleware intercepts every request for cross-cutting auth gates (e.g. `requiresPasswordChange` JWT claim redirect) without DB round-trip — eliminates per-route enforcement gaps (invariants-catalog.md)
- Edge functions serve from nearest Vercel PoP; Origin functions route to sin1 → Vietnam DB — hybrid minimizes latency for stateless operations while maintaining DB access for stateful ones (regulatory-compliance.md)

---

### 6. Monorepo vs Polyrepo — Monorepo (single Next.js app)

| Option | Pros | Cons |
|--------|------|------|
| **Monorepo single app** (Next.js route groups) | Shared Prisma schema; cross-context `$transaction`; single deploy; simplest CI; shared auth/middleware | Larger bundle if not code-split; all three UIs deploy together; blast radius of a bad deploy is full product |
| Monorepo multi-package (Turborepo) | Shared code with independent builds; per-package deploys | Turborepo config overhead; shared Prisma schema still couples packages; deploy coordination for schema migrations |
| Polyrepo | Independent deploy cycles; team autonomy; isolated blast radius | Distributed transactions impossible (booking spans Payment + Fleet + Notification in one `$transaction`); schema drift; duplicated auth logic; 3x CI/CD setup; small team overhead |

**Choice**: Monorepo single Next.js app with route groups (`app/(customer)/`, `app/op/`, `app/admin/`)

**Reasons**:
- 11 bounded contexts share one PostgreSQL instance and one Prisma schema — no natural microservice boundary exists (bounded-contexts.md)
- Cross-context transactions are fundamental: booking creation touches Payment, Fleet, and Notification in a single `$transaction` — splitting into separate services would force distributed transaction coordination (invariants-catalog.md)
- Three UI surfaces (customer booking, operator console, admin portal) share auth, fleet, and booking domains — route groups provide URL separation without code duplication (bounded-contexts.md)
- Pre-launch through month 12 with a small team — polyrepo overhead (3x CI/CD, schema sync, API contracts between services) is unjustified (strategic-roadmap.md)
- Speed to market is critical for Series A gate ($500K-2M GMV/month target) — single deploy pipeline maximizes shipping velocity (investor-kpis.md)

---

## Known Gaps (as of 2026-06-19)

- **ZaloPay adapter**: Listed as a payment option in business docs (payment.md) but no adapter implemented. Only VNPay and MoMo adapters exist.
- **Bank transfer adapter (VietQR + SePay)**: Design complete (DS-013, rewritten 2026-06-20). Launch PSP — implements `PaymentGateway` interface with SePay webhook confirmation. Code implementation pending.
- **FPT Cloud pricing**: Compute and managed database pricing require sales quotation (only Object Storage has published prices). Terraform provider (`fpt-corp/fptcloud`) enables IaC provisioning but does not expose pricing. Cost comparison with Viettel IDC / CMC Cloud pending.
- **FPT PG16 / Redis 7 version confirmation**: Engine versions not published on FPT marketing pages — visible only in the FPT Console portal during provisioning. Must verify PostgreSQL 16 and Redis 7 availability before committing.
- **FPT DBProxy mode**: FPT Database Engine offers a "DBProxy" (connection proxy, likely PgBouncer-based) but has not confirmed whether it supports transaction mode — critical for Prisma's connection behavior. Verify before relying on it; fall back to self-hosted PgBouncer if needed.

---

## Consequences

### Positive
- Single codebase with typed schema enables rapid iteration across all three user surfaces
- **CDTIA filing accepted** — Vercel+Neon+Upstash (Singapore) requires CDTIA under PDPL 2025 Art. 25 (~$2-5K one-time, 60-day window). FPT Cloud backup path eliminates CDTIA entirely. See ADR-020 D11.
- PostgreSQL provider-agnosticism enables migration between FPT Cloud / AWS / Vercel / bare-metal without application changes
- Provider-agnostic Docker deployment contract (ADR-020 D8) ensures vendor lock-in is a configuration concern, not an architectural one
- Terraform provider (`fpt-corp/fptcloud`) enables infrastructure-as-code from Day 1 — infra is documented and reproducible
- Hybrid Edge/Origin pattern still applies on FPT Cloud: middleware runs as Node.js middleware (not Vercel Edge) but same JWT/CSRF logic, same auth gates
- Prisma's migration system + raw SQL escape hatch balances productivity with the precision needed for ledger/concurrency invariants

### Negative
- **DevOps overhead** — FPT Cloud requires Docker, Nginx, SSL, and cron sidecar management (vs Vercel zero-ops). Mitigated by Terraform IaC
- Prisma generated client adds bundle weight and constrains Edge runtime usage
- Single-app monorepo means all three portals deploy together — a regression in admin can block customer-facing releases
- Next.js App Router breaking changes (documented in AGENTS.md) require reading `node_modules/next/dist/docs/` before writing code — ongoing maintenance cost
- FPT Cloud pricing opacity — compute and managed database pricing require sales quotation; cost modeling blocked until quotes obtained
- No preview deploys on FPT Cloud — Vercel staging retained for per-PR preview environments

### Mitigations
- DevOps burden: Terraform provider automates VPC/instance/DB/LB provisioning; Nginx + Let's Encrypt is standard Vietnamese DevOps practice
- Vendor lock-in: Prisma schema + PostgreSQL are portable; Next.js-specific APIs (`after()`, Edge middleware) are isolated to thin adapter layers; S3-compatible storage via standard `@aws-sdk/client-s3`
- Deploy blast radius: route-group organization + feature flags enable incremental rollout per surface
- Preview deploys: Vercel staging (zero-ops) retained for development workflow; production traffic stays on FPT Cloud

---

## See Also

- [SI-001 Project Scaffold](../../scaffolding-infra/SI-001-project-scaffold/) — stack consolidation, monorepo structure, multi-tenancy model, state machines
- [SI-002 Dev Environment](../../scaffolding-infra/SI-002-dev-environment/) — local setup, Prisma workflow, stub modes, environment variable schema
- [SI-006 Deployment Config](../../scaffolding-infra/SI-006-deployment-config/) — FPT Cloud hosting architecture, deployment contract, provider migration playbook
