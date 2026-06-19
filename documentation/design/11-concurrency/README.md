> ← [Previous](../10-money-ledger/) | [Index](../README.md) | [Next →](../12-search/)

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
