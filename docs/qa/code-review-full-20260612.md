# CODE REVIEW — Full Codebase (master, --effort high)

**Date:** 2026-06-12 | **Scope:** 933 TS files, all production code | **Method:** 4-agent parallel category sweep

---

## PRIORITY 1 — Fix before go-live

### [CORRECTNESS / MONEY] lib/payment/adapters/momo.ts:128
Unsafe `Number()` coercion on webhook amount from PSP payload:
```typescript
const amount = Number(parsed.amount ?? 0);
```
If MoMo sends `"amount": "1e400"` → `Infinity`. If `"amount": "abc"` → `NaN`. Both bypass the underpayment check at `processWebhook.ts:176` (`Infinity` is not `< totalVnd`, so it passes; `NaN` comparisons are always false). A malformed IPN could mark a booking as paid without valid amount confirmation.
**Fix:** Add `if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: 'invalid_amount' }` before any comparison.

### [CORRECTNESS / MONEY] lib/jobs/reconcilePayments.ts:133
Same unsafe `Number()` coercion in the payment reconciliation sweeper:
```typescript
amount = Number(parsed.amount ?? 0);
```
Stored `PaymentEvent.rawBody` with malformed amount could reconcile incorrectly. The catch block only handles JSON parse errors, not invalid numeric values.
**Fix:** Add `Number.isFinite(amount)` guard, treat non-finite as non-confirming.

### [CORRECTNESS / STATE] lib/trips/completeTripCore.ts:65-90
Missing `departedAt` validation allows completing a trip that was never marked departed. The function fetches `departedAt` from the locked Trip row but never checks it. `autoCompleteTrips` (cron) correctly requires `status='departed'`, but the manual `markCompleted` path allows skipping the departed state entirely. Completing a non-departed trip triggers the payout pipeline prematurely.
**Fix:** Add guard after the FOR UPDATE lock: `if (!row.departedAt) throw new TripServiceError('trip_not_departed')`.

### [FAILURE MODE / MONEY] lib/trips/cancelTrip.ts:219-233
Refund failures during trip cancellation are logged but never retried or escalated. A booking marked `trip_cancelled` with a failed `refundOut()` call is left in an orphaned state — customer loses money with no automated recovery. Log says "refund needs retry" but no mechanism exists (no retry job, no flag, no requeue).
**Fix:** Either flag the booking for manual reconciliation review, or enqueue a retry job. At minimum, return partial-refund failure in the discriminated result so the route can surface it.

### [SECURITY / AUTH] app/api/cron/*/route.ts (all 11 handlers)
*(Cross-referenced from /security-review)* — CRON_SECRET auth check fails open when env var is unset. `if (cronSecret && ...)` skips the entire gate when `cronSecret` is falsy. CRON_SECRET is not in the Zod env schema — no startup validation.
**Fix:** Change to `if (!cronSecret || authHeader !== ...)` and add CRON_SECRET to `lib/config/env.ts` as required with `.min(16)`.

---

## PRIORITY 2 — Fix before merge / next sprint

### [CORRECTNESS / MONEY] lib/ledger/calcPayout.ts:85
`Number(rounded)` converts BigInt payout fee back to JS number. For extremely large VND aggregates (theoretical but possible with high-volume operators), precision loss could cause fee discrepancies. The Payout table stores `Int` which is 32-bit — large enough for realistic VND amounts but no overflow guard exists.
**Fix:** Add `if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw` guard, or keep in BigInt domain through to DB write.

### [CORRECTNESS / MONEY] lib/ledger/chargeback.ts:278,283
`backstopped: Number(shortfall)` converts BigInt to number in the return value. Same precision risk as calcPayout for extreme amounts.

### [FAILURE MODE] app/api/admin/finance/ledger/adjustment/route.ts:36-49
`addManualAdjustment()` call catches only `ManualAdjustmentError`. Prisma P2025 (operator not found) returns 500 instead of 404.
**Fix:** Catch `PrismaClientKnownRequestError` and map P2025 to 404.

### [FAILURE MODE] app/api/admin/finance/chargeback/route.ts:44-77
`recordChargeback()` catches only `ChargebackError`. Missing booking FK returns 500 instead of 404.

### [FAILURE MODE] app/api/admin/operators/[id]/fee-override/route.ts:43-55
`setOperatorFeeOverride()` catches only `FeeOverrideError`. Prisma constraint violations return 500.

### [FAILURE MODE] app/api/op/payout-account/route.ts:52-57
`setPayoutAccount()` not wrapped in try-catch. DB errors return 500 instead of controlled error.

### [FAILURE MODE] app/api/op/trips/route.ts:28-33
`fromDate` and `toDate` query params parsed via `new Date(string)` without validation. Malformed dates produce Invalid Date objects that silently pass through to Prisma queries, returning empty results instead of 400.
**Fix:** Validate date strings with regex or `isNaN(date.getTime())` check before query.

### [FAILURE MODE] app/api/op/auth/logout/route.ts:24
Session revocation error silently swallowed: `.catch(() => undefined)`. Failed revocation leaves token live until TTL expires.
**Fix:** Log error before swallowing: `.catch(err => logger.error({ err }, 'logout.revoke.failed'))`.

### [FAILURE MODE] app/api/op/buses/[id]/maintenance/route.ts:83-91
`prisma.busMaintenance.create()` not wrapped in try-catch. Constraint violations (duplicate busId+startAt) return 500 instead of 422.

### [VALIDATION] app/api/op/kyb/upload-url/route.ts:44-49
Manual `typeof` checks instead of Zod schema. Fragile, inconsistent with other routes that use Zod.
**Fix:** Define `uploadUrlSchema` with Zod and use `.safeParse()`.

### [TEST GAP] lib/payment/processWebhook.ts
Core IPN handler with money-critical logic has no dedicated unit test. Only tested indirectly via ledger integration tests. Edge cases (currency mismatch, overpayment, NaN amount) not unit-tested.

### [TEST GAP] lib/trips/completeTripCore.ts, markCompleted.ts, markDeparted.ts
Trip lifecycle functions lack isolated unit tests. Only integration-tested via `tripLifecycle.int.test.ts`.

---

## PRIORITY 3 — Address when convenient

### [READABILITY] lib/booking/listOperatorBookings.ts:75-76
Timezone handling uses string concatenation (`${serviceDate}T00:00:00+07:00`) while `searchTrips.ts` uses `date-fns-tz.fromZonedTime()`. Inconsistent patterns.

### [HYGIENE] Error response shapes inconsistent across routes
Some routes return `{ error: 'CODE' }`, others `{ error: 'CODE', issues: [...] }`. Client error handling is brittle.

### [HYGIENE] app/api/admin/moderation/routes/[id]/enable/route.ts:37
`prismaErrorToStatus()` only maps P2025 → 404. Other Prisma error codes (P2000, P2003, P2027) fall through to 500.

### [HYGIENE] app/api/op/profile/route.ts:130-145
Only P2002 (unique constraint) caught on `operatorUser.update()`. Other constraint violations (CHECK) become 500.

### [TEST GAP] lib/admin/{createOperator, disableOperator, resetOperatorAdminPassword}.ts
Operator lifecycle functions lack dedicated unit tests (integration-tested in `adminService.int.test.ts`).

### [TEST GAP] lib/account/{anonymizeCustomer, changePassword, changePhone, forgotPassword, resetPassword}.ts
Account management functions lack dedicated unit tests.

### [CODE QUALITY] No console.log/debugger/test.only found
Clean on all hygiene checks: no console logging in production code, no debugger statements, no `.only()` or `.skip()` in tests, no commented-out code blocks.

---

## SUMMARY

| Priority | Count | Domains |
|----------|-------|---------|
| **P1** | 5 | Money (2), State machine (1), Error recovery (1), Auth (1) |
| **P2** | 12 | Money (2), Error handling (6), Validation (2), Test gaps (2) |
| **P3** | 7 | Consistency (3), Test gaps (3), Readability (1) |

## Architecture Strengths Observed
- BigInt arithmetic throughout ledger/payout paths (no float drift)
- Consistent `FOR UPDATE` serialization on all financial state transitions
- Double-entry ledger with DB-level immutability triggers
- Zod validation on most route handlers (exceptions noted above)
- Pino logger with comprehensive PII redaction (44 paths)
- No console.log, debugger, or test.only in production code
- Named constants for all business thresholds (no magic numbers)
