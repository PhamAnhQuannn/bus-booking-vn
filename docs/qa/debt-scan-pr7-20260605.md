DEBT SCAN
─────────
Scanned: ~553 changed source files (PR #7 feat/rebuild-complete @ 3fc5afba)

PRIORITY 1 — Fix before next sprint:
  (none)

PRIORITY 2 — Improve before launch:
  [MISSING ERROR-WRAPPER / MONEY PATH] app/api/op/reports/payouts/[id]/retry/route.ts:24
    POST handler does NOT use the `withErrorHandler` HOF that sibling routes use for scrubbed 500s.
    It IS functionally safe — `retryPayout` returns a discriminated result (all domain errors
    mapped to 404/409) with a `satisfies never` exhaustiveness guard, and FOR UPDATE is held in the
    service. BUT an unexpected throw (DB down, etc.) bypasses scrubbing and returns Next's default
    500, which can leak a stack trace in non-prod and is inconsistent with the rest of /api.
    Escalated to P2 (not P1) because the money mutation itself is correct — only the failure
    presentation is unscrubbed.
    Fix: wrap the handler body in `withErrorHandler` like the other op routes.

PRIORITY 3 — Clean up when touching this area:
  [MISSING ERROR-WRAPPER] app/api/cron/sweep-holds/route.ts
    No withErrorHandler; mutate path is covered by `runJob` (advisory lock + JobRunLog) and the
    count path is a single read. CRON_SECRET-gated. Low risk — add withErrorHandler for uniformity.

  [MISSING ERROR-WRAPPER] app/api/auth/otp/test-peek/route.ts
    Dev/test-only OTP peek endpoint. Verify it is env-gated off in production; if so, leave as-is.

  [LARGE FILES — verify no >80-line single function] qr.ts (743), BusesClient.tsx (566),
    FinanceActions.tsx (521), reconcilePayments.ts (464), processWebhook.ts (431).
    qr.ts is a self-contained pure-JS QR codec (Reed-Solomon + bit matrix + lookup tables) — long
    by nature, NOT debt. The client components are handler-dense, not monolithic. Spot-check for a
    single >80-line function when next editing; none flagged as alarming.

  [TS ESCAPE HATCHES] See docs/qa/type-safety-2026-06-05.md — 0 @ts-ignore, ~7 `any` confined to
    the Prisma-DI seam. Not re-listed here.

SUMMARY: 0 P1, 1 P2, 3 P3 — total 4 debt items

POSITIVE / LOW-DEBT SIGNALS:
  - 41 of 44 /api route handlers use the `withErrorHandler` HOF (scrubbed 500s) — only 3 outliers.
  - TODO/FIXME/HACK markers: 8 total in prod, mostly false-positive prose ("temporary password"
    is a feature, not deferred work). No "workaround"/"temporary" deliberate-deferral debt.
  - Fee/tax/commission rates are CONFIG-DRIVEN (FeeConfig ppm-encoded, effective-dated) — zero
    hardcoded percentages inline. This is the highest-leverage anti-debt decision in the codebase.
  - No hardcoded base URLs (header-derived / env-derived per Issue 002 Mistake Log fix).

RECOMMENDED NEXT STEPS:
  → /lead "wrap payout-retry route in withErrorHandler" [P2 — money path, unscrubbed 500]
  → P3s are touch-when-nearby; not sprint-worthy on their own.
