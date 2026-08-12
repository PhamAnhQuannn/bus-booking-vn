CODE REVIEW — PR #408 "refactor(tourism-kb): relocate tourism KB into a standalone feature" @ b9e7a5b0
────────────────────────────────
Diff scope: 842 files, +437 / −98,292 (≈790 pure renames/deletes; 18 M-files + 24 edited-renames are the real surface)

Method: reviewed only files with real content change. Skipped ~790 mechanical renames (`scripts/tourism/*`→`tourism-kb/code/*`, `docs/qa`→`docs/archive`) and untrack-deletions (`.claude/skills`, tourism data).

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [ARCHITECTURE / DOMAIN] app/(customer)/account/bookings/page.tsx:16, [id]/page.tsx:19, booking/confirmation/[token]/page.tsx:21
    Customer-facing pages now cross-domain deep-import `@/lib/op/statusLabels` — a booking-status
    map physically located in the OPERATOR domain (`lib/op`) but consumed by both op and customer.
    Works and is correct as a *client-safe* deep import (statusLabels imports only `import type`
    from @prisma/client — no server-only transitive, so the client-bundle rule is satisfied), but
    the label map arguably belongs in a shared/booking domain, not lib/op. Flag for /architect-review
    boundaries pass; not blocking.

  [BEHAVIOR / INTENTIONAL] lib/op/statusLabels.ts:24
    Two deliberate display changes land with the unify, both covered by updated tests:
      - `cancelled` variant danger → neutral (customer-initiated cancel is terminal-but-benign).
      - `no_show` label "Không có mặt" → "Vắng mặt" (confirmation page's old local map wording dropped
        in favor of the single source). Verify the copy change is intended, not incidental.

VERIFIED CLEAN:
  - lib/op/statusLabels.ts: `bookingStatusDisplay(status: BookingStatus)` returns `BOOKING_STATUS[status]`
    with NO `?? fallback`, but `BOOKING_STATUS` is `Record<BookingStatus, StatusDisplay>` (exhaustive)
    and `getBookingByConfirmationToken` returns `BookingFullDetails` whose `.status` is the Prisma
    `BookingStatus` enum → lookup can never miss. Removing the old `?? 'neutral'` defensive fallback
    is type-safe. Test updated in the SAME diff (positive assertion on neutral + added trip_cancelled).
  - Consumers rewired correctly: three local `STATUS_LABEL`/`STATUS_VARIANT` maps deleted, all point
    at the single source. EmptyState/PageHeader edits are comment-only (drop refs to deleted
    DataTable/FilterBar). No dead code introduced.
  - PII push-guards correctly remapped to the relocated layout, logic preserved:
      - greppable-invariants.sh G8: now `git ls-files` on `tourism-kb/{raw,wiki,output}` +
        `tourism-kb/code/*.json` + guide-basename-anywhere + all `*.docx`; `code/` deliberately
        excluded as the one tracked subtree. Queries the INDEX (push-reachability), not the worktree.
      - python-syntax.py: scans `git ls-files -- '*.py'` REPO-WIDE (not scripts/-scoped), so relocated
        `tourism-kb/code/*.py` stay gated; self-check FAILs if the glob collapses.
      - secret-scan-staged.sh + .gitleaks.toml: comment-only path updates, no rule weakened.
  - .gitignore: consolidates tourism rules into `tourism-kb/.gitignore`; KEEPS the
    `!docs/archive/current-status/**` negation that fixed the prior data-loss bug; unanchored
    `[0-9][0-9]-*.md` retained but now documented.
  - .github/workflows/ci.yml: repoints two relocated Python test paths only; no logic change.

SUMMARY: 0 P1, 0 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → No blockers. P3s are advisory (architecture taste + intentional copy changes).
  → /architect-review will assess the lib/op cross-domain import formally.
  → CI is the decisive gate for this PR: next build (Tailwind/Turbopack scans docs/) + tsc + the
    tourism-guard job. Watch those, not the linters.
