# Cross-persona connection test — 2026-06-05

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/cross-persona-crawl.mts`) · Two contexts: operator 1366×950 + traveler 1280×900.
Mode: **full mutating + destructive** — creates a throwaway bus + 2 trips + 2 paid bookings, cancels one trip, and momentarily SUSPENDS then restores the seed operator (try/finally guarded). Operator acts as seed admin (`+84901230001`); traveler completes real stub payments.

> ⚠️ This run DIRTIED the dev DB. Run `pnpm db:seed` for a clean slate before a fresh comparison.

## Fixture state
- Route under test: **Hà Nội → TP.HCM**
- Fresh bus: `cmq0oyydm008e1gcdw8tvl504` (capacity 20)
- Trip 1 (booked + checked-in): `cmq0oz0u1008f1gcdtwrnhddx` on 2026-06-10
- Trip 2 (booked + cancelled): `cmq0oz2sz008g1gcda41sfrai` on 2026-06-11

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 4 |
| 🟧 WARN | 0 |
| 🟩 PASS | 27 |
| ⬜ INFO | 0 |
| Total checks | 31 |

## Connection-flow matrix

| Check | Handoff | Result |
|---|---|---|
| **C1** | Operator releases a trip → it surfaces in public traveler search | 🟩 PASS |
| **C2** | Traveler discovers that trip → holds → pays (stub) → PAID | 🟥 BROKEN |
| **C3** | Paid booking appears on the operator manifest + DB (trip-scoped) | 🟩 PASS |
| **C4** | Search availableSeats decrements by ticketCount across the boundary | 🟩 PASS |
| **C5** | Operator check-in sets checkedInAt; second attempt idempotent | 🟩 PASS |
| **C6** | Operator cancels a booked trip → booking trip_cancelled + refund_out ledger | 🟥 BROKEN |
| **C7** | Approval gate: SUSPENDED operator trips vanish from search, return on APPROVED | 🟩 PASS |

## 🟥 Broken handoffs

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| BROKEN | instrument | traveler | POST /dev/stub-pay?adapter=zalopay&orderId=BB-2026-h1rk-wu43&amount=188000&red (ctx:visit /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-10&ticketCount=1) | HTTP 500 |
| BROKEN | C2 | traveler | stub-pay UI "Thanh toán" button | HTTP 500 — submitStubPayment gets empty outcome (Next16 submitter name/value dropped) [P1] |
| BROKEN | instrument | traveler | POST /dev/stub-pay?adapter=zalopay&orderId=BB-2026-0542-8i12&amount=199000&red (ctx:visit /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-11&ticketCount=1) | HTTP 500 |
| BROKEN | C6 | traveler | stub-pay UI "Thanh toán" button | HTTP 500 — submitStubPayment gets empty outcome (Next16 submitter name/value dropped) [P1] |

## 🟧 Warnings

_None._

## Full check log

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| PASS | setup | pg | pre-reset | seed operator re-armed (pwd=BBOp2026!, requiresPasswordChange=true) |
| PASS | setup | operator | login + first-login | authed → /op/dashboard ([shot](cross-persona-shots/001-op-login.png)) |
| PASS | C1 | operator | create bus XPS889213A | bus id cmq0oyydm008e1gcdw8tvl504 ([shot](cross-persona-shots/002-create-bus.png)) |
| PASS | C1 | operator | create trip on Hà Nội→TP.HCM @price 188000 | trip id cmq0oz0u1008f1gcdtwrnhddx ([shot](cross-persona-shots/003-create-trip.png)) |
| PASS | C1 | operator | create trip on Hà Nội→TP.HCM @price 199000 | trip id cmq0oz2sz008g1gcda41sfrai ([shot](cross-persona-shots/004-create-trip.png)) |
| PASS | C1 | connection | operator trip appears in /api/trips/search | trip1 visible: Hà Nội→TP.HCM 2026-06-10, 20 seats @ 188000đ |
| PASS | C1 | connection | second operator trip appears in search | trip2 visible 2026-06-11 |
| PASS | C2 | traveler | hold created → review | held seat for trip cmq0oz0u1008f1gcdtwrnhddx |
| PASS | C2 | traveler | funnel → gateway (hold + initiate) | reached /dev/stub-pay |
| BROKEN | instrument | traveler | POST /dev/stub-pay?adapter=zalopay&orderId=BB-2026-h1rk-wu43&amount=188000&red (ctx:visit /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-10&ticketCount=1) | HTTP 500 |
| BROKEN | C2 | traveler | stub-pay UI "Thanh toán" button | HTTP 500 — submitStubPayment gets empty outcome (Next16 submitter name/value dropped) [P1] |
| PASS | C2 | traveler | complete payment via processPaymentWebhook (gateway path) | webhook HTTP 200 → booking paid (BB-2026-h1rk-wu43) |
| PASS | C2 | traveler | booking result page shows success | result shows "thành công" ([shot](cross-persona-shots/005-result-success.png)) |
| PASS | C2 | connection | traveler completes booking on operator trip | trip1 booked + paid (BB-2026-h1rk-wu43) |
| PASS | C3 | connection | paid booking present in operator's trip (DB) | booking BB-2026-h1rk-wu43 status=paid |
| PASS | C3 | operator | passenger shows on /op/manifest | 1 checkable passenger row(s) on manifest ([shot](cross-persona-shots/006-op-manifest.png)) |
| PASS | C4 | connection | search availableSeats decremented after paid booking | seats 20 → 19 (Δ=1, expected 1) |
| PASS | C5 | connection | operator check-in sets Booking.checkedInAt | checkedInAt=Fri Jun 05 2026 08:58:27 GMT-0700 (Pacific Daylight Time) ([shot](cross-persona-shots/007-op-checkin.png)) |
| PASS | C5 | operator | check-in idempotent (no re-checkable row) | 0 still-checkable row(s) after check-in (expected 0) |
| PASS | C6 | traveler | hold created → review | held seat for trip cmq0oz2sz008g1gcda41sfrai |
| PASS | C6 | traveler | funnel → gateway (hold + initiate) | reached /dev/stub-pay |
| BROKEN | instrument | traveler | POST /dev/stub-pay?adapter=zalopay&orderId=BB-2026-0542-8i12&amount=199000&red (ctx:visit /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-11&ticketCount=1) | HTTP 500 |
| BROKEN | C6 | traveler | stub-pay UI "Thanh toán" button | HTTP 500 — submitStubPayment gets empty outcome (Next16 submitter name/value dropped) [P1] |
| PASS | C6 | traveler | complete payment via processPaymentWebhook (gateway path) | webhook HTTP 200 → booking paid (BB-2026-0542-8i12) |
| PASS | C6 | traveler | booking result page shows success | result shows "thành công" ([shot](cross-persona-shots/008-result-success.png)) |
| PASS | C6 | connection | traveler books trip2 (to be cancelled) | trip2 booked + paid |
| PASS | C6 | operator | cancel trip (POST .../cancel) | trip-status="Đã hủy" ([shot](cross-persona-shots/009-cancel-trip.png)) |
| PASS | C6 | connection | cancel flips booking paid → trip_cancelled | booking BB-2026-0542-8i12 status=trip_cancelled |
| PASS | C6 | connection | refund_out ledger row written for cancelled booking | 1 refund_out entr(y/ies) |
| PASS | C7 | connection | SUSPENDED operator trips disappear from search | trip1 hidden while operator SUSPENDED |
| PASS | C7 | connection | restoring APPROVED brings trips back | trip1 visible again after restore |
