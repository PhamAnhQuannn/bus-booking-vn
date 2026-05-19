---
name: perf-review
description: Performance + cost review of an open PR. Audits N+1 queries (loops over findOne/findUnique), missing index on new WHERE / ORDER BY column, unbounded findMany / file reads, large in-memory loads, bundle-size delta on frontend changes, cold-start delta from new heavy import, new always-on cost (cron / queue worker / polling), and caching gaps. Read-only — writes `docs/qa/perf-pr<PR#>-YYYYMMDD.md`. Use when you want a perf+cost gate on a PR before merge — the trio does not cover this.
output_size:
  XS: 5m
  S: 10m
  M: 10m
  L: 15m
  XL: 20m
---

# /perf-review — DB, Memory, Bundle, Cost Audit on a PR

## Why you'd care

The trio catches correctness, arch, and PR shape — not perf. `/code-review` will not flag a loop that calls `prisma.user.findUnique` once per item. `/architect-review` will not flag a new `setInterval` that polls every 30s in production. `/pr-review` will not flag a `lodash` full-import that adds 70 KB to the client bundle. These are the regressions that ship silently and only surface when a customer complains. This skill scans the diff for them.

Invoke as `/perf-review <PR#>`. PR# required.

---

## Pre-flight

1. `gh auth status` — required. Stop with install/login hint if missing.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url,reviewDecision,author,additions,deletions,changedFiles` — capture PR shape. Pin `headRefOid`.
3. If `state != "OPEN"` → stop, report "PR closed/merged."
4. `gh pr diff <PR#>` — full patch.

### Auto-skip

If every changed path matches `*.md|docs/**|*.txt|CHANGELOG*|LICENSE*|*.lock|.env.example|.github/**|*.yml|*.yaml` (no source code touched) → emit:

```
PERF REVIEW — PR #<PR#>
───────────────────────
Skipped — doc-only or config-only PR (no source code in diff).
```

…and stop.

---

## Categories

### Cat 1 — DB hotspots

Scan added (`+`) lines:

- **N+1 pattern.** A `for (` / `forEach(` / `map(` / `while (` block whose body contains `await prisma.*.findUnique(` / `findFirst(` / `findOne(` / `.get(` / `db.execute(` on a primary-key lookup → P1.
  - Detect: any added line inside an added loop containing one of those calls.
  - Recommended fix in the report: `findMany({ where: { id: { in: ids } } })` + in-memory join.
- **Missing index.** New `where:` or `orderBy:` clause on a column NOT marked `@id`, `@unique`, `@@index`, `@@unique` in `prisma/schema.prisma` (or `Index(` in alembic, `index:` in drizzle).
  - Detect: for each new `where: { <col>: ` in a `findMany|findFirst|count|aggregate`, check schema for the column → if no index → P1 if path is in `app/api/**`, P2 elsewhere.
- **SELECT \***. New `prisma.<table>.findMany(...)` without `select:` or `include:` clause AND table is known-wide (heuristic: > 8 columns in `prisma/schema.prisma`) → P2.
- **count() without filter.** New `prisma.<table>.count()` with no `where` arg → P2.
- **Joins across > 3 tables.** New `include: { a: { include: { b: { include: { c: ` (depth > 3) → P2.

### Cat 2 — Memory loads

- `findMany(` without `take:` / `cursor:` / `limit:` in the args → P2 (P1 if the matching schema model has > 100k expected rows — heuristic: presence of `audit|event|log|history|message` in model name).
- `fs.readFileSync(` whose path is derived from a non-constant variable (i.e. user input or runtime data) without size cap → P2.
- `JSON.parse(await response.text())` / `JSON.parse(await response.json())` without a `Content-Length` / `maxBytes` check on `response` → P2.
- `await response.arrayBuffer()` of a `fetch(<external URL>)` without size cap → P2.

### Cat 3 — Frontend bundle

Detect newly-added top-level imports in client components (`'use client'` directive present, or file under `app/` / `pages/` / `components/` that does NOT contain `'use server'`):

- `import moment from 'moment'` → P2 (recommend `date-fns` or native Intl).
- `import _ from 'lodash'` (default whole-package import) → P2 (recommend `import {x} from 'lodash-es'` named imports).
- `import * as firebase from 'firebase'` → P2.
- `import AWS from 'aws-sdk'` (v2 monolith) → P2 (recommend modular `@aws-sdk/client-*`).
- `import { ... } from 'pdfjs-dist'` at top level → P2 (recommend dynamic import).
- A new component over ~150 lines that is only referenced from one route file → P3 (dynamic-import candidate).

### Cat 4 — Cold start / always-on cost

- New `setInterval(` in a file that runs in a long-lived process (server route handlers, jobs, workers; heuristic: under `lib/server/`, `workers/`, `jobs/`, `app/api/` — flag in any server-side file) → P2.
- New cron registration: `crontab` line, `@nestjs/schedule` `@Cron(`, `node-cron` `cron.schedule(`, GitHub-Actions `schedule:` block, Vercel `vercel.json` `crons:` entry → P2 (P1 if interval `< 5min`).
- New always-on worker: new file under `workers/**` or new `Queue.process(` registration → P3 informational with cost-estimate ask.
- New external API call inside a per-request handler without `cache(` / `unstable_cache(` / `revalidate:` / `redis.get(` upstream → P2.

### Cat 5 — Caching gaps

- New GET handler in `app/api/**` that calls `prisma.*.findMany|findUnique|...` and does NOT set `Cache-Control` header, does NOT use Next.js `cache(`, does NOT wrap in `unstable_cache(` → P3.
- Same data fetched twice in the same component / handler within ≤ 30 lines without intermediate variable → P3.

---

## Severity

- **P1** — N+1 in hot path, missing index on `app/api/**` query.
- **P2** — unbounded findMany, heavy client import, cron < 5min, setInterval in server, large external load without size cap, missing AEAD-style cap on JSON.parse.
- **P3** — caching gap, dynamic-import candidate, double-fetch.

---

## Output Format

Write to `docs/qa/perf-pr<PR#>-YYYYMMDD.md`:

```
PERF REVIEW — PR #<PR#> "<title>"
─────────────────────────────────
PR:        <URL>
Base/Head: <baseRefName> ← <headRefName> @ <headRefOid[:8]>
Decision:  <reviewDecision>
Size:      +<additions> / -<deletions> across <changedFiles> files
Generated: <ISO timestamp>

Findings: <N>  (P1: <a> · P2: <b> · P3: <c>)

P1 — BLOCKING:
  app/api/orders/list.ts:34  🐢 P1: N+1 query — loop over `ids` calls `prisma.user.findUnique`.
    Fix: replace with `prisma.user.findMany({ where: { id: { in: ids } } })` + map by id.

  app/api/search/route.ts:18  🐢 P1: New `where: { vendorId }` on `Order` — no index on `Order.vendorId` in prisma/schema.prisma.
    Fix: add `@@index([vendorId])` to `Order` model + migrate.

P2 — SHOULD FIX:
  components/Dashboard.tsx:1  📦 P2: New top-level `import moment from 'moment'` in client component (~70 KB minified).
    Fix: replace with `date-fns` named imports or native `Intl.DateTimeFormat`.

  lib/jobs/cleanup.ts:12  ⏱ P2: New cron `*/2 * * * *` (every 2 min) — high frequency.
    Fix: confirm 2-min interval is needed; otherwise relax to ≥ 5 min.

P3 — ADVISORY:
  app/api/menu/route.ts:1  ℹ️  P3: GET handler hits DB without `Cache-Control` or `unstable_cache(`.
    Consider `Cache-Control: public, max-age=60` or wrap in `unstable_cache(..., { revalidate: 60 })`.

Bundle delta estimate (frontend changes detected):
  +moment (~70 KB min+gz)
  +new component DashboardChart (estimated ~12 KB)
  ≈ +82 KB to client bundle

RECOMMENDED NEXT:
  - Address P1 before merge.
  - If reviewer already requested changes: /pr-feedback-route <PR#>

SUMMARY: <a> P1 · <b> P2 · <c> P3 · pinned to <headRefOid[:8]>
```

Empty case:

```
PERF REVIEW — PR #<PR#>
───────────────────────
No perf findings.
(No N+1, no unindexed hot paths, no heavy imports, no new always-on cost.)
```

---

## Boundaries

- Read-only. Does NOT run benchmarks, does NOT execute the diff, does NOT comment on PR.
- Bundle-delta estimate is heuristic (per-import known sizes); does NOT run `webpack-bundle-analyzer`.
- Does NOT cover correctness or arch — see `/code-review`, `/architect-review`.
- Does NOT cover observability — see `/observability-review`.
- Does NOT cover back-compat or new-dep license — see `/backcompat-review`.

## Auto-chain

- **No auto-chain out.**
- **Triggered by**: `/pr-inbox` (always-on companion row); `/route` when user says "perf review" / "is this slow" / "N+1" / "bundle size" with a PR#.
- **Cross-links**: `/pr-feedback-route <PR#>` for the post-CHANGES_REQUESTED loop; `/perf-audit` for a full-codebase (not per-PR) sweep.

## Integration

- **Produces**: `docs/qa/perf-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr view --json` + `gh pr diff <PR#>` + `prisma/schema.prisma` (or alembic / drizzle equivalent) for index detection.
- **Re-run**: idempotent. Re-run after each push.
