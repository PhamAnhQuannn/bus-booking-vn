> ← [Previous](../25-testing/) | [Index](../README.md) | [Next →](../27-glossary/)

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
