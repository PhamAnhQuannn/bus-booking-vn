---
depends-on: []
type: BUG
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 4. GitHub #364.

## What to fix

`lib/jobs/processPayouts.ts:47-55` claims due payouts with
`SELECT id, "operatorId", net FROM "Payout" WHERE status = 'requested' AND "scheduledAt" <= NOW()
FOR UPDATE SKIP LOCKED` — **no `LIMIT`, no `ORDER BY`**. `SKIP LOCKED` prevents double-claiming
across concurrent invocations but does not bound how many rows one tick takes.

A completion spike (holiday weekend, T+3 alignment) dues hundreds of payouts into a single
long-held transaction and advisory lock. The whole tick runs inside one `$transaction` via
`runJob` → `withAdvisoryLock`, so the lock is held for the entire batch.

Compounds once `settlePayout` stops being a stub. It currently returns `{ok:true}` with no
network I/O (`lib/ledger/settlePayout.ts`), and the file's own header warns real bank HTTP
"must move to claim-then-dispatch".

### Fix

Mirror the bound already used by the sibling sweeper. `lib/jobs/reconcilePayments.ts:90` defines
`const CLAIM_LIMIT = 200` and applies `ORDER BY b."createdAt" ASC LIMIT ${CLAIM_LIMIT}`
(`:302-334`) with the same `for (const … of …)` loop shape. One const plus an `ORDER BY … LIMIT`.

Order by `scheduledAt ASC` so the oldest due payout is never starved.

## Acceptance criteria

- [ ] Claim query carries `ORDER BY "scheduledAt" ASC LIMIT <CLAIM_LIMIT>`.
- [ ] A backlog larger than the limit drains across successive ticks rather than one long tick.
- [ ] Test seeding more due payouts than the limit asserts exactly `CLAIM_LIMIT` are processed
      per tick and the remainder survive for the next.
- [ ] No behaviour change to the ledger `payout_debit` idempotency key.

## Blocked by

- none

## Files

- `lib/jobs/processPayouts.ts`

## Severity

P2 — low probability at current volume, but it is a money path and the fix is a one-const change.
