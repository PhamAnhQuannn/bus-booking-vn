CODE REVIEW — PR #19 "feat(security): automated data leak scanning suite" @ f2bc6a1e
────────────────────────────────
Diff scope: 8 files, +632 / -1 lines

PRIORITY 1 — Block push, fix first:
  [CORRECTNESS / TEST] e2e/data-leak-smoke.spec.ts:75
    Raw SQL inserts Operator with status 'active' but OperatorStatus enum is
    {PENDING_REVIEW, UNDER_REVIEW, APPROVED, REJECTED, SUSPENDED}. No 'active' value exists.
    Integration test (tenantIsolation.int.test.ts:23) correctly uses 'APPROVED'.
    The e2e test either fails on INSERT (constraint violation) or vacuously passes
    cross-tenant checks because operator B is invisible to all queries that filter
    by APPROVED status — tenant isolation is not actually tested.
    Fix: change raw SQL status value to 'APPROVED'.

PRIORITY 2 — Fix before merge:
  [CORRECTNESS / MAINTENANCE] lib/__tests__/logger.test.ts:98-107
    Forbidden fields list duplicated inline instead of importing from the shared
    constant in lib/security/__tests__/forbiddenFields.ts. If the canonical list
    gains a field and this inline copy does not, the "coverage for all forbidden
    fields" logger test silently goes stale.
    Fix: import FORBIDDEN_RESPONSE_FIELDS from '../security/__tests__/forbiddenFields'.

  [FAILURE MODE / TEST] e2e/data-leak-smoke.spec.ts:196-198
    `if (res.status() !== 200) return;` silently passes when the booking-list
    endpoint returns 500 or 403. The test gives false confidence — a broken
    endpoint reads as "no bookings seeded, skip" rather than a server error.
    Fix: assert `expect(res.status()).not.toBeGreaterThanOrEqual(500)` before
    the early return, or `expect([200, 404].includes(res.status())).toBe(true)`.

PRIORITY 3 — Address when convenient:
  [HYGIENE] e2e/data-leak-smoke.spec.ts:22
    SEED_PHONE defined but never used (lint confirms: @typescript-eslint/no-unused-vars).
    Fix: remove the constant.

SUMMARY: 1 P1, 2 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → Fix P1 (status 'active' → 'APPROVED' in e2e raw SQL) before merge.
  → P2 items can ride this PR or defer — both are test-quality improvements.
