> ← [Previous](../02-requirements-nonfunctional/) | [Index](../README.md) | [Next →](../03a-frontend-design-system/)

## 3. System Architecture

### 3.1 What is a "Modular Monolith"?

A **monolith** is a single application deployed as one unit (as opposed to microservices, where each feature is a separate application communicating over the network).

A **modular monolith** adds internal structure: code is organized into independent domain modules (like `payment/`, `booking/`, `ledger/`) with strict boundaries. Each module exposes a public API (its `index.ts` barrel file) and hides its internals. Other modules can only import through that public API.

**Why monolith at this scale?**
- 200 bookings/day ≈ 0.002 requests/second average. Microservices add network latency, deployment complexity, and distributed debugging pain — all for load that a single process handles trivially.
- The constraint is **correctness** (money, tenancy, concurrency), not throughput.

**Why modular?**
- When (if) a module becomes a proven bottleneck, it can be extracted to a separate service almost mechanically — because every caller already goes through its public API.

### 3.2 Layered Design

```
┌─────────────────────────────────────────────────────┐
│  EXPERIENCE LAYER                                   │
│  3 frontends: Customer Web · Operator Console · Admin│
│  (app/ — thin, no business logic)                   │
├─────────────────────────────────────────────────────┤
│  DOMAIN LAYER                                       │
│  catalog · search · booking · payment · ledger ·    │
│  ticketing · charter · onboarding · auth            │
│  (lib/<domain>/ — all business logic lives here)    │
├─────────────────────────────────────────────────────┤
│  CORE LAYER                                         │
│  db · money · time · id · errors · logger · config  │
│  jobs · http (rate-limit, CSRF, HMAC)               │
│  (lib/core/ — shared primitives, no domain logic)   │
├─────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                     │
│  PostgreSQL · Redis · S3 · PSP Adapters · SMS/Email │
└─────────────────────────────────────────────────────┘
```

**Direction rule**: Each layer depends only downward. `app/` calls `lib/<domain>/`. Domains call `lib/core/`. Core calls infrastructure. Never upward, never sideways-skip.

### 3.3 Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | Server-side rendering for SEO; API routes colocated; React ecosystem |
| Language | TypeScript | Type safety across frontend + backend in one codebase |
| Database | PostgreSQL | ACID transactions for money; relational integrity; mature |
| Cache/Ephemeral | Redis | Rate-limit counters, OTP storage, idempotency keys, hold countdown |
| ORM | Prisma | Type-safe queries; migration management; schema as code |
| File Storage | S3 (or compatible) | Ticket PDFs, KYB documents; signed URLs for direct access |
| Deployment | Vercel (serverless) | Zero-ops for a small team; auto-scaling; edge middleware |

### 3.4 What We Deliberately Defer

| Technology | Why NOT now |
|------------|------------|
| Microservices | Load doesn't justify the complexity |
| Kafka / event sourcing | Same — overkill for 200 bookings/day |
| Elasticsearch | SQL search is sub-100ms at this data size |
| Database sharding | Single Postgres handles years of this volume |
| Custom autoscaling | Serverless handles it |
| Dedicated worker fleet | DB job table + cron is sufficient |

### 3.5 Key Architecture Decisions (ADRs)

An **Architecture Decision Record** (ADR) captures WHY a choice was made — the context, alternatives considered, and consequences. A student learning system design should practice this format for every major decision.

**ADR-1: Next.js (App Router) as full-stack framework**

| | |
|---|---|
| **Context** | Need SSR (Server-Side Rendering) for SEO in Vietnamese search engines; API routes for the backend; React for the frontend — all in one codebase for a team of 1–2. |
| **Options** | (a) Next.js App Router, (b) Remix, (c) Separate SPA (React) + Express API server |
| **Decision** | Next.js App Router |
| **Consequences** | (+) Single deploy, colocated frontend + API, Vercel-native integration. (−) Tied to Vercel's serverless model; Edge Runtime limitations prevent using Prisma or Node.js `crypto` in middleware; large framework surface area to learn. |

**ADR-2: PostgreSQL over MongoDB**

| | |
|---|---|
| **Context** | Money operations require ACID transactions. Data is deeply relational: Operator → Route → Trip → Booking → Payment → LedgerEntry. |
| **Options** | (a) PostgreSQL, (b) MongoDB, (c) MySQL |
| **Decision** | PostgreSQL |
| **Consequences** | (+) ACID transactions, foreign keys, partial indexes, advisory locks, `SELECT ... FOR UPDATE` row locking. (−) Schema migrations required for every change; no schemaless flexibility for rapid prototyping. |

**ADR-3: Prisma as ORM**

| | |
|---|---|
| **Context** | Need type-safe database access from TypeScript, plus schema-as-code migration management. |
| **Options** | (a) Prisma, (b) Drizzle, (c) Raw SQL + pg driver |
| **Decision** | Prisma |
| **Consequences** | (+) Generated types match schema exactly; migration management built-in; developer-friendly query API. (−) Cannot express partial indexes, CHECK constraints, or triggers in the Prisma DSL — SQL-only migrations needed for those (e.g., the ledger immutability trigger). Edge Runtime incompatible — forces `runtime = 'nodejs'` on all API routes. |

**ADR-4: Vercel serverless over self-hosted**

| | |
|---|---|
| **Context** | Team of 1–2 developers; ~200 bookings/day; strong preference for zero-ops (no DevOps engineer). |
| **Options** | (a) Vercel, (b) Railway / Render, (c) Self-hosted VPS (DigitalOcean / Linode) |
| **Decision** | Vercel |
| **Consequences** | (+) Zero-ops deployment, auto-scaling, preview deploys per PR, built-in CDN + edge middleware. (−) Serverless = no persistent process for background workers (→ cron-driven jobs, Section 16); connection pooler (PgBouncer) mandatory from day 1 (Section 4.5); cold starts add ~200ms to first request; vendor lock-in for deployment. |
