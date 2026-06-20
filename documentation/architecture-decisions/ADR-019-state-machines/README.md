# ADR-019: State Machine Enforcement

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform contains 8 distinct state machines governing the lifecycle of core entities. Each state machine determines what operations are legal, what side effects fire, and what the entity is visible/bookable/payable. Incorrect state transitions have direct financial impact (paying for a cancelled trip, double-refunding, overselling departed trips).

**Sources**: `business/domain-model/state-machines.md`, `business/domain-model/invariants-catalog.md` §I5, `business/domain-model/event-flows.md`

> **Authoritative schema source**: DS-001 (Data Model) defines the canonical entity schemas, column types, and enum values for all state machine entities. This ADR covers the architectural rationale for state machine enforcement patterns (centralized transition maps, `SELECT FOR UPDATE`, guard placement). When transition tables or enum values diverge, DS-001 is authoritative.

---

## Decisions

### D1: Eight Canonical State Machines

> Canonical transition tables, guards, and side-effect details: [`domain-model/state-machines.md`](../../business/domain-model/state-machines.md). Summary below.

| Entity | States | Terminal states |
|--------|--------|----------------|
| **Trip** | `scheduled → departed → completed`, `scheduled → cancelled` | `completed`, `cancelled` |
| **Booking** | `awaiting_payment → paid → completed`, plus `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded` | `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded` |
| **Hold** | `active → consumed`, `active → expired`, `active → cancelled_trip` | `consumed`, `expired`, `cancelled_trip` |
| **Payout** | `requested → processing → paid`, `processing → failed`, `failed → requested` (retry) | `paid` |
| **Operator** | `PENDING_REVIEW → UNDER_REVIEW → APPROVED`, `→ REJECTED`, `APPROVED ↔ SUSPENDED` | None (lifecycle) |
| **OTP** | Implicit: active → consumed/expired/lockout sentinel | consumed, expired |
| **EInvoice** | `pending → issued → sent`, `→ failed`, `→ cancelled` | `sent`, `failed`, `cancelled` |
| **CharterRequest** | `SUBMITTED → ADMIN_REVIEW → ASSIGNED_DIRECT/PUBLISHED → ACCEPTED → COMPLETED` | `COMPLETED`, `CANCELLED`, `REJECTED` |

---

### D2: `LEGAL_*_TRANSITIONS` Maps as Single Source of Truth

Every state machine has a `LEGAL_<ENTITY>_TRANSITIONS` constant that enumerates all valid `(fromStatus, toStatus)` pairs. No code may transition an entity's status without checking this map.

```typescript
const LEGAL_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  awaiting_payment: ['paid', 'payment_failed_expired', 'cancelled', 'trip_cancelled'],
  paid: ['completed', 'cancelled', 'trip_cancelled', 'refunded', 'no_show'],
  // ... etc
}
```

Every `UPDATE ... SET status = X` is guarded by checking that the current status is in `legalPredecessors(targetStatus)`. The guard runs inside the transaction after acquiring the row lock.

**Rationale**: A centralized transition map is auditable — one glance shows all legal moves. Without it, transitions are scattered across service functions and each handler invents its own predecessor check (or forgets it). The map is also the basis for exhaustive testing: every edge in the transition graph should have a test.

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Every state machine has a `LEGAL_*_TRANSITIONS` map; no status write bypasses it.
> - **Actual**: Only 3 of 8 state machines have explicit `LEGAL_*_TRANSITIONS` maps (Booking, CharterRequest, Operator). The remaining 5 (Trip, Hold, Payout, OTP, EInvoice) use inline `WHERE status IN (...)` clauses in service functions — functionally equivalent guards but not centralized in a single auditable map.
> - **Status**: `PARTIALLY_IMPLEMENTED`
> - **Tracking**: Extract transition maps for Trip, Hold, Payout, OTP, and EInvoice. Low severity — guards exist but are scattered.

---

### D3: Every Status Change Inside `$transaction` + `SELECT FOR UPDATE`

All state transitions run inside a Prisma `$transaction` callback with a leading `SELECT ... FOR UPDATE` on the entity row. This serializes concurrent transition attempts on the same entity.

```typescript
await prisma.$transaction(async (tx) => {
  const trip = await tx.$queryRaw`SELECT ... FROM "Trip" WHERE id = ${id} FOR UPDATE`
  // Check current status against LEGAL_TRANSITIONS
  // Apply transition
  await tx.trip.update({ where: { id }, data: { status: newStatus, ... } })
})
```

**Rationale**: Without `FOR UPDATE`, two concurrent requests can both read `status = 'scheduled'`, both decide the transition to `'cancelled'` is legal, and both write — the second write succeeds but fires side effects (refunds, notifications) that have already been fired by the first. The row lock ensures only one transition executes at a time.

---

### D4: Timestamp + Status Written Together

Any service function that writes a timestamp column corresponding to a state transition MUST update the status enum in the same `tx.model.update` call.

| Timestamp column | Required status write |
|------------------|-----------------------|
| `departedAt` | `status: 'departed'` |
| `completedAt` | `status: 'completed'` |
| `cancelledAt` | `status: 'cancelled'` |

**Greppable invariant**: Every `<verb>At` column write should appear within 3 lines of a `status:` write in the same update call.

**Rationale**: Writing the timestamp without the status leaves the entity in an inconsistent state — `departedAt` is set but `status` is still `'scheduled'`. Downstream queries that filter by status will include the entity incorrectly.

---

### D5: DTO Status Union Extended in Same Commit

When a new status value is added to a state machine, the corresponding DTO's status type union MUST be extended in the same commit. A positive test assertion on the new status value must also land in the same commit.

```typescript
// If Trip gains 'departed' status:
// 1. Update TripDto.status union: 'scheduled' | 'departed' | 'cancelled' | 'completed'
// 2. Add test: expect(result.trip.status).toBe('departed')
// Both in the same commit as the service function change.
```

**Rationale**: A status value that exists in the database but not in the DTO type causes a tsc error when any consumer accesses it. A status value in the DTO but untested gives false confidence. The three artifacts (service write, DTO union, test assertion) must stay synchronized.

---

### D6: Idempotent Transitions Use Discriminated Result

Transitions that may be applied more than once (cancel, complete, check-in) return a discriminated result, not a thrown error. See ADR-015 §D3 for the full pattern.

The idempotency check runs INSIDE the existing `$transaction` (lock already held) — never as a separate query after lock release.

```typescript
// Inside transaction, after SELECT FOR UPDATE:
if (trip.status === 'cancelled') {
  return { trip: toTripDto(trip), alreadyCancelled: true, cancelledBookings: 0 }
}
```

**Rationale**: Checking idempotency outside the transaction creates a TOCTOU gap. Checking inside ensures the status hasn't changed between the lock acquisition and the check.

---

### D7: Side Effects Tied to Transitions

Each state transition has defined side effects that fire atomically (within the transaction) or asynchronously (post-commit via `after()`).

| Transition | Side effects |
|------------|-------------|
| Booking: `awaiting_payment → paid` | Hold → consumed; 2 LedgerEntry rows (booking_credit + platform_fee); 2 NotificationLog rows (customer + operator) |
| Trip: `scheduled → cancelled` | All bookings → `trip_cancelled`; all active holds → `cancelled_trip`; refund per paid booking; notification per affected booking |
| Trip: `departed → completed` | Payout row created; `payout_scheduled` notification with `scheduledFor = completedAt + 1 day` |
| Operator: any → `APPROVED` | Clear `disabledAt`; operator visible in search |
| Operator: any → `SUSPENDED` | Set `disabledAt = NOW()`; listings hidden; cannot sell |

Side effects are currently orchestrated procedurally inside the service function's transaction. A future event bus could decouple them — but at current scale (200 bookings/day), procedural orchestration in one transaction is simpler and easier to debug.

---

## Consequences

### Positive

- **Auditable transitions** — one map shows all legal moves per entity
- **No illegal transitions** — row lock + predecessor check prevents concurrent corruption
- **Consistent state** — timestamp + status always written together
- **Safe idempotency** — repeat calls return the same result without re-firing side effects
- **Type-safe DTOs** — status union stays in sync with database reality

### Negative

- **Transition map maintenance** — every new status requires updating the map, DTO union, and tests
- **Side effect coupling** — all side effects in one transaction means a notification failure can roll back a status change (mitigated by enqueue-only in transaction, dispatch via cron)
- **Row lock contention** — popular entities (high-demand trips) serialize all transition attempts
- **Procedural orchestration** — side effects are not decoupled; adding a new side effect requires modifying the service function
