---
name: code-review
description: Line-level review of either the local branch diff (git diff <base>...HEAD) OR an open GitHub PR (when called as `/code-review <PR#>`) against a fixed checklist — correctness, security smells, failure modes, test coverage of diff, naming/readability, diff hygiene. Ranks findings P1/P2/P3 and writes docs/qa/code-review-<branch>-YYYYMMDD.md (local) or docs/qa/code-review-pr<PR#>-YYYYMMDD.md (PR mode). Hard-block gate on draft PR when chained from /commit-split. Use when user says "code review", "review my diff", "review changes", "review PR <N>", "/code-review", "/code-review <PR#>", or before merging any non-trivial diff.
output_size:
  XS: skip
  S: 15m
  M: 30m
  L: 1h
  XL: 2h
---

# /code-review — Line-Level Diff Review Gate

## Why you'd care

Type checks pass. Tests pass. Smoke test green. The PR still ships with a `prisma.payment.create()` outside any try/catch, a `parseInt(amount)` that drops decimal cents, and a new admin endpoint that forgets to check the session role. Surface tools don't catch reasoning bugs — only a structured line-level pass does. This skill is that pass, run before push, and ranked so P1 actually blocks.

Invoke as `/code-review` (local diff) or `/code-review <PR#>` (open GH PR). Reviews either the **branch diff vs base** locally or the PR diff fetched via `gh`. Not repo-wide.

---

## Mode selection

- **No arg** → **local mode**: review `git diff <base>...HEAD` on current working tree.
- **`<PR#>` arg** → **PR mode**: review the diff of GitHub PR `<PR#>` via `gh pr diff` / `gh pr view`. Use when reviewing someone else's PR, when chained from `/commit-split` (which opens a draft PR first), or any time the artifact of interest is the PR itself rather than local state.

Output filename differs by mode (see Output Format).

---

## Pre-flight

### Local mode (no arg)

1. Detect base branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` if `gh` available, else fall back to `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`, else default `main`
2. Verify current branch is NOT the base: `git rev-parse --abbrev-ref HEAD`. If on base, stop and tell user.
3. Build diff context:
   - `git diff <base>...HEAD --name-only` → file list
   - `git diff <base>...HEAD --stat` → size sense
   - `git diff <base>...HEAD --unified=10` → full reviewable diff with surrounding context
4. Read `CLAUDE.md` Mistake Log if present — any pattern listed there is **auto-P1** when matched in this diff (rationale: user already paid the cost once)
5. If diff is empty (branch caught up to base), stop and tell user — nothing to review

### PR mode (`<PR#>` arg)

1. `gh auth status` — must succeed. If `gh` missing or unauthenticated, stop and surface install/login hint.
2. `gh pr view <PR#> --json title,body,headRefName,baseRefName,headRefOid,isDraft,state` — fetch PR metadata. If PR not found / closed / merged, stop and tell user.
3. **Pin the review to `headRefOid`** — record the SHA. Use `gh pr diff <PR#>` (which resolves to current head) but tag the report with the pinned SHA so the user can tell if a force-push happened mid-review.
4. Fetch diff:
   - `gh pr diff <PR#> --name-only` → file list
   - `gh pr diff <PR#>` → full unified diff
5. Read `CLAUDE.md` Mistake Log if present — same auto-P1 rule as local mode.
6. If PR diff empty (e.g. just-opened PR with no commits), stop and tell user.
7. Determine **chain context**: if env var `COMMIT_SPLIT_CHAIN=1` is set (or invoked via `/commit-split` chain marker), the post-review step will `gh pr comment <PR#>`. Standalone invocation skips the auto-comment.

---

## Review Categories

Walk every changed file. For each category, scan added lines (`+`) and modified-context lines. Removed-only lines (`-`) are not reviewed unless deletion creates an obvious gap (e.g., removed authz check).

### Category 1 — Correctness

Hunt for reasoning bugs:
- **Off-by-one** — `for (let i = 0; i <= arr.length; i++)`, `slice(0, n-1)` when intent is "first n"
- **Null / undefined unguarded** — accessing `.field` on a result that can be null (Prisma `findUnique`, REST 404, optional chain missing)
- **Missing `await`** — async fn called without await, especially `prisma.*`, `fetch`, `fs.promises.*`
- **Race on shared state** — read-then-write on a row without `SELECT FOR UPDATE` / transaction; counter increment outside atomic op
- **Money rounding** — `parseFloat`/`Number` on currency strings; `*` or `/` on currency without integer-cent math; `toFixed(2)` for storage (display only)
- **Timezone** — `new Date(<string>)` without explicit timezone; `Date.now()` for "today" comparison; date diff across DST boundary
- **Regex catastrophic backtrack** — nested quantifiers (`(.*)+`, `(a+)+`) on user input
- **Off-domain coercion** — `==` on string vs number; truthy check on `0` or `""`

### Category 2 — Security smells

Trust boundaries first:
- **User input reaches dangerous sink** — `eval`, `Function()`, `child_process.exec` with template string, raw SQL with template string, `dangerouslySetInnerHTML` with unvalidated content
- **Missing authz** — new route handler / server action without role / ownership check
- **Secret in diff** — API key, password, token, JWT, private cert literal in source
- **Missing input validation at boundary** — request body parsed straight into `prisma.*.create({ data })` without schema (Zod / valibot / pydantic)
- **Open redirect / SSRF** — user-supplied URL passed to `fetch`, `redirect`, image-loader without allowlist
- **Mass assignment** — spread of `req.body` into update payload without field allowlist

### Category 3 — Failure mode

- **Unhandled rejection** — `await prisma.*` / `await fetch` not wrapped in try/catch in a route handler / server action
- **Catch-all swallow** — `catch { /* ignore */ }`, `catch (e) {}`, `.catch(() => {})` with no rethrow, log, or telemetry
- **No timeout on external call** — `fetch(url)` to third-party without `AbortSignal.timeout(...)` or equivalent
- **Missing idempotency on write endpoint** — POST that mutates without idempotency key handling, especially on payment / order / inventory
- **No retry budget** — retry loop with no max attempts or no backoff (potential DDoS-self)

### Category 4 — Test coverage of diff

Cross-check diff vs test files:
- Every NEW exported function / route handler / server action has a corresponding test added or modified in this diff
- Every NEW branch (if/else, switch arm, ternary on logic-bearing condition) in a money/auth/data-loss path has a test
- New test file references the new code (not a stub)

Test glob (TypeScript example — adapt per stack):
- `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`
- Python: `tests/**/test_*.py`
- Go: `**/*_test.go`

### Category 5 — Naming + readability

- **Flag arg** — `fn(x, true, false)` — boolean positional args without object/enum
- **Magic number / magic string** — literal in business logic without named constant (`if (status === 3)`, `setTimeout(fn, 86400000)`)
- **Dead code in same diff** — new function with zero callers, new export with zero importers
- **Comment says WHAT** — `// increment counter` above `counter++`. Strip or rewrite as WHY
- **Single-letter var outside loop counter / math** — `const u = await getUser()` instead of `const user`

### Category 6 — Diff hygiene

- Unrelated whitespace / formatting churn (mixed with real change)
- `console.log`, `console.debug`, `print(`, `dbg!`, `dump` in committed code
- `debugger` statement
- `.only` / `.skip` in tests
- Commented-out code blocks added in this diff
- Generated file (lock file, build output) checked in unexpectedly

---

## Severity Rules

| Severity | Triggers |
|----------|----------|
| **P1** | Category 1 finding on money / auth / data-loss path. Any Category 2 finding. Category 3 finding on payment / order / auth route. Missing test on risk-path branch (Cat 4 + risk path). Any pattern matched from CLAUDE.md Mistake Log. |
| **P2** | Category 1 finding on non-risk path. Category 3 finding on non-risk path. Missing test on non-risk new branch. |
| **P3** | Category 5 finding. Category 6 finding. |

Risk-path domains: `payment`, `auth`, `schema`, `admin`, plus any domain CLAUDE.md flags as critical.

---

## Output Format

Write to:
- **Local mode**: `docs/qa/code-review-<sanitized-branch>-YYYYMMDD.md`
- **PR mode**: `docs/qa/code-review-pr<PR#>-YYYYMMDD.md`

Format (header varies by mode):

```
CODE REVIEW — <branch> vs <base>                       ← local mode
CODE REVIEW — PR #<PR#> "<title>" @ <headRefOid[:8]>   ← PR mode
────────────────────────────────
Diff scope: <N> files, <+M / -K> lines

PRIORITY 1 — Block push, fix first:
  [CORRECTNESS / MONEY] app/api/checkout/route.ts:78
    parseFloat(req.body.amount) drops decimal cents on inputs like "10.105".
    Fix: use a decimal lib (decimal.js / dinero.js) or store as integer cents.

  [SECURITY / AUTHZ] app/api/admin/users/route.ts:12
    DELETE handler has no session.role === 'admin' check.
    Fix: gate behind requireAdmin(session) before db call.

  [TEST / RISK PATH] app/api/payments/refund/route.ts (new file)
    New refund endpoint has no test in this diff.
    Fix: add test/payments-refund.test.ts covering happy + failure + idempotency.

PRIORITY 2 — Fix before merge:
  [FAILURE MODE] app/api/orders/route.ts:145
    prisma.order.create() called without try/catch.
    Fix: wrap in try/catch, log to telemetry, return typed error to client.

PRIORITY 3 — Address when convenient:
  [READABILITY / MAGIC] lib/cart.ts:34
    Hardcoded 86400000 — name as MS_PER_DAY or use date-fns.

  [HYGIENE] app/(checkout)/page.tsx:88
    Leftover console.log({ debug: cart }).

SUMMARY: <N1> P1, <N2> P2, <N3> P3

RECOMMENDED NEXT STEPS:
  → Fix all P1 findings before /commit-split push gate.
  → For each P1, decide: fix in-place vs route to /lead for tracked task.
  → P2/P3 can ride this PR or defer.
```

---

## Post-review comment (PR mode + chain only)

When invoked from `/commit-split` chain (chain marker present) AND P1 count > 0:

1. Build comment body from P1 + P2 findings (P3 omitted to keep PR comment focused):
   ```
   ## /code-review findings (P1: <N>, P2: <M>)

   **Pinned to:** `<headRefOid[:8]>`

   ### P1 — block:
   - `<file>:<line>` — <one-line summary>. Fix: <one-line fix>.
   ...

   ### P2 — fix before merge:
   - `<file>:<line>` — <one-line summary>. Fix: <one-line fix>.
   ...

   _Full report: `docs/qa/code-review-pr<PR#>-YYYYMMDD.md`_
   ```
2. `gh pr comment <PR#> --body "$(cat <<'EOF' ... EOF)"`
3. Surface comment URL to chain caller.

**Standalone PR-mode invocation** writes the report file only — does NOT comment on the PR. User decides whether to share findings.

**Local mode** writes file only (no PR exists to comment on).

---

## Auto-chain

- Invoked from `/commit-split` review-gate sub-step against the freshly-opened draft PR. Returns P1 count; non-zero leaves PR as draft + posts comment.
- Standalone use: terminates with the report file. User decides next step.
- Cross-links: `/pr-inbox` (find which PR to review), `/type-safety-audit` (deeper TS escape-hatch hunt), `/security-review` (deeper attack-surface walk), `/tdd` (when missing-test finding becomes a tracked add).

## Integration

- **Consumed by**: `/commit-split` (review-gate on draft PR). Reads report head section, parses P1 count.
- **Produces**: `docs/qa/code-review-<branch>-YYYYMMDD.md` (local) or `docs/qa/code-review-pr<PR#>-YYYYMMDD.md` (PR mode)
- **Re-run**: idempotent. Same branch/PR + same day overwrites prior file (no clutter).

## Boundaries

- Does NOT review files outside the branch diff / PR diff
- Does NOT modify source code — advisory only
- Does NOT replicate `/verify` (typecheck, lint, run tests) — assumes those already passed
- Does NOT replicate `/smoke-test` (browser-level) — assumes that already passed
- Does NOT auto-comment in standalone mode — only when chained from `/commit-split`
