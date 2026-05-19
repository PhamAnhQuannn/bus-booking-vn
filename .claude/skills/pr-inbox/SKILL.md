---
name: pr-inbox
description: Discovery + dispatcher for open GitHub PRs. Lists every open PR via `gh`, classifies each by risk slot touched (schema/auth/payment/admin), size bucket, review state, and age, then recommends which review skills (/code-review, /pr-review, /architect-review) to invoke per PR. Read-only — does not auto-invoke, does not comment, does not fetch full diffs (file lists only). Writes docs/qa/pr-inbox-YYYYMMDD.md with ranked table + copyable per-PR commands. Use when user says "review PRs", "what needs review", "open PR list", "/pr-inbox", or before starting a review session.
output_size:
  XS: 5m
  S: 10m
  M: 15m
  L: 20m
  XL: 30m
---

# /pr-inbox — Open-PR Triage + Dispatcher

## Why you'd care

You have eight open PRs. Two are drafts still in flight. One is a tooling bump nobody will block on. One touches `prisma/schema.prisma` and three webhook files — that one wants the full review trio. The rest sit somewhere in between. Without a triage layer, you either review them in `gh pr list` order (random) or pick by gut (biased toward recent / familiar). This skill ranks the list by risk + readiness and tells you exactly which review skills to fire per PR — so the schema-touching one rises to the top and the dep bump gets a 30-second shape check.

Invoke as `/pr-inbox`. Read-only triage. Does NOT invoke review skills itself — surfaces copyable commands so you pick.

---

## Pre-flight

1. `gh auth status` — must succeed. If `gh` missing or unauthenticated, stop and tell user: install `gh` and run `gh auth login`. Do not fall back to git-only mode (no PR data available without `gh`).
2. `gh pr list --state open --json number,title,headRefName,baseRefName,additions,deletions,changedFiles,isDraft,reviewDecision,labels,author,createdAt --limit 50` — fetch all open PRs in one call. Cap at 50 (raise via `--limit` arg if user passes one explicitly).
3. If list is empty, stop and tell user: "No open PRs."
4. For each PR: `gh pr diff <PR#> --name-only` — file list ONLY (no diff body). Cheap, lets us classify domains without pulling kilobytes of patch.
5. Read `CLAUDE.md` if present — capture any user-declared risk domains (auto-elevated to risk slot for classification).

---

## Classification (per PR)

### Risk slots touched

Intersect each PR's changed-file list with universal-slot patterns (reuse `/commit-split` taxonomy, `.claude/skills/commit-split/SKILL.md` "Universal slots" table):

- `schema` — `prisma/schema.prisma`, `prisma/migrations/**`, `alembic/versions/**`, `db/migrate/**`, `drizzle/**`
- `auth` — `app/api/auth/**`, `app/(auth)/**`, `lib/auth.ts`, `middleware.ts`, `auth/**`
- `payment` — `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts`, `<pkg>/payments/**`
- `admin` — `app/admin/**`, `app/api/admin/**`, `components/admin/**`
- Plus any user-declared critical domain from `CLAUDE.md`

Also count distinct detected business domains touched (reuse `/commit-split` business-domain detection — top-level subdirs under `app/api/`, `src/modules/`, etc.).

### Size bucket

Use `additions + deletions` (net lines) and `changedFiles`:

| Bucket | Lines  | Files |
|--------|--------|-------|
| XS     | ≤ 50   | ≤ 3   |
| S      | ≤ 200  | ≤ 10  |
| M      | ≤ 500  | ≤ 20  |
| L      | ≤ 800  | ≤ 40  |
| XL     | > 800  | > 40  |

Take the **larger** of the two dimensions (e.g. 80 lines across 15 files → M, not S).

Exception paths (do NOT inflate size): lock files (`pnpm-lock.yaml`, `package-lock.json`, `poetry.lock`, `go.sum`, `Cargo.lock`), generated migrations (`prisma/migrations/**/migration.sql`), codegen output. Subtract their line counts before bucketing.

### Review state

From `reviewDecision` + `isDraft`:
- `isDraft == true` → **DRAFT**
- `reviewDecision == "APPROVED"` → **APPROVED**
- `reviewDecision == "CHANGES_REQUESTED"` → **CHANGES_REQUESTED**
- `reviewDecision == "REVIEW_REQUIRED"` or null + not draft → **READY**

### Age

`(now - createdAt)` in days, integer.

### Detect `/commit-split`-opened drafts

If PR labels include `commit-split-chain` OR PR body contains marker `<!-- opened-by-commit-split -->`, mark as **chain-managed** — skip recommendation (the chain handles this PR's review itself).

---

## Recommendation Matrix

Per PR, pick the review-skill set:

| Condition (check top-down, first match wins)                                       | Recommended invocations                                       | Tag           |
|------------------------------------------------------------------------------------|---------------------------------------------------------------|---------------|
| `reviewDecision == APPROVED`                                                       | (none — skip)                                                 | `[approved]`  |
| Chain-managed draft                                                                | (none — skip)                                                 | `[chain]`     |
| `isDraft == true` AND not chain-managed                                            | (none — skip, but note in report)                             | `[draft]`     |
| Touches `schema` \| `auth` \| `payment` OR ≥ 3 detected business domains            | `/code-review <PR#>` + `/pr-review <PR#>` + `/architect-review <PR#>` | `[HIGH RISK]` |
| Size L or XL (any domain)                                                          | `/code-review <PR#>` + `/pr-review <PR#>` + `/architect-review <PR#>` | `[large]`     |
| Pure `infra` / `claude-config` (only matches those slots, no business domain)      | `/pr-review <PR#>`                                            | `[tooling]`   |
| `CHANGES_REQUESTED` (re-review)                                                    | `/pr-feedback-route <PR#>` (route reviewer comments to remediation skills first; then re-run review skills after fixes) | `[re-review]` |
| Small UI-only or shared-lib-only (matches only `ui` / `shared-lib`)                | `/code-review <PR#>` + `/pr-review <PR#>`                     | `[low risk]`  |
| Default                                                                            | `/code-review <PR#>` + `/pr-review <PR#>`                     | `[standard]`  |

**Always-on companion checks** (append to every non-skip PR's command line):
`/security-review-deep <PR#> && /perf-review <PR#> && /observability-review <PR#> && /backcompat-review <PR#>`

Skipped automatically by each companion skill if the PR is doc-only / config-only / test-only as defined per skill. Each writes its own `docs/qa/*-pr<PR#>-YYYYMMDD.md` artifact.

---

## Ranking (top of report)

Sort PRs by this priority order:

1. Risk-touching (schema / auth / payment) AND `READY` AND not approved → **top of list**
2. Large (L / XL) AND `READY` AND not approved
3. `CHANGES_REQUESTED` (re-review pending)
4. Other `READY` PRs (age desc — oldest first)
5. `DRAFT` (still in flight, deprioritized — last in list)
6. `APPROVED` (skip section at bottom for visibility)

Within each tier, sort by `createdAt` ascending (oldest first — they've been waiting longest).

---

## Output Format

Write to `docs/qa/pr-inbox-YYYYMMDD.md`:

```
PR INBOX — open PRs needing review
──────────────────────────────────
Fetched: <N> open PRs (<M> ready · <D> draft · <A> approved)
Generated: <ISO timestamp>

NEEDS REVIEW (ranked):

  #42  feat(payment): refund flow                              ready · L · 612/24
       author: @alice · age: 1d
       domains: payment, schema, ui
       → /code-review 42 && /pr-review 42 && /architect-review 42
         && /security-review-deep 42 && /perf-review 42
         && /observability-review 42 && /backcompat-review 42            [HIGH RISK]

  #38  feat(auth): SSO via Okta                                ready · M · 318/9
       author: @bob · age: 2d
       domains: auth
       → /code-review 38 && /pr-review 38 && /architect-review 38
         && /security-review-deep 38 && /perf-review 38
         && /observability-review 38 && /backcompat-review 38            [HIGH RISK]

  #41  refactor(ui): extract Button primitive                  ready · S · 84/4
       author: @carol · age: 3d
       domains: ui
       → /code-review 41 && /pr-review 41
         && /security-review-deep 41 && /perf-review 41
         && /observability-review 41 && /backcompat-review 41             [low risk]

  #36  fix(orders): handle empty cart                          changes_requested · S · 52/3
       author: @dave · age: 5d
       domains: orders
       → /pr-feedback-route 36                                            [re-review]

  #39  chore: bump deps                                        ready · XS · 22/2
       author: @eve · age: 5d
       domains: infra
       → /pr-review 39
         && /security-review-deep 39 && /perf-review 39
         && /observability-review 39 && /backcompat-review 39             [tooling]

DRAFTS (in flight — skip until ready):
  #33  feat(orders): batch cancel                              draft · M · 318/12  age: 8d
  #29  wip(reservations): rewrite scheduler                    draft · L · 540/19  age: 14d

CHAIN-MANAGED (review handled by /commit-split chain — skip):
  #44  feat(menu): seasonal items                              draft · M · 280/7   age: 6h

APPROVED (no action needed):
  #40  fix(types): export OrderSummary                         approved · XS · 12/1

RECOMMENDED NEXT: /code-review 42 && /pr-review 42 && /architect-review 42
                  && /security-review-deep 42 && /perf-review 42
                  && /observability-review 42 && /backcompat-review 42
                  (newest risk-touching, ready for review — companions appended)

SUMMARY: <H> high-risk · <L> large · <R> re-review · <T> tooling · <S> standard · <C> companions
```

If no PRs need review (all approved / drafts), emit:

```
PR INBOX — open PRs needing review
──────────────────────────────────
Fetched: <N> open PRs (0 ready for review)

Nothing to review right now.
  - <X> drafts still in flight
  - <Y> already approved

RECOMMENDED NEXT: (none — clear queue)
```

---

## Boundaries

- Does NOT fetch full diffs — only file lists (cheap across N PRs). Review skills fetch the full diff themselves when invoked with `<PR#>`.
- Does NOT auto-invoke review skills — surfaces copyable commands; user picks.
- Does NOT comment on PRs.
- Does NOT modify PRs (no labels, no edits, no ready-state changes).
- Does NOT re-rank based on author / labels beyond the explicit matrix.
- Read-only.

---

## Auto-chain

- **No auto-chain into review skills.** This is a triage layer, not an orchestrator. User reads the report, picks the PR + command, fires manually.
- **Triggered by**: user saying "review PRs", "what needs review", "open PR list", "PR inbox", `/pr-inbox`. Also dispatched from `/route` when user intent is "review GH PRs".
- **Cross-links**: `/code-review <PR#>`, `/pr-review <PR#>`, `/architect-review <PR#>` (all callable with `<PR#>` arg per their amended skills). `/pr-feedback-route <PR#>` is the post-review sibling — recommended for any `CHANGES_REQUESTED` PR.

## Integration

- **Discovery layer**: produces ranked list with per-PR command lines. Read by user.
- **Produces**: `docs/qa/pr-inbox-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr list` + per-PR `gh pr diff --name-only`. No other inputs.
- **Re-run**: idempotent. Re-run any time the PR set changes (new PR opened, draft marked ready, PR approved).
