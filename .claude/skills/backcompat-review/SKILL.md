---
name: backcompat-review
description: API back-compat + supply-chain review of an open PR. Flags breaking changes to public endpoints (removed field, renamed field, type-narrowed param, status code change, removed endpoint), breaking schema changes without deprecation window (removed/renamed column, narrowed type, NOT NULL without default), exported-function signature breaks in shared libs, new dependency with risky license (GPL/AGPL into MIT project), typosquat-shaped package names, post-install scripts on new deps, lockfile drift. Read-only — writes `docs/qa/backcompat-pr<PR#>-YYYYMMDD.md`. Use when you want a back-compat + supply-chain gate on a PR before merge — the trio does not cover this.
output_size:
  XS: 5m
  S: 10m
  M: 10m
  L: 15m
  XL: 20m
---

# /backcompat-review — API + Schema + Supply-Chain Audit on a PR

## Why you'd care

The trio does not flag: a removed field from a `Response.json({...})` literal that other services consume; a `prisma/schema.prisma` column dropped without a deprecation window; an exported function in `lib/` whose signature narrowed; a new `package.json` entry for `axois` (typosquat of `axios`); a new dep whose license is GPL going into an MIT codebase; a new dep with a `postinstall` script. Any of these can break consumers or compromise the build host. This skill scans the diff for them.

Invoke as `/backcompat-review <PR#>`. PR# required.

---

## Pre-flight

1. `gh auth status` — required. Stop with install/login hint if missing.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url,reviewDecision,author,additions,deletions,changedFiles` — capture PR shape. Pin `headRefOid`.
3. If `state != "OPEN"` → stop, report "PR closed/merged."
4. `gh pr diff <PR#>` — full patch (both `-` and `+` lines; this skill needs deletions to detect removed fields / dropped columns).
5. Read project root `package.json` (or `pyproject.toml` / `Cargo.toml` / `go.mod`) for current license string — needed for license-compat check.

### Auto-skip

If every changed path matches `*.md|docs/**|*.txt|CHANGELOG*|LICENSE*|.github/**|*.test.ts|*.spec.ts|__tests__/**` → emit:

```
BACKCOMPAT REVIEW — PR #<PR#>
─────────────────────────────
Skipped — doc-only or test-only PR (no public surface or supply-chain in diff).
```

…and stop.

---

## Categories

### Cat 1 — API shape breaks

Scan diff hunks under `app/api/**`, `pages/api/**`, `src/routes/**`, `server/routes/**`, `controllers/**`:

- **Removed response field.** A `-` line inside a `Response.json({...})`, `res.json({...})`, `return { ... }` object literal of an HTTP handler where a key disappears → **P1**.
- **Renamed response field.** Same handler, same line context, one `-` key + one `+` key both at the same indentation level → **P1**.
- **Status code changed.** `-` line `res.status(200)` / `return new Response(..., { status: 200 })` paired with `+` line of a different status code → **P2** (P1 if changed from a 2xx to a 4xx/5xx, or 200 → 204 where consumers parse body).
- **Param type narrowed.** TypeScript param type change from `string` → string-literal union, from a wider union to a narrower one, from `unknown`/`any` to a concrete type → **P2**.
- **Endpoint removed / renamed.** A whole `app/api/<route>/route.ts` file deleted or renamed without a stub re-exporting / forwarding the old path → **P1**.

### Cat 2 — Schema breaks

Scan diff hunks under `prisma/schema.prisma`, `alembic/versions/**`, `db/migrate/**`, `drizzle/schema*.ts`, `*.sql` migrations:

- **Dropped column.** `-` line removing a field from a model, or `ALTER TABLE ... DROP COLUMN`, or alembic `op.drop_column(` → **P1**.
- **Renamed column.** Paired `-`/`+` lines in same model where field name changes → **P1**.
- **Type narrowed.** `String` → `String @db.VarChar(N)` with smaller N; `Int` → `SmallInt`; nullable → non-nullable on existing column → **P1**.
- **NOT NULL without default on existing table.** `+` line adding a non-optional field (no `?` in Prisma, no `default(` arg) to a model that already exists → **P1** (migration will fail on populated tables).
- **Dropped enum value.** `-` line in an `enum {` block where a value is referenced elsewhere in the codebase → **P2**.

### Cat 3 — Shared-lib signature breaks

Scan diff under `lib/**`, `packages/*/src/**`, `src/index.ts`, `src/lib/**`, anywhere an `export` is touched:

- Exported function signature changed: paired `-`/`+` lines on the same `export function` / `export const` declaration where param list, param types, or return type differ → **P2** (P1 if the symbol is re-exported from a package barrel file like `src/index.ts` or `packages/*/index.ts`).
- Exported type / interface had a property removed → **P2**.
- `default export` swapped for named export (or vice versa) → **P2**.

### Cat 4 — New dep license

Scan diff in `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`:

- Each new dependency entry → emit an advisory line in the report recommending the user run the appropriate license lookup:
  - npm: `npm view <pkg> license`
  - pip: `pip show <pkg> | grep License`
  - cargo: `cargo metadata --format-version 1 | jq '.packages[] | select(.name=="<pkg>") | .license'`
  - go: `go-licenses report <module>`
- If the dep name is on a known-risky list (`GPL`, `AGPL`, `SSPL`, `BUSL`, `Commons Clause`) per its `package.json` `license` field embedded in the lockfile hunk → **P1**.
- If the project root license is `MIT` / `Apache-2.0` / `BSD-*` and a new dep is GPL/AGPL/SSPL → **P1**.
- If the dep has no `license` field in the lockfile hunk → **P3** (unknown — user must verify).

### Cat 5 — Typosquat + post-install risk

For each new dep in `package.json`:

- **Typosquat heuristic.** Compute edit distance to the popular-package list: `react, react-dom, lodash, axios, express, next, typescript, vue, svelte, eslint, prettier, jest, vitest, webpack, rollup, vite, tailwindcss, zod, prisma, mongoose, redis, ioredis, pg, mysql2, dayjs, moment, uuid`. If edit distance ≤ 2 AND the new name is not exactly equal → **P1** (`axois`, `reqct`, `lod_ash` shape).
- **Lifecycle script.** If the lockfile hunk shows the new package has `scripts.postinstall` / `scripts.preinstall` / `scripts.install` → **P2** (P1 if combined with typosquat hit).

### Cat 6 — Lockfile drift

- `package.json` touched but `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` not in the same PR → **P3**.
- Lockfile touched but `package.json` not → **P3** (could be transitive bump; user verifies).
- `requirements.txt` touched without matching `poetry.lock` / `Pipfile.lock` (project-dependent) → **P3**.

---

## Severity

- **P1** — removed/renamed response field, removed endpoint, dropped/renamed/narrowed schema column, NOT NULL without default, barrel-exported signature break, GPL/AGPL/SSPL into MIT/Apache codebase, typosquat name.
- **P2** — status code change (non-2xx-to-2xx), param type narrowed, shared-lib internal signature change, dropped enum value still referenced, lifecycle script on new dep.
- **P3** — license unknown, lockfile drift.

---

## Output Format

Write to `docs/qa/backcompat-pr<PR#>-YYYYMMDD.md`:

```
BACKCOMPAT REVIEW — PR #<PR#> "<title>"
───────────────────────────────────────
PR:        <URL>
Base/Head: <baseRefName> ← <headRefName> @ <headRefOid[:8]>
Decision:  <reviewDecision>
Size:      +<additions> / -<deletions> across <changedFiles> files
Project license: <root license string>
Generated: <ISO timestamp>

Findings: <N>  (P1: <a> · P2: <b> · P3: <c>)

P1 — BLOCKING:
  app/api/orders/route.ts:42  💥 P1: Response field `customerEmail` removed.
    Before:  { id, customerEmail, total }
    After:   { id, total }
    Fix: keep field with deprecation note, or bump endpoint to /v2/.

  prisma/schema.prisma:88  💥 P1: New `vendorId String` on existing `Order` model — no default, not optional.
    Migration will fail on populated table.
    Fix: make `vendorId String?` then backfill then tighten, OR add `@default(...)`.

  package.json:34  💥 P1: New dep `axois@1.7.0` — likely typosquat of `axios` (edit distance 1).
    Fix: remove and use `axios` if intended.

P2 — SHOULD FIX:
  lib/orders/format.ts:12  ⚠️  P2: Exported `formatOrder(order: Order)` signature narrowed — now requires `Order & { lineItems: LineItem[] }`.
    Callers that pass a bare `Order` will fail typecheck.
    Fix: keep wider signature; assert inside.

  package.json:51  ⚠️  P2: New dep `image-tools@0.3.0` has `scripts.postinstall`.
    Fix: review the post-install script before merging; pin to a verified version.

P3 — ADVISORY:
  package.json:67  ℹ️  P3: New dep `some-utils` — license field empty in lockfile.
    Run: `npm view some-utils license` to verify before merge.

  package.json:34  ℹ️  P3: `package.json` touched without `pnpm-lock.yaml` update.
    Run: `pnpm install` and include the lockfile diff.

RECOMMENDED NEXT:
  - Address P1 before merge.
  - For new deps, run the recommended license-lookup commands above.
  - If reviewer already requested changes: /pr-feedback-route <PR#>

SUMMARY: <a> P1 · <b> P2 · <c> P3 · pinned to <headRefOid[:8]>
```

Empty case:

```
BACKCOMPAT REVIEW — PR #<PR#>
─────────────────────────────
No backcompat findings.
(No API shape breaks, no schema breaks, no shared-lib signature changes, no risky new deps.)
```

---

## Boundaries

- Read-only. Does NOT run `npm view` / `pip show` / network license lookups — emits recommended commands the user runs.
- Does NOT execute the diff, does NOT install deps in a sandbox.
- Does NOT cover security depth — see `/security-review-deep`.
- Does NOT cover perf — see `/perf-review`.
- Does NOT cover observability — see `/observability-review`.

## Auto-chain

- **No auto-chain out.**
- **Triggered by**: `/pr-inbox` (always-on companion row); `/route` when user says "back-compat" / "breaking change" / "new dep safe" with a PR#.
- **Cross-links**: `/pr-feedback-route <PR#>` for the post-CHANGES_REQUESTED loop.

## Integration

- **Produces**: `docs/qa/backcompat-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr view --json` + `gh pr diff <PR#>` + project root `package.json` (or equivalent) for license context.
- **Re-run**: idempotent. Re-run after each push.
