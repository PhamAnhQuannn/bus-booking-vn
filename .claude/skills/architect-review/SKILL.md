---
name: architect-review
description: Repo-wide architectural review judging module dependency graph (cycles, layer violations, god modules), coupling spread, shallow modules, ADR coverage, domain isolation invariants, and dep-graph drift vs prior snapshot. Accepts optional <PR#> arg — without arg audits working-tree HEAD; with arg fetches PR ref into a temp branch, audits that HEAD, restores prior branch. Ranks findings P1/P2/P3 and writes docs/qa/architect-review-YYYYMMDD.md (or docs/qa/architect-review-pr<PR#>-YYYYMMDD.md) plus docs/qa/arch-graph.json. Hard-block gate on draft PR (stays draft until P1=0) when chained from /commit-split on risk-touching diffs (schema | auth | payment | 3+ domains). Use when user says "architect review", "architecture review", "design review", "/architect-review", "/architect-review <PR#>", or before major release.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /architect-review — Repo-Wide Architectural Review Gate

## Why you'd care

`/code-review` and `/pr-review` are diff-scoped. They can't see the cycle you just added between `payment` and `auth`, the third file this month that imports `lib/db` directly from a React component, or the fact that no ADR exists for the new auth provider you wired in. Architecture rots one accepted-PR at a time. A repo-wide gate every push catches the rot at the edge, before it compounds.

Invoke as `/architect-review` (audits working tree) or `/architect-review <PR#>` (fetches PR ref, audits that HEAD, restores prior branch). **Re-audits the whole repo** every run (not just diff). Slower than line-level reviews — chained only when diff touches risk domains.

---

## Mode selection

- **No arg** → Local mode. Audit working-tree HEAD as-is.
- **`<PR#>` arg** → PR mode. Fetch PR ref into temp branch, checkout, audit, restore prior branch + delete temp branch on exit (even on error).

Pre-flight differs per mode (below). Review categories + severity rules + graph output are mode-agnostic.

---

## Pre-flight

### Local mode (no arg)

1. Detect source roots (reuse `/stack-profile` if available). Worked example for TS/Next.js: `app/**/*.{ts,tsx}`, `components/**/*.tsx`, `lib/**/*.ts`. Substitute per stack (Python: `src/**/*.py`; Go: `**/*.go` excluding `vendor/`; Rust: `src/**/*.rs`).
2. Load prior graph snapshot from `docs/qa/arch-graph.json` if present (for drift detection).
3. Read `docs/adr/` index to enumerate recorded decisions.
4. Read `CLAUDE.md` "Architectural Invariants" section if present — user-declared invariants are auto-P1 when violated.

### PR mode (`<PR#>` arg)

1. `gh auth status` — must succeed. If `gh` missing or unauthenticated, stop and tell user.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url` — capture metadata.
3. **Pin to `headRefOid`** — record SHA. Surface in report header. If PR force-pushes mid-review, the SHA in the header makes the staleness visible.
4. Save current branch: `git rev-parse --abbrev-ref HEAD` → `$PRIOR_BRANCH`. Save current SHA: `git rev-parse HEAD` → `$PRIOR_SHA`. Refuse if working tree dirty (`git status --porcelain` non-empty) — user must stash or commit first; do NOT auto-stash.
5. Fetch PR ref into temp branch: `git fetch origin pull/<PR#>/head:_architect-review-pr<PR#>` then `git checkout _architect-review-pr<PR#>`. Verify checked-out SHA matches `headRefOid` from step 3 — if not, abort (race; user re-runs).
6. Detect source roots, load prior graph snapshot, read `docs/adr/`, read `CLAUDE.md` (same as Local mode steps 1–4, now executing against PR's HEAD state).
7. Determine chain context: if env var `COMMIT_SPLIT_CHAIN=1` or marker file `.claude/_chain-marker` present → chain mode (auto-comment findings). Otherwise standalone (write report file only).

**Restore (always, even on error)**: at end of run OR on any abort, `git checkout $PRIOR_BRANCH` then `git branch -D _architect-review-pr<PR#>`. Wrap audit in try/finally equivalent so temp branch cleanup runs even if audit fails. Do NOT push the temp branch. Do NOT modify the PR.

---

## Review Categories

### Category 1 — Module dependency graph

Build the import graph:
1. Lex every source file's imports (reuse code-graph logic from `/commit-split` "Code-graph domain auto-detect" section, `.claude/skills/commit-split/SKILL.md:104-114`)
2. Resolve each import spec to a module/package node
3. Aggregate file-level edges into module-level edges

Then check:
- **Cycles** between modules / packages — strongly-connected component detection (Tarjan / Kosaraju). Any non-trivial SCC (size > 1) → **P1**
- **Layer violations**:
  - UI layer imports DB layer directly (e.g. `components/**` imports `prisma`, `lib/db`, raw query) → **P1**
  - Payment logic outside designated webhook dir (reuse `/consistency-audit` rule: payment crypto, signature verify only in `app/api/webhooks/**`) → **P1**
  - Domain layer imports from another domain that doesn't appear in domain's allowed-deps list (when CLAUDE.md declares one) → **P1**
- **God module** — one module imported by > 70% of source files → **P2** (signals missing abstraction or fragmented utility dumping ground)

### Category 2 — Coupling spread

For each file modified in the last 30 days (`git log --since="30 days ago" --name-only --pretty=format: | sort -u`):
- Map to detected domain (reuse `/commit-split` domain taxonomy)
- Count distinct domains touched per file across that window

Findings:
- Files touched in 30d that span > 3 domains repeatedly → **P2** with file list (signals leaky abstraction; same file keeps growing across domain boundaries)
- Pairs of domains co-edited in > 50% of recent commits → **P2** (signals these two should be one domain, or there's a missing seam between them)

### Category 3 — Deep vs shallow modules

Per Ousterhout: deep modules have small public API and large implementation; shallow modules have large public API relative to implementation.

For each module:
- Public API surface = count of exported symbols
- Implementation size = total non-export lines

Flag:
- Public API count > 10 AND implementation lines < 200 → **P2** "shallow module"
- Public API count > 20 → **P2** regardless of size (re-export pile / barrel file that adds no abstraction)
- Module with 1 exported function that internally calls > 5 other internal modules → OK (deep, that's the goal)

Cross-link `/improve-codebase-architecture` for refactor proposals on any P2 here.

### Category 4 — ADR coverage

For each architecturally-significant pattern present in code, verify a matching ADR exists in `docs/adr/`:

Significant patterns to scan for:
- New framework or major library (each entry in `package.json` dependencies that didn't exist 90 days ago → ADR expected)
- Auth method (presence of `next-auth`, `@auth/core`, `passport`, custom JWT logic → ADR expected)
- Database choice (Postgres / MySQL / Mongo / DynamoDB / SQLite — each ORM / driver present → ADR expected)
- Deploy target (Vercel / Fly / AWS / Cloudflare — each indicated by config file → ADR expected)
- Feature flag system (presence of `growthbook`, `launchdarkly`, `unleash`, custom impl → ADR expected)
- Event bus / queue (`bullmq`, `inngest`, `kafkajs`, `sqs`, `rabbitmq` → ADR expected)
- AI provider (`@anthropic-ai/sdk`, `openai`, `vertexai` → ADR expected)

For each significant pattern in code, grep `docs/adr/` for an ADR mentioning it. Missing → **P2**. Cross-link `/adr-writer`.

### Category 5 — Domain isolation invariants

Hardcoded invariants (reuse `/consistency-audit` rules + extend):
- **Payment crypto in webhooks only** — signature verify (`stripe.webhooks.constructEvent`, HMAC verify) outside `app/api/webhooks/**` → **P1**
- **Auth check at boundary only** — session validation duplicated inside individual route handlers when middleware already gates → **P2** (redundant; risk of inconsistent check)
- **Schema mutations outside migrations** — `prisma.$executeRaw` with DDL (`CREATE`, `ALTER`, `DROP`) in app code → **P1**
- **Secrets in source** — `process.env.X` referenced where `X` is a known-secret name (API_KEY, SECRET, PASSWORD, TOKEN), used outside server-only modules (RSC, route handler, server action) — leaks to client → **P1**

User-declared invariants from `CLAUDE.md` Architectural Invariants section → match severity declared there, default P1.

### Category 6 — Dep-graph drift

Compare current import graph vs `docs/qa/arch-graph.json` (snapshot from prior run):
- New edges crossing layer boundary (UI→DB, payment→auth, etc.) → **P2** with before/after diff
- New cycle that didn't exist in prior snapshot → **P1** (Category 1 already catches; drift adds "this is new" context)
- Removed edges that crossed boundary → SAFE (note as improvement)

If no prior snapshot, this category emits "baseline established" and writes the current graph as the new snapshot.

---

## Severity Rules

Severities assigned inline above. Summary aggregates by max.

---

## Output Format

Write two files. Filename depends on mode:

- Local mode → `docs/qa/architect-review-YYYYMMDD.md`
- PR mode → `docs/qa/architect-review-pr<PR#>-YYYYMMDD.md`

**1.** Report file. Header line varies by mode:

```
ARCHITECT REVIEW — repo-wide                                  (local mode)
─────────────────────────────
```

or

```
ARCHITECT REVIEW — PR #<PR#> "<title>" @ <headRefOid[:8]>     (PR mode)
─────────────────────────────
Base: <baseRefName>  ·  Head: <headRefName>  ·  State: <state> (draft/open)
URL: <pr url>
```

Then body (identical both modes):

```
Scanned: <N> modules, <E> edges, <F> files in last 30d window

PRIORITY 1 — Block push, fix first:
  [CYCLE] payment ↔ auth
    SCC members: lib/payment/charge.ts, lib/auth/session.ts
    Path: lib/payment/charge.ts → lib/auth/session.ts → lib/payment/charge.ts
    Fix: extract shared types/utility; one direction only.

  [LAYER VIOLATION] components/cart/CheckoutButton.tsx:18
    Imports `lib/db` directly (UI → DB skip service layer).
    Fix: route through `lib/cart/actions.ts` server action.

  [DOMAIN INVARIANT] app/api/orders/route.ts:45
    HMAC verify using STRIPE_WEBHOOK_SECRET outside webhooks/.
    Fix: move signature verification into app/api/webhooks/stripe/route.ts.

PRIORITY 2 — Fix before next release:
  [GOD MODULE] lib/utils.ts imported by 73% of source files.
    Fix: split into domain-specific util modules (date-utils, money-utils, ...).

  [COUPLING SPREAD] app/api/orders/route.ts touched 11 times in 30d spanning {orders, payment, ui, schema}.
    Fix: extract per-domain seams; this file is becoming a junction.

  [SHALLOW MODULE] lib/types/index.ts exports 47 types, 0 implementation.
    Fix: barrel file with no abstraction; either delete (import direct) or wrap behind a typed facade.

  [ADR MISSING] @anthropic-ai/sdk present in package.json, no docs/adr/*ai-provider*.md
    Fix: /adr-writer to record the choice.

  [DRIFT] New edge: components/admin/UserTable.tsx → lib/db (crossed UI→DB layer)
    Prior snapshot: 2026-04-12. Edge did not exist.
    Fix: re-route through server action.

PRIORITY 3 — Track on roadmap:
  (none from this scan)

SUMMARY: <N1> P1, <N2> P2, <N3> P3
Graph snapshot updated → docs/qa/arch-graph.json

RECOMMENDED NEXT STEPS:
  → P1 cycles + layer violations block any push touching schema/auth/payment.
  → /adr-writer for each ADR-MISSING finding.
  → /improve-codebase-architecture proposals for SHALLOW + GOD MODULE.
```

**2.** `docs/qa/arch-graph.json` (machine-readable graph snapshot for next run's drift check). **Both modes write to the same path** — PR mode overwrites with PR-HEAD graph. Drift comparison still works (prior run's snapshot is the baseline regardless of which mode wrote it). If the user wants pristine main-branch graph preserved, they should run Local mode on `main` after merging.

```json
{
  "generated": "2026-05-18T14:23:00Z",
  "modules": ["lib/auth", "lib/payment", "lib/db", "..."],
  "edges": [
    {"from": "lib/payment/charge.ts", "to": "lib/auth/session.ts"},
    {"from": "components/cart/CheckoutButton.tsx", "to": "lib/db"}
  ],
  "layer_map": {
    "ui": ["components/**", "app/(routes)/**"],
    "service": ["lib/**"],
    "db": ["prisma", "lib/db"]
  }
}
```

---

## Post-review comment (PR mode + chain context only)

When invoked with `<PR#>` AND chain context (`COMMIT_SPLIT_CHAIN=1`):

1. Build comment body — combined P1 + P2 findings, each tagged `[architect-review]` and including the SCC / file path / fix line. Include pinned `headRefOid[:8]` so reviewers can verify the SHA the audit ran against. Reference the report file path.
2. `gh pr comment <PR#> --body "<comment>"`.
3. P1 count is returned to the `/commit-split` aggregator (it decides ready-vs-stay-draft based on combined P1 across all three review skills).

**Standalone PR mode** (`/architect-review <PR#>` without chain context) → write report file only. Does NOT comment. Does NOT mark PR ready/draft. User decides what to share.

**Local mode** → write report file only. No PR interaction.

---

## Auto-chain

- Invoked from `/commit-split` push-gate **only when** group set includes `schema` | `auth` | `payment` OR spans 3+ business domains. Otherwise skipped (heavy). In chain mode, runs as `/architect-review <PR#>` against the draft PR opened by `/commit-split`.
- Standalone Local: terminates with both output files.
- Standalone PR mode: report file only, no comment, no ready-state change.
- Cross-links: `/improve-codebase-architecture` (refactor proposals), `/adr-writer` (record missing ADRs), `/consistency-audit` (reuses some invariants), `/pr-inbox` (per-PR dispatcher that recommends this skill for risk-touching PRs).

## Integration

- **Consumed by**: `/commit-split` (push-gate on draft PR, conditional). Also dispatched from `/pr-inbox` recommendation matrix.
- **Produces**: `docs/qa/architect-review-YYYYMMDD.md` (local) or `docs/qa/architect-review-pr<PR#>-YYYYMMDD.md` (PR) + `docs/qa/arch-graph.json`
- **Re-run**: idempotent for same day (same mode → same filename). PR mode and Local mode write to different report files but share the graph snapshot. Graph snapshot always overwrites (latest wins; drift comparison runs before overwrite).

## Boundaries

- Does NOT review individual diffs — repo-wide only (PR mode = repo-wide at PR's HEAD, still not diff-scoped)
- Does NOT modify source code — advisory only
- Does NOT modify the PR in standalone mode (no comment, no ready/draft transition, no body edit)
- Does NOT auto-comment on PR in standalone PR mode — chain context required
- Does NOT push the temp branch created in PR mode
- Does NOT replicate `/improve-codebase-architecture` (which proposes refactors) — flags + cross-links instead
- Skips when `/commit-split` group set is low-risk (UI-only, infra-only, claude-config-only) — too expensive to run every commit
- Refuses PR mode if working tree dirty — user must stash/commit first (auto-stash would silently lose work on restore)
