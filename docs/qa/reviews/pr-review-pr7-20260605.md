PR REVIEW — PR #7 "feat: push rebuild backlog + OTA polish + pay/profile/OTP fixes" @ 3fc5afba
─────────────────────────────
Diff scope: 849 files, +59,299 / −7,700 lines, 162 commits (vs master)
PR exists: yes
State: open (not draft), mergeable, CI UNSTABLE
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/7

PRIORITY 1 — Block push, fix first:

  [SIZE] 849 files, ~51.6k net lines — 20× the P1 ceiling (>40 files / >800 net lines).
    Even excluding lockfile + 30 generated migration.sql, this is far past reviewable-in-one-pass.
    Author rationale (PR body): 131 commits accumulated unpushed since PR #6; this is a
    catch-up push, not one change. Rationale ACCEPTED as to *why* — but the shape risk stands:
    not bisectable, not revertable as a unit, CI failure localization is hard.
    Fix: cannot retro-split 131 historical commits cheaply. Mitigate instead — (a) confirm CI
    goes green before merge (currently UNSTABLE), (b) merge with a merge-commit (not squash) so
    the 131-commit history stays bisectable on master, (c) tag the pre-merge master SHA as a
    one-shot revert anchor.

  [SCOPE] 6+ distinct intents braided together: feat (charter/admin/ledger/onboarding/ticketing),
    fix (pay/profile/otp/ci), refactor (092/092b barrel sweep ~968 imports), chore (cash-rail
    delete), docs, test. Normally a hard split.
    Same constraint as SIZE — historical accumulation, not splittable now.
    Fix: accept for this catch-up PR; going forward enforce /commit-split per-slice so the next
    PR is one intent. Do NOT treat this PR as the new normal.

  [ROLLBACK] Destructive, irreversible migrations with NO rollback plan documented.
    Found in prisma/migrations/**/migration.sql:
      - ALTER TABLE "PaymentEvent" DROP COLUMN "resultCode"      (data loss)
      - ALTER TABLE "Booking" DROP COLUMN "cashCollectedAt"      (data loss)
      - in-place enum renames (BookingStatus paid_operator_notified→paid, HoldStatus
        converted→consumed, PayoutStatus settled→paid/pending→requested) — forward-only,
        no down-path
      - ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT
    No docs/ops/rollback-*.md exists (checked: NONE). PR body "Not in scope" covers go-live but
    says nothing about migration rollback.
    Fix: run /rollback-plan to author docs/ops/rollback-pr7.md covering each DROP/rename with a
    reverse-migration block (or an explicit "no rollback — forward-fix only" decision per op).
    For a fresh-deploy target with no prod data this may be a documented no-op, but the decision
    must be written down, not implicit.

PRIORITY 2 — Fix before merge:

  [NEGATIVE SPACE / TESTS] 59 new app/api/**/route.ts handlers added. Skill rule wants a matching
    test file per new route; a 1:1 map can't be confirmed in a shape pass at this scale.
    Fix: spot-confirm the money/auth-critical routes have tests (holds, bookings/initiate,
    payments/*/webhook, op payout/withdraw, admin step-up actions). The /code-review pass (next)
    covers diff test-coverage in depth — defer the per-route verdict to it.

  [CI] mergeStateStatus = UNSTABLE — at least one required check pending/failing at review time
    (pinned SHA 3fc5afba). A large PR merging on red is the classic post-merge-bisect nightmare.
    Fix: block merge until checks green; do not "merge and fix forward" on a 51k-line diff.

PRIORITY 3 — Address when convenient:

  [ENV] 16 process.env.* keys referenced across app/** + lib/** (CRON_SECRET, JWT_SECRET,
    TICKET_SECRET, STORAGE_STUB_SECRET, ESMS_API_KEY, REFRESH_TOKEN_SECRET, SENTRY/DATADOG URLs,
    etc.). .env.example IS in the diff (good) — confirm every new key above has a placeholder row
    so a fresh clone boots. Parity not auto-verifiable here (grep format mismatch).
    Fix: diff the env-key set vs .env.example keys once; add any missing placeholder.

  [PR DESC] Strong — has ## Summary, ## Verification, ## Not in scope. Title 64 chars (≤70 OK).
    No finding; noted as a positive. Body honestly flags "not go-live ready" + stub rails.

POSITIVE NOTES (shape done right):
  - Schema change ships WITH 30 migration files (no orphan schema drift). 
  - .env.example updated alongside new env vars.
  - No new RUNTIME deps — only 3 dev eslint plugins (boundaries/import-x/resolver). No license gap.
  - Commit messages: clean conventional-commit form throughout, issue-tagged (issue NNN),
    bodies present on feat/fix. No wip/asdf/fixup. Commit-message quality is exemplary.
  - PR body pre-emptively scopes out go-live risk.

SUMMARY: 3 P1, 2 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → ROLLBACK P1 is the only *actionable* blocker for this PR: run /rollback-plan → docs/ops/rollback-pr7.md.
  → Gate merge on CI going green (UNSTABLE → success).
  → SIZE/SCOPE P1s are structural & acknowledged — mitigate via merge-commit + pre-merge tag, do
    not attempt a retro-split. Enforce per-slice /commit-split on all FUTURE PRs.
  → Defer per-route test-coverage verdict to /code-review (next pass).
