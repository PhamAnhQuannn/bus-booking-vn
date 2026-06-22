# Cross-persona connection test — 2026-06-22

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/cross-persona-crawl.mts`) · Two contexts: operator 1366×950 + traveler 1280×900.
Mode: **full mutating + destructive** — creates a throwaway bus + 2 trips + 2 paid bookings, cancels one trip, and momentarily SUSPENDS then restores the seed operator (try/finally guarded). Operator acts as seed admin (`+84901230001`); traveler completes real stub payments.

> ⚠️ This run DIRTIED the dev DB. Run `pnpm db:seed` for a clean slate before a fresh comparison.

## Fixture state
- Route under test: **Sài Gòn → Thanh Hóa**
- Fresh bus: `cmqojt1dy005dg4cdenj59rrf` (capacity 20)
- Trip 1 (booked + checked-in): `cmqojt3zw005eg4cd37xqfz1p` on 2026-06-27
- Trip 2 (booked + cancelled): `new` on 2026-06-28

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 8 |
| 🟧 WARN | 1 |
| 🟩 PASS | 10 |
| ⬜ INFO | 0 |
| Total checks | 19 |

## Connection-flow matrix

| Check | Handoff | Result |
|---|---|---|
| **C1** | Operator releases a trip → it surfaces in public traveler search | 🟥 BROKEN |
| **C2** | Traveler discovers that trip → holds → pays (stub) → PAID | 🟥 BROKEN |
| **C3** | Paid booking appears on the operator manifest + DB (trip-scoped) | 🟥 BROKEN |
| **C4** | Search availableSeats decrements by ticketCount across the boundary | 🟩 PASS |
| **C5** | Operator check-in sets checkedInAt; second attempt idempotent | 🟧 WARN |
| **C6** | Operator cancels a booked trip → booking trip_cancelled + refund_out ledger | 🟥 BROKEN |
| **C7** | Approval gate: SUSPENDED operator trips vanish from search, return on APPROVED | 🟩 PASS |

## 🟥 Broken handoffs

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| BROKEN | C1 | connection | second operator trip appears in search | trip2 new NOT in search 2026-06-28 |
| BROKEN | instrument | traveler | POST /api/bookings/initiate (ctx:visit /search?origin=S%C3%A0i+G%C3%B2n&destination=Thanh+H%C3%B3a&date=2026-06-27&ticketCount=1) | HTTP 500 |
| BROKEN | C2 | traveler | initiate (POST /api/bookings/initiate) | stuck at /booking/review?holdId=4900108e-35bf-4177-b437-bd437aa078b9 ([shot](cross-persona-shots/005-initiate-stuck.png)) |
| BROKEN | C2 | connection | traveler completes booking on operator trip | booking did not reach paid state |
| BROKEN | C3 | connection | paid booking present in operator's trip (DB) | no paid booking row for trip1 |
| BROKEN | C3 | operator | passenger shows on /op/manifest | 0 checkable passenger row(s) on manifest ([shot](cross-persona-shots/006-op-manifest.png)) |
| BROKEN | C6 | traveler | locate trip card in search results | trip new not matched among 3 detail links / 3 book buttons (idx=-1) ([shot](cross-persona-shots/007-no-card.png)) |
| BROKEN | C6 | connection | traveler books trip2 (to be cancelled) | trip2 booking not paid |

## 🟧 Warnings

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| WARN | C5 | operator | check-in | no checkable manifest row to check in |

## Full check log

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
| PASS | setup | pg | pre-reset | seed operator re-armed (pwd=BBOp2026!, requiresPasswordChange=true) |
| PASS | setup | operator | login + first-login | authed → /op/dashboard ([shot](cross-persona-shots/001-op-login.png)) |
| PASS | C1 | operator | create bus XPS403167A | bus id cmqojt1dy005dg4cdenj59rrf ([shot](cross-persona-shots/002-create-bus.png)) |
| PASS | C1 | operator | create trip on Sài Gòn→Thanh Hóa @price 188000 | trip id cmqojt3zw005eg4cd37xqfz1p ([shot](cross-persona-shots/003-create-trip.png)) |
| PASS | C1 | operator | create trip on Sài Gòn→Thanh Hóa @price 199000 | trip id new ([shot](cross-persona-shots/004-create-trip.png)) |
| PASS | C1 | connection | operator trip appears in /api/trips/search | trip1 visible: Sài Gòn→Thanh Hóa 2026-06-27, 20 seats @ 188000đ |
| BROKEN | C1 | connection | second operator trip appears in search | trip2 new NOT in search 2026-06-28 |
| PASS | C2 | traveler | hold created → review | held seat for trip cmqojt3zw005eg4cd37xqfz1p |
| BROKEN | instrument | traveler | POST /api/bookings/initiate (ctx:visit /search?origin=S%C3%A0i+G%C3%B2n&destination=Thanh+H%C3%B3a&date=2026-06-27&ticketCount=1) | HTTP 500 |
| BROKEN | C2 | traveler | initiate (POST /api/bookings/initiate) | stuck at /booking/review?holdId=4900108e-35bf-4177-b437-bd437aa078b9 ([shot](cross-persona-shots/005-initiate-stuck.png)) |
| BROKEN | C2 | connection | traveler completes booking on operator trip | booking did not reach paid state |
| BROKEN | C3 | connection | paid booking present in operator's trip (DB) | no paid booking row for trip1 |
| BROKEN | C3 | operator | passenger shows on /op/manifest | 0 checkable passenger row(s) on manifest ([shot](cross-persona-shots/006-op-manifest.png)) |
| PASS | C4 | connection | search availableSeats decremented after paid booking | seats 20 → 19 (Δ=1, expected 1) |
| WARN | C5 | operator | check-in | no checkable manifest row to check in |
| BROKEN | C6 | traveler | locate trip card in search results | trip new not matched among 3 detail links / 3 book buttons (idx=-1) ([shot](cross-persona-shots/007-no-card.png)) |
| BROKEN | C6 | connection | traveler books trip2 (to be cancelled) | trip2 booking not paid |
| PASS | C7 | connection | SUSPENDED operator trips disappear from search | trip1 hidden while operator SUSPENDED |
| PASS | C7 | connection | restoring APPROVED brings trips back | trip1 visible again after restore |
