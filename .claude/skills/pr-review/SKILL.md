---
name: pr-review
description: Diff-as-a-whole review judging PR shape, not code lines — scope discipline, diff size, commit message quality, negative-space audit (missing migration / env / test / docs), rollback path, PR description completeness. Accepts optional `<PR#>` arg — without arg reviews local branch + commit log; with arg fetches the open GH PR via `gh pr view --json` + `gh pr diff` and reviews shape of the real PR artifact (including the actual PR body, not a pre-built one). Ranks findings P1/P2/P3 and writes docs/qa/pr-review-<branch>-YYYYMMDD.md (local) or docs/qa/pr-review-pr<PR#>-YYYYMMDD.md (PR mode). Hard-block gate on draft PR when chained from /commit-split. Use when user says "PR review", "review pull request", "review my PR", "review PR <N>", "/pr-review", "/pr-review <PR#>", or before opening / marking-ready a PR.
output_size:
  XS: skip
  S: 10m
  M: 20m
  L: 30m
  XL: 1h
---

# /pr-review — Pull-Request Shape Review Gate

## Why you'd care

`/code-review` catches bad lines. `/pr-review` catches a bad PR: 38 files spanning a refactor, a feature, and an unrelated bugfix; a new column with no migration; a feature flag with no sunset date; a `payments.refund()` call with no rollback plan. Reviewers reject these PRs not because the code is wrong but because the *shape* is wrong — impossible to bisect, impossible to revert, impossible to land safely. This skill enforces shape.

Invoke as `/pr-review` (local) or `/pr-review <PR#>` (open GH PR). Reviews **PR-level metadata**: file set, commit messages, what is/isn't in the diff, PR description.

---

## Mode selection

- **No arg** → **local mode**: collects commit log + diff stat from `git`; opportunistically reads PR body via `gh pr view` if a PR happens to exist for the current branch.
- **`<PR#>` arg** → **PR mode**: full GH fetch of the PR `<PR#>`. Negative-space audit + PR description completeness read the **real PR body** (not a draft/local one). Use when reviewing someone else's PR or when chained from `/commit-split` (which opens a draft PR first).

Output filename differs by mode (see Output Format).

---

## Pre-flight

### Local mode (no arg)

1. Detect base branch (same as `/code-review`): `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`, fall back to `origin/HEAD`, fall back to `main`
2. Verify on a feature branch (not base). Stop if on base.
3. Collect PR data:
   - `git diff <base>...HEAD --name-only` → file list
   - `git diff <base>...HEAD --stat` → size
   - `git log <base>..HEAD --pretty=format:%s%n%b%n---` → commit messages
   - `git log <base>..HEAD --pretty=format:%H %s` → commit count
   - `gh pr view --json title,body 2>/dev/null` → PR metadata if PR exists; tolerate failure
4. If diff empty, stop and tell user

### PR mode (`<PR#>` arg)

1. `gh auth status` — must succeed. If `gh` missing or unauthenticated, stop and surface install/login hint.
2. Fetch full PR metadata in one call:
   ```
   gh pr view <PR#> --json number,title,body,headRefName,baseRefName,headRefOid,commits,additions,deletions,files,reviewDecision,isDraft,state,labels,url
   ```
   If PR not found / closed / merged, stop and tell user.
3. **Pin to `headRefOid`** — record SHA in report header so user can detect mid-review force-push.
4. Fetch file list + diff:
   - `gh pr diff <PR#> --name-only` → file list (cross-check with `files` from step 2)
   - `gh pr diff <PR#>` → unified diff for negative-space audit triggers
5. Extract commit subjects + bodies from `commits` array in step-2 JSON (each commit has `messageHeadline` + `messageBody`).
6. If PR diff empty (just-opened PR with no commits), stop and tell user.
7. Determine **chain context**: if invoked via `/commit-split` chain marker, post-review step `gh pr comment`s findings. Standalone invocation writes report file only.

---

## Review Categories

### Category 1 — Scope discipline

Classify diff intent from commit subjects + file paths:
- `feat:` adds new behavior
- `fix:` repairs broken behavior
- `refactor:` restructures without behavior change
- `chore:` tooling / config
- `docs:` docs only
- `test:` tests only

Count distinct intents in the PR. Threshold:
- 1-2 related intents (e.g. `feat` + `test` for same area) → OK
- 3+ unrelated intents → **P1** with "split via `/commit-split` rerun"

Also flag: same intent across unrelated domains (e.g. `feat(auth)` + `feat(payment)` + `feat(ui)` with no shared thread) → **P2**

### Category 2 — Diff size

| Net lines changed | Files | Severity |
|-------------------|-------|----------|
| ≤ 400 | ≤ 20 | OK |
| 401–800 | 21–40 | **P2** — ask split |
| > 800 | > 40 | **P1** — must split |

Exceptions (do NOT count as oversize):
- Lock file churn (`pnpm-lock.yaml`, `package-lock.json`, `poetry.lock`, `go.sum`, `Cargo.lock`)
- Generated files (`prisma/migrations/**/migration.sql`, codegen output, OpenAPI generated clients)
- Snapshot test updates (when only diff line is snapshot hash)

Compute `net = additions - deletions` excluding exception paths.

### Category 3 — Commit message quality

Walk each commit subject:
- Must match conventional commit form: `<type>(<scope>)?: <subject>` where type ∈ {feat, fix, refactor, chore, docs, test, perf, build, ci, style, revert}
- Subject ≤ 72 chars
- Body present for any `feat:` or `fix:` (explains WHY, not WHAT)
- No "wip", "fixup", "asdf", "test commit" subjects

Severity:
- > 30% of commits violate format → **P2**
- Any commit subject contains "wip" / "fixup" / "asdf" / "fix typo" / "address comments" without prior commit context → **P2** (squash or rebase needed)
- Missing body on `feat:` / `fix:` → **P3** per commit

### Category 4 — Negative-space audit (what's NOT in the diff)

For each pattern below, check if the trigger appears in the diff AND the required companion is absent. Severity per row:

| Trigger in diff | Required companion | Severity if missing |
|-----------------|-------------------|---------------------|
| New column / table / index in schema file (`prisma/schema.prisma`, `alembic/*`, `db/migrate/*`) | Matching migration file added | **P1** |
| New env var (`process.env.X`, `os.environ['X']`, `ENV['X']`) referenced in code | `.env.example` updated with X | **P1** |
| New route handler / server action file | Matching test file added | **P1** |
| New feature flag (`flag.X`, `featureFlag('X')`, env-driven flag) | Rollout plan documented in PR body OR `docs/ops/rollback-*.md` reference OR sunset date in PR body | **P2** |
| New public API endpoint (`app/api/**/route.ts` exporting GET/POST/PUT/PATCH/DELETE) | API docs or OpenAPI updated | **P2** |
| New runtime dep added to `package.json` / `pyproject.toml` / `go.mod` | License note in PR body OR `/licensing-audit` reference | **P2** |
| New cron / scheduled job | Failure-mode + observability doc reference | **P2** |
| New external API call (`fetch('https://...')`, `axios.*`, SDK init) | Timeout + retry note in PR body | **P3** |

### Category 5 — Rollback path

Scan diff for **irreversible operations**:
- Migration with `DROP COLUMN`, `DROP TABLE`, `DROP INDEX`, `ALTER COLUMN ... DROP`
- Payment-side mutation: `stripe.charges.create`, `stripe.refunds.create`, `stripe.subscriptions.cancel`, equivalent for other processors
- Queue purge / topic delete
- File deletion in shared storage (`s3.deleteObject`, etc.)
- `rm -rf` in any script added or modified

For each, check PR body / `docs/ops/rollback-*.md` for documented rollback plan covering this op.

Severity:
- Irreversible op + no rollback plan → **P1**
- Irreversible op + rollback plan present → OK (note in report)
- Reversible op (additive migration, idempotent write) → skip

### Category 6 — PR description completeness

**PR mode** (always runs against the real PR body fetched in pre-flight):
- Title ≤ 70 chars → P3 if violated
- Body has `## Summary` section → P3 if missing
- Body has `## Test plan` section → P3 if missing
- Body mentions linked issue (`Closes #`, `Fixes #`, `Refs #`) if commits reference issue numbers → P3 if missing
- Body present (non-empty) → P2 if empty (PR with no description is bad shape)

**Local mode** runs same checks only if `gh pr view` opportunistically returned data. If no PR exists yet: note "no PR yet — `/commit-split` will assemble body; this check re-runs against the real PR via `/pr-review <PR#>` after the draft opens".

### Category 7 — Negative-space audit on real PR body (PR mode only)

Augments Category 4 with PR-body checks (because the PR body is the canonical place to document these):
- New feature flag in diff AND PR body does NOT mention rollout plan / sunset date / kill-switch reference → **P2** (Category 4 catches the trigger; this checks the documented half)
- Irreversible op in diff AND PR body does NOT contain rollback notes / `docs/ops/rollback-*.md` link → **P1** (overrides Category 5 sub-finding when no rollback file exists either)
- New runtime dep added AND PR body does NOT contain license / `/licensing-audit` note → **P2**

Local mode skips this category (no real PR body to read).

---

## Severity Rules

Severities are assigned inline above. The summary aggregates by max across all categories.

---

## Output Format

Write to:
- **Local mode**: `docs/qa/pr-review-<sanitized-branch>-YYYYMMDD.md`
- **PR mode**: `docs/qa/pr-review-pr<PR#>-YYYYMMDD.md`

Format (header varies by mode):

```
PR REVIEW — <branch> vs <base>                              ← local mode
PR REVIEW — PR #<PR#> "<title>" @ <headRefOid[:8]>          ← PR mode
─────────────────────────────
Diff scope: <N> files, <+M / -K> lines, <C> commits
PR exists: yes | no
State: open/draft/ready (PR mode only)

PRIORITY 1 — Block push, fix first:
  [SCOPE] 4 unrelated intents in this PR.
    Detected: feat(auth), feat(payment), refactor(ui), fix(unrelated-bug)
    Fix: rerun /commit-split to group; push separately or carve into multiple PRs.

  [NEGATIVE SPACE / MIGRATION] prisma/schema.prisma:42 adds `User.lastLoginAt` column.
    No matching migration file added in prisma/migrations/.
    Fix: run `pnpm prisma migrate dev --name add_last_login_at`, commit the migration.

  [ROLLBACK] Migration 20260518_drop_legacy_phone.sql drops column.
    No rollback plan documented in PR body or docs/ops/.
    Fix: write reverse-migration block; reference in PR body.

PRIORITY 2 — Fix before merge:
  [SIZE] 612 net lines across 27 files.
    Risk: hard to review, hard to bisect.
    Fix: consider splitting into 2 PRs.

  [COMMIT MSG] 5 of 12 commits violate conventional commit format.
    Examples: "wip auth fix", "address comments", "asdf"
    Fix: interactive rebase to squash + rewrite.

PRIORITY 3 — Address when convenient:
  [PR DESC] PR title 84 chars (limit 70).
  [PR DESC] PR body missing ## Test plan section.

SUMMARY: <N1> P1, <N2> P2, <N3> P3

RECOMMENDED NEXT STEPS:
  → Fix all P1 findings before /commit-split push gate.
  → For SCOPE P1, rerun /commit-split with current state to regroup.
  → For NEGATIVE-SPACE migration P1, generate and commit migration before push.
```

---

## Post-review comment (PR mode + chain only)

When invoked from `/commit-split` chain AND P1 count > 0:

1. Build comment body:
   ```
   ## /pr-review findings (P1: <N>, P2: <M>)

   **Pinned to:** `<headRefOid[:8]>`

   ### P1 — block:
   - [<finding-type>] <one-line summary>. Fix: <one-line fix>.
   ...

   ### P2 — fix before merge:
   - [<finding-type>] <one-line summary>. Fix: <one-line fix>.
   ...

   _Full report: `docs/qa/pr-review-pr<PR#>-YYYYMMDD.md`_
   ```
2. `gh pr comment <PR#> --body "$(cat <<'EOF' ... EOF)"`
3. Surface comment URL to chain caller.

**Standalone PR-mode invocation** writes file only — no auto-comment.

**Local mode** writes file only (no PR exists yet, or wasn't asked to read it).

---

## Auto-chain

- Invoked from `/commit-split` review-gate sub-step against the freshly-opened draft PR. Returns P1 count; non-zero leaves PR as draft + posts comment.
- Standalone: terminates with report file. Cross-link `/pr-inbox` (find PR#), `/commit-split` (regroup), `/migration-author` (when migration missing), `/rollback-plan` (when rollback gap), `/licensing-audit` (when new dep).

## Integration

- **Consumed by**: `/commit-split` (review-gate on draft PR). Reads P1 count from report header.
- **Produces**: `docs/qa/pr-review-<branch>-YYYYMMDD.md` (local) or `docs/qa/pr-review-pr<PR#>-YYYYMMDD.md` (PR mode)
- **Re-run**: idempotent. Same branch/PR + same day overwrites.

## Boundaries

- Does NOT review individual code lines — that's `/code-review`
- Does NOT review repo-wide architecture — that's `/architect-review`
- Does NOT modify diff or PR — advisory only
- Does NOT auto-open or auto-close PR — only `/commit-split` opens PR
- Does NOT auto-comment in standalone mode — only when chained from `/commit-split`
