---
name: commit-split
description: Group all currently-modified files into scoped, dependency-ordered commits with conventional-commit messages. Maps each file to a domain (auto-detected business domains + universal slots: schema, shared-lib, auth, payment, ui, admin, infra, claude-config) and orders commits so each group compiles cleanly. Flags cross-domain files for manual split. Use when the user says "commit", "stage", "group my changes", or whenever 10+ files span 3+ domains.
output_size:
  XS: 5m
  S: 10m
  M: 15m
  L: 20m
  XL: 30m
---

# /commit-split — Commit Grouping Gate

## Why you'd care

A single 40-file commit spanning schema, auth, billing, and UI is impossible to review, impossible to bisect, and impossible to revert cleanly. Grouping by domain and ordering by dependency turns the same change into commits that each compile, each tell a story, and each roll back independently.

Invoke as `/commit-split`. Groups all modified files into scoped, dependency-ordered commits.

---

## Pre-flight

Before producing the commit plan:
1. Run `git status` — identify all modified, added, deleted files
2. Run `git diff --stat` — confirm which files have actual changes
3. If git is unavailable, stop and tell the user — this skill needs git
4. **Detect business domains.** List the immediate subdirs under whichever of these exists in the repo: `app/api/`, `app/(routes)/`, `src/modules/`, `src/routes/`, `services/`, `internal/`. Each top-level subdir name becomes a candidate domain. If none of those layouts exist, run `/stack-profile` first.

---

## Domain Taxonomy

Domains come from two sources: **universal slots** (cross-vertical, hardcoded below) and **detected business domains** (from Pre-flight step 4).

### Universal slots

Map each file to exactly one universal domain when its path matches:

| Domain          | Path patterns (Next.js + Prisma worked example — adapt for your stack)                                          |
|-----------------|-----------------------------------------------------------------------------------------------------------------|
| `schema`        | `prisma/schema.prisma`, `prisma/migrations/**` — or `alembic/versions/**`, `db/migrate/**`, `drizzle/**`        |
| `shared-lib`    | `lib/types/**`, `lib/utils.ts`, `lib/constants.ts`, `lib/db.ts` — or `src/lib/**`, `<pkg>/common/**`            |
| `auth`          | `app/api/auth/**`, `app/(auth)/**`, `lib/auth.ts`, `middleware.ts` — or `auth/**`, `<pkg>/auth/**`              |
| `payment`       | `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts` — or `<pkg>/payments/**`, `<pkg>/webhooks/**` |
| `ui`            | `components/ui/**`, `components/<other generic>/**`, `app/globals.css`, `tailwind.config.*`, `app/layout.tsx` — or `src/components/**`, `templates/**` |
| `admin`         | `app/admin/**`, `app/api/admin/**`, `components/admin/**` — or `<pkg>/admin/**`, `internal/admin/**`            |
| `infra`         | `next.config.*`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `vitest.config.*`, `playwright.config.*`, `.env*`, `Dockerfile`, `docker-compose*`, `vercel.json` — or `pyproject.toml`, `requirements*.txt`, `go.mod`, `Gemfile`, `.github/**` |
| `claude-config` | `.claude/**`, `CLAUDE.md`                                                                                       |

### Detected business domains

For each domain name returned by Pre-flight step 4, map files under its top-level dir (and matching component/route subtrees) to that domain. Examples:

- Restaurant: `menu`, `orders`, `reservations`
- Fintech: `accounts`, `transfers`, `cards`, `kyc`
- Marketplace: `listings`, `messaging`, `payouts`
- SaaS-tool: `workspaces`, `members`, `billing`
- Content: `posts`, `comments`, `feeds`

The list is project-specific. Do not hardcode business domain names — re-detect every invocation.

If a file spans two domains (e.g., a generic util used by both `auth` and a detected domain), flag it as `[SPLIT NEEDED]` and ask the user to resolve before committing.

---

## Dependency Graph

Commits must be ordered so that each group compiles cleanly:

```
schema → shared-lib → auth → <detected business domains, in PRD order or alphabetical> → payment → ui → admin → infra
```

- `schema` first: migrations must exist before app code references new columns; codegen (`prisma generate`, `alembic upgrade`, `drizzle-kit migrate`) must run before any consumer compiles
- `shared-lib` second: consumers (routes, components, server actions) must not see type errors
- `payment` after the domains that emit payment calls — webhook handlers and signature code stay grouped
- `infra` last: config changes may reference any of the above
- `claude-config` can go any time (not code — no compile dependency)

---

## Logic

1. Classify every modified file into a domain (universal slot or detected business domain)
2. Flag cross-domain files as `[SPLIT NEEDED]`
3. Sort domains by the dependency graph above
4. For each group: draft a conventional commit message (`feat/fix/chore/refactor(scope): description`)
5. For groups containing schema changes: append `RUN AFTER COMMIT: <stack's migrate + generate>, then /verify` — e.g. `pnpm prisma migrate dev && pnpm prisma generate`, `alembic upgrade head`, `rails db:migrate`
6. For groups containing payment changes: append `GATES TO RUN: payment-webhook review (signature verification, idempotency), /verify`
7. For groups containing auth changes: append `GATES TO RUN: /verify, /smoke-test (auth golden path)`

### Monorepo group-by-package

When `.workspace-map.json` exists at repo root (or `/workspace-detect` was invoked this session), prefer grouping commits by **package boundary** before applying the domain graph: one commit per package, with inner-domain grouping inside each package.

- Read `.workspace-map.json` for the canonical package list + dependency edges
- Outer key: package (e.g. `@org/auth`, `apps/web`, `packages/ui`)
- Inner key: domain (universal slot or detected business domain) within that package
- Order packages by topological sort of the inter-package dep graph: **if pkg A depends on pkg B, commit B first**
- Within a package, apply the standard dependency graph (`schema → shared-lib → auth → ...`)
- Cross-package files (rare — usually generated) flag as `[SPLIT NEEDED]`

### Code-graph domain auto-detect

For repos without an explicit module layout, infer domains from imports:

1. Lex every modified file's import statements (`import ... from '<spec>'`, `require('<spec>')`, `from <spec> import ...`)
2. Extract the path prefix of each spec — e.g. `@org/auth/session` → `auth`, `src/billing/stripe` → `billing`, `internal/kyc/...` → `kyc`
3. Cluster files sharing import roots — files importing predominantly from `@org/auth/*` belong to `auth` domain
4. Tie-break by the file's own path prefix when import roots split evenly
5. Cross-ref the resulting cluster names against `/workspace-detect` output (`.workspace-map.json` `packages[].name`) — canonical package names win over inferred names when they overlap

Files with zero domain-bearing imports (pure infra, config) fall back to the universal-slot table.

### Rollback-safety annotation per group

Every commit group emits a rollback rating, surfaced in the output diff table:

- `SAFE` — pure UI, isolated component, no schema/auth/payment touch, single domain, no downstream consumers in this changeset
- `CARE` — schema-touch (must pair with migration rollback), or single-domain logic with 1–2 internal consumers, or auth-touch isolated to one route
- `RISKY` — multi-domain coupling, payment + schema in same chain, cross-package edits, or any group with `[SPLIT NEEDED]` siblings; requires manual sequence review before landing

Rating computed from: (a) domain set in group, (b) presence of schema/payment/auth, (c) downstream consumer count from the code graph, (d) `[SPLIT NEEDED]` proximity.

### Auto-chain on approval

Plan is presented, user approves. **On approve → auto-stage group → auto-`/verify` → next group; final group → auto-`/smoke-test` → push branch → open draft PR → review gates against PR# → ready or stay-draft.** Not "suggest" — fire.

- Wait for explicit user `approve` / `yes` / `go`
- For each group in order: `git add <files>` → `git commit -m "<message>"` → invoke `/verify`
- If `/verify` fails mid-chain: halt, surface the failing group, do not proceed to the next group
- After the final group lands cleanly: invoke `/smoke-test` automatically
- After `/smoke-test` passes: run push + draft-PR sub-step (below), then review gates against the open draft PR
- `RISKY`-rated groups pause for re-confirmation before staging even within an approved chain

### Push + draft-PR after final commit

After the final group lands and `/smoke-test` passes, push the branch and open a **draft** PR. Draft state is the hard-block signal — review gates run against the open PR; the PR transitions to ready only when P1 count hits 0.

Pre-push gate (refuse, surface to user):
- Current branch must NOT be `main` / `master` / `trunk` / `develop` — if it is, stop and tell user to switch to a feature branch first. Never push commits directly to a default branch.
- `git remote` must list at least one remote (prefer `origin`). If none, skip push+PR and tell user.
- `gh auth status` must succeed. If `gh` missing or unauthenticated, push only and surface the compare URL for manual PR creation. Review gates skip (they require `<PR#>`); user must open PR manually then re-invoke `/code-review <PR#>` etc. by hand.

Re-confirm before pushing (blast radius > local commit):
- Show user: branch name, remote, commit count, target base branch (`gh repo view --json defaultBranchRef`).
- Wait for explicit `push` / `yes` / `go`. `approve` from the original plan does NOT carry over — push is a separate gate.

On confirm:
1. `git push -u <remote> <branch>` (use `-u` only if upstream not set)
2. Build PR title from the highest-impact commit subject (schema > payment > auth > business domain > ui > infra > claude-config). Strip the `type(scope):` prefix when the body already lists per-commit scopes.
3. Build PR body via HEREDOC. Include marker `<!-- opened-by-commit-split -->` at end so `/pr-inbox` recognizes this as a chain-managed draft. Test plan lines are filled in by review gates after they run (initial values shown as `pending`):
   ```
   <!-- opened-by-commit-split -->
   ## Summary
   - <one bullet per commit group, in dependency order>

   ## Test plan
   - [x] /verify passed per group
   - [x] /smoke-test passed on final group
   - [ ] /code-review: pending
   - [ ] /pr-review: pending
   - [ ] /architect-review: pending (or "skipped — no risk groups")
   - [ ] <any group-specific gate, e.g. payment-webhook review>
   ```
4. **`gh pr create --draft --title "<title>" --body "$(cat <<'EOF' ... EOF)" --base <default-branch>`** — open as DRAFT. Capture PR# from `gh pr create` stdout (last URL segment) or follow with `gh pr view --json number -q .number` on the branch.
5. Add label `commit-split-chain` for `/pr-inbox` filtering: `gh pr edit <PR#> --add-label commit-split-chain` (best-effort; ignore if label doesn't exist in repo).
6. Surface to user: "Draft PR opened: <URL>. Running review gates against PR #<PR#>…"

If `gh pr create` fails (network, perms, draft policy), surface the error verbatim + the compare URL `https://<host>/<owner>/<repo>/compare/<base>...<branch>`. Do not retry blindly. Review gates abort (no PR# to run against).

### Review gates on draft PR

After the draft PR is open and PR# is captured, run review-quality gates **against the PR**. Any **P1** finding from any gate keeps the PR in draft state (hard-block signal). Gates run with chain context: set env var `COMMIT_SPLIT_CHAIN=1` (or write marker file `.claude/_chain-marker`) so each review skill auto-comments findings to the PR per its own logic.

Gate order (run sequentially, surface combined findings):

1. **`/code-review <PR#>`** — line-level diff review (correctness, security, failure mode, test coverage, naming, hygiene). Pinned to PR's `headRefOid`. Writes `docs/qa/code-review-pr<PR#>-YYYYMMDD.md` + posts findings comment on PR (chain mode). Read P1 count from report header.
2. **`/pr-review <PR#>`** — PR-shape review (scope, size, commit msgs, negative-space audit on real PR body, rollback path, PR desc). Writes `docs/qa/pr-review-pr<PR#>-YYYYMMDD.md` + posts comment. Read P1 count from header.
3. **`/architect-review <PR#>`** — repo-wide architectural audit at PR HEAD (via temp branch from PR ref). **Conditional trigger** — only invoke when:
   - Committed group set includes `schema` | `auth` | `payment`, OR
   - Committed group set spans 3+ detected business domains
   - Otherwise skip (heavy; not warranted for low-risk diffs). When skipped, treat as 0 P1 and record "skipped — no risk groups" in PR body Test plan.

After each gate, update the PR body Test plan line via `gh pr edit <PR#> --body "<new body>"`: replace `pending` with `<P1> P1, <P2> P2 (clean if all zero)` or `skipped — no risk groups`.

**Hard-block logic (draft → ready transition):**

- Sum P1 counts across the three reports (skipped architect-review contributes 0).
- If combined P1 == 0:
  - `gh pr ready <PR#>` → PR transitions to ready-for-review.
  - Surface PR URL to user. Done.
- If combined P1 > 0:
  - PR stays draft (no `gh pr ready` call). Each gate has already posted its own findings comment (chain mode). Optionally post one aggregated summary comment listing all P1 findings with source skill tagged: `gh pr comment <PR#> --body "<aggregated P1 list>"`.
  - Surface combined P1 list to user (file:line + fix per finding, source skill tagged) plus the PR URL.
  - Tell user: "PR #<PR#> stays draft until P1 findings are fixed. Fix locally, push to update the branch, then re-invoke `/commit-split` review-gate step (or `/code-review <PR#>` etc. individually). OR type `override-p1: <reason>` to mark ready anyway."

**Override path:**

- User responds `override-p1: <reason>`.
  1. Read current PR body: `gh pr view <PR#> --json body -q .body`.
  2. Append `## Review Overrides` section listing the reason + each P1 finding it bypasses (file:line + source skill).
  3. `gh pr edit <PR#> --body "<new body>"` to commit the appended section.
  4. `gh pr ready <PR#>` to transition the PR to ready.
  5. Surface PR URL.

P2/P3 findings: review skills already posted them as separate comments. Surfaced in PR body Test plan counts. Do not gate.

**Re-run behavior:**

- Review reports are idempotent per PR + per day (PR mode filenames include `pr<PR#>` so they don't collide with local-mode reports).
- If user fixes P1 and re-pushes the branch, the PR's `headRefOid` updates. Re-invoke the review-gate step (or `/commit-split` from the push step) — gates re-pin to the new SHA, re-run, re-comment with fresh findings.
- The chain does NOT auto-detect re-pushes. User triggers re-run explicitly.

---

## Output Format

```
COMMIT PLAN
───────────
Total files: N across M domains
Detected business domains: <domain-A>, <domain-B>, ...

Group 1 [schema] — N files — rollback: CARE
  Files:
    <schema file>
    <migration file>
  Suggested message: "feat(db): <description>"
  Depends on: none
  Risk: migration must run before Group 2
  RUN AFTER COMMIT: <stack migrate + generate>, then /verify

Group 2 [shared-lib] — N files — rollback: SAFE
  Files:
    lib/types/<entity>.ts
  Suggested message: "feat(types): <description>"
  Depends on: Group 1

Group 3 [<detected-domain>] — N files — rollback: SAFE | CARE | RISKY
  Files:
    <api route file>
    <page or component file>
  Suggested message: "feat(<detected-domain>): <description>"
  Depends on: Group 2

...

[SPLIT NEEDED]
  lib/<file>.ts — touches both <domain-A> and <domain-B> logic
  Resolve: decide if this belongs in <domain-A>, <domain-B>, or shared-lib, then split manually.

RECOMMENDED NEXT STEP: git add <group-1-files> && git commit -m "..."
APPROVE TO AUTO-CHAIN: reply `approve` → auto-stage → auto-/verify per group → auto-/smoke-test after final group → push (separate confirm) → open DRAFT PR → /code-review <PR#> + /pr-review <PR#> + /architect-review <PR#> (conditional) → P1==0 marks PR ready; P1>0 leaves PR draft + posts findings comment; `override-p1: <reason>` marks ready with override recorded in PR body
```

---

## Completion Criteria

- Every modified file is assigned to exactly one group
- Groups are ordered by the dependency graph (and by package topology when `.workspace-map.json` present)
- Each group has a conventional commit message
- Each group carries a rollback-safety rating (`SAFE` / `CARE` / `RISKY`)
- Cross-domain files are flagged
- Gate / post-commit requirements are noted per group
- On user approval, auto-chain fires `/verify` per group and `/smoke-test` after the final group
- After `/smoke-test` passes, prompt for push confirm; on confirm, push branch and open **draft** PR via `gh pr create --draft`; capture PR#; label `commit-split-chain`; surface URL (or compare URL if `gh` unavailable — review gates skip in that case)
- Review gates (`/code-review <PR#>`, `/pr-review <PR#>`, conditional `/architect-review <PR#>`) run against the open draft PR with chain context (`COMMIT_SPLIT_CHAIN=1`); each writes its `docs/qa/*-pr<PR#>-*.md` report and posts a PR comment
- Combined P1 == 0 → `gh pr ready <PR#>` transitions PR to ready; P1 > 0 → PR stays draft, user fixes + re-pushes (or supplies `override-p1: <reason>`)
- On `override-p1: <reason>`: append `## Review Overrides` section to PR body via `gh pr edit`, then `gh pr ready <PR#>`
- PR body Test plan lists review findings counts (updated after each gate); PR body Review Overrides section lists any `override-p1` reasons; PR body marker `<!-- opened-by-commit-split -->` lets `/pr-inbox` recognize chain-managed drafts
