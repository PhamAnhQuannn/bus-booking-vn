# ADR-009: Concurrency & Seat Holding

## Status
ACCEPTED

## Date
2026-06-17

## Context

A bus booking platform must prevent three critical failures:

1. **Overselling** — more tickets sold than seats on a bus
2. **Double-booking** — same seat counted twice in concurrent requests
3. **Phantom capacity** — seats locked by abandoned holds that never convert to bookings

The platform runs on Vercel serverless (multiple concurrent function instances), PostgreSQL, and Redis. There is no single-process guarantee — any concurrency control must work across distributed function invocations.

Key constraints (from `design/11-concurrency/`, `business/domain-model/invariants-catalog.md`):
- Tet surge: 2,000 concurrent booking attempts (ADR-002)
- Popular routes: multiple customers racing for the last few seats
- Hold-then-book model: seats must be reserved before payment (10-min window)
- PSP webhook: payment confirmation arrives asynchronously, minutes after hold
- Serverless: no in-process locks, no persistent connections between requests

**Sources**: `design/11-concurrency/`, `business/domain-model/invariants-catalog.md` §I1/§Capacity Guard, `business/domain-model/state-machines.md` §Hold Lifecycle, `business/domain-model/event-flows.md` §Flow 1 Step 2

---

## Decisions

> Canonical invariant catalog (I1/Capacity Guard): [`domain-model/invariants-catalog.md`](../../business/domain-model/invariants-catalog.md). This ADR decides the concurrency mechanisms that enforce those invariants.

### D1: PostgreSQL `SELECT FOR UPDATE` Row Locking

All capacity-affecting operations acquire a row-level lock on the gating entity (Trip, Bus, Operator) before reading or writing seat counts.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. PostgreSQL `SELECT FOR UPDATE`** ✅ | Row-level pessimistic lock within a transaction | ACID-guaranteed; no external dependency; deadlock detection built-in; works across serverless instances | Locks held for transaction duration; potential deadlock if lock ordering violated |
| B. Redis distributed locks (Redlock) | Lock key in Redis with TTL | Fast; language-agnostic | Not ACID — lock can expire mid-operation; Redis failure = lost lock; split-brain risk in cluster |
| C. Optimistic locking (version column) | Read version, write with `WHERE version = X` | No lock contention on reads | High retry rate on popular trips (many concurrent writers); retry storms during Tet surge |
| D. Application-level mutex | In-process lock (e.g., `Mutex`) | Simple | Serverless = multiple instances; lock is per-process only; useless for distributed concurrency |

**Choice**: Option A.

**Rationale**: The concurrency problem is fundamentally a database consistency problem — seats are database rows. PostgreSQL's row-level locking is the only option that provides ACID guarantees without external dependencies. Redis locks (B) add a failure mode where the lock expires before the transaction commits, creating a window for overselling. Optimistic locking (C) degrades under contention — exactly when correctness matters most (last seats on a popular Tet trip). Application mutexes (D) are meaningless in serverless.

---

### D2: Two-Tier Advisory Locks for Hold Creation

Hold creation uses two sequential PostgreSQL advisory locks within a single transaction:

1. **Phone-level lock**: `pg_advisory_xact_lock(hashtext('hold-phone:' || phone))` — serializes all hold attempts from the same phone number, enforcing `CONCURRENT_HOLD_CAP`
2. **Trip-level lock**: `pg_advisory_xact_lock(hashtext('hold:' || tripId))` — serializes all hold attempts on the same trip, preventing oversell race

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Two-tier advisory locks** ✅ | Phone cap lock, then trip serialization lock | Prevents both seat-squatting AND overselling in one atomic operation; advisory locks auto-release on tx end | Two lock acquisitions per hold; potential deadlock if order not consistent |
| B. Single trip-level lock only | Lock trip row, check phone cap inline | Simpler; one lock | Phone cap check is not serialized — concurrent requests from same phone could both pass the cap |
| C. Redis rate limit for phone, PG lock for trip | Phone cap in Redis, trip lock in PostgreSQL | Decouples phone cap from trip lock | Phone cap in Redis is not transactional — cap could be exceeded if Redis and PG disagree |

**Choice**: Option A.

**Rationale**: Both guards (phone cap and trip capacity) must be checked atomically within the same transaction. Splitting across Redis and PG (C) creates a TOCTOU gap. A single trip lock (B) leaves the phone cap unprotected against concurrent requests. Lock ordering is always phone-first-then-trip to prevent deadlocks.

---

### D3: Conditional INSERT for Atomic Hold Creation

Hold creation uses a single conditional INSERT (not SELECT-then-INSERT) that atomically checks all preconditions:

```
INSERT INTO Hold (...)
SELECT ... FROM Trip
WHERE trip.status = 'scheduled'
  AND trip.salesClosed = false
  AND (capacity - active_holds - paid_bookings - awaiting_payment_bookings) >= ticketCount
```

If the subquery returns no rows (preconditions failed), the INSERT produces zero rows — no hold created, no race window.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Conditional INSERT** ✅ | Single SQL statement combining check + write | Zero TOCTOU gap; database enforces atomicity; impossible to create a hold on a sold-out trip | More complex SQL; harder to return specific failure reasons |
| B. SELECT then INSERT | Read capacity, check in application code, then INSERT | Simple code; clear error messages | Classic TOCTOU race — capacity can change between SELECT and INSERT |

**Choice**: Option A.

**Rationale**: The TOCTOU race in option B is the #1 source of overselling bugs in booking systems. By combining the capacity check and the hold creation into a single SQL statement, the database guarantees atomicity — there is no moment when the check result is "stale." The advisory locks (D2) serialize concurrent attempts, and the conditional INSERT (D3) ensures each serialized attempt sees the true capacity.

---

### D4: 10-Minute Hold TTL with Cron Batch Expiry

Holds expire after 10 minutes. Expired holds are cleaned up by a cron job processing 500 holds per batch.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. 10-min TTL + cron expiry (500/batch)** ✅ | `expiresAt = NOW() + 10min`; cron sweeps expired holds | Balances payment completion time vs phantom capacity; batch size prevents DB overload | Seats unavailable for up to 10 min after abandonment; cron delay adds seconds |
| B. Shorter TTL (5 min) | Faster seat reclaim | May not leave enough time for PSP redirect + authentication | — |
| C. Longer TTL (30 min) | More time for payment | Too much phantom capacity; reduces effective inventory | — |
| D. Real-time expiry (Redis TTL trigger) | Redis keyspace notification on expiry | Instant seat reclaim | Redis is not the source of truth; missed notification = permanent phantom hold |

**Choice**: Option A.

**Rationale**: 10 minutes is calibrated against observed PSP redirect-to-completion times (VNPay: 3-5 min typical, MoMo: 2-4 min). Shorter (B) risks legitimate payments failing because the hold expired mid-checkout. Longer (C) wastes too much capacity on abandoned carts. Redis-based expiry (D) is unreliable — if the notification is missed, the hold stays active in PostgreSQL forever. Cron batch size of 500 prevents a single sweep from locking the Hold table under heavy load.

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Cron sweeps expired holds automatically on schedule.
> - **Actual**: `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Env override to `'count'` for dry-run in dev. Production deploys use the default `'update'` which expires holds correctly.
> - **Status**: `IMPLEMENTED`
> - **Tracking**: Verify `HOLD_SWEEPER_MODE` is not overridden to `'count'` in production env.

---

### D5: PSP Window for Awaiting-Payment Seat Reservation

Bookings in `awaiting_payment` status continue to occupy seats for 20 minutes (`PSP_WINDOW_MINUTES = 20`) — covering MoMo's 15-minute final retry window plus 5 minutes buffer.

After 20 minutes without a payment webhook, the booking's seat reservation is excluded from capacity calculations, effectively reclaiming the seat without explicitly cancelling the booking (the PSP may still send a delayed failure webhook).

**Rationale**: The PSP may send the payment confirmation up to 15 minutes after the customer completes payment (MoMo's retry schedule). If we reclaim the seat before the webhook arrives, a legitimate paid customer could be oversold. The 20-minute window covers the worst-case PSP delay. After 20 minutes, the probability of a legitimate late webhook is negligible — and if one does arrive, the oversold-race guard (D7) handles it.

---

### D6: `$transaction` Callback Form for All Capacity Operations

All operations that read-then-write capacity state use Prisma's `$transaction` callback form (`prisma.$transaction(async (tx) => { ... })`), not the array form.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Callback `$transaction`** ✅ | `prisma.$transaction(async (tx) => { ... })` | Provides a `tx` handle for raw SQL (`FOR UPDATE`, advisory locks); all reads and writes in single serializable scope | Must pass `tx` through all function calls; error aborts entire transaction |
| B. Array `$transaction` | `prisma.$transaction([op1, op2, op3])` | Simpler syntax | No `tx` handle — cannot issue raw SQL, `FOR UPDATE`, or advisory locks within the transaction |

**Choice**: Option A.

**Rationale**: The array form (B) does not provide a transaction handle, making it impossible to issue `SELECT FOR UPDATE` or `pg_advisory_xact_lock` within the transaction scope. Since every capacity-affecting operation requires row locking (D1) or advisory locking (D2), the callback form is the only viable option.

---

### D7: Three-Layer Capacity Guard

Oversell prevention uses three independent defense layers:

| Layer | When | Mechanism | What it catches |
|-------|------|-----------|-----------------|
| **Layer 1: Hold creation** | Customer clicks "Book" | Conditional INSERT with advisory locks (D2+D3) | Concurrent hold attempts on same trip |
| **Layer 2: Payment webhook** | PSP confirms payment | `SELECT FOR UPDATE` on Trip + re-count paid seats; if `paid > capacity` → immediate refund (`status = 'refunded'`) | Race between two payments completing simultaneously for the last seat |
| **Layer 3: Phone hold cap** | Hold creation | Phone-level advisory lock + count active holds | Single phone hoarding multiple holds across trips (seat-squatting) |

**Rationale**: No single layer is sufficient. Layer 1 handles the common case (concurrent hold attempts). Layer 2 handles the rare but critical case where two holds exist and both payment webhooks arrive simultaneously — one must be refunded. Layer 3 prevents abuse (a single phone locking up inventory across many trips). Defense-in-depth: if any one layer has a bug, the others catch it.

> **CONFLICT**: D2 uses `pg_advisory_xact_lock` (advisory locks) for hold creation, while D7 Layer 2 uses `SELECT FOR UPDATE` (row-level locks) for payment webhook. These are independent lock mechanisms — advisory locks do not participate in PostgreSQL's deadlock detector alongside row-level locks. A concurrent hold-creation (advisory lock on Trip hash) and payment webhook (`FOR UPDATE` on Trip row) on the same trip operate on different lock planes with no cross-detection documented.

---

## Consequences

### Positive

- **Zero overselling** — three independent layers, each sufficient alone for common cases
- **No external dependency** — all concurrency control in PostgreSQL; Redis failure doesn't cause overselling
- **Deadlock-safe** — consistent lock ordering (phone → trip) prevents deadlock cycles
- **Serverless-compatible** — row locks and advisory locks work across any number of concurrent function instances
- **Self-healing** — cron expiry reclaims phantom capacity; PSP window prevents indefinite seat locks

### Negative

- **Advisory lock overhead** — two lock acquisitions per hold creation (microseconds each, but adds latency)
- **Cron delay** — expired holds are not reclaimed instantly; up to 60 seconds delay depending on cron frequency
- **Transaction duration** — capacity operations hold DB connections for the full transaction; connection pool pressure under Tet surge
- **Conditional INSERT complexity** — single-statement check+write is harder to debug than sequential read+write
- **Exclusive trip lock** — only one hold attempt per trip can execute at a time; serialization bottleneck on very popular departures (mitigated by sub-100ms transaction duration)
