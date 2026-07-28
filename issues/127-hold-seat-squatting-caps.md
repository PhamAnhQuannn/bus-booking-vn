---
depends-on: []
type: BUG
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 3. GitHub #359.

## What to fix

Seat holds are gated only by an unverified `buyerPhone` (regex-only, `lib/core/validation/hold.ts:21`;
Phase 1 has no customer auth). Denial-of-inventory against the core product, at zero cost.

**The rate limit is not the lever.** `ticketCount` is per-hold, capped at 10
(`lib/core/validation/hold.ts:14`), and `CONCURRENT_HOLD_CAP = 5` (`lib/core/db/holdErrors.ts:8`)
— so one fake phone holds **50 seats in 5 requests**. A 45-seat trip locks with five POSTs,
nowhere near the generic 60/min/IP limit. Renew on the 10-minute TTL
(`lib/core/db/holdRepo.ts:30`) and the trip never sells.

**`bb_sid` can be withheld.** It is HttpOnly, minted only on safe-method requests, and
`proxy.ts:302` **returns the minting response directly** rather than forwarding — mint and
app-handling never share a request. A real browser has it by POST time; a script that never
issues a GET never has one. So a `bb_sid`-keyed cap is opt-in for the attacker unless a
missing `bb_sid` is its own, stricter bucket.

### Fix (decided: cap total held seats per session)

1. **Per-session seat ceiling.** Cap total seats in flight per `bb_sid` (proposed 10). Keep
   `ticketCount` max 10 and `CONCURRENT_HOLD_CAP` 5 unchanged, so a family booking 10 seats in
   one hold still works while 50-across-five does not.
2. **Anonymous bucket.** Requests with no `bb_sid` get a much tighter ceiling and a dedicated
   limiter key. Do not treat absent-session as a fresh allowance.
3. **Dedicated limiter.** `holdsRatelimit` keyed `hold:<bb_sid>` / `hold-anon:<ip>`, following
   the established `<prefix>:<identifier>` convention (`charter:<ip>` in
   `app/api/charter/route.ts:63`; `op-login:<ip>` in `app/api/auth/login/route.ts:51`).
   `POST /api/holds` is currently the only route using the bare shared `ratelimit.limit(ip)`
   with no prefix (`app/api/holds/route.ts:35`).
4. **No per-IP-only cap** — Vietnamese mobile CGNAT and shared household Wi-Fi put many
   unrelated buyers behind one egress IP.
5. **`Retry-After` on the cap branch.** `HOLD_CAP_EXCEEDED` returns 429 with no `Retry-After`
   (`app/api/holds/route.ts:105-107`), so `lib/api/holdsClient.ts:64-67` fabricates 60s and the
   UI cannot distinguish a cap from a throttle — both render the same copy
   (`CustomerForm.tsx:351-353`).
6. **Denial telemetry.** The cap logs `tripId` only; the rate-limit branch logs nothing; `track()`
   has no funnel step for a denied hold (`lib/analytics/track.ts:12-17`). Add one signal so
   squatting is visible.

## Acceptance criteria

- [ ] One session cannot hold more than the seat ceiling across any number of holds or phones.
- [ ] A request with no `bb_sid` is capped more tightly than one with a session.
- [ ] A single legitimate 10-seat family hold still succeeds.
- [ ] `HOLD_CAP_EXCEEDED` carries `Retry-After`; the client distinguishes it from a throttle.
- [ ] A denied hold emits a log line carrying the limiting key and reason (never the phone).
- [ ] **Route-level** test: existing hold int tests are DB-layer only and never construct a
      request (`lib/core/db/__tests__/holdCap.int.test.ts`), so extend
      `app/api/holds/__tests__/route.test.ts` — its `makeRequest(body, headers?)` helper takes a
      `Cookie` header.

## Blocked by

- none

## Files

- `lib/core/validation/hold.ts`, `lib/core/db/holdRepo.ts`, `lib/core/db/holdErrors.ts`
- `app/api/holds/route.ts`, `lib/ratelimit/index.ts`, `lib/api/holdsClient.ts`

## Severity

LAUNCH — one attacker from one IP denies the entire inventory of a trip for free. Bank transfer
is the only live rail, so a locked trip is direct lost revenue.
