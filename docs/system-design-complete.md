# Bus Booking Platform — Complete System Design Document

> **Purpose**: This document covers every design consideration for building the bus booking
> marketplace from idea to production. Each section explains technical terms on first use
> so a non-specialist can follow. This is the "paper build" — the thinking layer before code.
>
> **Platform**: Online bus ticket marketplace for Vietnam. Customers search and buy tickets.
> Operators (bus companies) list trips and manage fleets. Admins oversee the marketplace.

---

## 0. Problem Statement

Every design decision in this document flows from a real problem. Before diving into solutions, understand what's broken.

### 0.1 Who Has This Problem?

- **Travelers in Vietnam**: 1,600+ bus operators, most are small companies running 5–20 buses. Booking a bus ticket today means calling a bus station, walking up at the depot, or using one of a few aggregator apps with limited route coverage.
- **Bus operators**: Run their business on phone calls, handwritten manifests, and walk-up customers. No visibility into how full a bus is until departure. No digital payment collection — cash only, often handed to drivers.
- **The market gap**: No single platform connects a large number of operators to travelers with real-time seat availability, online payment, and digital ticketing.

### 0.2 What's Broken Today?

| Pain Point | Who Feels It | Consequence |
|-----------|-------------|------------|
| Phone-only booking | Travelers | Can't compare prices, can't confirm seats, risk of oversell |
| No price transparency | Travelers | Same route, three operators, no way to compare |
| Paper manifests | Operators | No-shows invisible, boarding chaos, no real-time seat count |
| Cash-only payment | Operators | Revenue leakage, no audit trail, driver trust issues |
| Fragmented systems | Platform | No network effects, no data, no marketplace leverage |

### 0.3 What Does Success Look Like?

- **Customer**: Search-to-ticket in under 5 minutes, zero phone calls, digital ticket on phone
- **Operator**: Digital manifest, real-time seat counts, money deposited to bank account automatically
- **Platform**: ~200 bookings/day (current), scaling to ~2,000/day; 6% platform fee on each booking
- **Measurable goal**: A single integration gives any operator access to all customer traffic on the platform

### 0.4 Why This Matters for the Design

Every technical choice traces back to this problem:
- **Guest checkout** (no account required) → matches how Vietnamese travelers buy (one-off, not frequent flyer)
- **Central collection model** (Section 9.1) → solves "did money arrive?" for 100+ operator accounts
- **VND integer math** (Section 10.2) → not a localized global product; Vietnamese dong has no decimal places
- **Phone-first identity** → most Vietnamese users identify by phone number, not email
- **Modular monolith** (Section 3.1) → correctness (money, concurrency) matters more than throughput at this scale

---

## 0.5 How to Read This Document

### Prerequisites

- Basic programming concepts (variables, functions, HTTP requests)
- Familiarity with databases (what a table and a row are)
- Helpful but not required: SQL, TypeScript, React

### Suggested Reading Order

Don't read front-to-back. Follow this path:

| Phase | Sections | What You Learn |
|-------|----------|---------------|
| 1. The problem | 0, 1, 2 | What we're building, for whom, and what quality bar we need |
| 2. The skeleton | 3, 23 | Architecture (monolith vs microservices) and deployment (serverless) |
| 3. The data | 6 | What we store, how entities relate, why PostgreSQL |
| 4. The core flows | 12, 13 | Search → Hold → Book — the customer's journey through the system |
| 5. The money | 9, 10 | Payment → Ledger — the critical path where correctness is non-negotiable |
| 6. The hard problems | 11 | Concurrency, race conditions, failure modes — what makes systems engineering hard |
| 7. Everything else | 7, 8, 14–22, 24–26 | API design, auth, notifications, security, ops, scaling |
| 8. Reference | 27 | Glossary — look up any term you forgot |

### Conventions Used in This Document

- **Bold terms** are defined inline on first use (e.g., **ACID** in Section 6.1)
- `Code blocks` show real schema, query, or configuration examples from the codebase
- Tables compare alternatives (technology choices, race condition solutions, cost projections)
- Each section is self-contained — forward references say "(see Section N)"
- > Blockquotes like this mark **trade-off callouts** — decisions where we gained something but gave up something else

---

## Table of Contents

0. [Problem Statement](#0-problem-statement)
0.5. [How to Read This Document](#05-how-to-read-this-document)
1. [Functional Requirements](#1-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [System Architecture](#3-system-architecture)
4. [Networking & Traffic Flow](#4-networking--traffic-flow)
5. [Capacity Estimation](#5-capacity-estimation)
6. [Data Model & Storage](#6-data-model--storage)
7. [API Design](#7-api-design)
8. [Identity & Access Control](#8-identity--access-control)
9. [Payment System](#9-payment-system)
10. [Money Correctness & Ledger](#10-money-correctness--ledger)
11. [Concurrency & Race Conditions](#11-concurrency--race-conditions)
12. [Search & Discovery](#12-search--discovery)
13. [Booking & Hold Flow](#13-booking--hold-flow)
14. [Ticketing (QR / PDF)](#14-ticketing-qr--pdf)
15. [Notification System](#15-notification-system)
16. [Background Jobs & Scheduling](#16-background-jobs--scheduling)
17. [File & Document Storage](#17-file--document-storage)
18. [Security](#18-security)
19. [Compliance & Data Privacy](#19-compliance--data-privacy)
20. [Observability & Monitoring](#20-observability--monitoring)
21. [Configuration & Feature Flags](#21-configuration--feature-flags)
22. [Charter / Contract Rental Subsystem](#22-charter--contract-rental-subsystem)
23. [Deployment & Infrastructure](#23-deployment--infrastructure)
24. [Disaster Recovery & Rollback](#24-disaster-recovery--rollback)
25. [Testing Strategy](#25-testing-strategy)
26. [Evolution & Scale Path](#26-evolution--scale-path)
27. [Glossary](#27-glossary)

---

## 1. Functional Requirements

Functional requirements define **what the system does** — the capabilities each user type needs.

### 1.1 Three Actor Groups

| Actor | Role | Key Actions |
|-------|------|-------------|
| **Customer** | Traveler buying tickets | Search trips, hold seats, pay online, receive ticket (QR + PDF), check booking status |
| **Operator** | Bus company selling trips | Register/apply, manage fleet (buses), create trips, view bookings/manifest, manage money (balance/payout), scan tickets at boarding |
| **Admin** | Platform staff | Approve/reject operators, oversee finance (payouts, refunds, disputes), moderate content, manage system config |

### 1.2 Customer Capabilities

- **Search**: Enter origin, destination, date, ticket count → see matching trips with operator name, departure/arrival time, duration, bus type, price, seats remaining. Filter by operator, bus type, departure window, price range. Sort by departure, price, or duration.
- **Book (Guest Checkout)**: Select a trip → seats are held with a countdown timer → enter buyer info (name, phone, email) → review → pay online → receive booking reference + ticket QR via SMS and email PDF.
- **Payment**: Online only (no cash). Supported rails: VietQR bank transfer, MoMo wallet, domestic debit card, Visa/Mastercard, PayPal. All payments in VND (Vietnamese Dong).
- **Ticket Verification**: A public page (accessible via QR scan) shows the booking as paid, with trip details and bus plate — the source of truth.
- **Account (future)**: Register/login via phone + OTP (One-Time Password — a temporary code sent to your phone to prove ownership). Past guest bookings auto-linked when registering with the same phone. Currently paused — guest-only.

> **Trade-off**: Guest checkout means no user account data — we can't build purchase history, loyalty programs, or personalized recommendations. But in Vietnam's inter-city bus market, most travelers book infrequently and on impulse. Forcing account creation before booking would kill conversion. The design choice: optimize for conversion now, add optional accounts later (and backfill past bookings by phone match).

- **Charter Request**: Request a private vehicle for a custom trip (tourism/visiting). Fill a form with pickup, destination(s), dates, passenger count, budget. An operator is matched by the admin.

### 1.3 Operator Capabilities

- **Onboarding**: Submit an application form (NOT instant account creation). Admin reviews, approves, and creates the operator's login credentials (generated username + temporary password).
- **Fleet Management**: Add/edit buses (plate number, type, capacity). Set maintenance windows (bus auto-hidden from search during maintenance).
- **Trip Management**: Create trips (route + bus + departure time + price). System blocks overlapping trips on the same bus. Cancel trips (triggers customer refund). Close sales, mark departed, mark completed.
- **Booking & Manifest**: View bookings per trip/date. See passenger manifest for each departure. Scan ticket QR at boarding to verify + check in. Mark no-shows.
- **Money**: View balance (pending / available / paid out). View ledger of all financial entries. Request payouts to registered bank account. Download payout statements.
- **Charter**: View charter requests assigned by admin. Accept/decline. Claim open public-pool requests (first-come-first-served).

### 1.4 Admin Capabilities

- **Operator Approval**: Review applications, verify documents, create operator accounts (step-up authenticated — requires re-entering 2FA), approve/reject with reason.
- **Finance** (step-up authenticated): Oversee payouts (approve/retry), view any operator's ledger, make manual adjustments (with reason), execute refunds, handle chargebacks/disputes.
- **User Management**: Search customers + operators, view details, suspend/reinstate.
- **Moderation**: Disable bad trips/routes (not edit — moderate means disable).
- **System**: Manage feature flags, payment rail toggles, admin accounts (invite-only), view audit log.
- **Charter Dispatch**: Triage incoming charter requests. Assign directly to an operator OR publish to the open pool. Reject spam. Reassign on decline/expiry.

---

## 2. Non-Functional Requirements

Non-functional requirements define **how well the system performs** — the quality attributes.

### 2.1 Performance

| Metric | Target | Why |
|--------|--------|-----|
| Search response time | < 200ms (p95) | Users abandon slow search results |
| Payment initiation | < 500ms | Must feel instant before redirecting to PSP |
| Page load (first contentful paint) | < 1.5s | SEO + mobile users on 4G in Vietnam |
| API response (general) | < 300ms (p95) | Responsive operator console |

### 2.2 Availability

- **Target**: 99.5% uptime (allows ~3.6 hours downtime/month).
- **Payment webhooks**: Must be reliable — a missed webhook = unpaid booking that needs manual reconciliation. Retry + reconciliation sweeper as safety net.
- **Graceful degradation**: If SMS provider is down, bookings still work (notification is async, decoupled from booking state).

### 2.3 Scalability

- **Current**: ~200 bookings/day, ~100 operators. One server handles this trivially.
- **Near-term**: 10–100+ operators, ~2,000 bookings/day. Same architecture with a read replica.
- **Long-term**: If a single module becomes a measured bottleneck → extract that module only. Never pre-optimize.

### 2.4 Security Posture

- Three separate auth realms (customer, operator, admin) — never shared.
- Admin: email + password + mandatory TOTP (Time-based One-Time Password — a code from an authenticator app like Google Authenticator, rotating every 30 seconds; NOT SMS, which is vulnerable to SIM-swap attacks).
- All money operations: idempotent (safe to retry), transactional (all-or-nothing), audited.
- Tenant isolation: every operator query scoped to their own data — no cross-operator leakage.

### 2.5 Compliance

- **VN PDPD 2023** (Nghị định 13/2023/NĐ-CP — Vietnam's Personal Data Protection Decree): governs how personal data is collected, stored, processed, and erased. Requires consent, data-subject rights (access, correction, deletion), and breach notification. See [Section 19](#19-compliance--data-privacy) for full treatment.
- **PCI DSS** (Payment Card Industry Data Security Standard): We never store card numbers — the PSP handles that. But we must still protect payment metadata.
- Financial record retention: money/audit records retained even on account deletion (anonymize PII, keep financial totals).

### 2.6 Maintainability

- Modular monolith with clean domain boundaries — any module can later become a service.
- Colocated tests (unit + integration next to the code they test).
- Structured logging with request ID propagation.

---

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

---

## 4. Networking & Traffic Flow

This section explains how a user's request travels from their browser to the server and back, and the infrastructure layers involved.

### 4.1 DNS — Domain Name System

**What it is**: DNS is the internet's phone book. When a user types `busbooking.vn` in their browser, DNS translates that human-readable name into an IP address (like `104.21.56.123`) that computers use to find each other.

**How it works for us**:
1. User types `busbooking.vn` → browser asks a DNS resolver "what's the IP?"
2. DNS responds with the IP of our hosting provider (Vercel's edge network)
3. Browser connects to that IP

**DNS records we configure**:
- `A` record: points `busbooking.vn` → hosting IP
- `CNAME` record: points `www.busbooking.vn` → `busbooking.vn`
- `MX` record: email routing (for transactional emails)
- `TXT` record: domain verification (for email sender authentication, SPF/DKIM)

### 4.2 CDN — Content Delivery Network

**What it is**: A CDN is a network of servers spread across many locations (called "edge nodes" or "PoPs — Points of Presence"). Instead of every user hitting your origin server in one location, the CDN serves cached copies of static content (images, CSS, JavaScript files) from the nearest edge node.

**Why it matters**:
- A user in Ho Chi Minh City gets static assets from a nearby edge node (~5ms) instead of a server in the US (~200ms).
- Reduces load on the origin server — static assets never hit your application code.

**What gets CDN-cached**:
- Static assets: JavaScript bundles, CSS, images, fonts
- Ticket PDFs (served via signed S3 URLs through CDN)
- NOT cached: API responses (dynamic, per-user), search results, payment pages

**Stage 0**: Vercel's built-in CDN handles this automatically.
**Stage 1**: Add CloudFront or similar in front of S3 for ticket PDFs at scale.

### 4.3 SSL/TLS — Secure Connection

**What it is**: SSL (Secure Sockets Layer) / TLS (Transport Layer Security) encrypts all traffic between the user's browser and the server. The padlock icon in the browser means TLS is active. Without it, passwords, payment data, and personal info travel as plain text — readable by anyone on the network.

**How it works for us**:
- Vercel auto-provisions TLS certificates (via Let's Encrypt)
- All HTTP traffic redirected to HTTPS (enforced)
- TLS terminates at the edge (Vercel's network handles the encryption/decryption)

### 4.4 Request Lifecycle — Full Round Trip

Here is what happens when a customer searches for a trip:

```
User's Browser (Ho Chi Minh City)
  │
  ├─ 1. DNS lookup: busbooking.vn → 104.21.56.123
  │
  ├─ 2. TLS handshake (encrypted connection established)
  │
  ├─ 3. HTTP GET /search?from=hanoi&to=hcm&date=2026-07-01&seats=2
  │
  ▼
Vercel Edge Network (nearest PoP)
  │
  ├─ 4. Edge middleware runs (proxy.ts):
  │     - Rate-limit check (Redis) → allow or 429 Too Many Requests
  │     - Auth check (if needed) → verify JWT
  │
  ├─ 5. Request routed to serverless function
  │
  ▼
Next.js Server (serverless function)
  │
  ├─ 6. RSC (React Server Component) renders search page:
  │     - Calls lib/search/searchTrips() in-process (NOT a self-fetch)
  │     - searchTrips() queries PostgreSQL via Prisma through PgBouncer
  │     - SQL: indexed query on (origin, dest, date, status) with
  │       available-seats computation
  │
  ├─ 7. Returns rendered HTML + streaming RSC payload
  │
  ▼
Back to User's Browser
  │
  ├─ 8. Browser renders the page
  ├─ 9. React hydrates (makes the page interactive)
  └─ 10. Total time: ~150-300ms
```

### 4.5 Connection Pooling — PgBouncer

**The problem**: In a serverless environment, each request may spin up a new function instance. Each instance opens a new database connection. PostgreSQL has a hard limit (~100 concurrent connections by default). Under a traffic spike, 100+ simultaneous serverless functions exhaust the connection pool → database rejects new connections → site goes down.

**The solution**: **PgBouncer** (or Prisma Accelerate) sits between the application and PostgreSQL as a connection pooler. It maintains a pool of ~20 real database connections and multiplexes hundreds of application requests across them.

```
Serverless Function 1 ─┐
Serverless Function 2 ─┤──→ PgBouncer (20 real connections) ──→ PostgreSQL
Serverless Function 3 ─┤
...                     │
Serverless Function 150─┘
```

**Critical from day 1** — not a later optimization. Without it, the first traffic spike kills the database.

---

## 5. Capacity Estimation

Capacity estimation answers: "How much compute, storage, and bandwidth do we need?" This prevents over-provisioning (wasting money) and under-provisioning (site goes down).

### 5.1 Current Traffic Profile

| Metric | Value | Derived From |
|--------|-------|--------------|
| Bookings/day | ~200 | Current business volume |
| Operators | ~100 | Registered bus companies |
| Trips listed/day | ~500 | ~5 trips per operator |
| Search queries/day | ~5,000 | ~25x booking rate (browse-to-book ratio) |
| Peak QPS (queries/second) | ~2 | 5,000 queries concentrated in 8 peak hours ÷ 3,600 |
| Concurrent users (peak) | ~50 | Estimated from QPS × avg session duration |

**Verdict**: This is tiny. A single serverless function handles it without breaking a sweat.

### 5.2 Database Size Projection (1 year)

| Table | Rows/year | Avg row size | Total |
|-------|-----------|-------------|-------|
| Booking | 73,000 (200/day × 365) | ~500 bytes | ~35 MB |
| Trip | 182,500 (500/day × 365) | ~300 bytes | ~52 MB |
| LedgerEntry | 219,000 (3 per booking) | ~200 bytes | ~42 MB |
| Payment | 73,000 | ~400 bytes | ~28 MB |
| Hold | 146,000 (2 per booking avg) | ~200 bytes | ~28 MB |
| NotificationLog | 146,000 (2 per booking: SMS + email) | ~500 bytes | ~70 MB |
| Customer | 50,000 (unique travelers) | ~300 bytes | ~15 MB |
| **Total** | | | **~270 MB** |

**Verdict**: Fits in a single small PostgreSQL instance with room for 10x growth. No partitioning needed for years.

### 5.3 Storage (S3)

| Asset | Count/year | Avg size | Total |
|-------|-----------|----------|-------|
| Ticket PDFs | 73,000 | ~100 KB | ~7 GB |
| KYB documents | 500 (operator applications) | ~2 MB | ~1 GB |
| **Total** | | | **~8 GB/year** |

**Verdict**: Negligible. S3 free tier covers the first year.

### 5.4 Bandwidth

| Traffic type | Estimate |
|-------------|----------|
| Page loads (HTML + JS + CSS) | ~5,000/day × ~500 KB = ~2.5 GB/day |
| API calls (JSON) | ~10,000/day × ~5 KB = ~50 MB/day |
| PDF downloads | ~200/day × ~100 KB = ~20 MB/day |
| **Daily total** | **~2.6 GB/day** |
| **Monthly total** | **~78 GB/month** |

**Verdict**: Well within Vercel free/pro tier limits. CDN handles static assets.

### 5.5 Growth Triggers — When to Scale What

| Trigger | Action |
|---------|--------|
| > 1,000 bookings/day | Add PostgreSQL read replica for search queries |
| > 50 concurrent DB connections | Tune PgBouncer pool size |
| > 10,000 search queries/day | Add Redis cache for hot route results (short TTL) |
| > 50,000 bookings/day | Consider dedicated search index (Elasticsearch/Meilisearch) |
| > 500 PDF generates/hour | Add dedicated PDF render workers |
| Database > 50 GB | Partition Booking/LedgerEntry/NotificationLog by time |

### 5.6 Monthly Cost Projection

System design includes economics. Over-engineering costs real money.

| Service | Provider | ~200 bookings/day | ~2,000 bookings/day |
|---------|----------|-------------------|---------------------|
| Hosting | Vercel Pro | $20/mo | $20/mo (same plan; serverless auto-scales) |
| Database | Neon / Supabase (managed PG) | $0–25/mo (free tier or starter) | $50–100/mo (Pro + read replica) |
| Redis | Upstash | $0/mo (free tier: 10K cmds/day) | $10–30/mo (Pro) |
| Object Storage | S3 / Cloudflare R2 | $0/mo (free tier covers ~8 GB/yr) | $1–5/mo |
| SMS | eSMS.vn | ~$15/mo (200 SMS/day × ~₫500/msg) | ~$150/mo |
| Email | Resend / SES | $0/mo (free tier) | $20/mo |
| Error tracking | Sentry | $0/mo (free tier) | $26/mo (Team) |
| Domain + DNS | Cloudflare | ~$1/mo | ~$1/mo |
| **Monthly total** | | **~$35–60/mo** | **~$280–350/mo** |

**Revenue context**: At 200 bookings/day × 450,000₫ average × 6% platform fee = ~₫5.4M/day (~$220/day) in platform revenue. Infrastructure is < 1% of revenue even at the higher scale.

> **Trade-off**: We chose managed services (Vercel, Neon, Upstash) over self-hosted (VPS + PostgreSQL + Redis). This costs ~2–3x more at scale but saves an entire ops hire (~$1,500–2,000/mo in Vietnam). The break-even for self-hosting is ~5,000 bookings/day — beyond our Stage 1 horizon.

### 5.7 How to Estimate — Back-of-Envelope Technique

Capacity estimation is a core system design skill. Here's the methodology:

**Step 1: Start from the business metric** — bookings/day (not "requests per second"). Everything derives from this.

**Step 2: Apply common ratios**

| Ratio | Our value | Why |
|-------|-----------|-----|
| Browse-to-book | 25:1 | 25 search queries per completed booking (most people browse before buying) |
| Peak-to-average | ~5x | Rush hours (7–9 AM, 5–7 PM) concentrate traffic; midnight is near-zero |
| Read-to-write | ~50:1 | Searches (reads) vastly outnumber bookings (writes) |
| Holds-to-booking | ~2:1 | Some holds expire (payment abandoned); ~2 holds per completed booking |

**Step 3: Derive infrastructure numbers**

```
200 bookings/day
  → 5,000 searches/day (25:1 browse ratio)
  → 5,000 ÷ (8 peak hours × 3,600 seconds) ≈ 0.17 QPS average
  → 0.17 × 5 (peak multiplier) ≈ 1 QPS peak
```

**Step 4: Sanity check** — ask "does this number make sense?"
- Does 1 QPS exceed serverless capacity? No — Vercel handles thousands.
- Does 73,000 rows/year exceed PostgreSQL capacity? No — PG handles billions.
- Does 270 MB/year fill the disk? No — smallest managed DB is 10+ GB.

**Common mistakes**:
- Estimating QPS first (top-down) instead of from business volume (bottom-up)
- Using peak numbers for storage (peak applies to compute; storage is cumulative)
- Forgetting that 90% of traffic is reads (searchable, cacheable) not writes

---

## 6. Data Model & Storage

### 6.1 Why PostgreSQL (Relational Database)

A relational database stores data in tables with defined relationships (foreign keys) between them. PostgreSQL specifically:

- **ACID transactions**: Atomicity (all-or-nothing), Consistency (rules always enforced), Isolation (concurrent operations don't interfere), Durability (committed data survives crashes). Critical for money — you can't have a payment succeed but the booking fail.
- **Foreign keys**: The database itself enforces that a Booking must reference a real Trip, a Trip must reference a real Bus, etc. Broken references are impossible.
- **Rich indexing**: Composite indexes, partial indexes, and expression indexes — all needed for fast search with complex filters.

**Why not MongoDB/NoSQL?**
- Money requires ACID transactions. MongoDB's multi-document transactions are possible but awkward and slower.
- Relational data (Trip belongs to Route belongs to Operator) fits naturally in tables with joins.
- The data is highly structured — not a good fit for schema-less storage.

### 6.2 Key Entities and Relationships

```
Place (canonical city/stop names)
  │
  ├── Route (originPlaceId → Place, destPlaceId → Place, duration)
  │     │
  │     └── Trip (routeId → Route, busId → Bus, operatorId, departureAt, price, status)
  │           │
  │           ├── Hold (tripId, seatCount, expiresAt, status: active|consumed|expired)
  │           │
  │           ├── Booking (tripId, customerId?, buyerName/Phone/Email, seatCount,
  │           │            paymentMethod, status, bookingRef)
  │           │     │
  │           │     ├── Payment (bookingId, orderRef, amount, currency, provider,
  │           │     │            providerTxnId, status)
  │           │     │
  │           │     └── NotificationLog (bookingId, template, channel, status, scheduledFor)
  │           │
  │           └── LedgerEntry (operatorId, bookingId?, payoutId?, type, amount, sourceEventId)
  │
  └── Bus (operatorId, plate, type, capacity)
        │
        └── MaintenanceWindow (busId, startAt, endAt)

Operator (brandName, legalName, status: PENDING_REVIEW|UNDER_REVIEW|APPROVED|REJECTED|SUSPENDED)
  │
  ├── OperatorUser (operatorId, username, passwordHash, role: admin|staff)
  │
  └── FeeConfig (operatorId?, globalRate, effectiveFrom, changedBy)

Admin (email, passwordHash, totpSecret, role: super_admin|finance|support)

Customer (phone, name, email, deletedAt?)

CharterRequest (contactName/Phone/Email, originPlaceId, destinations, dates, budget,
                status, assigneeOperatorId?)
```

### 6.3 Why Redis (In-Memory Cache)

**Redis** is an in-memory data store — extremely fast (sub-millisecond reads) but volatile (data lost on restart unless persisted). We use it for ephemeral state that's okay to lose:

| Use Case | Why Redis | Why not PostgreSQL |
|----------|-----------|-------------------|
| Rate-limit counters | Needs microsecond increment/check | DB round-trip too slow for every request |
| OTP storage (5-min TTL) | Built-in key expiry | Would need a sweeper job to clean expired rows |
| Idempotency keys (SETNX) | Atomic set-if-not-exists | Works in PG too, but Redis is faster for this |
| Hold countdown (UX) | Client polls for remaining seconds | The real hold is in PG; Redis is just for the timer display |
| Hot route cache | Short TTL, fast reads | Search goes to PG for truth; Redis is an optional speed layer |

**What Redis does NOT do**:
- Seat locking (PostgreSQL `SELECT ... FOR UPDATE` only)
- Money operations (PostgreSQL transactions only)
- Anything where losing data = money loss or oversell

### 6.4 Index Strategy

Indexes are like a book's index — they let the database find rows without scanning the entire table. Without them, every query reads every row (full table scan).

**Key indexes**:
- `Trip(originPlaceId, destPlaceId, departureAt, status)` — the search query's exact predicate
- `Booking(tripId, status)` — counting paid/held seats per trip
- `LedgerEntry(operatorId, createdAt)` — operator ledger view
- `NotificationLog(template, scheduledFor)` — cron sweeper predicate
- `Hold(tripId, status, expiresAt)` — active hold counting
- `Payment(orderRef)` — webhook matching
- `Payment(providerTxnId)` — idempotency dedup

**Partial indexes** (index only a subset of rows):
- `Customer(email) WHERE email IS NOT NULL` — unique email, but only for customers who have one
- `OtpAttempt(phone) WHERE consumed = false AND expiresAt > NOW()` — only active OTPs

### 6.5 ID Strategy — CUID

**CUID** (Collision-resistant Unique Identifier) — a globally unique ID generated without a central coordinator. Example: `clx4a2b3c0000abcd1234efgh`.

**Why not auto-increment (1, 2, 3...)?**
- Sequential IDs leak business info (competitor can estimate booking volume by observing IDs).
- No central sequence bottleneck — any server can generate IDs independently.
- Safe to generate client-side or in distributed systems.

**Why not UUID v4?**
- UUIDs are random → bad for B-tree index locality (random inserts fragment the index). CUIDs are time-sorted → sequential inserts, better index performance.

### 6.6 Domain Boundaries & Aggregates

This section explains the design thinking behind how the code is organized — concepts from **Domain-Driven Design** (DDD) that help structure a complex system.

**What is a bounded context?** A self-contained area of the system with its own vocabulary and rules. In our codebase, each `lib/<domain>/` folder is a bounded context with a barrel file (`index.ts`) as its public API. Other modules import ONLY through that barrel — never reach into internal files.

**Bounded context map** (key domains):

| Bounded Context | Folder | Core Entities | Public API examples |
|----------------|--------|---------------|---------------------|
| Catalog | `lib/catalog/` | Route, Bus, OperatorPickupArea | getActiveRoutes, getTripOccupancy |
| Search | `lib/search/` | Trip (read-only view) | searchTrips (filters, facets, cursor pagination) |
| Booking | `lib/booking/` | Hold, Booking | initiateOnlineBooking, getManifest, checkInBooking |
| Payment | `lib/payment/` | PaymentEvent, gateway adapters | processPaymentWebhook, applyPaidStatusTransition |
| Ledger | `lib/ledger/` | LedgerEntry, Payout, FeeConfig | appendLedgerEntry, refundOut, getOperatorBalance |
| Onboarding | `lib/onboarding/` | Operator status transitions | transitionOperatorStatus |
| Charter | `lib/charter/` | CharterRequest lifecycle | transitionCharterRequest, claimCharter |
| Auth | `lib/auth/` | Customer, AdminUser, sessions, JWT | adminLogin, requireOperatorAuth, signAccess |
| Notification | `lib/notification/` | NotificationLog | dispatchNotifications, renderTemplate |
| Core | `lib/core/` | DB client, tenant scope, validation | prisma, withOperatorScope, Zod schemas |

**Aggregate roots** — an aggregate root is the single entity through which all modifications to a cluster of related objects must pass. You never modify a child directly; you go through the root.

| Aggregate Root | Owns | Consistency rule |
|---------------|------|-----------------|
| **Trip** | Holds, seat count, departure state | Seat availability = `bus.capacity − paid bookings − active holds`. Lock the Trip row (`SELECT ... FOR UPDATE`) before modifying seat inventory. |
| **Operator** | Buses, Routes, OperatorUsers, PickupAreas, FeeConfig | All data scoped by `operatorId`. The `withOperatorScope(operatorId)` helper ensures every query is tenant-isolated. |
| **Booking** | PaymentEvents, ConsentRecords, NotificationLogs | Status transitions governed by `LEGAL_BOOKING_TRANSITIONS` map — the single source of truth for what moves are legal. |
| **CharterRequest** | Lifecycle state, assignee, deadlines | Transitions governed by `LEGAL_CHARTER_TRANSITIONS` — all transitions run inside a locked `$transaction`. |

**Domain events (conceptual)** — when a payment webhook confirms a booking, a cascade of side effects fires. Although we don't use a formal event bus, the concept is the same:

```
Payment confirmed (webhook arrives)
  ├─→ Booking status: awaiting_payment → paid
  ├─→ Hold status: active → consumed
  ├─→ LedgerEntry: booking_credit + platform_fee (two rows)
  ├─→ NotificationLog: SMS + email enqueued (dispatched by cron)
  └─→ (later) PDF generation cron picks up the booking
```

These side effects are currently orchestrated procedurally inside `processPaymentWebhook()` and `applyPaidStatusTransition()`. A future event bus could decouple them — but at 200 bookings/day, procedural orchestration in one transaction is simpler, faster, and easier to debug.

---

## 7. API Design

### 7.1 REST + Webhooks

**REST** (Representational State Transfer) is the API style: each URL represents a resource, HTTP methods indicate the action.

| Method | Meaning | Example |
|--------|---------|---------|
| `GET` | Read | `GET /api/trips/search?from=hanoi&to=hcm` |
| `POST` | Create | `POST /api/holds` (create a seat hold) |
| `PATCH` | Update | `PATCH /api/op/buses/123` (edit a bus) |
| `DELETE` | Delete | `DELETE /api/op/trips/123` (cancel a trip) |

**Webhooks** are the reverse: instead of us calling the payment provider, the payment provider calls US when something happens (payment confirmed, refund processed). We expose a URL like `POST /api/payments/momo/webhook` that the provider hits.

### 7.2 Three API Realms

The API is segmented by who's calling:

| Realm | URL Prefix | Auth | Who |
|-------|-----------|------|-----|
| Customer | `/api/trips/`, `/api/holds/`, `/api/bookings/` | Guest (no auth) or customer JWT | Travelers |
| Operator | `/api/op/*` | Operator JWT (tenant-scoped) | Bus company staff |
| Admin | `/api/admin/*` | Admin JWT + TOTP step-up | Platform admins |
| Webhooks | `/api/payments/*/webhook` | HMAC signature (no JWT) | Payment providers |
| Cron | `/api/cron/*` | Internal secret/bearer | Scheduled jobs |

### 7.3 Thin Route Handlers

Route handlers (the code at each URL) are **thin** — they parse the request, call a domain function, and format the response. All business logic lives in `lib/<domain>/`.

```
POST /api/holds
  → parse request body (tripId, seatCount, buyerPhone)
  → call lib/booking/createHold(tripId, seatCount, buyerPhone)
  → return { holdId, expiresAt } or error
```

**Why?** The domain function is testable without HTTP. Multiple consumers (API route, cron job, admin action) can call the same function.

### 7.4 Pagination — Cursor-based

**Offset pagination** (`?page=5&limit=20`) breaks when data changes between pages (items shift, duplicates appear).

**Cursor pagination** (`?cursor=clx4a2b3c&limit=20`) uses the last item's ID as the starting point for the next page. Stable even when data changes.

```
GET /api/op/bookings?cursor=clx4a2b3c&limit=20
→ returns { items: [...], nextCursor: "clx7d8e9f" }
```

### 7.5 Error Format

Consistent error shape across all endpoints:

```json
{
  "error": {
    "code": "plate_in_use",
    "message": "A bus with this plate number already exists",
    "status": 422
  }
}
```

Error codes are typed (a `TripErrorCode` union, a `BookingErrorCode` union) so clients can switch on them programmatically.

### 7.6 Concrete API Examples

The abstract patterns above are easier to understand with real request/response shapes from the codebase.

**POST /api/holds — Create a seat hold**

Request body (validated by Zod schema in `lib/core/validation/hold.ts`):
```json
{
  "tripId": "clx4a2b3c0000abcd1234efgh",
  "ticketCount": 2,
  "buyerName": "Nguyễn Văn A",
  "buyerPhone": "0912345678",
  "buyerEmail": "a@example.com",
  "pickupKind": "station"
}
```

Validation rules:
- `tripId`: must be a valid CUID
- `ticketCount`: integer, 1–10
- `buyerName`: 4–100 chars, Unicode letters/spaces/apostrophes/hyphens (`/^[\p{L}\p{M}\s'.-]+$/u`)
- `buyerPhone`: Vietnamese mobile format (`/^(0|\+84)[35789][0-9]{8}$/`)
- `buyerEmail`: valid email, trimmed + lowercased, max 254 chars
- `pickupKind`: `"station"` | `"point"` | `"custom"`, defaults to `"station"`

Success (200):
```json
{ "holdId": "clx...", "expiresAt": "2026-07-01T10:15:00.000Z" }
```
+ `Set-Cookie: bb_hold=<HMAC-signed holdId>` (used to verify ownership at booking initiation)

Errors: `409 SOLD_OUT` | `429 HOLD_CAP_EXCEEDED` (max 5 concurrent holds per phone) | `429 TOO_MANY_REQUESTS`

---

**POST /api/bookings/initiate — Initiate online payment**

Request body (validated inline in `app/api/bookings/initiate/route.ts`):
```json
{
  "holdId": "clx...",
  "paymentMethod": "momo",
  "consents": {
    "noRefund": true,
    "piiStorage": true,
    "version": "2026-06-01"
  }
}
```

- `paymentMethod`: `"momo"` | `"zalopay"` | `"card"` (no cash — removed in Issue 039)
- `consents.noRefund` and `consents.piiStorage`: must both be `true`
- `consents.version`: must match server's `CONSENT_VERSION` (blocks stale clients showing old policy text)
- Requires `bb_hold` cookie matching `holdId` (prevents hold hijacking)
- Rate-limited by client IP

Success (200):
```json
{ "bookingId": "550e8400-e29b-41d4-a716-446655440000", "payUrl": "https://momo.vn/pay/..." }
```

Errors: `403 FORBIDDEN` (cookie mismatch) | `409 HOLD_EXPIRED` / `TRIP_DEPARTED` / `OPERATOR_NOT_BOOKABLE` | `422 consent_required` | `429 TOO_MANY_REQUESTS` | `502 GATEWAY_ERROR` (PSP call failed — compensating transaction deletes booking, reverts hold)

---

**POST /api/payments/momo/webhook — MoMo IPN callback**

Request: Raw JSON body from MoMo. Authenticated via HMAC-SHA256 signature (not JWT — webhooks don't carry user sessions).

The adapter translates MoMo's proprietary format into a canonical event:
```json
{
  "orderRef": "BB-2026-a3x7-k9m2",
  "providerTxnId": "momo_txn_123456",
  "amount": 450000,
  "currency": "VND",
  "status": "paid"
}
```

Always returns `200 OK` — even for unknown booking refs (prevents enumeration) or duplicate webhooks (idempotent via `providerTxnId` unique constraint).

---

**POST /api/admin/auth/login — Admin login**

Request body (validated by Zod):
```json
{
  "email": "admin@busbooking.vn",
  "password": "..."
}
```

Success (200):
```json
{ "role": "SUPER_ADMIN", "totpDisabled": false }
```
+ `Set-Cookie: bb_admin_access` (HttpOnly, Secure, SameSite=strict, 600s)
+ `Set-Cookie: bb_admin_refresh` (HttpOnly, Secure, SameSite=strict, 30 days)

Tokens are NEVER in the response body — cookies only.

Error (401): `{ "error": "INVALID_CREDENTIALS" }` — uniform message, no email/password distinction (prevents enumeration).
Error (429): `{ "error": "RATE_LIMITED" }` + `Retry-After` header.

After login: `totpVerified = false` in the JWT. The admin must complete TOTP verification (`POST /api/admin/auth/totp/verify`) before accessing protected routes. Finance and approval routes additionally require step-up re-auth (`POST /api/admin/auth/step-up`).

---

## 8. Identity & Access Control

### 8.1 Three Auth Realms — Why Separate?

Each user group has a different trust level and attack surface:

| Realm | Login Method | Session | Why Different |
|-------|-------------|---------|---------------|
| **Customer** | Phone + OTP (paused; guest-only now) | Short JWT | Low trust; high volume; guest allowed |
| **Operator** | Username + password | JWT + refresh cookie | Medium trust; tenant-scoped; staff roles |
| **Admin** | Email + password + TOTP (mandatory) | Short JWT + step-up | High trust; high privilege; invite-only |

They use **separate database tables, separate cookie scopes, and separate middleware chains**. An operator credential cannot log into admin. A customer credential cannot access operator data.

### 8.2 JWT — JSON Web Token

**What it is**: A JWT is a small, signed data packet that proves who you are. The server creates it at login and the client sends it with every request. The server verifies the signature without hitting the database.

**Structure**: `header.payload.signature`
- **Header**: Algorithm used (HS256)
- **Payload** (claims): `{ userId, operatorId, role, requiresPasswordChange, exp }` — what the server needs to authorize the request
- **Signature**: HMAC hash proving the server issued it and nobody tampered with it

**Why JWT over sessions?**
- **Stateless**: No server-side session store to manage. Any server instance can verify the token.
- **Edge-safe**: Vercel Edge middleware can read JWT claims without a database query (critical — Edge runtime can't use Prisma/PostgreSQL).

**Token lifecycle**:
1. User logs in → server issues an **access token** (15-min TTL) + **refresh token** (7-day TTL, stored as HttpOnly cookie + hashed in DB)
2. Client sends access token with every request
3. Access token expires → client uses refresh token to get a new access token
4. Refresh token rotation: each use issues a new refresh token and invalidates the old one (reuse detection → revoke all sessions)

> **Trade-off**: A single `JWT_SECRET` signs all tokens across all three realms. Simpler than per-realm key management, but rotating the key invalidates ALL active sessions (customer + operator + admin simultaneously). Mitigation: access token TTL is short (15 min for customer/operator, 10 min for admin), so natural expiry handles most rotation lag. Stage 1 improvement: per-realm signing keys.

### 8.3 RBAC — Role-Based Access Control

**What it is**: Each user has a role, and each role has permissions. The system checks "does this user's role allow this action?" rather than "is this specific user allowed?"

**Operator roles**:
- `admin` — full access to operator console (fleet, trips, bookings, money, settings, staff management)
- `staff` — limited access (bookings, manifest, check-in; no money, no fleet edits)

**Admin roles**:
- `super_admin` — everything including admin account management, system config
- `finance` — finance tab only (payouts, ledger, refunds, disputes)
- `support` — user management, moderation; no finance

### 8.4 Tenant Isolation

**What it is**: Ensuring Operator A can never see, modify, or affect Operator B's data. Every row belonging to an operator has an `operatorId` column, and every query includes `WHERE operatorId = ?`.

**How it's enforced**: A `withOperatorScope(operatorId)` helper wraps every operator-realm database query, automatically injecting the tenant filter. Developers never write unscoped queries by hand.

**Defense in depth**:
1. JWT carries `operatorId` claim (can't be changed by the client)
2. Middleware extracts `operatorId` from JWT
3. Every DB query uses the tenant-scope helper
4. Integration tests verify cross-tenant queries return empty results

### 8.5 Edge Middleware Auth

**The problem**: Next.js middleware runs on the **Edge Runtime** (a lightweight JavaScript environment at the CDN edge). Edge Runtime cannot use Node.js APIs like `crypto` (for password hashing) or database drivers (Prisma/pg). So auth checks in middleware can't query the database.

**The solution**: Encode all gate state into the JWT claim itself. Middleware reads the claim with `jose.jwtVerify()` (Edge-safe).

Example: The `requiresPasswordChange` flag is a JWT claim, not a DB lookup. When an operator changes their password, the server mints a fresh token with `requiresPasswordChange: false`.

---

## 9. Payment System

### 9.1 Central Collection Model

All customer payments land in **one platform bank account**. The platform then pays out operators' share minus the platform fee.

**Why?**
- The platform only needs to monitor ONE account for incoming payments (not 100+ operator accounts).
- Confirmation is instant — "did money arrive in our account?" vs "did money arrive in some operator's account that we can't read?"
- The platform controls payout timing (settlement delay for dispute buffer).

```
Customer pays ──→ Platform Account ──→ (minus platform fee) ──→ Operator Bank Account
                   ▲                                              (payout)
                   │
            Single account to monitor
```

> **Trade-off**: Central collection means the platform holds ALL customer money before paying operators. This creates regulatory liability (payment license requirements in Vietnam), makes the platform bank account a high-value target, and means an account freeze halts ALL operator payouts. The alternative — direct-to-operator payments — eliminates these risks but makes payment confirmation impossible (we can't see inside 100+ operator bank accounts). At our scale, the operational simplicity of one account to monitor wins.

### 9.2 PSP — Payment Service Provider

**What it is**: A PSP is a company that handles the actual money movement. Instead of integrating with every bank individually, you integrate with one PSP that connects to all of them.

**Vietnam-specific PSPs**:
- **VNPay / PayOS**: VietQR bank transfers, domestic cards
- **MoMo**: Vietnam's largest e-wallet
- **Stripe**: International cards (Visa, Mastercard, PayPal)

**Adapter pattern**: Each PSP has different APIs, webhook formats, and authentication. We write a thin adapter per PSP that translates their specific format into our canonical (standard) event format:

```
MoMo webhook → MoMo adapter → Canonical Event { orderRef, providerTxnId, amount, currency, status }
VNPay webhook → VNPay adapter → Canonical Event { orderRef, providerTxnId, amount, currency, status }
```

The booking logic only knows about canonical events — it never touches PSP-specific code.

### 9.3 Async Payment Flow

**The core problem**: The user clicks "Pay" and is done in 3 seconds. The bank confirms in 30 seconds to 2 minutes. You can't make the user wait.

**Solution**: Asynchronous confirmation via webhook.

```
Timeline:
─────────────────────────────────────────────────────

0s   User clicks "Pay with MoMo"
     → Server creates Payment(status=pending) in DB
     → Server returns MoMo redirect URL to browser
     → User redirected to MoMo app

3s   User authorizes payment in MoMo
     → User redirected back to our "waiting" page
     → Page shows "Payment processing..." with a spinner

30s  MoMo sends webhook POST to /api/payments/momo/webhook
     → Server verifies HMAC signature
     → Adapter translates to canonical event
     → Core: match by orderRef, verify amount, check idempotency
     → Booking status: awaiting_payment → paid
     → Enqueue: send SMS + generate PDF + email

31s  User's "waiting" page polls or receives SSE → shows "Paid! ✓"
```

**Key rules**:
- The server-side webhook is the **single source of truth**. Never trust the client redirect URL (a user could fake `?status=success`).
- The client redirect is just UX — it tells the user "we're checking" and starts polling.

### 9.3.1 Payment Flow — Sequence Diagram

This shows all four actors and the exact sequence of calls:

```
 Browser              Server                    PSP (MoMo)           PostgreSQL
    │                    │                          │                     │
    │ POST /api/bookings/│                          │                     │
    │ initiate           │                          │                     │
    │───────────────────>│                          │                     │
    │                    │ SELECT Hold FOR UPDATE    │                     │
    │                    │─────────────────────────────────────────────────>│
    │                    │<────────────────────────────────────────────────│
    │                    │ INSERT Booking            │                     │
    │                    │ (awaiting_payment)        │                     │
    │                    │─────────────────────────────────────────────────>│
    │                    │<────────────────────────────────────────────────│
    │                    │                          │                     │
    │                    │ createPayment(orderId,   │                     │
    │                    │   amount, ipnUrl)        │                     │
    │                    │────────────────────────>│                     │
    │                    │<───────────────────────│ { payUrl }           │
    │                    │                          │                     │
    │<───────────────────│ { bookingId, payUrl }    │                     │
    │                    │                          │                     │
    │ redirect to payUrl ──────────────────────────>│                     │
    │ (user pays in app)                            │                     │
    │<─────────────────────────────────────────────│ redirect back       │
    │ (shows spinner)    │                          │                     │
    │                    │                          │                     │
    │                    │ POST /api/payments/      │                     │
    │                    │ momo/webhook (IPN)       │                     │
    │                    │<────────────────────────│                     │
    │                    │ verify HMAC signature    │                     │
    │                    │ $transaction {           │                     │
    │                    │   INSERT PaymentEvent    │                     │
    │                    │   UPDATE Booking → paid  │                     │
    │                    │   UPDATE Hold → consumed │                     │
    │                    │   INSERT LedgerEntry ×2  │                     │
    │                    │ }                        │                     │
    │                    │─────────────────────────────────────────────────>│ COMMIT
    │                    │                          │                     │
    │                    │──→ 200 OK ──────────────>│                     │
    │                    │                          │                     │
    │                    │ after(): enqueue SMS +   │                     │
    │                    │ PDF generation jobs      │                     │
    │                    │                          │                     │
    │ (polls or SSE)     │                          │                     │
    │<───────────────────│ "Booking confirmed!"     │                     │
```

The critical insight: everything between `$transaction {` and `COMMIT` is atomic. If any step fails, the entire transaction rolls back — no partial state (booking paid but hold still active, or ledger entries without a booking).

### 9.4 Idempotency

**What it is**: An operation is idempotent if doing it twice produces the same result as doing it once. This is critical because payment providers often send the same webhook multiple times (retries, network glitches).

**How we enforce it**:
- Each payment provider includes a unique `providerTxnId` (transaction ID) in the webhook.
- On first webhook: process normally, store `providerTxnId` in the Payment record.
- On duplicate webhook: check `providerTxnId` exists → already processed → return 200 OK (no-op).

Without idempotency: a retried webhook could credit the operator twice, or send two confirmation SMSes.

### 9.5 Monotonic State Transitions

**What it is**: The payment/booking state machine can only move forward, never backward. `pending → paid` is allowed. `paid → pending` is rejected.

**Why?** Payment webhooks can arrive out of order:
1. PSP sends `status=paid` (webhook A)
2. Network delays webhook A
3. PSP retries with `status=paid` (webhook B)
4. PSP also sends a status query with `status=pending` (webhook C — stale)
5. Webhook C arrives first, then A, then B

Without monotonic enforcement, webhook C would revert a paid booking back to pending. With it, C is silently ignored because `paid → pending` is a backward transition.

### 9.5.1 State Machine Diagrams

**Booking status** (source: `lib/booking/transitions.ts` → `LEGAL_BOOKING_TRANSITIONS`):

```
                            ┌──→ completed           (terminal)
                            │
  awaiting_payment ──→ paid ┼──→ trip_cancelled      (terminal, refund issued)
         │                  │
         │                  ├──→ no_show             (terminal)
         │                  │
         │                  └──→ refunded            (terminal, oversold-race)
         │
         └──→ payment_failed_expired                 (terminal)

  Also terminal: cancelled
```

| Transition | Guard | Side effects |
|-----------|-------|-------------|
| awaiting_payment → paid | Webhook confirms: amount ≥ totalVnd, currency = VND | LedgerEntry ×2 (booking_credit + platform_fee), Hold → consumed, NotificationLog ×2 (SMS + email) |
| awaiting_payment → payment_failed_expired | PSP_WINDOW (20 min) elapsed without webhook | Seats released (hold already expired by sweeper) |
| paid → trip_cancelled | Operator cancels trip | refund_debit + refund_out ledger entries, customer notified |
| paid → no_show | Operator marks after departure | Sets `noShowAt` timestamp |
| paid → refunded | Oversold race: paid but seats gone | Immediate refund-out in same transaction (Issue 100) |

**Hold status** (enum `HoldStatus` — `prisma/schema.prisma`):

```
  active ──┬──→ consumed        (booking created from this hold)
           │
           ├──→ expired         (TTL elapsed — sweeper cron every 1 min)
           │
           └──→ cancelled_trip  (operator cancelled the trip)
```

| Transition | Guard | Key detail |
|-----------|-------|-----------|
| active → consumed | Inside the SAME `$transaction` + `FOR UPDATE` as the Booking INSERT | If transaction aborts, hold stays active — seats not lost |
| active → expired | `hold.expiresAt < NOW()` | Sweeper runs every minute; read-time check as belt-and-suspenders |
| active → cancelled_trip | `cancelTrip()` cascades | All active holds on the cancelled trip are released |

### 9.6 Reconciliation Sweeper

**What it is**: A background job that runs periodically (every 5 minutes) to catch payments that fell through the cracks — webhooks that were lost, network timeouts, etc.

**How it works**:
1. Query all `Payment(status=pending, createdAt < 15 minutes ago)`
2. For each, call the PSP's status-check API
3. If PSP says paid → process as if the webhook arrived
4. If PSP says failed/expired → expire the payment and release the held seats

This is the safety net. The webhook is the fast path; the sweeper catches everything the webhook misses.

### 9.7 VietQR Bank Transfer — Memo Matching

**VietQR** is Vietnam's QR-code-based bank transfer standard. The customer scans a QR code with their banking app, which pre-fills the transfer details including a **memo** (transfer note) containing the booking reference.

**The fragility**: Vietnamese banks sometimes truncate, strip, or garble the memo field. If the memo is lost, we can't match the transfer to the booking by reference.

**Degraded match** (fallback): When memo is missing or garbled, the reconciliation sweeper matches by:
- Correct amount (exact VND match)
- Correct receiving account (our platform account)
- Within a time window (±30 minutes of booking creation)

If exactly one pending booking matches all three criteria → match it. If ambiguous → flag for manual review.

---

## 10. Money Correctness & Ledger

### 10.1 Append-Only Double-Entry Ledger

**What it is**: Every money event creates a new ledger entry — a row that records what happened, how much, and why. Entries are **never edited or deleted** (append-only). The balance is always computed by summing all entries (`SUM(amount)`), never stored as a mutable number.

**Why append-only?**
- An edited ledger entry destroys the audit trail. If someone changes `-500000` to `-50000`, there's no evidence.
- Append-only means every state is reconstructable — you can replay the ledger from entry #1 to derive the current balance.
- Enforced at the **database level**: the application role has `INSERT` permission on the ledger table but NOT `UPDATE` or `DELETE`. Even a bug in the application code can't corrupt history.

**Entry types**:

| Type | Direction | When | Example |
|------|-----------|------|---------|
| `booking_credit` | + (credit) | Customer pays for a trip | +450,000₫ |
| `platform_fee` | − (debit) | Platform takes its cut | −27,000₫ (6% of 450,000₫) |
| `refund_debit` | − (debit) | Operator cancels trip → clawback | −450,000₫ |
| `refund_out` | − (debit) | Money sent back to customer | −450,000₫ |
| `payout_debit` | − (debit) | Operator withdraws earnings | −423,000₫ |
| `payout_reversal` | + (credit) | Payout failed, money returned | +423,000₫ |
| `chargeback` | − (debit) | Bank dispute (card/PayPal) | −450,000₫ |
| `adjustment` | ± | Manual admin correction (with reason) | ±any |

### 10.2 BigInt — Why Integer Math for Money

**The problem with floating-point numbers**:

```javascript
0.1 + 0.2 = 0.30000000000000004  // NOT 0.3
```

Computers represent decimal numbers in binary, and many decimals (like 0.1) have infinite binary representations — so they're rounded. Over many transactions, these tiny errors accumulate.

**The solution**: Store all money as **integer minor units**. VND has no decimal places (no cents), so 450,000₫ is stored as the integer `450000`. All arithmetic is integer addition/subtraction — no floating point, no rounding errors.

**BigInt**: JavaScript's `Number` type is a 64-bit float that can only safely represent integers up to 2^53 (~9 quadrillion). That sounds large, but fee calculations involve multiplication: `450000 * 0.06 = 27000` — except with `Number`, `450000 * 0.06` might not equal exactly `27000` due to floating-point drift.

**BigInt** is JavaScript's arbitrary-precision integer type. It can represent integers of any size with zero rounding. We do ALL money math in BigInt:

```javascript
// Wrong (floating-point drift)
const fee = gross * 0.06;

// Correct (BigInt — exact)
const fee = (BigInt(gross) * BigInt(6)) / BigInt(100);
```

**ES2017 constraint**: Our build target doesn't support `6n` literal syntax. We use `BigInt(6)` constructor calls everywhere.

### 10.3 Platform Fee — FeeConfig

The platform takes a percentage of each booking as revenue. This rate is:
- **Not hard-coded** — stored in a `FeeConfig` database table
- **Per-operator overridable** — a new operator might get a lower rate as an incentive
- **Effective-dated** — rate changes apply from a specific date, not retroactively
- **Change-audited** — every rate change logged (who changed it, when, from what to what)

Rate is read at **credit time** (when the booking_credit ledger entry is created) and recorded on that entry — so even if the rate changes later, historical entries show the rate that was actually applied.

### 10.4 Balance States

Money flows through three states:

```
PENDING ─────────→ AVAILABLE ─────────→ PAID OUT
(trip not yet       (trip completed      (operator withdrew
 completed)          + T+1 settlement     to bank account)
                     delay passed)
```

- **Pending**: Customer paid, money credited to operator's ledger, but the trip hasn't happened yet. If the operator cancels the trip, this money gets clawed back (refund_debit).
- **Available**: Trip completed + 1 business day has passed (the T+1 settlement delay — a buffer for chargebacks/disputes). Operator can now withdraw.
- **Paid out**: Operator requested payout and money was sent to their bank account.

### 10.5 Settlement Delay — T+1

**T+1** means "Trip completion date plus 1 business day." Money becomes available for withdrawal 1 day after the trip is completed (marked as `status: completed` by the operator).

**Why the delay?**
- Chargebacks from credit card companies can arrive hours after payment
- Gives time for customer complaints (wrong bus, didn't depart) before the operator withdraws
- Standard practice in marketplace platforms (Uber, Airbnb all have settlement delays)

### 10.6 Chargeback Handling

**What is a chargeback?** When a customer disputes a credit card or PayPal charge with their bank. The bank forcibly reverses the payment — money leaves the platform account whether we agree or not.

**The dangerous scenario**: Customer pays → operator trip completes → operator withdraws earnings → chargeback arrives → money is already gone.

**How we handle it**:
1. `chargeback` ledger entry debits the operator's balance
2. If operator still has balance → covered
3. If operator's balance is insufficient → `payout_reversal` clawback + platform bad-debt backstop (platform absorbs the loss temporarily, recovers from operator later)

---

## 11. Concurrency & Race Conditions

### 11.1 What is a Race Condition?

A race condition occurs when two operations happen at nearly the same time and interfere with each other because neither sees the other's changes. Classic example: two people buying the last seat simultaneously.

### 11.2 SELECT ... FOR UPDATE — Database Row Locking

**What it is**: A PostgreSQL command that reads a row AND locks it in one step. Any other transaction trying to read/update the same row must wait until the lock is released.

```sql
BEGIN;
  -- Lock the trip row — no one else can modify it until we COMMIT
  SELECT * FROM "Trip" WHERE id = 'trip123' FOR UPDATE;

  -- Now safely read available seats (no one can change them while we hold the lock)
  -- available = capacity - paid - held = 40 - 39 - 0 = 1

  -- Create the booking (consuming the last seat)
  INSERT INTO "Booking" ...;
COMMIT;  -- Lock released
```

If two buyers execute simultaneously:
1. Buyer A acquires the lock, sees 1 seat available, books it
2. Buyer B waits for the lock, then acquires it, sees 0 seats available, gets a clean rejection

**No oversell.** The lock serializes concurrent access.

### 11.3 Critical Race Conditions and Their Solutions

| Race | Scenario | Solution |
|------|----------|----------|
| **Last-seat oversell** | Two buyers, one seat, same instant | `SELECT ... FOR UPDATE` on Trip row inside `$transaction` |
| **Double-withdraw** | Operator clicks "Withdraw" twice fast | `$transaction` + `FOR UPDATE` on balance gate + idempotent payout key |
| **Capacity reduction below sold** | Operator reduces bus capacity while someone is booking | TOCTOU guard: read bookings + update bus inside same `$transaction` with `FOR UPDATE` |
| **Charter double-claim** | Two operators accept same charter request | `UPDATE ... WHERE status='published' AND assigneeOperatorId IS NULL` — atomic conditional; loser gets 409 |
| **Check-in double-scan** | Two staff scan same ticket QR simultaneously | `UPDATE ... SET checkedInAt = NOW() WHERE id = ? AND checkedInAt IS NULL` — rowcount 0 = already scanned |
| **Hold→Booking seat accounting** | Hold consumed but booking insert fails → seats disappear | Hold transitions `active → consumed` inside the SAME `FOR UPDATE` transaction as the booking insert. If transaction aborts, hold stays active. |

### 11.4 TOCTOU — Time-of-Check to Time-of-Use

**What it is**: A class of bug where you CHECK a condition (e.g., "are there enough seats?") and then USE the result (e.g., "create the booking"), but between the CHECK and USE, someone else changed the state.

```
Buyer A: CHECK (1 seat available) ─────────────────── USE (book 1 seat) ✓
Buyer B:            CHECK (1 seat available) ── USE (book 1 seat) ✓  ← OVERSOLD!
```

**Fix**: The CHECK and USE must happen inside a single locked transaction:

```
Buyer A: [LOCK + CHECK + USE → COMMIT]
Buyer B:                          [LOCK + CHECK (0 seats) → REJECT]
```

### 11.5 Failure Modes & Degradation

Designing for the happy path is easy. The real skill is designing for failure.

| Component Down | Impact | Cascades? | Degradation Strategy |
|---------------|--------|-----------|---------------------|
| **PostgreSQL** | Everything stops — search, booking, payment confirmation, operator console | YES — total | No graceful degradation possible at this architecture tier. Mitigation: managed DB with auto-failover (Neon/Supabase), automated daily backups, point-in-time recovery, health check at `/api/health` returns 503. |
| **Redis** | Rate limiting disabled, OTP storage unavailable, hold countdown timer UX breaks | Partial | Search and booking still work (seat truth is in PostgreSQL, not Redis). Rate limits fail-open (allow requests through — better than blocking all users). OTP login blocked until Redis recovers. |
| **S3** | PDF ticket downloads fail, KYB document uploads fail | NO — isolated | Booking flow is completely unaffected (PDF generation is async background job). Customer still receives SMS confirmation with booking ref. PDFs retry when S3 recovers. |
| **PSP (MoMo/VNPay)** | Payments can't be initiated for that rail | Partial | Other enabled PSP rails still work. If webhook was lost but payment succeeded on PSP side, the reconciliation sweeper (every 15 min) catches it by polling the PSP's status API. Booking stays `awaiting_payment` until resolved. |
| **SMS provider (eSMS)** | Booking confirmations not delivered | NO — isolated | Booking is still `paid` — notification status is decoupled from booking state (Section 15.2). Customer can check status via booking ref URL. `NotificationLog` rows queue as `failed`, retry with exponential backoff (up to 5 attempts). |
| **Vercel Edge** | Rate limiting and auth checks at CDN edge fail | Rare | Vercel edge has 99.99% SLA. Server-side rate limiting in each route handler provides belt-and-suspenders defense. |

**Key design principle**: The booking→payment→ledger critical path depends ONLY on PostgreSQL. Every other dependency (Redis, S3, SMS, email) is either on the async path or has a fail-open/retry fallback.

**Which failures cascade?**
```
PostgreSQL down  → EVERYTHING blocked (single point of failure — acceptable at this scale)
Redis down       → rate limits + OTP broken, but booking/payment works
S3 down          → PDF downloads only (async, retried by cron)
PSP down         → that rail's payments only; reconciler catches stragglers
SMS down         → notification queue grows; dispatches when provider recovers
```

> **Trade-off**: PostgreSQL is a single point of failure. We accept this because (a) managed providers offer 99.95%+ uptime with auto-failover, (b) the cost of multi-master replication isn't justified at 200 bookings/day, and (c) a 30-minute DB outage at this scale affects ~4 bookings — painful but not catastrophic.

---

## 12. Search & Discovery

### 12.1 SQL-Based Search — Why Not Elasticsearch?

**Elasticsearch** is a dedicated search engine built for full-text search, faceted filtering, and high-volume queries across huge datasets.

**Why we don't need it (yet)**:
- ~500 active trips at any time. SQL query with proper indexes: < 10ms.
- Our search is structured (origin, destination, date, price range) not full-text ("find trips mentioning scenic route").
- Adding Elasticsearch means another server to maintain, data sync to manage, and a consistency lag between the database (source of truth) and the search index.

**When we'd add it**: If trip volume exceeds ~50,000 active trips AND SQL queries consistently exceed 200ms despite index tuning.

### 12.2 The Search Query

The core search answers: "Show me trips from A to B on date D with N seats available."

**What gets excluded** (in the SQL `WHERE` clause):
- Cancelled trips
- Sales-closed trips
- Trips on buses currently in maintenance
- Trips from non-approved operators
- Trips where `available seats < requested ticket count`

**Available seats computation**:
```
available = capacity − paidSeats − activeHeldSeats
```
This is computed set-based (one query with subquery/join), not per-row in a loop (which would be N+1).

### 12.3 Place Entity — Canonical Names

**The problem**: An operator creates a route "Ha Noi → HCM". Another creates "Hanoi → Ho Chi Minh City". A customer searches "Hà Nội → Hồ Chí Minh". Three different strings for the same cities — search finds nothing.

**The solution**: A `Place` table with canonical names and aliases:
```
Place { id: "hanoi", canonicalName: "Hà Nội", aliases: ["Ha Noi", "Hanoi", "HN"] }
Place { id: "hcm", canonicalName: "TP. Hồ Chí Minh", aliases: ["HCM", "Ho Chi Minh", "Saigon"] }
```

Routes reference `originPlaceId` and `destPlaceId` (not free text). Typeahead searches Place names and aliases. No fragmentation.

### 12.4 Facets

**What they are**: Summary counts shown alongside search results. "Showing 15 trips. Filter by: Hoàng Long (8) · Phương Trang (7) | Sleeper (10) · Seated (5)".

Facets are computed from the **unfiltered** base result set (all trips matching origin/destination/date), not from the already-filtered set. This way, selecting a filter shows how many results other filters would yield.

---

## 13. Booking & Hold Flow

### 13.1 Why Holds Exist

Between "I want this trip" and "I've paid", time passes (entering buyer info, choosing payment method, completing payment). Without holds, someone else could buy the seats while you're filling in the form.

A **hold** temporarily reserves seats for a specific buyer. It has a TTL (Time-To-Live — a countdown timer) after which the seats are automatically released.

### 13.2 The Full Booking Flow

```
1. Customer picks a trip (2 seats)
   │
2. POST /api/holds → creates Hold(tripId, seatCount=2, expiresAt=now+15min, status=active)
   │                  Available seats: capacity - paid - held (including this new hold)
   │                  Returns: holdId + expiresAt
   │
3. Customer enters buyer info (name, phone, email)
   │
4. /booking/review page shows: trip details + price + buyer info + countdown timer
   │                           Timer reads from Redis (UX) but truth is DB Hold.expiresAt
   │
5. Customer clicks "Pay" → POST /api/bookings/initiate
   │  Server: verify hold still active + extend if needed → create Payment(pending) → return PSP URL
   │
6. Customer redirected to PSP (MoMo/VNPay/etc.)
   │
7. Customer completes payment in PSP
   │
8. PSP sends webhook → POST /api/payments/momo/webhook
   │  Server (inside one transaction):
   │    - Verify HMAC signature
   │    - Match by orderRef, verify amount
   │    - Idempotency check (providerTxnId)
   │    - SELECT ... FOR UPDATE on Trip row
   │    - Create Booking(status=paid, seatCount=2)
   │    - Transition Hold(status=active → consumed)  ← same transaction!
   │    - Create LedgerEntry(booking_credit) + LedgerEntry(platform_fee)
   │    - COMMIT
   │
9. Enqueue async: send SMS confirmation + generate PDF ticket + send email
   │
10. Customer sees "Booking confirmed! Ref: BB-2026-a3x7-k9m2"
```

### 13.3 Hold TTL vs Payment Timing

The hold must outlast the payment process. If the hold expires while the customer is mid-payment, the seats get released and sold to someone else — then the first customer's payment confirms for seats that no longer exist.

| Duration | Event |
|----------|-------|
| 0:00 | Hold created (15-minute TTL) |
| 2:00 | Customer enters buyer info |
| 4:00 | Customer clicks "Pay" → hold validated + extended if < 5 min remaining |
| 4:30 | Redirected to MoMo |
| 5:00 | Customer authorizes in MoMo |
| 6:00 | MoMo webhook arrives → booking created, hold consumed |

**Safety net**: If the hold genuinely expires before payment confirms → on webhook-paid, check if seats are still free. If yes → honor the booking. If no (someone else booked) → **refund-out** to the customer (rare but possible).

### 13.4 Inventory DoS Protection

**The attack**: A malicious actor creates holds on every seat of a popular trip, waits 15 minutes (hold expires), repeats. The trip appears "fully booked" to real customers even though no one is paying.

**Defense**: Per-IP and per-customer concurrent hold cap. One IP address can hold seats on at most N trips simultaneously. Exceeding the cap → 429 Too Many Requests.

### 13.5 Hold Expiry Sweeper

A background job (cron, every 1-2 minutes) finds all holds where `expiresAt < NOW() AND status = active` and transitions them to `status = expired`. This releases the seats for other buyers.

The sweeper is idempotent — running it twice has no effect on already-expired holds. And at read time, expired holds are also treated as free (belt AND suspenders).

### 13.6 Trip Lifecycle State Machine

**Trip status** (enum `TripStatus` — `prisma/schema.prisma`):

```
  scheduled ──┬──→ departed ──→ completed
              │
              └──→ cancelled
```

| Transition | Trigger | Guard | Side effects |
|-----------|---------|-------|-------------|
| scheduled → departed | `markDeparted()` or operator UI | `departureAt` check | Sets `departedAt`, `salesClosed=true`; no new holds/bookings |
| departed → completed | `markCompleted()` or `autoCompleteTrips` cron | Must be `departed` | Sets `completedAt`; creates Payout row with `scheduledAt = completedAt + 1 day` (T+1) |
| scheduled/departed → cancelled | `cancelTrip()` | Not already cancelled | Cascades: bookings → `trip_cancelled` (refund issued), holds → `cancelled_trip`; idempotent (second cancel returns `{ alreadyCancelled: true }`) |

Note: `salesClosed` is a boolean independent of status — an operator can close sales on a scheduled trip without departing it.

### 13.7 Operator Approval State Machine

**Operator status** (source: `lib/onboarding/operatorStatus.ts` → `LEGAL_OPERATOR_TRANSITIONS`):

```
  PENDING_REVIEW ──→ UNDER_REVIEW ──┬──→ APPROVED ←──→ SUSPENDED
                                    │
                                    └──→ REJECTED ──→ PENDING_REVIEW
                                                       (resubmit)
```

| Transition | Who | Side effect |
|-----------|-----|------------|
| PENDING_REVIEW → UNDER_REVIEW | Admin | — |
| UNDER_REVIEW → APPROVED | Admin (step-up) | Clears `disabledAt`; creates operator login credentials |
| UNDER_REVIEW → REJECTED | Admin | Sets `rejectionReason`; operator can resubmit |
| REJECTED → PENDING_REVIEW | Operator | Resubmit with updated application |
| APPROVED → SUSPENDED | Admin | Sets `disabledAt`; trips hidden from search |
| SUSPENDED → APPROVED | Admin | Clears `disabledAt`; trips re-visible |

Each transition enqueues SMS + email notifications via `NotificationLog`.

### 13.8 Charter Request State Machine

**Charter status** (source: `lib/charter/charterStatus.ts` → `LEGAL_CHARTER_TRANSITIONS`):

```
  SUBMITTED ──→ ADMIN_REVIEW ──┬──→ ASSIGNED_DIRECT ──┬──→ ACCEPTED ──→ COMPLETED
              ↑                │                       │
              │                │                       └──→ DECLINED ──┐
              │                │                                       │
              │                ├──→ PUBLISHED ──┬──→ ACCEPTED          │
              │                │                │                      │
              │                │                └──→ EXPIRED ──────────┤
              │                │                                       │
              │                └──→ REJECTED                           │
              │                                                        │
              └────────────── (re-route from DECLINED / EXPIRED) ──────┘
```

**Customer-cancellable states**: `SUBMITTED`, `ADMIN_REVIEW`, `ASSIGNED_DIRECT`, `PUBLISHED` (defined in `CUSTOMER_CANCELLABLE_STATUSES`). Once an operator accepts, the customer can no longer cancel.

**Key guard**: `PUBLISHED → ACCEPTED` uses an atomic SQL UPDATE:
```sql
UPDATE "CharterRequest"
SET status = 'ACCEPTED', "assigneeOperatorId" = ?
WHERE id = ? AND status = 'PUBLISHED' AND "assigneeOperatorId" IS NULL;
```
If 0 rows affected → someone else claimed first → 409.

**Terminal states**: `REJECTED`, `COMPLETED`, `CANCELLED` — no further transitions.

---

## 14. Ticketing (QR / PDF)

### 14.1 Async PDF Generation

**The problem**: Generating a PDF is CPU-intensive (layout, fonts, rendering). Doing it inside the payment webhook handler would slow the response and risk a timeout — the PSP might not get a 200 OK, retries the webhook, and we process the payment twice.

**The solution**: The payment webhook handler does the critical work (booking + ledger) and returns 200 OK fast. PDF generation is enqueued as a background job:

```
Webhook received → [Create Booking + Ledger] → Return 200 OK → [Enqueue PDF job]
                   ^^^^^^^^^^^^^^^^^^^^^^^^                      ^^^^^^^^^^^^^^^^^
                   Synchronous (< 500ms)                         Asynchronous (takes 2-5s)
```

### 14.2 S3 — Simple Storage Service

**What it is**: S3 (originally Amazon's Simple Storage Service, but now a generic term) is cloud object storage — a service that stores files (objects) in buckets (containers). Think of it as a limitless hard drive in the cloud.

**Why S3 for tickets?**
- Scales infinitely (no "disk full" scenario)
- Durable (99.999999999% — "eleven nines" — data loss is essentially impossible)
- Supports **signed URLs** — temporary links that grant access for a limited time

**Signed URLs**: Instead of proxying the PDF through our server (server downloads from S3, then sends to client — slow and wasteful), we generate a temporary URL that lets the client download directly from S3:

```
Client → Server: "I need my ticket PDF"
Server → Client: "Here's a signed URL (valid for 1 hour): https://s3.../ticket-abc.pdf?signature=xyz&expires=..."
Client → S3: Downloads directly (server not involved)
```

### 14.3 QR Token — Signed Verification

The ticket QR code contains a signed token (like a mini-JWT) encoding the booking reference. When scanned:

1. QR reader opens a URL: `https://busbooking.vn/verify/BB-2026-a3x7-k9m2?token=eyJ...`
2. The public verify page looks up the booking in the database
3. Displays: booking ref, trip details, seats, PAID status, bus plate
4. No login required — anyone (operator, staff, customer) can verify

**The verify page is the source of truth** — it reads live data. The emailed PDF is a point-in-time snapshot that might go stale (e.g., if the bus is reassigned, the plate changes). That's why on bus reassignment, the PDF is regenerated and the customer is notified.

### 14.4 Check-in at Boarding

When the operator scans the QR at boarding:

```sql
UPDATE "Booking"
SET "checkedInAt" = NOW()
WHERE id = 'booking123'
  AND "checkedInAt" IS NULL;
-- Returns: 1 row affected = success (first scan)
-- Returns: 0 rows affected = already checked in (duplicate scan)
```

This is an **atomic conditional update** — if two staff members scan the same ticket at the exact same time, the database guarantees only one succeeds. The other gets "already checked in."

---

## 15. Notification System

### 15.1 The Outbox Pattern

**What it is**: Instead of sending an SMS/email immediately (which can fail and block the current operation), we write a "send this notification" record to a database table (`NotificationLog`). A separate background worker reads the table and does the actual sending.

```
Payment webhook → [Create Booking] → [Insert NotificationLog row] → Return 200 OK
                                              │
                                     (later, every 30s)
                                              │
                               Cron worker → Read pending notifications → Send via SMS/email
                                              │
                                     Update NotificationLog: status = sent / failed
```

**Why?**
- The payment webhook is never blocked by a slow/failed SMS provider
- Failed sends are retried automatically by the next cron run
- Every send attempt is logged (for debugging "customer says they didn't get the SMS")

### 15.2 Decoupled from Booking State

A critical design rule: **notification failure must NEVER affect booking state**. The booking is `paid` because the payment webhook confirmed it. If the SMS fails to send, the booking is still paid — the customer can retrieve their ticket via the booking reference.

If notification status were folded into booking state (e.g., `paid_and_notified`), an SMS outage would make bookings appear "not fully processed" — a false alarm that could trigger incorrect refunds or re-processing.

### 15.3 Channels and Templates

| Template | Channel | Trigger |
|----------|---------|---------|
| `booking_confirmed` | SMS + email (PDF attached) | Payment confirmed |
| `otp_code` | SMS | Customer requests OTP |
| `operator_credentials` | Email | Admin creates operator account |
| `trip_cancelled_refund` | SMS + email | Operator cancels trip with paid bookings |
| `bus_reassigned` | SMS | Bus changed on a trip with paid bookings |
| `charter_matched` | SMS + email | Charter request matched to an operator |
| `payout_scheduled` | Email | Payout queued for processing |

### 15.4 Scheduled Notifications — The scheduledFor Column

Some notifications are scheduled for the future (e.g., payout T+1 sweep). The cron worker queries:

```sql
SELECT * FROM "NotificationLog"
WHERE template = 'payout_scheduled'
  AND "scheduledFor" <= NOW()
  AND status = 'pending';
```

**Critical rule**: `scheduledFor` is a **top-level indexed column** on the table, with a composite index `@@index([template, scheduledFor])`. It is NEVER stored inside a JSON payload column — querying inside JSON requires parsing every row (no index help), which becomes a full table scan as the table grows.

### 15.5 Stub Provider Day-1

Real SMS (via eSMS) and email delivery is deferred to go-live. Day-1, the notification system writes to `NotificationLog` and logs the "send" — but the actual HTTP call to the SMS/email provider is a no-op stub. This lets the entire booking→notification pipeline work end-to-end in development without real SMS costs or provider credentials.

A feature flag (`NOTIFY_STUB`) controls this. Flip to `false` when real credentials are configured.

---

## 16. Background Jobs & Scheduling

### 16.1 Why Background Jobs?

Some operations are too slow, too unreliable, or too timing-sensitive to run inside a user request:

| Job | Why Background |
|-----|---------------|
| Hold expiry sweeper | Runs every 1-2 min, checks all expired holds |
| Payment reconciliation | Polls PSP for stuck-pending payments every 5 min |
| Notification dispatch | Retries failed SMS/email sends every 30s |
| Payout T+1 sweep | Moves money from PENDING → AVAILABLE daily |
| Recurring trip generation | Creates future trips from templates weekly |
| PDF render | CPU-intensive, 2-5s per ticket |

### 16.2 At-Least-Once + Idempotent

**"Exactly once" is a myth** in distributed systems. Network failures, process crashes, and cron double-fires mean a job might run twice. Instead:

- **At-least-once**: The system guarantees the job runs at least once (retry on failure).
- **Idempotent**: Running the job twice produces the same result as running it once (via unique keys, status checks, conditional updates).

Example: The notification dispatcher checks `status = 'pending'` before sending. If it runs twice, the second run sees `status = 'sent'` and skips.

### 16.3 Cron Overlap Lock

**The problem**: A cron job runs every 1 minute. One run takes 90 seconds (maybe the DB is slow). The next tick fires while the first is still running → two copies processing the same data → duplicate sends, double-credits, etc.

**The solution**: An advisory lock or sentinel row. Before processing, the job acquires a lock:
- `SELECT pg_advisory_lock(42)` — if another copy holds lock 42, wait
- Or `SELECT ... FOR UPDATE SKIP LOCKED` on a `CronRun` row — if locked, skip this tick entirely

### 16.4 Stage Evolution

```
Stage 0 (now):     DB job table + cron endpoints (/api/cron/*)
                   Simple, zero infrastructure, sufficient for years

Stage 1 (later):   BullMQ (Redis-backed queue) + dedicated worker process
                   Same lib/<domain> job handlers, new execution layer
                   Needed when: job latency matters or volume exceeds cron throughput

Stage 2 (if ever): Per-job-type workers with independent scaling
                   Needed when: PDF renders or notifications saturate one worker
```

---

## 17. File & Document Storage

### 17.1 What Gets Stored

| File Type | Source | Access Pattern |
|-----------|--------|---------------|
| Ticket PDFs | Generated by system after payment | Download by customer (signed URL) |
| KYB documents | Uploaded by operator during application | Reviewed by admin (signed URL) |
| Operator logos | Uploaded by operator | Public (CDN-cached) |

### 17.2 Upload Flow — Direct to S3

**The wrong way** (proxying through the server):
```
Client → Upload to Server → Server uploads to S3    ← slow, doubles bandwidth
```

**The right way** (signed upload):
```
1. Client → Server: "I want to upload a file"
2. Server → Client: "Here's a signed PUT URL (valid 5 min, max 10MB, must be PDF)"
3. Client → S3: Upload directly using the signed URL
4. Client → Server: "Upload complete, here's the S3 key"
5. Server stores the key in the database
```

The server never touches the file bytes. It only mints the permission (signed URL) and records the metadata.

### 17.3 Download Flow — Signed GET URLs

Same principle in reverse. The server generates a time-limited signed URL. The client downloads directly from S3/CDN. No byte-proxying.

### 17.4 Security

- Bucket is **private** — no public access. Every download requires a signed URL.
- Upload URLs are scoped: specific key, max size, content type, expiry time.
- KYB documents: access logged in audit trail (who viewed what, when).
- Optional: AV (antivirus) scan job on uploaded files.

---

## 18. Security

### 18.1 CSRF — Cross-Site Request Forgery

**What it is**: An attack where a malicious website tricks your browser into making requests to our site using your existing login session. Example: you're logged into the operator console, you visit a malicious site, and it silently submits a POST request to our API to create a trip — using your session cookies.

**How we prevent it** (Double-Submit Cookie pattern):
1. Server sets a `bb_csrf` cookie (readable by JavaScript, NOT HttpOnly)
2. Client reads this cookie and sends its value as an `X-CSRF-Token` header with every POST/PUT/DELETE
3. Server verifies: cookie value = header value

The malicious site can trigger the browser to send cookies (automatic), but it CANNOT read our cookies (same-origin policy) → it can't set the header → request rejected.

**Scope**: All non-safe (`POST/PUT/PATCH/DELETE`) requests to `/api/*` — customer, operator, AND admin. Webhook endpoints are exempt (they authenticate via HMAC, not cookies).

### 18.2 HMAC — Hash-based Message Authentication Code

**What it is**: A way for payment providers to prove that a webhook really came from them (not an attacker). Both sides share a secret key. The sender hashes the request body with the secret → attaches the hash as a header. The receiver hashes the same body with the same secret → compares. If they match, the message is authentic.

```
MoMo sends:  POST /api/payments/momo/webhook
             Body: { orderRef: "BB-2026-...", amount: 450000, ... }
             Header: X-MoMo-Signature: sha256(body + secret_key)

Our server:  Computes sha256(body + our_copy_of_secret_key)
             Compares with the header value
             Match → authentic. Mismatch → reject (401).
```

### 18.3 Rate Limiting

**What it is**: Capping how many requests a client can make in a time window. Prevents brute-force attacks, abuse, and accidental DoS.

| Endpoint | Limit | Why |
|----------|-------|-----|
| Search API | 30 req/min per IP | Prevent scraping |
| OTP send | 3 req/15 min per phone | Prevent SMS bombing |
| OTP verify | 5 attempts per code | Prevent brute-force guessing |
| Login | 5 req/15 min per username | Prevent credential stuffing |
| Hold creation | 3 concurrent per IP | Prevent inventory DoS |
| General API | 100 req/min per IP | Safety net |

Implemented via Redis counters with TTL expiry.

### 18.4 Tenant Isolation

Every operator-owned query is scoped by `operatorId`. A `withOperatorScope` helper ensures this automatically. Without it:

```sql
-- WRONG: returns ALL operators' trips
SELECT * FROM "Trip" WHERE status = 'scheduled';

-- RIGHT: returns only this operator's trips
SELECT * FROM "Trip" WHERE status = 'scheduled' AND "operatorId" = 'op123';
```

### 18.5 Input Validation

All user input is validated at the API boundary using Zod schemas (typed validation). This prevents:
- **SQL injection**: Prisma parameterizes queries automatically, but validation catches malformed data before it reaches the ORM
- **XSS** (Cross-Site Scripting): Server-rendered content is escaped by React; user input in URLs is validated
- **Command injection**: No shell commands are constructed from user input

### 18.6 Admin Hardened Door

The admin console has additional security layers:
- Separate credential store (not in customer/operator tables)
- Invite-only (no self-registration path exists)
- Mandatory TOTP (not optional)
- Step-up re-auth for privileged actions (re-enter TOTP before approving operators or processing payouts)
- Short session TTL (30 minutes)
- Exact-match path allowlist in middleware (not prefix-match — prevents `/admin-bypass` attacks)
- Audit log on every action

---

## 19. Compliance & Data Privacy

### 19.1 VN PDPD 2023 — Vietnam's Personal Data Protection Decree

**Full name**: Nghị định 13/2023/NĐ-CP (Decree 13/2023/ND-CP), effective July 1, 2023.

**What it governs**: How organizations collect, store, process, transfer, and erase personal data of individuals in Vietnam. Similar in spirit to Europe's GDPR but with Vietnam-specific requirements.

**Key obligations for us**:

| Obligation | What It Means | How We Comply |
|------------|--------------|---------------|
| **Consent** | Must get clear consent before collecting personal data | Consent checkbox at checkout + registration; separate consent for marketing |
| **Purpose limitation** | Data used only for stated purpose | We state: "to process your booking and send your ticket" — not "to sell to advertisers" |
| **Data minimization** | Collect only what's needed | Booking needs name + phone + email. We don't ask for ID number, date of birth, etc. |
| **Access right** | Individual can request a copy of their data | Admin support can export a customer's data |
| **Correction right** | Individual can request corrections | Edit profile / contact support |
| **Deletion right** | Individual can request data erasure | See anonymize-in-place below |
| **Breach notification** | Must notify authorities + affected individuals within 72 hours of a data breach | Incident runbook + notification templates prepared |
| **Cross-border transfer** | Special rules for transferring data outside Vietnam | We store data in Vietnam-region infrastructure where possible |

### 19.2 Anonymize-in-Place — The Erase vs. Retain Tension

**The problem**: A customer requests account deletion (their right under PDPD). But we MUST retain financial records for tax/audit/dispute purposes. Deleting the booking rows would destroy the money trail.

**The solution**: Anonymize-in-place.
- **Hard-delete**: Account credentials, session tokens, preferences → gone forever
- **Anonymize**: Booking rows stay, but PII (personally identifiable information) is scrubbed:
  - `buyerName` → `"[deleted]"`
  - `buyerPhone` → `"[deleted]"`
  - `buyerEmail` → `"[deleted]"`
  - `bookingRef`, `amount`, `tripId`, `status` → **preserved** (financial record)

The booking still shows "someone paid 450,000₫ for trip X" (audit trail intact) but no longer identifies who.

### 19.3 PII — Personally Identifiable Information

**What it is**: Any data that can identify a specific individual. In our system:

| PII Field | Where Stored | Retention |
|-----------|-------------|-----------|
| Customer name | Booking.buyerName, Customer.name | Until account deletion (then anonymized) |
| Phone number | Booking.buyerPhone, Customer.phone | Until account deletion |
| Email | Booking.buyerEmail, Customer.email | Until account deletion |
| Operator contact name | Operator.contactName | Until operator offboarding |
| Operator phone | Operator.contactPhone | Until operator offboarding |
| KYB documents | S3 bucket | Retained per business license regulations; deleted N years after operator leaves |

### 19.4 Audit Trail

Every privileged action (admin approvals, financial operations, account suspensions) is recorded in an append-only audit log:

```
AuditLog {
  id, actorId, actorType (admin|system), action, targetType, targetId,
  details (JSON), ipAddress, createdAt
}
```

- **Append-only at DB level**: The application role cannot UPDATE or DELETE audit log rows (enforced by PostgreSQL permissions or a trigger).
- **Exportable**: Admin can export the audit log for external review.

### 19.5 Consent Capture

Consent is captured at specific moments and stored:
- **No-refund policy**: Checkbox at checkout ("I understand this ticket is non-refundable for customer-initiated cancellations")
- **PII storage**: Checkbox at checkout ("I consent to my booking information being stored for ticket delivery and service purposes")
- **Marketing** (if added later): Separate opt-in, never bundled with the service consent

---

## 20. Observability & Monitoring

### 20.1 Why "Buy, Not Build"

Building a custom monitoring dashboard is reinventing the wheel badly. Existing tools (Sentry, Datadog, Vercel Analytics) are battle-tested and purpose-built. We use them.

| Tool | What It Does |
|------|-------------|
| **Sentry** | Error tracking — catches unhandled exceptions, groups them, alerts on new/regression errors, shows stack traces with source maps |
| **Vercel Analytics** | Traffic metrics — page views, response times, serverless function invocations, cold starts |
| **Structured Logs** | Application logging — JSON-formatted logs with request ID, user ID, operation name, timing |
| **`/api/health`** | Health endpoint — returns 200 if the app + database + Redis are reachable; used by uptime monitors |

### 20.2 Sentry — Error Tracking

**What it is**: A service that automatically captures unhandled errors from your application, groups duplicate errors, and alerts you (Slack, email) when new error types appear or existing ones spike.

**What it gives us**:
- Every 500 error with full stack trace + request context
- Breadcrumbs (what happened before the error)
- Release tracking (did this deploy introduce a new error?)
- Performance monitoring (slow transactions)

### 20.3 Structured Logging

Instead of `console.log("payment failed for user 123")`, we log structured JSON:

```json
{
  "level": "error",
  "message": "Payment webhook verification failed",
  "requestId": "req_abc123",
  "operatorId": "op_xyz",
  "orderRef": "BB-2026-a3x7-k9m2",
  "provider": "momo",
  "reason": "amount_mismatch",
  "expected": 450000,
  "received": 400000,
  "timestamp": "2026-07-01T10:30:00Z"
}
```

**Why structured?** Searchable. You can query "show me all payment failures for MoMo in the last hour" instead of grep-ing through unformatted text.

### 20.4 Request ID Propagation

Every incoming request gets a unique ID (e.g., `req_abc123`). This ID is:
- Attached to every log line during that request
- Passed to every downstream call (database query, S3 upload, PSP call)
- Returned in the response header

When debugging "customer says their payment didn't work", you search for the request ID and see the entire chain: request received → hold validated → payment initiated → webhook received → error at step X.

### 20.5 Redaction List

The logger automatically strips sensitive fields from log output:
- Passwords, password hashes
- OTP codes
- JWT tokens, refresh tokens, OTP proof tokens
- Full phone numbers (logged as `+849xxx...xx`)
- Credit card numbers (never in our system, but defense-in-depth)

---

## 21. Configuration & Feature Flags

### 21.1 What Are Feature Flags?

A feature flag is a toggle that enables or disables a feature without deploying new code. Think of it as a light switch for functionality.

**Why they matter**:
- **Kill switch**: If a payment rail has a bug in production, flip the flag → rail disabled → site stays up.
- **Gradual rollout**: Enable a new feature for 10% of users, monitor, then increase.
- **Development**: Build a feature behind a flag, deploy it (invisible to users), test in production, then flip.

### 21.2 Our Flags

| Flag | What It Controls | Default |
|------|-----------------|---------|
| `PAYMENTS_STUB` | When `true`, payments use a local stub gateway (no real money moves) | `true` in dev, `false` in prod |
| `NOTIFY_STUB` | When `true`, notifications are logged but not actually sent (no real SMS/email) | `true` in dev, `false` in prod |
| Payment rail toggles | Enable/disable specific payment rails (MoMo, VietQR, card) | Per-rail |
| Feature gates | Enable/disable features (charter requests, customer accounts) | Per-feature |

### 21.3 FeeConfig Is NOT a Flag

The platform fee rate (e.g., 6%) is not a feature flag — it's business data with audit requirements:
- Effective-dated (a rate change applies from date X, not retroactively)
- Per-operator overridable (operator A gets 4%, everyone else gets 6%)
- Change-audited (who changed the rate, when, from what to what)
- Read at credit time and recorded on each ledger entry

This lives in a proper `FeeConfig` database table, not in the feature flag system.

---

## 22. Charter / Contract Rental Subsystem

### 22.1 What It Is

In addition to fixed-route scheduled trips (the main product), customers can request a **charter** — a private vehicle for a custom itinerary (tourism, group travel, business trips). This is a separate marketplace:

- **Fixed trips**: Known route, known time, known price, buy instantly
- **Charter**: Custom route, custom time, negotiated price, matched by admin

### 22.2 The Flow

```
Customer submits request (form: pickup, destination(s), dates, passengers, budget)
  │
  ▼
Admin reviews in Charter Dispatch queue
  │
  ├─ Option A: ASSIGN DIRECTLY to a specific operator
  │             Operator has 24h to accept/decline
  │             Decline → back to admin
  │
  ├─ Option B: PUBLISH to public pool (all approved operators see it)
  │             First operator to claim wins (atomic — no double-assignment)
  │             48h expiry → back to admin
  │
  └─ Option C: REJECT (spam/invalid)
```

### 22.3 First-Accept-Wins — Atomic Claim

When a charter request is published to the public pool, multiple operators might try to claim it simultaneously. The database handles this atomically:

```sql
UPDATE "CharterRequest"
SET status = 'ACCEPTED', "assigneeOperatorId" = 'op123'
WHERE id = 'charter456'
  AND status = 'PUBLISHED'
  AND "assigneeOperatorId" IS NULL;
-- If 1 row affected: you won the claim
-- If 0 rows affected: someone else claimed it first → 409 Already Claimed
```

### 22.4 Lead-Gen Payment Model

Charter pricing is bespoke — unlike fixed trips where the price is set by the operator and paid online. For charters:
1. Customer states a budget in the request
2. Operator accepts and contacts the customer directly
3. Price is negotiated off-platform (phone/chat)
4. Payment happens directly between customer and operator (outside our system)
5. Platform optionally invoices the operator a referral fee later

This is the **lead-generation** model — the platform connects supply and demand, not the payment rail.

---

## 23. Deployment & Infrastructure

### 23.1 Serverless Deployment (Vercel)

**What "serverless" means**: You don't manage servers. You deploy code, and the hosting platform automatically:
- Provisions compute resources when requests arrive
- Scales to zero when idle (no traffic = no cost)
- Scales up under load (each request gets its own function instance)
- Handles TLS certificates, CDN, edge routing

**Why Vercel for this project**:
- Next.js is Vercel's framework (best integration)
- Zero-ops for a small team (no DevOps engineer needed)
- Edge middleware for auth/rate-limiting at the CDN level
- Automatic preview deployments for PRs

### 23.2 Single App, Three Consoles (Stage 0)

```
busbooking.vn/          → Customer web (search, book, tickets)
busbooking.vn/op/       → Operator console (fleet, trips, bookings, money)
busbooking.vn/admin/    → Admin console (approvals, finance, moderation)
```

All three share one Next.js deployment. The admin compensates for being in the same app with:
- Separate credential store (different database table)
- Separate cookie scope (different cookie name/path)
- Strict exact-match middleware allowlist
- Mandatory TOTP

### 23.3 Environment Configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (via pooler) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Signing key for access tokens |
| `MOMO_SECRET_KEY` | MoMo webhook HMAC secret |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY` | File storage credentials |
| `PAYMENTS_STUB` | `true` = stub gateway; `false` = real PSP |
| `NOTIFY_STUB` | `true` = stub notifications; `false` = real SMS/email |
| `SENTRY_DSN` | Sentry error tracking endpoint |

All secrets stored in Vercel's encrypted environment variables. Never committed to the repository.

### 23.4 Stage 1 — Split Admin + Worker

When the platform outgrows Stage 0:
- **Admin on a subdomain** (`admin.busbooking.vn`) — separate deployment, stronger isolation
- **Worker process** — a long-running Node.js process consuming a BullMQ queue, running the same `lib/<domain>` job handlers. Replaces cron for time-sensitive jobs.

---

## 24. Disaster Recovery & Rollback

### 24.1 Database Backups

- **Automated daily backups** (managed by the database provider)
- **Point-in-time recovery** (restore to any second within the retention window)
- **Tested**: Periodically restore a backup to a staging database and verify it works

### 24.2 Migration Safety

Database migrations (schema changes) are the highest-risk deployments. Rules:
- Every migration is **forward-only** (no `DOWN` migration that could lose data)
- Destructive changes (drop column) are **two-phase**: Phase A removes all code references; Phase B (separate deploy) drops the column
- Non-partial indexes declared in BOTH `schema.prisma` AND the SQL migration (Prisma and DB must agree)
- Test every migration against a copy of production data before deploying

### 24.3 Rollback Plan

If a deployment introduces a critical bug:
1. **Immediate**: Vercel instant rollback to previous deployment (< 30 seconds)
2. **If migration ran**: Forward-fix (new migration that undoes the change) — never edit a committed migration
3. **Feature flag**: If the bug is in a flagged feature, flip the flag to disable

### 24.4 DB-Enforced Immutability as Safety Net

The ledger and audit log tables are append-only at the database level. Even a catastrophic application bug that somehow issues `UPDATE` or `DELETE` on these tables will be rejected by PostgreSQL. This is the last line of defense for financial integrity.

---

## 25. Testing Strategy

### 25.1 Test Pyramid

```
        ╱ E2E (Playwright) ╲        ← Few: critical user flows
       ╱ Integration Tests   ╲      ← Many: domain logic + DB
      ╱ Unit Tests             ╲    ← Many: pure functions, validators
     ╱─────────────────────────────╲
```

### 25.2 Unit Tests

- Pure functions (fee calculation, booking ref generation, date math)
- Validation schemas
- State machine transitions
- Colocated: `lib/<domain>/__tests__/<fn>.test.ts`

### 25.3 Integration Tests

- Domain functions that touch the database (create booking, process payment, claim charter)
- Use a real PostgreSQL instance (not mocks — per Mistake Log lessons)
- Colocated: `lib/<domain>/__tests__/<fn>.int.test.ts`

### 25.4 E2E Tests (Playwright)

- Critical user flows: search → hold → pay → receive booking
- Operator flows: create trip, view manifest, scan ticket
- Admin flows: approve operator, process payout
- Located: `e2e/`

### 25.5 Key Testing Rules (from Mistake Log)

| Rule | Why |
|------|-----|
| Use real DB, not mocks, for integration tests | Mocks drift from reality (Issue 001) |
| Mock Prisma methods must match the real method name | `findUnique` vs `findFirst` mismatch = silent pass (Issue 008) |
| Every `NOT NULL` column added → grep all test fixtures | Missing columns in test INSERTs crash on first run (Issue 012) |
| Every error code in a union must have a throwing path | Declared-but-never-thrown = dead code + un-enforced AC (Issue 013) |
| Date derivation in tests must match the filter's timezone | UTC vs VN-local mismatch = intermittent failures (Issue 014) |
| Hex strings in crypto tests must be valid hex of correct length | Invalid hex → empty buffer → `timingSafeEqual(0, 0)` = true (Issue 010) |

---

## 26. Evolution & Scale Path

### 26.1 The Three Stages

| Stage | When | What Changes |
|-------|------|-------------|
| **0** (now) | 1 operator, ~200/day | Modular monolith, single deploy, DB jobs + cron, PgBouncer, one Postgres + one Redis |
| **1** (10-100+ operators) | Measured bottleneck in jobs or reads | Add: read replica, BullMQ + worker process, CDN for PDFs, admin subdomain split |
| **2** (proven hotspot) | One module sustains high CPU/latency | Extract THAT module to a service (boundary already clean via barrel imports) |

### 26.2 What Each Stage Adds (Additive — Nothing Moves)

**Stage 0 → Stage 1**:
- `worker/` entrypoint added — imports the same `lib/<domain>` job handlers. No logic moves.
- PostgreSQL read replica — search queries routed to replica. Write path unchanged.
- BullMQ replaces DB job table — same Job interface, new execution layer.
- CDN (CloudFront) in front of S3 — ticket PDF downloads served from edge.
- Admin split to subdomain — separate Vercel project, same codebase.

**Stage 1 → Stage 2** (only if measured):
- A domain folder (e.g., `lib/payment/`) lifts to its own deployment. Every caller already imports through `index.ts` — the boundary is the API surface. Replace in-process calls with HTTP/gRPC to the new service.
- Partition hot tables (Booking, LedgerEntry, NotificationLog) by time or operator if row counts exceed index efficiency.
- Dedicated search index (Elasticsearch/Meilisearch) if SQL search query time exceeds 200ms consistently.

### 26.3 The "REMODEL IF" Triggers

These are the signals that indicate when the next stage is needed — never before:

| Signal | Action |
|--------|--------|
| Job latency > 30s consistently | Stage 1: queue + worker |
| DB connections hitting pool ceiling under normal load | Stage 1: tune PgBouncer, then replica |
| Search p95 > 200ms with proper indexes | Stage 2: dedicated search index |
| One `lib/<domain>` function consumes > 50% of serverless CPU | Stage 2: extract to service |
| Booking/LedgerEntry table > 50M rows AND queries slow despite indexing | Stage 2: time-based partitioning |

### 26.4 One-Way Doors — Right from Day 1

These 10 decisions are expensive to retrofit, so they're built correctly from the start:

1. **Multi-tenancy**: `operatorId` on every operator-owned row + tenant-scope helper
2. **Double-entry ledger**: Append-only, integer minor units, BigInt
3. **Idempotency keys**: On payments, webhooks, payouts
4. **Row-level locking**: `SELECT ... FOR UPDATE` for seats, balances
5. **Stateless app servers**: All state in JWT/Redis/DB
6. **Payment adapter abstraction**: Canonical event format
7. **Async job boundary**: All slow external work off the request path
8. **Clean module boundaries**: `lib/<domain>/index.ts` barrels
9. **Migrations + indexes + foreign keys**: Schema as code, versioned
10. **Structured logging + request ID**: Observability from line one

---

## 27. Glossary

| Term | Definition | First used |
|------|-----------|------------|
| **ACID** | Atomicity, Consistency, Isolation, Durability — four guarantees of a reliable database transaction. All-or-nothing, rules enforced, concurrent ops don't interfere, committed data survives crashes. | Section 6.1 |
| **Advisory lock** | A PostgreSQL lock acquired by application code (not tied to a row/table) to serialize concurrent operations — used to prevent duplicate cron runs. | Section 16.3 |
| **Aggregate root** | The single entity through which all modifications to a cluster of related objects must pass. You lock the root to ensure consistency of the whole cluster. | Section 6.6 |
| **Barrel file** | An `index.ts` that re-exports a module's public API. Other modules import only through this file — hides internal implementation details. | Section 3.1 |
| **BigInt** | JavaScript's arbitrary-precision integer type. Used for all money math to avoid floating-point rounding errors that occur with `Number`. | Section 10.2 |
| **Bounded context** | A self-contained area of the system with its own vocabulary and rules. Each `lib/<domain>/` folder is a bounded context. | Section 6.6 |
| **CDN** | Content Delivery Network — geographically distributed servers that cache static assets (JS, CSS, images) close to users for faster delivery. | Section 4.2 |
| **CUID** | Collision-resistant Unique Identifier — time-sorted, globally unique ID generated without a central coordinator. Better B-tree locality than random UUIDs. | Section 6.5 |
| **CSRF** | Cross-Site Request Forgery — an attack where a malicious site tricks your browser into making authenticated requests to another site using your cookies. | Section 18.1 |
| **Edge runtime** | A lightweight JavaScript environment at CDN edge nodes (Vercel). Cannot use Node.js APIs like Prisma or `crypto` — only `jose` for JWT verification. | Section 8.5 |
| **HMAC** | Hash-based Message Authentication Code — a cryptographic signature proving a message (e.g., webhook) came from the claimed sender. Both sides share a secret key. | Section 18.2 |
| **Idempotency** | Property where performing an operation multiple times produces the same result as doing it once. Critical for payment webhooks that may be retried. | Section 9.4 |
| **JWT** | JSON Web Token — a small, signed data packet (`header.payload.signature`) proving identity. The server verifies the signature without a database query. | Section 8.2 |
| **Monotonic transition** | A state machine that only moves forward, never backward. `paid → pending` is illegal even if a stale webhook tries it. | Section 9.5 |
| **OTP** | One-Time Password — a temporary code sent to your phone (SMS) to prove phone ownership. Expires after a short TTL. | Section 1.2 |
| **PII** | Personally Identifiable Information — any data that can identify a specific person (name, phone, email). Must be anonymized on account deletion. | Section 19.3 |
| **PDPD** | Vietnam's Personal Data Protection Decree (Nghị định 13/2023/NĐ-CP) — governs collection, storage, processing, and erasure of personal data in Vietnam. | Section 2.5 |
| **PSP** | Payment Service Provider — a company handling money movement (MoMo, VNPay, Stripe). Integrates with banks so you don't have to. | Section 9.2 |
| **RBAC** | Role-Based Access Control — permissions assigned to roles (admin, staff, finance), not individual users. System checks "does this role allow this action?" | Section 8.3 |
| **Tenant isolation** | Ensuring one operator can never see or modify another's data. Every query includes `WHERE operatorId = ?` via the `withOperatorScope` helper. | Section 8.4 |
| **TOCTOU** | Time-of-Check to Time-of-Use — a race condition where state changes between checking a condition and acting on it. Fixed by locking during both steps. | Section 11.4 |
| **TOTP** | Time-based One-Time Password — a rotating code from an authenticator app (Google Authenticator), changing every 30 seconds. Stronger than SMS OTP. | Section 2.4 |
| **TTL** | Time-To-Live — a countdown after which data expires. Holds expire after 10 minutes, OTPs after 5 minutes, access tokens after 15 minutes. | Section 13.1 |
| **Webhook** | A URL that a third party (e.g., MoMo) calls to notify us of an event (e.g., payment confirmed). The reverse of an API call — they call us. | Section 7.1 |

---

*This document is the system design source of truth. It should be updated as decisions change or new subsystems are added. For code-level specifications, see `rebuild-plan.md`.*
