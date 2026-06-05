# Cross-persona connection test — 2026-06-06

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/cross-persona-crawl.mts`) · Two contexts: operator 1366×950 + traveler 1280×900.
Mode: **full mutating + destructive** — creates a throwaway bus + 2 trips + 2 paid bookings, cancels one trip, and momentarily SUSPENDS then restores the seed operator (try/finally guarded). Operator acts as seed admin (`+84901230001`); traveler completes real stub payments.

> ⚠️ This run DIRTIED the dev DB. Run `pnpm db:seed` for a clean slate before a fresh comparison.

## Fixture state
- Route under test: **Hà Nội → TP.HCM**
- Fresh bus: `cmq17koqx001i4ocdh813fnp3` (capacity 20)
- Trip 1 (booked + checked-in): `cmq17krbw001j4ocd4u356vde` on 2026-06-11
- Trip 2 (booked + cancelled): `cmq17kt2u001k4ocdfk1v7cl7` on 2026-06-12

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 0 |
| 🟧 WARN | 2 |
| 🟩 PASS | 27 |
| ⬜ INFO | 0 |
| Total checks | 29 |

## Connection-flow matrix

| Check | Handoff | Result |
|---|---|---|
| **C1** | Operator releases a trip → it surfaces in public traveler search | 🟩 PASS |
| **C2** | Traveler discovers that trip → holds → pays (stub) → PAID | 🟧 WARN |
| **C3** | Paid booking appears on the operator manifest + DB (trip-scoped) | 🟩 PASS |
| **C4** | Search availableSeats decrements by ticketCount across the boundary | 🟩 PASS |
| **C5** | Operator check-in sets checkedInAt; second attempt idempotent | 🟩 PASS |
| **C6** | Operator cancels a booked trip → booking trip_cancelled + refund_out ledger | 🟧 WARN |
| **C7** | Approval gate: SUSPENDED operator trips vanish from search, return on APPROVED | 🟩 PASS |

## 🟥 Broken handoffs

_None detected._

## 🟧 Warnings

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| WARN | C2 | traveler | stub-pay UI "Thanh toán" button | unexpected: HTTP 303 (button may be fixed) |
| WARN | C6 | traveler | stub-pay UI "Thanh toán" button | unexpected: HTTP 303 (button may be fixed) |

## Full check log

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| PASS | setup | pg | pre-reset | seed operator re-armed (pwd=BBOp2026!, requiresPasswordChange=true) |
| PASS | setup | operator | login + first-login | authed → /op/dashboard ([shot](cross-persona-shots/001-op-login.png)) |
| PASS | C1 | operator | create bus XPS135410A | bus id cmq17koqx001i4ocdh813fnp3 ([shot](cross-persona-shots/002-create-bus.png)) |
| PASS | C1 | operator | create trip on Hà Nội→TP.HCM @price 188000 | trip id cmq17krbw001j4ocd4u356vde ([shot](cross-persona-shots/003-create-trip.png)) |
| PASS | C1 | operator | create trip on Hà Nội→TP.HCM @price 199000 | trip id cmq17kt2u001k4ocdfk1v7cl7 ([shot](cross-persona-shots/004-create-trip.png)) |
| PASS | C1 | connection | operator trip appears in /api/trips/search | trip1 visible: Hà Nội→TP.HCM 2026-06-11, 20 seats @ 188000đ |
| PASS | C1 | connection | second operator trip appears in search | trip2 visible 2026-06-12 |
| PASS | C2 | traveler | hold created → review | held seat for trip cmq17krbw001j4ocd4u356vde |
| PASS | C2 | traveler | funnel → gateway (hold + initiate) | reached /dev/stub-pay |
| WARN | C2 | traveler | stub-pay UI "Thanh toán" button | unexpected: HTTP 303 (button may be fixed) |
| PASS | C2 | traveler | complete payment via processPaymentWebhook (gateway path) | webhook HTTP 200 → booking paid (BB-2026-d235-w706) |
| PASS | C2 | traveler | booking result page shows success | result shows "thành công" ([shot](cross-persona-shots/005-result-success.png)) |
| PASS | C2 | connection | traveler completes booking on operator trip | trip1 booked + paid (BB-2026-d235-w706) |
| PASS | C3 | connection | paid booking present in operator's trip (DB) | booking BB-2026-d235-w706 status=paid |
| PASS | C3 | operator | passenger shows on /op/manifest | 1 checkable passenger row(s) on manifest ([shot](cross-persona-shots/006-op-manifest.png)) |
| PASS | C4 | connection | search availableSeats decremented after paid booking | seats 20 → 19 (Δ=1, expected 1) |
| PASS | C5 | connection | operator check-in sets Booking.checkedInAt | checkedInAt=Fri Jun 05 2026 17:39:11 GMT-0700 (Pacific Daylight Time) ([shot](cross-persona-shots/007-op-checkin.png)) |
| PASS | C5 | operator | check-in idempotent (no re-checkable row) | 0 still-checkable row(s) after check-in (expected 0) |
| PASS | C6 | traveler | hold created → review | held seat for trip cmq17kt2u001k4ocdfk1v7cl7 |
| PASS | C6 | traveler | funnel → gateway (hold + initiate) | reached /dev/stub-pay |
| WARN | C6 | traveler | stub-pay UI "Thanh toán" button | unexpected: HTTP 303 (button may be fixed) |
| PASS | C6 | traveler | complete payment via processPaymentWebhook (gateway path) | webhook HTTP 200 → booking paid (BB-2026-z52l-l313) |
| PASS | C6 | traveler | booking result page shows success | result shows "thành công" ([shot](cross-persona-shots/008-result-success.png)) |
| PASS | C6 | connection | traveler books trip2 (to be cancelled) | trip2 booked + paid |
| PASS | C6 | operator | cancel trip (POST .../cancel) | trip-status="Đã hủy" ([shot](cross-persona-shots/009-cancel-trip.png)) |
| PASS | C6 | connection | cancel flips booking paid → trip_cancelled | booking BB-2026-z52l-l313 status=trip_cancelled |
| PASS | C6 | connection | refund_out ledger row written for cancelled booking | 1 refund_out entr(y/ies) |
| PASS | C7 | connection | SUSPENDED operator trips disappear from search | trip1 hidden while operator SUSPENDED |
| PASS | C7 | connection | restoring APPROVED brings trips back | trip1 visible again after restore |
