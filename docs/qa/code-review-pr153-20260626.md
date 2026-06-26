CODE REVIEW — PR #153 "fix(hold): post-QA fixes — sweeper validation, cookie clear, request correlation" @ 005dd6e9
────────────────────────────────
Diff scope: 14 files, +833 / -1987 lines (net -1154; bulk is deleted rebuild docs + added QA reports)
Code-only scope: 6 files, +30 / -10 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

NOTES:

1. [CORRECTNESS ✓] sweep-holds/route.ts — `getEnv().HOLD_SWEEPER_MODE` replaces
   raw `process.env` read. Zod schema enforces `z.enum(['count', 'update']).default('count')`,
   so invalid values now throw at first call instead of silently falling through to
   the update branch. `getEnv()` caches after first parse — no repeated validation cost.

2. [CORRECTNESS ✓] bookings/initiate/route.ts — `res.cookies.set('bb_hold', '', { maxAge: 0 })`
   clears the cookie on success. Uses Next.js cookies API (not raw Set-Cookie header),
   which correctly handles serialization. HttpOnly + SameSite=Lax flags match the
   original cookie set in POST /api/holds.

3. [CORRECTNESS ✓] holds/route.ts — `const logger = loggerForRequest(...)` shadows
   the removed module import, so all existing `logger.info(...)` calls in the handler
   body automatically use the child logger with requestId. No call-site changes needed.
   Same pattern applied in sweep-holds/route.ts with `const log = loggerForRequest(...)`.

4. [SECURITY ✓] No new route handlers. No auth/payment paths changed. Cookie clear
   is additive security improvement (expires stale auth artifact sooner). CRON_SECRET
   auth unchanged (still raw process.env — intentional, matches all other cron routes).

5. [FAILURE MODE ✓] `getEnv()` can throw on invalid HOLD_SWEEPER_MODE. This happens
   inside the request handler AFTER auth check, so unauthenticated requests still get
   clean 401. An invalid value would surface as 500 on the first authenticated request —
   correct fail-loud behavior vs the prior silent fallthrough.

6. [TEST COVERAGE ✓] All code changes have corresponding test changes:
   - sweep-holds test: mocks `getEnv` instead of `process.env.HOLD_SWEEPER_MODE`
   - initiate test: asserts `Set-Cookie bb_hold=; Max-Age=0` via `getSetCookie()`
   - getHoldDetails.test.ts: 6 new tests (DTO mapping, null, totalVND, dates, pickup)

7. [HYGIENE ✓] No console.log, debugger, .only/.skip. Deleted files are confirmed
   obsolete (rebuild-plan/order/mismatches — old planning docs superseded by
   docs/work-inventory.md). QA report files are new additions documenting test results.

8. [MISTAKE LOG CHECK] Scanned all CLAUDE.md Mistake Log entries:
   - vi.mock() path rule: test uses `vi.mock('@/lib/config', ...)` matching barrel
     import — correct. Other cron tests use same pattern (verified: bank_transfer,
     charter decline).
   - 'use client' barrel rule: no client components touched — N/A.
   - getEnv production-required rule: HOLD_SWEEPER_MODE has `.default('count')` so
     it's NOT in the superRefine production-required list — no CI env update needed.
   - RSC purity: no render-body changes — N/A.

SUMMARY: 0 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Clean review. Proceed to /pr-review and CI.
