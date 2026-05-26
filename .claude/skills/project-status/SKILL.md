---
name: project-status
description: Full-lifecycle project tracker. Reads PRD, issue files, CLAUDE.md, the schema, the source tree, tests, and git log; classifies stage (greenfield → spec'd → planned → building → mature → pre-launch); flags each PRD issue as DONE / IN-PROGRESS / NOT-STARTED; renders the issue dependency graph + critical path + next-unlocks; surfaces blockers ranked P1–P3; recommends the right skill for the current situation across the installed skill set, and falls back to `/route` when intent is ambiguous. Use when the user asks "where are we", "what's left", "what next", "project status", or before a planning session. Named `project-status` (not `status`) to avoid collision with the built-in `/status` slash command.
---

# /project-status — Full Lifecycle Tracker + Skill Dispatcher

Invoke as `/project-status` (optionally `/project-status <free-form goal>`).
Read-only audit: survey project state (history, stage, issue graph, risks) and
recommend the next skill. Never edits, commits, migrates, or starts servers.

**This file is the thin core.** Heavy machinery lives in `refs/` and is read
ONLY when its precondition fires (see ADVANCED PASSES at the bottom). Most
calls need no ref read. Stack assumed Next.js + Prisma + pnpm + vitest +
Playwright — adapt globs/commands for other stacks.

---

## Pre-flight (read-only, with fallbacks)

Each input optional; note presence/absence in the report.

| Input | Tool | Fallback if missing |
|---|---|---|
| `git status`, `git log -50`, `git log --since="7 days ago"` | Bash | "not a git repo" / empty |
| `package.json` (or `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`) | Read | "not scaffolded" |
| `CLAUDE.md` at root | Read | flag — onboarding context missing |
| Schema (`prisma/schema.prisma`, `alembic/versions/**`, `db/migrate/**`, `drizzle/**`) | Read | "no schema yet" |
| `issues/*-prd.md` or `issues/prd.md` | Glob + Read | "no PRD" |
| `issues/*.md` (PRD excluded), incl. `dependencies:` field | Glob + Read each | "no issues split"; infer deps from numeric prefix |
| API entrypoints (`app/api/**/route.ts`, `app/routers/*.py`, `src/routes/**`) | Glob | count → 0 |
| Pages/views (`app/**/page.tsx`, `templates/**/*.html`) | Glob | count → 0 |
| Unit/int tests (`**/*.test.{ts,tsx}`, `tests/**/test_*.py`, `*_test.go`) | Glob | count → 0 |
| E2E specs (`e2e/**/*.spec.ts`, `tests/e2e/**`) | Glob | count → 0 |
| `.claude/skills/**/SKILL.md` (installed-skill set) | Glob | (always present) |
| `docs/classify/<project>.md` (class label `**Class: <XS\|S\|M\|L\|XL>**`) | Glob + Read | flag → recommend `/project-classify`; default `M` |
| `docs/design/{wireframes/**,design-system,flows/**,a11y-*}.md` | Glob | "no design docs — UI/UX gate open" |
| `gh pr list --state open --json number --limit 1` → `open_pr_count = N` | Bash | silent-fail → `open_pr_count = 0` |

Render `Open PRs: <N>  (run /pr-inbox to triage)` in the header only when `open_pr_count ≥ 1`.

---

## Stage Detection

First matching row wins. Substitute your stack's dependency manifest.

| Stage | Indicator | First-pick skill |
|---|---|---|
| greenfield | No PRD, no manifest | `/write-a-prd` |
| spec'd | PRD exists, no issue files | `/prd-to-issues` |
| planned | Issues exist, no manifest | `/plan` (Large track) |
| building | Code present, ≥1 issue NOT-STARTED or IN-PROGRESS | per-issue (see below) |
| mature | All issues DONE, no e2e tests (e2e count = 0) | `/coverage-map` + `/smoke-test` |
| pre-launch | All issues DONE, e2e exists, branch ahead of default | `/verify` → `/commit-split` |

Tie-breakers: two rows match → prefer the lower (earlier) stage AND lower
confidence. ≥2 indicators tie → top recommendation is `/route "<goal>"`.

**Source of truth = filesystem only.** Stage is computed from the indicators
above. A classify front-matter `stage:` field is **ignored** by design —
declared stage drifts from real state; indicators are authoritative.

---

## Issue Progress Classification

For each `issues/*.md` (PRD excluded):

1. Parse `goal`, `scope`, `acceptance criteria`, `dependencies`.
2. **Build scope-keyword → file-glob map at runtime.** For each top-level dir
   under `app/api/`, `src/modules/`, `src/routes/`, `services/`, `internal/`,
   register `<dirname>` → its glob. Augment with universal triggers:
   - `auth`/`login`/`session` → `app/api/auth/**`, `app/(auth)/**`, `middleware.ts`, `lib/auth.ts`
   - `payment`/`webhook`/`charge`/`refund` → `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts`
   - `admin`/`dashboard` → `app/admin/**`, `app/api/admin/**`, `components/admin/**`
   - `schema`/`prisma`/`migration`/`alembic` → schema file + migration dir
   - `cron`/`scheduled`/`sweep` → `app/api/cron/**`, `vercel.json`, scheduler manifests
   - `infra`/`config`/`deploy` → root config (`next.config.*`, `pyproject.toml`, `go.mod`, `.github/**`, `Dockerfile`)
   - `page`/`screen`/`ui`/`frontend`/`form`/`modal`/`nav`/`table`/`component` → `app/**/page.tsx`, `app/(*)/**`, `app/**/layout.tsx`, `components/**`, `src/components/**`, `pages/**/*.{tsx,vue}`
3. Classify:
   - **NOT-STARTED** — zero files match scope globs
   - **IN-PROGRESS** — scope files present, but ≥1 AC has no matching code/test
   - **DONE** — all scope files present AND every AC has matching evidence
4. On ambiguity → IN-PROGRESS. Never silently mark DONE.

---

## Issue Graph + Risk Surface

**Graph** (after classification): read `dependencies:`; if absent, infer
numeric-prefix soft-order (PRD critical path overrides). Compute **critical
path** (longest chain to the launch-blocking issue), **most-blocking** (highest
downstream-blocked count), **next-unlocks** (per IN-PROGRESS / next NOT-STARTED
issue). ASCII tree if ≤20 issues, else list.

**Risk surface (ranked):**
- **P1 (blocks launch):** payment webhook missing/untested; auth missing on
  PII/money routes; zero e2e on the golden path; secrets in repo (`.env*`
  tracked, keys in code); schema model referenced by code but undefined.
- **P2 (blocks merge):** IN-PROGRESS issue overlaps a security touchpoint;
  missing admin role check; imports referencing non-existent exports; migration
  drift.
- **P3 (cleanup):** TODO/HACK/`@ts-expect-error`/`# type: ignore`; untested
  non-critical routes; naming inconsistency (defer detail to `/consistency-audit`).

---

## Recommended Next Steps (core decision logic)

Produce ≤5 ranked steps; each names a specific skill with a copy-pasteable
invocation string. Default class = M.

| Stage | Top recommendation |
|---|---|
| greenfield | `/write-a-prd` (M); class S → `/idea-capture` |
| spec'd | `/prd-to-issues`, then `/grill-me`; class S → `/lean-canvas` if validation pending |
| planned | `/plan` (M); class L → `/write-a-prd → /prd-to-issues → /prioritize`; class XL → `/regulatory-preflight → /threat-model-pre → /data-flow-diagram-pre` |
| building | per high-priority issue (see elevation rules below) |
| mature | `/coverage-map` → `/tdd`; `/smoke-test` for golden paths |
| pre-launch | `/verify` → `/smoke-test` → `/commit-split` → push (then manually run `/ultrareview` — billed, NOT auto-recommended); class XL → prepend `/dr-drill, /rollback-plan, /deploy-health-gate, /prod-smoke` |

**Top-1 auto-elevation (first match wins):**
1. Any **P1 risk** → its remediation skill to position 1, regardless of stage/class.
1a. `open_pr_count ≥ 1 AND stage ∈ {building, mature, pre-launch}` → top-1 = `/pr-inbox` (P1 still wins → `/pr-inbox` to position 2).
2. `class=S AND stage ∈ {greenfield, spec'd, planned} AND no PRD` → top-1 = `/idea-capture`.
3. `class=S AND stage ∈ {greenfield, spec'd, planned} AND validation pending` → top-1 = `/lean-canvas`.
4. `class=L AND stage=planned AND no PRD` → top-1 = `/write-a-prd`.
5. `class=XL AND stage=planned AND regulated domain` → top-1 = `/regulatory-preflight`.
5a. `frontend_present AND class ∈ {S,M,L,XL} AND stage ∈ {planned, building} AND frontend-scope issues ≥3` → top-1 = `/build-frontend`.
6. `stage=building AND IN-PROGRESS issue has frontend scope AND no wireframes` → top-1 = `/ui-wireframe "<screen>"`, pos-2 = `/user-flow "<flow>"`.
7. Stage row offers `/lead` AND issue spec unclear → prepend `/grill-me "<issue>"` before `/lead`.

**Billed-Skill Registry — HARD EXCLUSION.** Skills here cost money / are
user-triggered. They MUST NOT appear in any recommendation slot (RECOMMENDED
NEXT STEPS, SITUATION → SKILL, FRONTEND BUILD, STAGE-APPROPRIATE NEXT SKILL),
regardless of stage/class/boost. Silent-drop (not a class-skip filter line).
Registry: `/ultrareview`. Extend here when adding billed skills.

---

## ADVANCED PASSES — conditional ref reads

Read the matching file ONLY when its precondition holds. Do NOT read by default.

- **`refs/situation-matrix.md`** — full Situation → Skill dispatch table, stage
  gating, FRONTEND BUILD gating, `/route` fallback rules.
  **READ WHEN:** rendering the `SITUATION → SKILL` block or enumerating
  actionable skills beyond the per-stage top rec.

- **`refs/class-filter.md`** — class-skip filter + Class-Aware Boost algorithm.
  **READ WHEN:** `docs/classify/<project>.md` exists. If absent: skip the read,
  flag "⚠ no class label — run `/project-classify`", default class `M`.

- **`refs/sim-check.md`** — sim-sanity-check parser/aggregation, `--verify-verbose`
  drill-down, full annotated output template, exhaustive completion checklist.
  **READ WHEN:** ≥3 same-class fixtures exist under `D:\Skills\reports\sim100\<class>-*.md`
  or `D:\Skills\reports\<class>-*.md`. If <3 (or class defaulted to M): emit the
  one-line `Sim-match: SKIP — <reason>` and do NOT read. Also read for the full
  output template if needed.

---

## Output skeleton

Render these sections (full annotated example in `refs/sim-check.md`):

```
PROJECT STATUS
Stage / Confidence
WORK HISTORY (last 7d)        commits, issues completed, skills invoked
INPUTS READ                   ✓/✗ per pre-flight row
ISSUE PROGRESS (<N>)          [DONE]/[IN-PROGRESS — gap]/[NOT-STARTED] per issue
ISSUE GRAPH                   critical path, most-blocking (ASCII tree ≤20)
NEXT UNLOCKS                  per IN-PROGRESS / next NOT-STARTED
RISK SURFACE                  P1 / P2 / P3
[FRONTEND BUILD]              only if stage∈{planned,building} + frontend scope + design docs missing
SITUATION → SKILL             actionable rows only (+ Filtered/Dropped if class-filtered)
[SIM-MATCH]                   one-line OK / WARN / SKIP
RECOMMENDED NEXT STEPS        ≤5 ranked, copy-pasteable
STAGE-APPROPRIATE NEXT SKILL  single highlighted pick
```

For `greenfield`, ISSUE PROGRESS / GRAPH / NEXT UNLOCKS / RISK SURFACE collapse
to "(no issues — start with /write-a-prd)". For a free-form arg, append a
`DESCRIPTION DISPATCH → /route "<arg>"` block.

## Completion check (condensed — full list in refs/sim-check.md)

Pre-flight rows all ✓/✗ · stage + confidence assigned · every issue classified ·
graph with critical-path + most-blocking · next-unlocks · P1–P3 risks ·
SITUATION → SKILL shows actionable rows only · class filter applied if classify
doc present · billed-skill exclusion applied · ≤5 copy-pasteable next steps ·
one stage-appropriate pick · `/route` surfaced when ambiguous / free-form arg /
unmapped P1.
