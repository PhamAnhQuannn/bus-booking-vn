> ← [Previous](../05-capacity/) | [Index](../README.md) | [Next →](../07-api-design/)

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
