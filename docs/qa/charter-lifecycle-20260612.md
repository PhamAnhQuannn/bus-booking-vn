# Charter Lifecycle Correctness Review
Date: 2026-06-12
Reviewer: automated QA sweep
Scope: 10-state machine, all charter routes, expiry sweeper, all unit and integration tests

---

## State Machine Map

```
                    ┌─────────────────────────────────────────────────┐
                    │                    SUBMITTED                    │
                    │  (created directly as ADMIN_REVIEW in practice)  │
                    └────────────────┬──────────────────┬────────────┘
                                     │                  │
                             ADMIN_REVIEW             CANCELLED (*)
                                     │
          ┌──────────────────────────┼──────────────────────┬──────────┐
          │                          │                      │          │
   ASSIGNED_DIRECT             PUBLISHED               REJECTED (T) CANCELLED (*)
          │                          │
    ┌─────┼─────┬─────┐        ┌─────┼──────┐
    │     │     │     │        │     │      │
 ACCEPTED DECLINED ADMIN_REVIEW CANCELLED(*) ACCEPTED  EXPIRED  CANCELLED(*)
          │         (timeout)                              │
          │                                         ADMIN_REVIEW
   ADMIN_REVIEW
   (re-route)

ACCEPTED ──────────────────────┬──────────────┐
                                │              │
                           COMPLETED (T)   CANCELLED (T)

(T) = Terminal state (no outgoing edges)
(*) = Customer-cancellable pre-ACCEPT terminal

DECLINED ──→ ADMIN_REVIEW  (transient state only — immediately re-routed by declineCharter)
EXPIRED  ──→ ADMIN_REVIEW  (transient state only — immediately re-routed by charterExpirySweeper)

Full edge list (16 legal edges):
  SUBMITTED        → ADMIN_REVIEW       (createCharterRequest: skipped, row created directly in ADMIN_REVIEW)
  SUBMITTED        → CANCELLED          (customer cancel — route never fires, row created in ADMIN_REVIEW)
  ADMIN_REVIEW     → ASSIGNED_DIRECT    (admin assign-direct)
  ADMIN_REVIEW     → PUBLISHED          (admin publish)
  ADMIN_REVIEW     → REJECTED           (admin reject)
  ADMIN_REVIEW     → CANCELLED          (customer cancel)
  ASSIGNED_DIRECT  → ACCEPTED           (operator accept)
  ASSIGNED_DIRECT  → DECLINED           (operator decline — step 1 of 2)
  ASSIGNED_DIRECT  → ADMIN_REVIEW       (sweeper: acceptByAt timeout)
  ASSIGNED_DIRECT  → CANCELLED          (customer cancel)
  PUBLISHED        → ACCEPTED           (operator claim — claimCharter atomic UPDATE)
  PUBLISHED        → EXPIRED            (sweeper: claimByAt timeout — step 1 of 2)
  PUBLISHED        → CANCELLED          (customer cancel)
  DECLINED         → ADMIN_REVIEW       (declineCharter: step 2 of 2)
  EXPIRED          → ADMIN_REVIEW       (sweeper: step 2 of 2)
  ACCEPTED         → COMPLETED          (admin/operator complete)
  ACCEPTED         → CANCELLED          (admin/operator teardown)
```

---

## Summary

The charter state machine is well-structured and largely correct. The single-source transition map, SELECT FOR UPDATE serialisation, and atomic conditional UPDATE for pool claims give strong correctness foundations. Three P1 bugs exist: a TOCTOU gap in the accept/decline routes between the ownership pre-check and the locked transition, a silent notification asymmetry in claimCharter when post-commit notification writes partially fail, and a sweeper vulnerability if EXPIRED → ADMIN_REVIEW throws (leaving a row stranded in the EXPIRED transient state). Several P2 race conditions and advisory gaps are documented below.

---

## P1 — Correctness Bugs

### P1-1: TOCTOU ownership gap in accept and decline routes
**Files:** `app/api/op/charter/[id]/accept/route.ts:49-55`, `app/api/op/charter/[id]/decline/route.ts:57-63`

**Issue:** Both routes perform a plain `prisma.charterRequest.findUnique` ownership check (no lock) and then call `transitionCharterRequest` (which takes its own `SELECT FOR UPDATE`). Between these two reads, an admin can call `assign-direct` to reassign the charter to a different operator. The TOCTOU window:
1. Op-A reads: `assigneeOperatorId = Op-A` → ownership check passes
2. Admin reassigns (ASSIGNED_DIRECT → ADMIN_REVIEW → ASSIGNED_DIRECT for Op-B) during the window
3. Op-A's transition proceeds on a row now assigned to Op-B

The `transitionCharterRequest` FOR UPDATE lock will catch this only if the status has already left `ASSIGNED_DIRECT`. If the reassign is incomplete (still ASSIGNED_DIRECT, new assignee), the transition succeeds and Op-A accepts a charter meant for Op-B.

**Impact:** Cross-operator charter acceptance. An operator can accept a lead they do not own if admin reassigns concurrently.

**Fix:** Move the ownership check inside the same transaction as the status transition. The FOR UPDATE lock should be issued first; then check `locked[0].assigneeOperatorId === operatorId` before calling `isLegalCharterTransition`. This requires threading the operatorId into `transitionCharterRequest` or adding a pre-transition assertion callback. Alternatively: do a second `WHERE id = $id AND assigneeOperatorId = $operatorId` inside the `$transaction` after the FOR UPDATE lock is held.

---

### P1-2: claimCharter post-commit notifications are sequential — partial failure leaves asymmetric state
**File:** `lib/charter/claimCharter.ts:157-196`

**Issue:** After a winning claim, four `createNotificationLog` calls are issued sequentially outside the transaction:
1. Customer charterMatched sms
2. Customer charterMatched email
3. Operator charterClaimWon sms
4. Operator charterClaimWon email

If call 1 succeeds and call 2 throws (e.g. DB connection drops mid-sequence), the customer receives an SMS but not an email. Worse, if call 2 or 3 throws, it propagates up and the HTTP response becomes a 500 to the winning operator even though the claim committed. The operator is confused (got a 500, will retry? But it's already claimed), and the customer received only partial notifications.

**Impact:** Operator sees 500 on a successful claim. May retry claim, gets 409 (already_claimed). Customer may receive only one of two confirmation notifications.

**Fix:** Wrap all four `createNotificationLog` calls in individual `try/catch` blocks (or use `Promise.allSettled` and log failures). The claim is already committed; notification failures must never propagate. Mirror the `declineCharter` pattern which wraps its single notification call in `try/catch` with a logger.warn.

---

### P1-3: Sweeper leaves charter stranded in EXPIRED on the second transition step if it throws
**File:** `lib/jobs/charterExpirySweeper.ts:154-163`

**Issue:** The two-step PUBLISHED → EXPIRED → ADMIN_REVIEW flow:
```ts
await transitionCharterRequest(prisma, { charterId: row.id, to: 'EXPIRED', actor });
// ← if anything throws here (network, pg error), the row stays EXPIRED
await transitionCharterRequest(prisma, { charterId: row.id, to: 'ADMIN_REVIEW', actor });
```
The comment says "an illegal_transition would be a genuine bug; let it surface". But `transitionCharterRequest` can also throw for reasons other than `illegal_transition` (connection errors, deadlocks). If the second call fails after the first committed, the row is stranded in `EXPIRED` indefinitely. `EXPIRED` is supposed to be a pure transient state (only reachable via sweeper, only leavable via sweeper), but a failure here leaves it with no mechanism to re-enter the sweeper loop (the sweeper's `publishedStale` query only picks `PUBLISHED` rows).

**Impact:** Charter requests stranded in EXPIRED forever. Customer never notified. Admin never sees the lead re-queued. The charter lead is lost.

**Fix:** Either (a) wrap the EXPIRED → ADMIN_REVIEW call in a `try/catch` that logs and continues (the sweeper will re-encounter the EXPIRED row on the next tick if the sweeper's query is expanded to include `EXPIRED`), or (b) add `EXPIRED` rows to the sweeper's candidate query with a separate loop that transitions EXPIRED → ADMIN_REVIEW directly. Option (b) is preferable because it also handles any future scenario where a row enters EXPIRED outside the sweeper.

---

## P2 — Race Condition Risks

### P2-1: Admin assign-direct racing with operator accept — brief correctness window
**Files:** `app/api/admin/charter/[id]/assign-direct/route.ts`, `app/api/op/charter/[id]/accept/route.ts`

Admin can call `assign-direct` (ADMIN_REVIEW → ASSIGNED_DIRECT) while an operator is simultaneously calling `accept` (ASSIGNED_DIRECT → ACCEPTED) on the same charter. Because `transitionCharterRequest` serialises via FOR UPDATE:
- If admin's transaction commits first: the row moves to ASSIGNED_DIRECT (different operator). The operator's `accept` FOR UPDATE then sees status=ASSIGNED_DIRECT and succeeds — accepting a charter that was just reassigned to a different operator. (This is the same bug as P1-1 seen from a different angle.)
- If the operator's `accept` commits first: admin's ADMIN_REVIEW → ASSIGNED_DIRECT throws `illegal_transition`. Admin gets 422 — correct behaviour.

**Impact:** Same as P1-1 in the worst case.

---

### P2-2: Customer cancel racing with operator accept
**File:** `app/api/charter/[ref]/cancel/route.ts:42-69`

The cancel route does: read status → check CUSTOMER_CANCELLABLE_STATUSES → call transition. In the window between read and transition lock, the operator accepts (ASSIGNED_DIRECT → ACCEPTED). The FOR UPDATE lock in `transitionCharterRequest` will see status=ACCEPTED and the ASSIGNED_DIRECT→CANCELLED edge is no longer valid — so `illegal_transition` is thrown and the route correctly returns 422 CANNOT_CANCEL. This race is correctly handled.

**Status:** Handled correctly; no action needed.

---

### P2-3: Sweeper SKIP LOCKED vs concurrent claim — the cancel window
**File:** `lib/jobs/charterExpirySweeper.ts:85-93`

The sweeper uses `SKIP LOCKED` to avoid blocking rows held by concurrent operator actions. This is correct. However, the sweeper's lock tx holds the candidate ids; then each row's transition runs in a separate short `$transaction`. Between the SKIP LOCKED SELECT and the per-row transition, a customer could cancel the charter (PUBLISHED → CANCELLED). The per-row EXPIRED transition will then fail with `illegal_transition` (status=CANCELLED, not PUBLISHED), and the sweeper correctly catches and skips it. No issue.

**Status:** Handled correctly.

---

### P2-4: Double-sweep within CLAIM_LIMIT
**File:** `lib/jobs/charterExpirySweeper.ts:50`

`CLAIM_LIMIT = 200` bounds work per tick. If more than 200 ASSIGNED_DIRECT rows are stale simultaneously, the first tick processes 200, and the next tick processes the remainder. This is intentional and documented. The advisory lock prevents overlapping ticks. No issue.

**Status:** By design.

---

## P3 — Advisory

### P3-1: SUBMITTED state is declared but unreachable in practice
**File:** `lib/charter/createCharterRequest.ts:107`

`createCharterRequest` creates rows directly in `ADMIN_REVIEW`, skipping `SUBMITTED` entirely. The `SUBMITTED → ADMIN_REVIEW` and `SUBMITTED → CANCELLED` edges in `LEGAL_CHARTER_TRANSITIONS` are therefore dead code. The `CUSTOMER_CANCELLABLE_STATUSES` set includes `SUBMITTED`. In the cancel route, a `getCharterByRef` for a `SUBMITTED` row would pass the gate — but since no row is ever in `SUBMITTED`, this is theoretical.

**Advisory:** Either remove `SUBMITTED` from the DB enum, the transition map, and `CUSTOMER_CANCELLABLE_STATUSES`; or add a comment explicitly acknowledging it is reserved for future use (e.g. a step-by-step wizard that saves a draft). Leaving a dangling state in the transition map is confusing to future contributors and creates test coverage noise.

---

### P3-2: claimCharter operator notify phone falls back to empty string silently
**File:** `lib/charter/claimCharter.ts:134`

```ts
operatorNotifyPhone: r.operatorNotificationPhone ?? r.operatorContactPhone ?? '',
```
If both `notificationPhone` and `contactPhone` are null on the `Operator` row, `operatorNotifyPhone` is `''`. The post-commit check `if (w.operatorNotifyPhone)` gates on truthiness, so an empty string correctly skips the SMS enqueue. However, the operator receives zero win-notification by SMS if both phone fields are null. The schema does not enforce NOT NULL on `notificationPhone` (it is nullable), and `contactPhone` is nullable in the query result (typed as `string | null`). No crash, but the operator learns of the win only via email.

**Advisory:** Log a warning when both phone fields are null on a winning claim so ops can investigate why the operator has no notification phone. The current code silently skips.

---

### P3-3: getPublicPoolCharters does not page-fence stale PUBLISHED rows
**File:** `lib/charter/getOperatorCharters.ts:208`

The pool query excludes expired items via `OR: [claimByAt: null, claimByAt > now]`. However, a PUBLISHED row with `claimByAt: null` has no deadline and will appear in the pool forever until an operator claims it or the admin manually cancels or re-routes. The sweeper's `publishedStale` query filters `claimByAt IS NOT NULL AND claimByAt <= now`, so a null-deadline PUBLISHED row is never swept. This is intentional per the schema comment ("claimByAt is optional") but worth flagging: an admin who publishes without setting a deadline creates a permanently-visible pool item.

The `publish` route always sets `claimByAt = now + 48h` (48-hour window). So this case cannot arise from the current route. But `transitionCharterRequest` itself accepts `claimByAt: undefined` and writes `claimByAt: null` for the PUBLISHED case.

**Advisory:** Either validate in `transitionCharterRequest` that `claimByAt` is required (non-null) when transitioning to PUBLISHED, or add the null-deadline case to the sweeper's query as an explicit no-deadline pool item.

---

### P3-4: No route for ACCEPTED → COMPLETED; the "complete" transition has no admin UI route
**Files checked:** `app/api/admin/charter/`, `app/api/op/charter/`

The `ACCEPTED → COMPLETED` edge is declared in `LEGAL_CHARTER_TRANSITIONS` and is legitimate (off-platform fulfillment is done, admin marks it complete). No API route implementing this transition was found in `app/api/admin/charter/` or `app/api/op/charter/`. The `ACCEPTED → CANCELLED` edge is similarly un-routed for admin/operator teardown.

**Advisory:** Confirm whether these edges are intentionally deferred (the charter is settled off-platform; completed/cancelled are maybe only used later). If they are intended to be reachable, add the routes. Without them, accepted charters remain in `ACCEPTED` forever in the DB.

---

### P3-5: SUBMITTED state in CUSTOMER_CANCELLABLE_STATUSES is misleading without a route
**File:** `lib/charter/charterStatus.ts:84-89`

The `cancel` route resolves the charter by `ref` (via `getCharterByRef`) and then checks `CUSTOMER_CANCELLABLE_STATUSES`. Since `SUBMITTED` is never the actual initial state of a row, the `SUBMITTED` entry in the set has no effect at runtime but misleads readers into thinking customer-submitted-but-not-yet-reviewed charters can be cancelled. See P3-1 for the root cause.

---

### P3-6: declineCharter two-transaction gap (known, documented)
**File:** `lib/charter/declineCharter.ts:56-60`

The ASSIGNED_DIRECT → DECLINED → ADMIN_REVIEW double-transition is explicitly documented as not being wrapped in a single outer transaction. If the first transition (→ DECLINED) commits and the second (→ ADMIN_REVIEW) fails with a non-`illegal_transition` error (e.g. network failure), the row is left in DECLINED. DECLINED is only leavable via `DECLINED → ADMIN_REVIEW`, so a subsequent retry of the decline route will fail with `illegal_transition` (DECLINED → DECLINED is not a legal edge), and the admin will need to manually intervene.

**Advisory:** Add the DECLINED state to the sweeper as a reclaim target: rows in DECLINED for more than N minutes should be automatically re-routed to ADMIN_REVIEW. Alternatively, add a `DECLINED → ADMIN_REVIEW` direct cron sweep alongside the existing ones.

---

## State-by-State Analysis

### SUBMITTED
- **Legal edges out:** ADMIN_REVIEW, CANCELLED
- **Enforcement:** Edge check in `transitionCharterRequest` with FOR UPDATE
- **Reality:** No row is ever created in SUBMITTED (`createCharterRequest` writes ADMIN_REVIEW directly). The state is a dead letter.
- **Edge cases:** The `cancel` route would accept a SUBMITTED charter (it is in `CUSTOMER_CANCELLABLE_STATUSES`) — but cannot fire because no row reaches SUBMITTED.
- **Risk:** Dangling dead state adds cognitive load and test coverage noise.

### ADMIN_REVIEW
- **Legal edges out:** ASSIGNED_DIRECT, PUBLISHED, REJECTED, CANCELLED
- **Enforcement:** All four edges go through `transitionCharterRequest` with FOR UPDATE (admin routes for assign/publish/reject; cancel route for customer cancel)
- **Entry paths:** `createCharterRequest` (initial), DECLINED → ADMIN_REVIEW (declineCharter), EXPIRED → ADMIN_REVIEW (sweeper), ASSIGNED_DIRECT → ADMIN_REVIEW (sweeper timeout)
- **Side effects on entry:** `transitionCharterRequest` clears `assigneeOperatorId`, `acceptByAt`, `claimByAt` (stale deadline cleanup)
- **Edge cases:** None found.

### ASSIGNED_DIRECT
- **Legal edges out:** ACCEPTED, DECLINED, ADMIN_REVIEW, CANCELLED
- **Enforcement:** `transitionCharterRequest` FOR UPDATE for all edges except the TOCTOU window described in P1-1
- **Entry path:** Only `assign-direct` admin route (ADMIN_REVIEW → ASSIGNED_DIRECT); sets `assigneeOperatorId` + `acceptByAt`
- **Side effects on entry:** `assigneeOperatorId` and `acceptByAt` written atomically with status flip
- **Edge cases:** P1-1 (TOCTOU ownership check); acceptByAt=null is possible if admin route is bypassed (only via direct `transitionCharterRequest` call — current route always sets 24h deadline)

### PUBLISHED
- **Legal edges out:** ACCEPTED, EXPIRED, CANCELLED
- **Enforcement:** ACCEPTED uses `claimCharter` atomic UPDATE (correct); EXPIRED uses `transitionCharterRequest` (sweeper); CANCELLED uses `transitionCharterRequest` (cancel route)
- **Entry path:** Only `publish` admin route; sets `publishedAt` + `claimByAt`
- **Side effects on entry:** `publishedAt = now()`, `claimByAt = now + 48h`
- **Edge cases:** P3-3 (null claimByAt would make pool item permanent, not possible via current routes)

### DECLINED
- **Legal edges out:** ADMIN_REVIEW
- **Enforcement:** `transitionCharterRequest` FOR UPDATE
- **This is a transient state** — `declineCharter` immediately follows with ADMIN_REVIEW. A row stuck in DECLINED (due to P3-6 gap) has no automatic recovery.
- **Side effects on entry:** `assigneeOperatorId = null` (frees the operator)

### EXPIRED
- **Legal edges out:** ADMIN_REVIEW
- **Enforcement:** `transitionCharterRequest` FOR UPDATE (sweeper)
- **This is a transient state** — sweeper immediately follows with ADMIN_REVIEW. A row stuck in EXPIRED (P1-3) has no recovery mechanism.
- **Side effects on entry:** `assigneeOperatorId = null`

### ACCEPTED
- **Legal edges out:** COMPLETED, CANCELLED
- **Enforcement:** `transitionCharterRequest` FOR UPDATE
- **No route implements either edge** (P3-4 advisory) — `ACCEPTED` is effectively terminal in the current implementation
- **Side effects on entry (any path):** Customer match notification (sms + email) enqueued. For `claimCharter`: operator win notification also enqueued.
- **Edge cases:** If `claimByAt` has passed at claim time, `claimCharter` rejects the UPDATE (correct). If the status moved to ACCEPTED between the pool-query (getPublicPoolCharters) and the claim attempt, `claimCharter` returns `already_claimed` (correct).

### REJECTED (Terminal)
- **Legal edges out:** none
- **Enforcement:** `transitionCharterRequest` throws `illegal_transition` if any exit is attempted
- **Entry path:** Only `reject` admin route; sets `rejectionReason`
- **Correctly terminal:** Yes

### COMPLETED (Terminal)
- **Legal edges out:** none
- **Entry path:** No route (P3-4)
- **Correctly terminal:** Yes

### CANCELLED (Terminal)
- **Legal edges out:** none
- **Entry path:** Customer cancel route (pre-ACCEPT states), admin/operator teardown (ACCEPTED — no route, P3-4)
- **Correctly terminal:** Yes

---

## Notification Side-Effects

| Transition | Notifications sent | Failure mode | Impact |
|---|---|---|---|
| Row creation (ADMIN_REVIEW) | charterSubmitted sms + email to customer | Best-effort, outside tx; individual call throws | Customer may receive 1 of 2 confirmations |
| Any state → ACCEPTED (via `transitionCharterRequest`) | charterMatched sms + email to customer | Best-effort, post-commit; individual `createNotificationLog` call throws → propagates | Customer may receive 1 of 2 match notifications; caller gets 500 |
| PUBLISHED → ACCEPTED (via `claimCharter`) | charterMatched sms + email to customer; charterClaimWon sms + email to operator | Sequential, no try/catch (P1-2) | 500 to winning operator even though claim committed; partial notifications possible |
| ASSIGNED_DIRECT → DECLINED (via `declineCharter`) | charterDeclined email to 'ops' | Wrapped in try/catch with logger.warn | Best-effort; failure logged, not fatal |
| Stale ASSIGNED_DIRECT → ADMIN_REVIEW (sweeper) | charterReturnedToReview sms + email to customer | Best-effort, no error handling shown in sweeper | NotificationLog failure propagates up through `notifyReturned`, which is `await`ed directly — sweeper would throw and the row would not increment `rerouted`; remaining rows continue |
| Stale PUBLISHED → EXPIRED → ADMIN_REVIEW (sweeper) | charterReturnedToReview sms + email to customer (same as above) | Same as above |

**Note on sweeper notification failure:** At `lib/jobs/charterExpirySweeper.ts:135`, `await notifyReturned(row)` is called after the transition commits but is not wrapped in a try/catch. If `createNotificationLog` throws, the exception propagates to the sweeper's for-loop, which has no catch for it. The error would propagate to the `runJob` caller and likely abort the entire sweep tick. This means a notification DB error during sweeping stops all subsequent reroutes for that tick.

**Fix:** Wrap `notifyReturned` calls in try/catch (similar to the `declineCharter` pattern) so a notification failure only drops one notification, not the entire sweep.

---

## Expiry Sweeper Analysis

### Null-deadline handling
- **ASSIGNED_DIRECT + null acceptByAt:** The sweeper query `WHERE "acceptByAt" IS NOT NULL AND "acceptByAt" <= now` correctly skips rows with null deadlines. A directly-assigned charter with no acceptByAt is never timed out. The `assign-direct` route always sets `acceptByAt = now + 24h`, so null here is only possible via direct DB manipulation or a future API omission.
- **PUBLISHED + null claimByAt:** The sweeper query `WHERE "claimByAt" IS NOT NULL AND "claimByAt" <= now` correctly skips null-deadline pool items. Such items remain in the pool indefinitely (P3-3).

### Concurrent execution protection
The advisory lock `'charter-sweep'` (via `runJob`/`withAdvisoryLock`) prevents overlapping ticks. SKIP LOCKED on the candidate SELECT prevents the sweeper from blocking rows held by concurrent operator actions. Both mechanisms are correctly applied.

### EXPIRED → ADMIN_REVIEW non-catch vulnerability (P1-3)
The second-step transition is called without error handling. Any non-`illegal_transition` exception (network, deadlock) strands the row in EXPIRED permanently.

### The sweeper does NOT cover:
- DECLINED rows stranded by P3-6 failures
- EXPIRED rows stranded by P1-3 failures

---

## Test Coverage

| Transition | Unit test | Integration test | E2E test |
|---|---|---|---|
| SUBMITTED → ADMIN_REVIEW | Yes (charterStatus.test.ts — `legalEdges`) | No | No |
| SUBMITTED → CANCELLED | Yes (charterStatus.test.ts — `legalEdges`) | No | No |
| ADMIN_REVIEW → ASSIGNED_DIRECT | Yes (charterStatus.test.ts — side-effect fields) | No | No |
| ADMIN_REVIEW → PUBLISHED | Yes (charterStatus.test.ts — side-effect fields) | No | No |
| ADMIN_REVIEW → REJECTED | Yes (charterStatus.test.ts — side-effect fields) | No | No |
| ADMIN_REVIEW → CANCELLED | Yes (charterStatus.test.ts — legalEdges + cancel route tests) | No | No |
| ASSIGNED_DIRECT → ACCEPTED | Yes (charterStatus.test.ts — ACCEPTED notification test) | No | No |
| ASSIGNED_DIRECT → DECLINED | Yes (charterStatus.test.ts + declineCharter.test.ts) | No | No |
| ASSIGNED_DIRECT → ADMIN_REVIEW (timeout) | Yes (charterStatus.test.ts + sweeper integration) | Yes (charterExpirySweeper.int.test.ts) | No |
| ASSIGNED_DIRECT → CANCELLED | Yes (charterStatus.test.ts — legalEdges) | No | No |
| PUBLISHED → ACCEPTED (claim) | Yes (claim route unit test) | Yes (claimCharter.int.test.ts — concurrent) | No |
| PUBLISHED → EXPIRED | Yes (charterStatus.test.ts — legalEdges) | Yes (charterExpirySweeper.int.test.ts) | No |
| PUBLISHED → CANCELLED | Yes (charterStatus.test.ts — legalEdges) | No | No |
| DECLINED → ADMIN_REVIEW | Yes (declineCharter.test.ts) | No | No |
| EXPIRED → ADMIN_REVIEW | Yes (charterStatus.test.ts — legalEdges) | Yes (charterExpirySweeper.int.test.ts) | No |
| ACCEPTED → COMPLETED | Yes (charterStatus.test.ts — legalEdges) | No | No |
| ACCEPTED → CANCELLED | Yes (charterStatus.test.ts — legalEdges) | No | No |

**No E2E tests exist for any charter flow.** The lack of e2e coverage is the largest gap — no full customer-submit → admin-review → publish → claim → notify flow has been exercised end-to-end.

**Race condition test coverage:**
- PUBLISHED → ACCEPTED concurrent claim: **Tested** (claimCharter.int.test.ts, Promise.all concurrency)
- ASSIGNED_DIRECT → ACCEPTED concurrent accept + admin reassign: **Not tested**
- Customer cancel racing with operator accept: **Not tested** (the route handles it correctly, but no test exercises the race)
- Sweeper racing with concurrent operator accept on ASSIGNED_DIRECT: **Not tested** (the sweeper comment explains the design, but no test exercises it)

---

## Recommendations (Prioritised)

1. **(P1 — immediate)** Fix `claimCharter` post-commit notifications: wrap each `createNotificationLog` call in its own `try/catch` with `logger.warn`. A DB failure in a best-effort notification must never surface as a 500 to the winning operator.
   - File: `lib/charter/claimCharter.ts:157-196`

2. **(P1 — immediate)** Fix sweeper `notifyReturned` call sites: wrap both `await notifyReturned(row)` calls in try/catch so a notification failure drops one log row, not the entire sweep tick.
   - File: `lib/jobs/charterExpirySweeper.ts:135, 163`

3. **(P1 — important)** Fix EXPIRED → ADMIN_REVIEW stranding: wrap the second-step transition call in a try/catch that logs a critical alert and either continues (accepting the stranded row until next tick with expanded sweeper query) or adds EXPIRED rows to the sweeper candidate query directly.
   - File: `lib/jobs/charterExpirySweeper.ts:157-162`

4. **(P1 — important)** Fix TOCTOU ownership gap in accept/decline routes: move the `assigneeOperatorId === operatorId` check inside the `$transaction` after the FOR UPDATE lock is held. The simplest approach: inside `transitionCharterRequest`, accept an optional `requiredAssigneeOperatorId` parameter; if provided, check `locked[0].assigneeOperatorId === requiredAssigneeOperatorId` before the edge check and throw `CharterError('illegal_transition')` if it fails.
   - Files: `app/api/op/charter/[id]/accept/route.ts:49-55`, `app/api/op/charter/[id]/decline/route.ts:57-63`, `lib/charter/charterStatus.ts` (add parameter)

5. **(P2 — near-term)** Add DECLINED to the sweeper (or add a recovery mechanism): rows stuck in DECLINED by P3-6 failure have no automated recovery. A simple additional query in the sweeper for `status = 'DECLINED' AND updatedAt < now - 5min` would catch these.

6. **(P3 — backlog)** Decide on SUBMITTED state: either remove it from the enum, the transition map, and CUSTOMER_CANCELLABLE_STATUSES, or document its intended future use. The dead state adds confusion.

7. **(P3 — backlog)** Add routes for ACCEPTED → COMPLETED and ACCEPTED → CANCELLED so accepted charters have a lifecycle end. Currently accepted charters have no path out of ACCEPTED.

8. **(P3 — backlog)** Add E2E tests for the primary charter flow: customer submit → admin review → admin publish → operator claim → notifications verified. The current test suite is unit/integration only with no e2e coverage for any charter path.
