---
name: reservation-conflict-resolver-design
description: Race-safe slot-allocation design for reservations, ticketing, seat-pick, appointment-booking, license-key claim, limited-inventory checkout. DB-level UNIQUE/EXCLUDE constraint + friendly conflict UX + idempotent retry. Outputs `docs/design/reservation-conflict-<feature>.md`. Use when two users can race to grab the same finite slot/seat/license/item and double-allocation is unacceptable. Triggers on "reservation conflict", "double booking", "slot race", "seat collision", "first-come-first-served", "/reservation-conflict-resolver-design". XS skip; S+ fires if any race-to-claim exists.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /reservation-conflict-resolver-design — Race-safe Slot Allocation

Invoke as `/reservation-conflict-resolver-design`. Required for any feature where N users compete for K<N finite slots and double-allocation creates a real-world conflict (two parties at same table, two buyers of same seat, two claimants of same license).

## Why you'd care

Two users grabbing the same slot is a four-figure customer-service ticket every time it happens. A DB-level constraint plus a friendly conflict UX is the difference between a graceful retry and a fight on Twitter.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
2. Read `docs/design/data-model-<project>.md` (need entity + uniqueness candidate columns).
3. Read `docs/design/idempotency-key-design-<project>.md` if retries possible.

## Inputs
- Resource being allocated (slot, table, seat, license, sku, time-window).
- Uniqueness key (which column set must be unique).
- Whether overlap or only exact-match is the conflict (point vs range).
- Expected conflict rate (1/yr / 1/wk / 1/sec).
- Acceptable UX on conflict (auto-retry next, show picker again, refund).

## Process
1. **Pick the constraint shape**:
   - **Exact-match uniqueness** (slot is a discrete tuple like `(resource_id, slot_start)`): Postgres `UNIQUE` constraint. Cheap, fastest path.
   - **Range overlap** (booking spans `[start, end)` and any overlap is a conflict): Postgres `EXCLUDE USING gist` with `tstzrange` + `&&` operator and the `btree_gist` extension. MySQL has no native — use serializable tx or app-locks.
   - **Capacity > 1 with cap K** (e.g. 4 seats per slot): use `CHECK (count <= K)` enforced via row-per-claim + `UNIQUE(resource_id, slot_id, seat_index)`, *not* a counter column (counter races).
2. **Push the invariant to the DB**. Never enforce in application logic alone — two app servers can both pass the check before either writes. The DB is the only place with one source of truth.
3. **Map the violation to a friendly error**:
   - Postgres `unique_violation` (SQLSTATE 23505) → Prisma `P2002` → HTTP 409.
   - Range conflict `exclusion_violation` (SQLSTATE 23P01) → HTTP 409.
   - Body: `{ "error": "slot_taken", "retry_with": ["nearest_alternatives"] }`.
4. **Avoid these anti-patterns**:
   - `SELECT then INSERT` without tx — classic race; do not write.
   - Application-level mutex / Redis lock — adds a dependency, leaks on crash, slower; DB constraint already free.
   - Optimistic counter `UPDATE inventory SET count = count - 1 WHERE count > 0` — works for capacity but loses identity of which seat went; use row-per-claim instead.
   - Polling for "is slot available" — racy and slow; let the write attempt and fail.
5. **Idempotency on retry**: client should include `Idempotency-Key`. On retry of a successful create, return the existing row (HTTP 200), not a 409.
6. **UX on conflict** — pick by use-case:
   - Ticketed seat: re-render seat map with current availability.
   - License key (1 of K): silent retry to next free key, succeed.
   - Appointment slot (clinic, salon, advisor): refresh picker, surface 3 nearest alternatives.
   - Hotel room / parking spot / restaurant table: refresh picker, surface 3 nearest alternatives.
   - Time-block booking: snap to next 15-min increment, ask confirmation.
   - High-stakes (concert front-row): hold for 5 min via transient claim then commit, with explicit timer in UI.
7. **Hold/release pattern** (only if necessary): claim row with `held_until = now() + interval '5 min'`, unique on `(resource_id, slot_id) WHERE held_until > now()`. Background job releases expired holds. Keep TTL short (3–10 min). Don't build this for low-contention paths — it adds bugs.
8. **Telemetry**:
   - `slot_claim_attempt`, `slot_claim_success`, `slot_claim_conflict` (with reason).
   - p95 latency of claim path.
   - Conflict rate per resource — high rate signals supply gap, not UX bug.

## Output
Write `docs/design/reservation-conflict-<feature>.md`:

```markdown
# Race-safe slot allocation — <feature>
**Date:** <YYYY-MM-DD>
**Resource:** <ticket seat / appointment slot / license key / hotel room / parking spot / restaurant table>

## Invariant
- Exactly **one** active claim per `(resource_id, slot_start)` (no double-allocation).
- Stale holds older than 5 min auto-release.

## Constraint
Shape: exact-match uniqueness on `(table_id, slot_start)`.

```sql
ALTER TABLE reservation
  ADD CONSTRAINT reservation_table_slot_unique
  UNIQUE (table_id, slot_start);
```

(Alternative for range:)
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  );
```

## Write path (single tx)
```ts
try {
  return await prisma.reservation.create({
    data: { tableId, slotStart, party, customerId, idempotencyKey },
  });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    // unique constraint hit — slot was taken between picker render and submit
    throw new SlotTakenError({ tableId, slotStart, alternatives: await nearestSlots(tableId, slotStart) });
  }
  throw e;
}
```

## API response on conflict
- Status: **409 Conflict**.
- Body:
```json
{
  "error": "slot_taken",
  "message": "That slot was just taken — pick another time.",
  "alternatives": [
    { "tableId": "t1", "slotStart": "2026-08-15T19:15-04:00" },
    { "tableId": "t2", "slotStart": "2026-08-15T19:00-04:00" }
  ]
}
```

## Idempotency
- Client sends header `Idempotency-Key: <uuid>` on POST.
- Server stores `(key, response_hash)` 24h.
- Retry with same key: return original response (200 if it succeeded, 409 if it failed).
- Without key: each POST is independent; client must dedup.

## UX
- Picker shows availability fetched at render. Optimistic submit.
- On 409: replace picker with alternatives + soft message "just taken".
- No alarm color; conflicts are normal, not errors.

## Hold/release (if needed)
- **Not used for v1** — direct write is fast enough; contention <1/day.
- Add later if conflict rate >5%/hr or for high-stakes booking.

## Test plan
- **Unit:** P2002 mapper returns 409 with alternatives.
- **Integration:** open two tx in parallel, both INSERT same `(table, slot)` — one succeeds, one gets P2002 → 409.
- **Load (k6):** 50 parallel claims on same slot — exactly 1 succeeds, 49 get 409, p95 < 200ms.
- **Restore drill:** after PITR restore, `\d+ reservation` shows constraint present (constraint loss is a silent killer).
- **E2E (Playwright):** two-tab dual-submit on the same slot — second tab sees friendly message + alternatives, no crash, no double-row in DB.

## Anti-patterns avoided
- App-level mutex / Redis lock — not used.
- `SELECT then INSERT` without tx — not used.
- Counter column without row-per-claim — not used.
- Polling availability — not used.

## Telemetry
- Events: `slot_claim_attempt`, `slot_claim_success`, `slot_claim_conflict{reason}`.
- Alert: conflict rate > 5%/hr (signals supply shortage, not UX bug).
- Dashboard: per-resource conflict rate over time.
```

## Verification
- Uniqueness/EXCLUDE constraint exists in migration source.
- P2002/23P01 → 409 mapper has unit test.
- API contract documents 409 shape with `alternatives` field.
- Two-tab race test passes (E2E).
- DR-restore checklist includes constraint presence check.
- No application-level mutex or "check then insert" pattern.
- Telemetry events + conflict-rate alert wired.
