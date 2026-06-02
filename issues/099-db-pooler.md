---
depends-on: []
type: FEATURE
wave: 8
spec: [SYS00, SYS01]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS00] / [SYS01]

## What to build

**Connection pooler (PgBouncer / Prisma Accelerate).** [SYS01] names "PgBouncer / Prisma Accelerate
from day 1; app → pooler, never raw PG" as a one-way door, but `lib/db/client.ts` uses
`new Pool({ connectionString: DATABASE_URL })` straight to Postgres — no pooler. Under serverless
fan-out this risks connection exhaustion (> PG's ~100 cap).

> **Low urgency / deferrable.** Per the SYS capacity note (200 bookings/day ≈ 8/hr — throughput is
> NOT the constraint), this is safe to defer at current scale. Required before any serverless
> scale-up or multi-instance deploy. Ticketed so it isn't silently lost.

- Route Prisma through a pooled DSN — PgBouncer (transaction mode) or Prisma Accelerate URL — with
  a bounded pool cap.
- Verify `SELECT … FOR UPDATE` + `pg_advisory_xact_lock` semantics still hold under the pooler
  (transaction-mode caveat: session-level features must stay xact-scoped — they already are).
- Keep a direct (non-pooled) DSN for migrations.

## Acceptance criteria

- [ ] App connects via the pooler DSN in prod config; direct DSN used only for migrations.
- [ ] Connection count is bounded under concurrent load.
- [ ] Existing integration + lock tests (hold concurrency, capacity guard, payout SKIP LOCKED)
      stay green through the pooler.

## Blocked by

- none. Deferrable — schedule when scale-up is on the horizon.

## User stories addressed

- [SYS01] As platform, the app talks to Postgres through a pooler so serverless fan-out can't
  exhaust connections.
