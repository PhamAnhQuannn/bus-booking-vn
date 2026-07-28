---
depends-on: []
type: BUG
wave: 2
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 5.
GitHub #376 part 2. (Part 1 — the VNPay `shape` discriminator — is moot once the VNPay routes
are deleted; see PR #378.)

## What to fix

Quality, not correctness — the log has no control-flow effect.

`reconcile.event_unrecoverable` (`lib/jobs/reconcilePayments.ts:393-408`) now iterates
`for (const e of events)`, which covers orphans. That is correct — the orphan path is Bug B's
shape on the live rail. But `rawEvents` selects:

```
bookingId = booking.id
  OR (bookingId IS NULL AND receivedAt within ±DEGRADED_MATCH_WINDOW_MINUTES of the anchor)
```

so **one** unrecoverable orphan is re-logged once per candidate booking whose anchor falls in its
±30 min window — up to `CLAIM_LIMIT` = 200 lines per tick.

Orphans are never claimed or consumed (round 2 deliberately removed the CAS claim) and are exactly
the rows `matchDegraded` skips on `!ev.success`, so the same row re-logs every 15-minute tick as
new stuck bookings drift into its window.

Bounded, not infinite: every `awaiting_payment` booking has a non-null `holdExpiresAt`, so the
per-booking repeat is capped by the 24h `SUSPECTED_HOLD_MAX_AGE_MINUTES` hold — roughly 96 ticks
worst case. Pre-fix (`for (const e of linked)`) this was at most one line per booking's own events.

### Fix

Log orphans once per tick rather than once per booking × orphan. Collect the unrecoverable orphan
ids across the sweep and emit them after the candidate loop, or de-duplicate by `paymentEventId`
within the tick.

Constants for reference: `DEGRADED_MATCH_WINDOW_MINUTES = 30` (`:87`), `CLAIM_LIMIT = 200` (`:90`),
`SUSPECTED_HOLD_MAX_AGE_MINUTES = 24 * 60` (`:115`).

No PII either way — `bookingId` / `paymentEventId` are UUIDs, and carrying `bodyShape` instead of
`rawBody` was the right call.

## Acceptance criteria

- [ ] One unrecoverable orphan produces at most one warn line per sweep tick.
- [ ] Linked (non-orphan) events keep their existing per-booking logging.
- [ ] Test with 1 orphan and N in-window candidate bookings asserts 1 log line, not N.

## Blocked by

- none

## Files

- `lib/jobs/reconcilePayments.ts`

## Severity

P3 — log noise on the sweeper that instruments the only live payment rail. Noise here is how a
real parser mismatch gets missed.
