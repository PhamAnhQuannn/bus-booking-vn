---
name: offline-first-sync-design
description: Offline-first + sync design — local-first stores (SQLite/IndexedDB/RxDB/PowerSync/Replicache/Yjs), conflict resolution (LWW/CRDT/OT/manual), causal ordering, tombstones, partial sync, schema evolution. Outputs `docs/design/offline-sync-<project>.md`. Use for mobile/PWA apps that must work without network (field tools, in-flight, retail, healthcare bedside, travel, collaborative editing). Reads `/project-classify`; XS skip; S+ fires if "works offline" is a Must.
output_size:
  XS: skip
  S: 1h
  M: 5h
  L: 10h
  XL: 20h
---

# /offline-first-sync-design — Offline-first Sync

## Why you'd care

Apps that handle network failure as 'show an error' fail in field, retail, healthcare, and any flaky-connection context. Offline-first design + conflict resolution is the difference between a product that works in the wild and one that works only on demo Wi-Fi.

Invoke as `/offline-first-sync-design`. Required when the app must read and write while disconnected, then converge with server + other clients on reconnect.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - "Offline" merely caching read-only → use `cache-strategy` skill, not this.
2. Read `docs/design/data-model-<project>.md` (entities + invariants drive conflict policy).
3. Read `docs/design/architecture-<project>.md` (server topology).

## Inputs
- List of entities that must be writable offline.
- Per-entity: single-writer (only the owner edits) vs multi-writer (collaborative).
- Conflict cost: low (notes, prefs) → high (inventory count, ledger).
- Sync direction: read-only / write-only / bidirectional.
- Network profile: minutes offline / hours / days / weeks.
- Device storage budget.

## Process
1. **Decide which entities are local-first**. Not everything has to be. Default rule:
   - Local-first: read+write in offline workflow.
   - Cache-only: read offline, write needs network.
   - Server-only: never offline (auth, billing, admin).
2. **Pick local store**:
   - **SQLite** (mobile native, Capacitor, Tauri, Expo SQLite, op-sqlite): relational, fast, durable. Default for native mobile.
   - **IndexedDB** (web): native browser; wrap in Dexie or RxDB for ergonomics.
   - **Replicache** / **Zero**: pull-based sync, mutators run locally + server, ordered consistency.
   - **PowerSync** / **Electric SQL**: Postgres ↔ SQLite live sync.
   - **WatermelonDB**: React Native SQLite ORM with sync protocol.
   - **Yjs** / **Automerge**: CRDT for collaborative documents.
   - Avoid raw localStorage for anything non-trivial (sync bytes, no tx, no indexes).
3. **Pick conflict resolution per entity**:
   - **Last-write-wins** (LWW) by timestamp: cheap; safe for prefs, notes, status messages. Requires Hybrid Logical Clock / server-issued ts to avoid drift.
   - **Field-level LWW**: keep both edits if different fields; LWW within field. Common default.
   - **CRDT** (G-Counter, OR-Set, RGA): mathematically convergent; right for collab text/sets/counters.
   - **OT** (operational transform): legacy collab editor pattern; harder than CRDT today.
   - **Server reconciliation**: send intent; server is source of truth; client retries on rejection (right for inventory, money, anything with invariants).
   - **Manual merge UI**: show user both versions; needed when neither LWW nor CRDT is safe.
4. **Causal ordering**: use HLC (Hybrid Logical Clock) or Lamport timestamps in writes so server can order client edits without trusting client wall-clock. NTP drift on mobile is common.
5. **Tombstones**: deletes must propagate. Soft-delete with `deleted_at` + retention period (e.g. 90 days). Hard-purge after retention to bound storage.
6. **Partial sync**:
   - User has 10M rows on server but device only needs 5k. Use a "sync window" (per-user filter, geo, recency).
   - Bookmark / cursor per device per table.
   - Backfill on first sync; incremental after.
7. **Schema evolution**: client app version N has old schema; server N+1 added a column. Strategy:
   - Additive-only on server schema.
   - Client sends + accepts unknown fields as opaque blob (round-trip safe).
   - Migration runs locally on app update.
   - Force-update if breaking change.
8. **Auth + tenancy** on sync edge:
   - Server filters sync by tenant + RLS policy.
   - Compromised device must not leak other-tenant data.
   - Sync token rotation on signout; wipe local DB on logout.
9. **Conflict UX**:
   - User-visible only when manual-merge entity.
   - Otherwise quiet; log to telemetry; review monthly for unsafe rules.
10. **Offline UX details**:
   - Optimistic UI (act now, sync later).
   - Pending state badge.
   - Outgoing-queue retry with backoff.
   - Sync error visible but non-blocking.
   - Tappable "sync now" for user reassurance.
   - Battery: schedule sync on Wi-Fi + charger if data > N MB.

## Output
Write `docs/design/offline-sync-<project>.md`:

```markdown
# Offline-first sync design — <project>
**Date:** <YYYY-MM-DD>

## Network profile
- Expected offline windows: <e.g. 0–4h in-flight, 0–1d remote field>
- Critical entities offline: <list>
- Acceptable conflict rate per 1k writes: <e.g. <1>

## Entity matrix
| Entity | Offline R | Offline W | Conflict policy | Store |
|---|:--:|:--:|---|---|
| Note | ✓ | ✓ | field-LWW (HLC) | SQLite |
| Task | ✓ | ✓ | field-LWW + collab list = OR-Set | SQLite + Yjs |
| Inventory item | ✓ | ✓ | server-reconcile (qty invariant) | SQLite + server-of-truth |
| User profile | ✓ | own-only | LWW | SQLite |
| Org / billing | ✓ (read) | ✗ | n/a | cache-only |
| Auth token | ✗ | ✗ | n/a | secure-storage |

## Store choice
- **SQLite via op-sqlite** (mobile) — relational fits domain, durable, batched writes.
- **PowerSync** for Postgres ↔ SQLite live sync.
- **Yjs** for the collaborative task list only.

## Causal ordering
- HLC `(wall_ms, logical_counter, node_id)` stamped on every local write.
- Server validates HLC, may shift to its own clock for canonical ordering.
- Reject writes >5min in future to bound drift.

## Conflict policy per entity (detail)
### Note (field-LWW)
- Per-field timestamp `title_ts`, `body_ts`, `pinned_ts`.
- Higher HLC wins per field.
- No user-visible conflict.

### Task (collab list)
- Title/desc: field-LWW.
- Members: OR-Set (CRDT) — adds/removes converge.
- Status: single-writer when assignee; server-reconcile when admin override.

### Inventory item
- Client sends `intent: decrement qty by N`, not absolute value.
- Server applies under row lock; rejects if `qty < 0`.
- On reject: client shows "out of stock, refresh".

## Tombstones
- Soft-delete `deleted_at` + propagate.
- Hard-purge after 90 d.
- Sync filters out `deleted_at IS NOT NULL AND deleted_at < now() - 90d`.

## Partial sync
- Sync window: `WHERE user_id = ? AND updated_at > device_bookmark`.
- First sync: 30d backfill, ~5k rows typical.
- Incremental sync every 60s when foreground + on push wake.

## Schema evolution
- Server additive-only.
- Client tolerates unknown fields (opaque pass-through).
- Breaking change → bump app min-version; old clients see force-update.

## Auth + tenancy on sync edge
- Sync endpoint authenticates per-request (short-lived JWT).
- Server-side RLS filters all sync queries by `tenant_id`.
- On logout: wipe local DB (SQLite drop + reopen).

## UX
- Pending state badge on top-bar with count.
- Per-row "syncing/synced/conflict" icon.
- Manual "Sync now" button.
- Conflict modal only for entities flagged manual-merge.
- Outgoing-queue persisted across app kills.

## Observability
- Per-entity conflict rate.
- Sync latency p50/p95.
- Outgoing-queue depth.
- Failed-sync count + reason buckets.
- Alert: conflict rate > 1% for any entity.

## Test plan
- Two clients edit same row offline → reconnect → expected merge.
- Client offline 7 days → reconnect → 30d backfill works.
- Clock-skew client (+1h) → server rejects future writes >5min.
- Logout wipes local DB; cross-tenant data isolation verified.
- Inventory invariant: 100 concurrent decrements when stock=10 → exactly 10 succeed.
- App version N old client + server v(N+2) → still works for known fields; unknown fields round-trip.

## Risk if skip
- Lost writes on reconnect → user trust gone.
- Two clients overwriting each other silently → data loss.
- Negative inventory / double-spend.
- Stale-cache pretending to be live.
```

## Verification
- Entity-by-entity offline R/W matrix.
- Conflict policy named per entity (not "we'll figure it out").
- Causal-ordering scheme (HLC / Lamport / server-ts) chosen.
- Tombstone + retention defined.
- Partial-sync window described.
- Schema-evolution rule written.
- Tenant isolation on sync edge verified.
- Conflict-rate alert + observability.
