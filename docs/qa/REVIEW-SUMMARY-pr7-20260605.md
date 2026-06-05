# Review Team — Combined Verdict — PR #7 @ 3fc5afba

**PR**: feat/rebuild-complete → master · 162 commits · 849 files · +59,299 / −7,700 · CI UNSTABLE
**Reviewed by**: 9 skills, full diff vs master, 2026-06-05.

## Per-skill scorecard

| # | Pass | P1 | P2 | P3 | Report |
|---|------|---:|---:|---:|--------|
| 1 | pr-review (shape) | 3 | 2 | 2 | pr-review-pr7-20260605.md |
| 2 | code-review (line) | 1 | 2 | 0 | code-review-pr7-20260605.md |
| 3 | architect-review | 0 | 1 | 1 | architect-review-pr7-20260605.md |
| 4 | security-review-deep | 1* | 0 | 3 | security-deep-pr7-20260605.md |
| 5 | consistency-audit | 0 | 1 | 2 | consistency-audit-pr7-20260605.md |
| 6 | type-safety-audit | 0 | 2 | — | type-safety-2026-06-05.md |
| 7 | debt-scan | 0 | 1 | 3 | debt-scan-pr7-20260605.md |
| 8 | perf-audit (static) | 0 | 0 | 2 | perf-audit-20260605.md (runtime CWV deferred) |
| 9 | dead-code-scan | 3 | 5 | — | dead-code-2026-06-05.md |

\* security P1 is the SAME finding as code-review P1 (otpProof replay) — counted once below.

## Merge-blocker list (deduped P1s)

1. **[SECURITY] otpProof replay** — `app/api/auth/register/route.ts` + login: raw `jwtVerify` with
   no jti consume; `'otp_proof'` missing from `JTI_REQUIRED_PURPOSES`. The documented (Issue 007)
   one-shot guarantee is not enforced. **Actionable, ~10 lines.** (code-review + security agree.)
2. **[ROLLBACK] No migration rollback plan** — destructive migrations (DROP COLUMN resultCode /
   cashCollectedAt, in-place enum renames) with no `docs/ops/rollback-*.md`. **Run /rollback-plan.**
3. **[CI] UNSTABLE** — at least one required check not green. Do not merge a 51k-line diff on red.
4. **[SHAPE] Size + scope** (pr-review 2×P1) — 849 files / 6 intents. STRUCTURAL & acknowledged
   (131 unpushed commits since PR#6). Not retro-splittable — mitigate, don't block (see verdict).
5. **[DEAD-CODE] 3 orphan files** — KpiTile/DetailLayout/updatePickupPoint (0 importers). Low-risk;
   confirm-not-pending-wire then delete. **Not a true merge blocker** — cleanup item.

## Verdict: **FIX-FIRST (small), then MERGE with mitigation**

This is a high-quality PR with one genuine code blocker and a set of process/shape items. The
per-issue QA discipline (the AGENTS.md Mistake Log) shows: money math, ledger, auth crypto, tenant
scoping, architecture boundaries, type safety, and query/index shape are all **clean**.

**Before merge (do these):**
- Fix the otpProof replay (blocker #1) — or document the deliberate exemption inline.
- Author `docs/ops/rollback-pr7.md` via /rollback-plan (blocker #2) — even if it's "fresh deploy,
  no prod data, forward-fix only," write the decision down.
- Get CI green (blocker #3).

**Merge mechanics (shape mitigation, blocker #4):**
- Merge with a **merge-commit** (not squash) so the 131-commit history stays bisectable on master.
- **Tag the pre-merge master SHA** as a one-shot revert anchor.
- Enforce per-slice `/commit-split` on ALL future PRs — this catch-up PR is not the new normal.

**Fast-follow (not blocking):**
- code-review P2s: payout-verify atomicity (wrap update+audit in $transaction), charter notify
  swallow → log instead of drop.
- type-safety P2s: RoutesClient unvalidated `as unknown as` cast; ratelimit field `: any`.
- debt P2: wrap payout-retry route in `withErrorHandler`.
- consistency P2: dedupe `MaintenanceWindow` (client/server contract drift).
- dep findings: `@sentry/nextjs` unlisted in package.json; verify `lint-staged` hook.
- dead-code: confirm + cut the 3 orphans (or file an issue to WIRE updatePickupPoint).
- ADR backfill (/adr-writer) + author docs/nfr.md + knip.json — hygiene, post-merge.
- **Run the real Lighthouse CWV gate** (`pnpm build && pnpm start`) before go-live #094.

**Out of scope / acknowledged (PR body is honest about these):** not go-live ready — real PSP
refunds throw, ZaloPay/Card stub-only, SMS/email log stubs, no .env.production, security gate #101
not run. These are a separate multi-week track, not this PR's job.

## One-line bottom line
Architecturally sound, money/auth code clean, one real ~10-line security fix + a written rollback
decision + green CI stand between this and a safe merge-commit. Reports in `docs/qa/*pr7*`.
