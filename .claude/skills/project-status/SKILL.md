---
name: project-status
description: Full-lifecycle project tracker. Reads PRD, issue files, CLAUDE.md, the schema, the source tree, tests, and git log; classifies stage (greenfield → spec'd → planned → building → mature → pre-launch); flags each PRD issue as DONE / IN-PROGRESS / NOT-STARTED; renders the issue dependency graph + critical path + next-unlocks; surfaces blockers ranked P1–P3; recommends the right skill for the current situation across the installed skill set, and falls back to `/route` when intent is ambiguous. Use when the user asks "where are we", "what's left", "what next", "project status", or before a planning session. Named `project-status` (not `status`) to avoid collision with the built-in `/status` slash command.
---

# /project-status — Full Lifecycle Tracker + Skill Dispatcher

Invoke as `/project-status` (optionally `/project-status <free-form goal>`).
Read-only audit that surveys the whole project — work history, current state,
issue graph, next unlocks, risks — and recommends what skill to call next.

Sits next to `debt-scan`, `consistency-audit`, `coverage-map` — but each of
those slices one dimension. `/project-status` is the wide-angle lens. Output
feeds `/route`, `/lead`, `/plan`, or any of the installed skills directly.

Stack worked here: Next.js + Prisma + pnpm + vitest + Playwright. Adapt globs
and tool commands for your stack — run `/stack-profile` if uncertain.

---

## Why you'd care

"Where are we" is the question every standup, every investor update, and every planning session orbits around. A status read that maps source code back to PRD intent answers it in seconds instead of an afternoon of digging.

## Pre-flight (read-only, with graceful fallbacks)

Each input is optional. Note presence/absence in the report.

| Input                                                                                    | Tool             | Fallback if missing               |
|------------------------------------------------------------------------------------------|------------------|-----------------------------------|
| `git status`, `git log -50`                                                              | Bash             | "not a git repo"                  |
| `git log --since="7 days ago"`                                                           | Bash             | empty section                     |
| `package.json` (or `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`)                  | Read             | "not scaffolded"                  |
| `CLAUDE.md` at root                                                                      | Read             | flag — onboarding context missing |
| Schema file (`prisma/schema.prisma`, `alembic/versions/**`, `db/migrate/**`, `drizzle/**`) | Read           | "no schema yet"                   |
| `issues/*-prd.md` or `issues/prd.md`                                                     | Glob + Read      | "no PRD"                          |
| `issues/*.md` (PRD excluded)                                                             | Glob + Read each | "no issues split"                 |
| `dependencies:` field in each issue                                                      | Read each issue  | infer from numeric prefix order   |
| API entrypoints (`app/api/**/route.ts`, `app/routers/*.py`, `src/routes/**/*.ts`, etc.)  | Glob             | count → 0                         |
| Pages / views (`app/**/page.tsx`, `templates/**/*.html`, etc.)                           | Glob             | count → 0                         |
| Unit/integration tests (`**/*.test.{ts,tsx}`, `tests/**/test_*.py`, `*_test.go`)         | Glob             | count → 0                         |
| E2E specs (`e2e/**/*.spec.ts`, `tests/e2e/**`)                                           | Glob             | count → 0                         |
| `.claude/skills/**/SKILL.md`                                                             | Glob             | (always present)                  |
| `docs/classify/<project>.md` (class label `**Class: <XS\|S\|M\|L\|XL>**`)                | Glob + Read      | flag — recommend `/project-classify`; default to `M` for filter pass |
| `docs/design/wireframes/**.md`, `docs/design/design-system.md`, `docs/design/flows/**.md`, `docs/design/a11y-*.md` | Glob | "no design docs — UI/UX gate open" |
| `D:\Skills\reports\sim100\<class>-*.md` + `D:\Skills\reports\<class>-*.md` (same-class sim fixtures, dedupe by slug, prefer sim100; sample up to 5) | Glob + Read | warn — sanity-check section emits "SKIP: no fixtures (need ≥3)" |

---

## Stage Detection

Pick the first row whose indicator matches. The dependency-manifest column lists
common manifests by stack — substitute your stack's equivalent.

| Stage         | Indicator                                                            | First-pick skill                                  |
|---------------|----------------------------------------------------------------------|---------------------------------------------------|
| greenfield    | No PRD, no dependency manifest                                       | `/write-a-prd`                                    |
| spec'd        | PRD exists, no issue files                                           | `/prd-to-issues`                                  |
| planned       | Issues exist, no dependency manifest                                 | `/plan` (Large track)                             |
| building      | Code present, ≥1 issue NOT-STARTED or IN-PROGRESS                    | per-issue (see Issue Progress)                    |
| mature        | All issues DONE, no e2e tests (e2e glob count = 0)                   | `/coverage-map` + `/smoke-test`                   |
| pre-launch    | All issues DONE, e2e exists, branch ahead of default branch          | `/verify` → `/commit-split`                       |

Tie-breakers:
- If two rows could match (e.g., issues exist AND a manifest exists but no
  code), prefer the lower-numbered (earlier) stage and **lower the confidence**.
- If stage detection is ambiguous (≥2 indicators tie), surface
  `/route "<your goal>"` as the top recommendation instead of guessing.

**Source of truth — filesystem only.** Stage is computed from the
indicators above (PRD presence, issues/, dependency manifest, code,
tests, branch state). If a classify front-matter declares
`stage: <value>`, that field is **ignored** by design — declared stage
can drift from real state and the indicators are always authoritative.
Test scenarios that need a specific stage should seed the matching
filesystem indicators rather than overriding the classify doc.

---

## Issue Progress Classification

For each `issues/*.md` (PRD excluded):

1. Parse sections: `goal`, `scope`, `acceptance criteria`, `dependencies`.
2. **Build the scope-keyword → file-glob mapping at runtime.**
   - For each top-level dir under `app/api/`, `src/modules/`, `src/routes/`,
     `services/`, or `internal/`, register `<dirname>` → `<path glob for that dir>`.
     A scope mentioning `<dirname>` maps to that glob. (Example: a project with
     `app/api/orders/` and `app/orders/` registers `orders` → both globs.)
   - Augment with these **universal triggers** (cross-vertical, hardcoded):
     - `auth` / `login` / `session` → `app/api/auth/**`, `app/(auth)/**`, `middleware.ts`, `lib/auth.ts` (or stack equivalent)
     - `payment` / `webhook` / `charge` / `refund` → `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts`
     - `admin` / `dashboard` → `app/admin/**`, `app/api/admin/**`, `components/admin/**`
     - `schema` / `prisma` / `migration` / `alembic` → schema file + migration dir
     - `cron` / `scheduled` / `sweep` → `app/api/cron/**`, `vercel.json`, scheduler manifests
     - `infra` / `config` / `deploy` → root config files (`next.config.*`, `pyproject.toml`, `go.mod`, `.github/**`, `Dockerfile`)
     - `page` / `screen` / `ui` / `frontend` / `form` / `modal` / `nav` / `dashboard` / `table` / `component` → `app/**/page.tsx`, `app/(*)/**`, `app/**/layout.tsx`, `components/**`, `src/components/**`, `pages/**/*.{tsx,vue}` (stack equivalent)
3. Classify:
   - **NOT-STARTED** — zero files match scope globs
   - **IN-PROGRESS** — scope files present, but ≥1 acceptance criterion has
     no matching code or test (e.g., AC says "409 on conflict" but no test
     covers it; AC says "admin-only" but no role check found)
   - **DONE** — all scope files present AND every acceptance criterion has
     matching evidence (a test, a code path, or both)
4. On ambiguity, mark IN-PROGRESS — never silently mark DONE.

---

## Issue Dependency Graph

Build the graph after classification:

1. For each issue, read `dependencies:` field if present (e.g.
   `dependencies: 001, 002`).
2. If absent, infer: numeric prefix order = soft dependency on the immediately
   prior slice; PRD critical path overrides if stated.
3. Compute:
   - **Critical path** — longest chain from earliest issue to the
     launch-blocking issue (the issue named in PRD critical path, or the
     last-numbered issue if not specified).
   - **Most-blocking** — issue with the highest count of downstream blocked
     issues.
   - **Next unlocks** — for each IN-PROGRESS or next-up NOT-STARTED issue,
     list which downstream issues it unblocks.

Rendered as ASCII tree if ≤20 issues; otherwise list form.

---

## Risk Surface (ranked P1–P3)

Scan beyond issues for blockers:

**P1 — blocks launch**
- Payment webhook route missing OR untested (any handler under the project's webhook dir)
- Auth missing on protected routes that handle PII or money
- Zero e2e tests for the project's golden path (per PRD)
- Secrets present in repo (`.env*` tracked, API keys in code)
- Schema model referenced by code but not defined (Prisma model / SQLAlchemy table / Drizzle table missing)

**P2 — blocks merge**
- IN-PROGRESS issue overlaps a security touchpoint
- Missing role check on admin route
- Imports referencing exports that don't exist (compile risk)
- Schema migration drift (migrate status not clean)

**P3 — cleanup**
- TODO / HACK / `@ts-expect-error` / `# type: ignore` comments
- Untested non-critical routes
- Naming inconsistencies (defer to `/consistency-audit` for detail)

---

## Situation → Skill Matrix

The full map of "what's happening now" → which skill to call. Render only the
**currently-actionable rows** in the report (filter by stage + IN-PROGRESS
issues + risks); keep the full table here as the source of truth. At
invocation, list `.claude/skills/*/SKILL.md` (Glob) and silently drop any row
whose target skill is not installed locally.

```
ISSUE INTAKE
  Issue spec unclear / hidden assumptions     → /grill-me "<issue>"
  Issue spans 2+ layers (auth + UI + DB)      → /lead "<issue>"
  Issue narrow, single AC                     → /tdd "<AC>"
  Issue large, needs research                 → /plan "<issue>"
  Multiple skills could apply, unsure order   → /route "<task>"

PRE-BUILD SCOPING (class ∈ {L, XL}, stage = planned)
  No PRD yet                                  → /write-a-prd
  PRD exists, no issues                       → /prd-to-issues
  Issues exist, no prioritization             → /prioritize
  Acceptance criteria undefined               → /acceptance-criteria
  Acceptance set, no traceability             → /traceability-matrix → /edge-case-enum

REGULATORY PRE-DESIGN (class = XL, stage = planned)
  Regulated domain (finance/health/safety)    → /regulatory-preflight
  Threat surface, pre-design                  → /threat-model-pre   (NOT /threat-model — that's mid-design)
  Data flows, pre-design                      → /data-flow-diagram-pre
  3rd-party pentest needed                    → /pen-test-procurement-plan
  Governance gap                              → /conflict-of-interest-disclosure → /code-of-conduct
  Compliance scope (planning artifact)        → /sbom-generate

INCEPTION TRACK (class = S, stage ∈ {greenfield, spec'd, planned}) — top-1 boost
  No PRD, idea phase                          → /idea-capture
  Validation pending                          → /lean-canvas → /problem-validation → /founder-fit

MID-IMPLEMENTATION
  Schema change needed                        → <stack migrate cmd> → /verify
  Renaming/removing exported symbol           → /atomic-file-edit
  Native module ABI mismatch                  → /better-sqlite3-rebuild (if installed)
  Subsystem feels tangled                     → /improve-codebase-architecture
  Frontend feature kickoff                    → /scaffold-feature
  Backend contract not ready                  → /mock-server, /endpoint-stub
  Form input + validation wiring              → /form-wire
  Error boundary wiring on new surface        → /error-boundary-wire

FRONTEND LIFECYCLE (class ∈ {S, M, L, XL}, stage ∈ {planned, building}, frontend scope detected)
  Multiple UI issues, full lifecycle needed   → /build-frontend
  One UI slice, scope clear, AC set           → /tdd "<AC>"
  UI slice spec unclear                       → /grill-me "<slice>" → /build-frontend
  Resume mid-chain after halt                 → /build-frontend --phase=<N>

FRONTEND BUILD (stage ∈ {planned, building}, frontend scope detected, design docs missing for slice)
  No wireframes for slice                     → /ui-wireframe "<screen>"
  No user flow diagram                        → /user-flow "<flow>"
  No design tokens / component inventory      → /design-system
  No a11y design pass                         → /a11y-design "<feature>"
  Form-heavy slice                            → /form-design
  Navigation / IA decision pending            → /nav-pattern-pick
  Dashboard surface                           → /dashboard-layout
  Data-table surface                          → /data-table-design
  Typography unspecified                      → /typography-hierarchy-spec
  Motion / animation spec missing             → /motion-direction-spec
  Designer handoff needed                     → /figma-handoff-spec
  Backend not ready, want to build UI first   → /mock-server, /endpoint-stub
  New feature scaffold                        → /scaffold-feature
  Form input wiring                           → /form-wire
  Error boundary wiring                       → /error-boundary-wire
  Cross-doc design drift                      → /design-review

CLASS-SPECIFIC BUILD (boost — see Class-Aware Boost section below)
  Class XL building (platform/infra cluster)  → /otel-wire, /sbom-generate, /env-config, /codegen-from-contract, /mock-server, /migration-author
  Class L  building (review/debt cluster)     → /tdd, /pr-review-bot, /debt-scan, /simplify, /traceability-matrix, /edge-case-enum
  Class S  building, perf-sensitive           → /perf-audit

POST-CODE-CHANGE (before commit, stage ∈ {building, pre-launch, mature} only)
  Small fix made                              → /verify
  UI/frontend change                          → /smoke-test
  Many files mixed across domains             → /commit-split
  UI/frontend change, cross-viewport check    → /responsive-test
  UI/frontend change, visual baseline         → /visual-regression
  UI/frontend change, runtime a11y scan       → /a11y-runtime
  UI/frontend change, browser smoke           → /smoke-test
  Frontend perf regression suspected          → /devtools-audit, /perf-audit

AUDIT / SURVEY
  "Where are we, what next?"                  → /project-status (this skill)
  "What's untested?"                          → /coverage-map → /tdd
  "What debt accumulated?"                    → /debt-scan
  "Is naming/structure consistent?"           → /consistency-audit

PRE-LAUNCH (all issues DONE, stage ∈ {pre-launch, mature} ONLY — suppressed otherwise)
  Fixed sequence                              → /verify → /smoke-test → /commit-split (then manually run /ultrareview — billed, never auto-recommended; see Billed-Skill Registry)
  Class XL pre-launch (ops cluster — boost)   → /dr-drill, /rollback-plan, /deploy-health-gate, /prod-smoke

GREENFIELD / SPEC'D
  No PRD                                      → /write-a-prd
  PRD exists, no issues                       → /prd-to-issues
```

**Stage gating (P3.5 — over-rec dampening):** The PRE-LAUNCH and POST-CODE-CHANGE groups render **only** when the current detected stage is in their declared stage set. Suppress them entirely for `stage ∈ {greenfield, spec'd, planned}` (the baseline showed `/verify` over-recommended at 62–68% in XS/S non-pre-launch cells). Caller can still invoke `/verify`, `/commit-split`, `/smoke-test` directly — gating affects only what `/project-status` recommends.

**FRONTEND BUILD gating:** The FRONTEND BUILD group renders **only** when (a) detected stage ∈ `{planned, building}`, (b) ≥1 IN-PROGRESS or next-up NOT-STARTED issue maps to a frontend scope (per the universal-trigger frontend row in Issue Progress Classification), AND (c) at least one expected `docs/design/*` artifact is missing for that slice. Rows for already-satisfied design docs are silent-dropped (e.g. `docs/design/wireframes/<slice>.md` exists → omit the `/ui-wireframe` row). Cluster suppressed entirely on backend-only repos and on stages outside `{planned, building}`.

For free-form intent ("I want to do X but unsure which skill"), defer to
`/route "<X>"` — it owns the trigger table and reads git state.

---

## Class-Aware Skill Filter

Every recommendation must respect the project's class. After reading
`docs/classify/<project>.md`, extract the `**Class: <XS|S|M|L|XL>**` label.
For each candidate skill in the Situation → Skill matrix and Recommended
Next Steps:

1. Read its frontmatter `output_size:` block (already universal across the
   skill set — BRAIN #11 / #20). Format:
   ```yaml
   output_size:
     XS: skip
     S: 2h
     M: 2h
     L: 4h
     XL: 6h
   ```
2. If the value for the project's current class = `skip` → **drop the skill**
   from the recommendation set.
3. If no `output_size:` block on a skill → keep it (treat as always-on, e.g.
   `/tdd`, `/verify`, `/commit-split`, `/route`).

Fallback when class missing:
- If `docs/classify/<project>.md` is absent → flag in the report
  ("⚠ no class label — run `/project-classify` first"), default to class
  `M` for the filter pass so the report still produces output.

In the report's **SITUATION → SKILL** section, append a one-line summary:

```
Filtered: <N> skills dropped as class=<X> skip
```

Optionally list the top 5 dropped skills inline for transparency:

```
Dropped (class=XS): /threat-model, /lean-canvas, /risk-register, /pricing-model, /pitch-deck-narrative (+ <N-5> more)
```

---

## Class-Aware Boost (additive to filter)

The Class-Aware Skill Filter above is **drop-only**: it removes skills whose
`output_size[class] = skip`. But validate-routing baseline 2026-05-15
(decision #26) showed three cells failing not because wrong skills surfaced,
but because **the right skills weren't ranked into top-5**. L planned fired
PRD-track; XL planned fired `-pre` regulatory family; XL building fired
platform/infra cluster — `/project-status` was emitting generic stage-table
picks for all three.

This block adds an **additive boost layer**: skills here are prepended to the
candidate set (capped at 5) before the stage-table fills remaining slots.
Centralized here (single edit point) rather than per-skill frontmatter on
464 files.

```
(class, stage)              → boost skills (in priority order)
─────────────────────────────────────────────────────────────────────────
(S,  greenfield|spec'd|planned)  → /idea-capture, /lean-canvas, /problem-validation, /founder-fit, /project-classify
(L,  planned)                    → /write-a-prd, /prd-to-issues, /prioritize, /acceptance-criteria, /traceability-matrix, /edge-case-enum
(L,  building)                   → /build-frontend*, /tdd, /pr-review-bot, /debt-scan, /simplify, /traceability-matrix, /edge-case-enum
(M,  planned|building)           → /build-frontend*, /tdd, /smoke-test  (frontend-aware miss-fill)
(XL, planned)                    → /regulatory-preflight, /threat-model-pre, /data-flow-diagram-pre, /pen-test-procurement-plan, /conflict-of-interest-disclosure, /code-of-conduct, /sbom-generate
(XL, building)                   → /build-frontend*, /otel-wire, /sbom-generate, /env-config, /codegen-from-contract, /mock-server, /migration-author
(XL, pre-launch)                 → /dr-drill, /rollback-plan, /deploy-health-gate, /prod-smoke
(S,  building)                   → /build-frontend*, /perf-audit  (single-skill miss-fill, not a full cluster)

* = gated by frontend-scope detector (step 2a below); only prepended when frontend_present = true.
```

**Algorithm** (run after Class-Aware Filter drop pass, before Recommended Next Steps):

1. Read `(class, stage)` from classify doc + Stage Detection.
2. If `(class, stage)` matches a row above, take the boost list in order.
2a. **Frontend-scope detection** — scan `issues/*.md` scope/title fields.
   If any matches scope keywords {`page`, `component`, `ui`, `ux`, `form`,
   `dashboard`, `nav`, `modal`, `wizard`, `onboarding`, `landing`,
   `paywall`, `table`, `chart`, `search`, `card`, `tab`, `screen`, `view`,
   `layout`} → set `frontend_present = true`. Otherwise drop every `*`-
   tagged skill (currently only `/build-frontend`) from the boost list
   silently.
3. Drop any boost skill whose `output_size[class] = skip` (filter still
   wins — never re-add a class-skipped skill).
4. Drop any boost skill not installed (`.claude/skills/<slug>/SKILL.md`
   absent — match the Situation → Skill matrix silent-drop rule).
5. Prepend remaining boost skills to the recommendation set.
6. Stage-table top recommendation (from L347–365 table) appends after the
   boost set, filling remaining slots up to 5.
7. P1 auto-elevation (L363) still wins over everything — it prepends a
   risk-driven step to position 1 regardless of boost set.

Render a one-line summary in the report:

```
Boosted (class=<X> stage=<Y>): <skill-1>, <skill-2>, <skill-3> (+ <N-3> more)
```

If no boost row matches `(class, stage)` → emit nothing; fall through to
default stage-table behavior.

---

## Sim Sanity Check

After computing the top-5 recommended next steps, cross-check against
empirical sim ground truth for the current project's class.

### Pre-conditions (skip the check if any fails)

1. **Class must be real, not defaulted.** If `docs/classify/<project>.md`
   was absent and the filter pass used default `M`, emit a single-line
   `SKIP: no classify doc — run /project-classify first` and exit the
   sanity-check pipeline. Wrong-class sims produce confidently-wrong
   output, which is worse than no check.
2. **At least 3 same-class fixtures must be available.** Render
   `SKIP: only N fixture(s) for class <X>` when N<3 — thresholds at
   N<3 are statistically meaningless.

### Fixture pool (P3.2 — dedupe across both pools)

Glob **both** `D:\Skills\reports\sim100\<class>-*.md` and
`D:\Skills\reports\<class>-*.md` (legacy 50-sim flat pool). Dedupe by
filename slug (`<class>-<product>` part), preferring the `sim100/`
version on collision. Take up to 5 most recent.

### Parser (P1.1 — multi-variant headings)

Sim formats vary by class. Heading match is regex, not literal:

- **Fired heading** — match `^## Fired skills \([^)]+\)` (accepts
  `(ordered, brief)`, `(grouped, summarized)`, `(grouped, with
  highlights)`, future variants).
- **Skipped heading** — match `^## Skipped — (bulk reasons|why)` or
  `^## Skipped skills` (accepts prose-list and markdown-table forms).

**Skill-name tokenizer is format-agnostic.** Within either section,
extract every `/<kebab-case-slug>` occurrence as a skill token,
regardless of prose vs. table vs. numbered-list structure. Slash prefix
+ kebab-case is the invariant — strip trailing punctuation, backticks,
parens.

### Stage-aware filter (P1.2 — restrict to matching phase)

Each sim covers full Inception→Sunset lifecycle. A Building-stage
project comparing against full-lifecycle fired_set gets false missing
flags for off-stage skills (`/regulatory-preflight`, `/dr-drill`,
`/sunset-plan`).

For each sim, parse phase markers (`## Phase <N> — <name>` or
`### <stage>`). Restrict `fired_set` to skills appearing in phases
matching the current `/project-status` detected stage ± 1 row in the
Stage Detection table. If a sim has no phase markers, fall back to
treating the entire fired_set as in-stage (best-effort).

### Class-skip subtraction (P1.3 — fix permanent noise)

Change-1 filter drops class-skipped skills from the recommendation set.
But raw `fired_set` may include them. Without subtraction, any
class-skipped skill that fires in sims gets permanently flagged
"missing" and never resolves.

Compute the class-skipped set first (from Class-Aware Skill Filter
output) and subtract before missing-flag emission:

```
missing_candidates = fired_≥3/N − class_skipped_set − recommendation_set
```

### Aggregation rules

After parser + stage-filter + class-subtract:

- For each **recommended** skill, count its appearances in `fired_set`
  across the N sampled sims:
  - ≥3/N → **high-confidence** (Sim-match ≥60%)
  - 0/N → **low-confidence** (Sim-match 0%); flag with `?` glyph in the
    SITUATION → SKILL block, not only in the sim section (P2.5)
- For each skill in `fired_set` of ≥3/N sims that survives class-skip
  subtraction but is not in the recommendation → flag **missing**.
- For each **recommended** skill in `skip_set` of ≥2/N sims → flag
  **suspicious**.

### Render

Default = one-line verdict in the report (P2.1). Verbose drill-down
(per-skill counts, dropped names, top missing/suspicious) only when
invoked as `/project-status --verify-verbose`.

One-line format:
- `Sim-match (N <class> sims): OK` — no flags
- `Sim-match (N <class> sims): WARN — <m> missing, <s> suspicious, <l> low-conf` — flags present
- `Sim-match: SKIP — <reason>` — pre-condition failed

Lightweight — ≤5 file reads + tokenize per invocation. No separate
report, no separate skill. Continuous validation on every run.

Tradeoff: sample of 5 catches per-class drift but not aggregate
cross-library precision/recall. Bump sample size (one-line change here)
if false-negative rate feels too high. Full-library regression sweep
was deemed overkill for solo-dev cadence (see BRAIN entry for
re-introduction trigger).

---

## When `/route` Surfaces

Codify the fallback rules so the skill never silently swallows ambiguity:

1. **Stage detection ambiguous** (≥2 stage rows tie) → top step is `/route "<your goal>"`.
2. **`/project-status` invoked with free-form arg** (e.g. `/project-status help me decide what to ship next`) → run the audit, then surface `/route "<the arg>"` as the second step so the description gets dispatched.
3. **IN-PROGRESS issue spans 3+ domains AND no `dependencies:` field** → second step is `/route "<issue title>"` so trigger-table sequencing kicks in.
4. **P0/P1 risk doesn't map to a stage-table row** (e.g. "secret in repo") → `/route` matches via its security trigger row; surface as the top step regardless of stage.

Otherwise (clear stage, clear next issue, no ambiguity) — recommend the
specific skill directly. Do not bury the right answer behind a dispatcher.

---

## Recommended Next Steps

Produce ≤5 ranked steps. Each names a specific skill **with a concrete
invocation string** the user can copy-paste.

### Billed / user-triggered skills (never recommend)

The following skills cost money or are explicitly user-triggered. They MUST
NOT appear in `RECOMMENDED NEXT STEPS`, `SITUATION → SKILL`, `FRONTEND
BUILD`, `STAGE-APPROPRIATE NEXT SKILL`, or any other recommendation slot
emitted by /project-status. When a stage table or boost row would otherwise
surface one, drop it from the rendered list (silent-drop — do not emit a
"filtered" line; these are not class-skip filters).

Registry (extend here when adding new billed skills):
  - /ultrareview   — billed cloud review, user-triggered only

This is a hard exclusion, separate from the class-skip filter. It applies
regardless of stage, class, or boost.

Selection rules by stage (default = class M). Class-aware overrides apply
the Class-Aware Boost block first, then fill remaining slots from this table:

| Stage         | Top recommendation                                                              |
|---------------|---------------------------------------------------------------------------------|
| greenfield    | `/write-a-prd` (class M default); class S → `/idea-capture`                     |
| spec'd        | `/prd-to-issues`, then `/grill-me`; class S → `/lean-canvas` if validation pending |
| planned       | `/plan` (M default); class L → `/write-a-prd → /prd-to-issues → /prioritize`; class XL → `/regulatory-preflight → /threat-model-pre → /data-flow-diagram-pre` |
| building      | For each high-priority issue: if frontend-scope issues ≥3 (`frontend_present = true` AND class ∈ {S, M, L, XL}) → top-1 = `/build-frontend`, which orchestrates the full lifecycle (spec→design→build→verify→ship). Otherwise: if frontend scope AND design docs missing → prepend `/ui-wireframe → /user-flow → /design-system → /a11y-design` (plus pattern-specific rows from FRONTEND BUILD cluster — `/form-design`, `/nav-pattern-pick`, `/dashboard-layout`, `/data-table-design`, etc. — based on issue keywords), then `/lead` if multi-layer, else `/tdd <ac>`. Class boost (XL → platform/infra cluster; L → review/debt cluster; S → /perf-audit if perf-sensitive) appends after the UI/UX prepend |
| mature        | `/coverage-map` → feeds `/tdd`; `/smoke-test` for golden paths                  |
| pre-launch    | `/verify` → `/smoke-test` → `/commit-split` → push (then manually run `/ultrareview` — billed, not auto-recommended); class XL → prepend `/dr-drill, /rollback-plan, /deploy-health-gate, /prod-smoke` |

**Top-1 auto-elevation rules (in priority order — first match wins):**
1. Any **P1 risk** elevates its remediation skill to position 1 regardless of stage/class.
2. `class=S AND stage ∈ {greenfield, spec'd, planned} AND no PRD` → top-1 = `/idea-capture`.
3. `class=S AND stage ∈ {greenfield, spec'd, planned} AND validation pending` → top-1 = `/lean-canvas`.
4. `class=L AND stage=planned AND no PRD` → top-1 = `/write-a-prd`.
5. `class=XL AND stage=planned AND regulated domain` → top-1 = `/regulatory-preflight`.
5a. `frontend_present = true AND class ∈ {S, M, L, XL} AND stage ∈ {planned, building} AND frontend-scope issues ≥3` → top-1 = `/build-frontend`. Single-slice cases (1–2 issues) fall through to rule 6 (`/ui-wireframe` first). (Rule 1 P1 risk still wins.)
6. `stage=building AND IN-PROGRESS issue has frontend scope AND no wireframes` → top-1 = `/ui-wireframe "<screen>"`, position 2 = `/user-flow "<flow>"`. Code-writing skills (`/lead`, `/tdd`) follow. (Rule 1 P1 risk still wins.)
7. If the stage row offers `/lead` and the IN-PROGRESS issue spec is unclear,
   **prepend** `/grill-me "<issue>"` before the `/lead` call.

---

## Output Format

```
PROJECT STATUS
──────────────
Stage:       <stage>
Confidence:  <high | medium — note ambiguities, e.g. "issue 05 ACs unclear">

WORK HISTORY (last 7d)
  <N commits — short summary>
  Issues completed:    <list, e.g. 001, or "—">
  Skills invoked:      <if tracked, else "— (no audit log yet)">

INPUTS READ
  PRD:                  ✓ issues/<project>-prd.md | ✗ missing
  Issues:               <N files>
  CLAUDE.md:            ✓ | ✗
  Manifest:             ✓ <path> (scripts: dev, build, test, lint) | ✗ not scaffolded
  Schema:               ✓ <path> (models: <entity-A>, <entity-B>, ...) | ✗
  API entrypoints:      <N route handlers, M pages>
  Tests:                <N unit/integration, M e2e>
  Git:                  <N commits last 7d, branch ahead/behind default | not a repo>

ISSUE PROGRESS (<N> total)
  [DONE]         <issue-001-title>
  [DONE]         <issue-002-title>
  [IN-PROGRESS]  <issue-003-title> — <gap, e.g. missing 409 conflict test>
  [NOT-STARTED]  <issue-004-title>
  [IN-PROGRESS]  <issue-005-title> — <gap, e.g. role gate not wired>
  [NOT-STARTED]  <issue-006-title>
  [NOT-STARTED]  <issue-007-title>
  [NOT-STARTED]  <issue-008-title>

ISSUE GRAPH
  Critical path: 001 → 002 → 005 → 007 → 003 → 008
  Most-blocking: 005 (unblocks 006, 007, 008)
  (full ASCII tree if ≤20 issues)

NEXT UNLOCKS
  Finishing 005 unblocks: 006, 007, 008
  Finishing 003 unblocks:   (no downstream — leaf)

RISK SURFACE
  P1: <launch-blocker issue> not started — blocks launch
  P1: zero e2e tests — golden path uncovered
  P2: admin route lacks role check (issue 005 IN-PROGRESS)
  P3: 2 TODOs in <api-route path>

FRONTEND BUILD  (slice 005 = booking-flow UI, no design docs)
  → /ui-wireframe "booking review screen"
  → /user-flow "purchase flow"
  → /design-system
  → /a11y-design "booking flow"
  → /form-design  (slice has 4-field payment form)

SITUATION → SKILL  (currently actionable, class=<X> filtered)
  Slice 005 multi-layer + spec gaps → /grill-me "issue 005" then /lead "issue 005"
  Slice 007 = payment + webhook     → /lead "issue 007 — webhook + idempotency"
  Slice 003 needs one more test     → /tdd "<HTTP-verb> <route> <error-case>"
  Coverage gaps before launch       → /coverage-map
  Multi-domain unsure?              → /route "<your goal>"
  Filtered: <N> skills dropped as class=<X> skip
  Dropped: /threat-model, /lean-canvas, /risk-register, ... (top 5)

  Glyph legend:
    ? prefix on a recommendation = low-confidence in sim sanity check
      (skill is in top-5 but appeared in 0/N same-class in-stage sims).
      User decides: trust recommendation (override) or drop it.

SIM-MATCH
  Sim-match (5 XS sims): WARN — 1 missing, 1 suspicious, 1 low-conf
  (verbose: invoke `/project-status --verify-verbose` for drill-down)

  Possible one-liners:
    Sim-match (5 XS sims): OK
    Sim-match (5 XS sims): WARN — 1 missing, 1 suspicious, 1 low-conf
    Sim-match: SKIP — only 2 fixtures for class XS (need ≥3)
    Sim-match: SKIP — no classify doc — run /project-classify first
    Sim-match: SKIP — no fixtures for class XL

VERBOSE BLOCK (only on `--verify-verbose`)
  Sampled: 5 same-class sims (xs-cli-todo, xs-password-gen, xs-static-site-gen, xs-shell-script-lib, xs-vim-plugin-personal)
  Stage filter: Building ± 1 → 3/5 sims in-stage; 2/5 fall-back full-set
  High-conf (Sim-match ≥60%): /verify (5/5), /commit-split (4/5), /tdd (4/5)
  Low-conf  (Sim-match 0%):  /pitch-deck-narrative (0/5) — `?` glyph applied in SITUATION → SKILL
  Class-skip subtraction:    /threat-model, /lean-canvas removed pre-missing-flag
  Missing — fires in 3+/5 in-stage sims, not class-skipped, not recommended:
    • /kill-criteria-doc (4/5 XS in-stage sims fire this; not recommended)
  Suspicious — recommended but sim skip-listed in ≥2/5 same-class sims:
    • /pricing-model (sim skip-list in 3/5 XS sims)

RECOMMENDED NEXT STEPS  (`?` = low Sim-match, see Glyph legend)
  1. /lead "issue 005 — <description>" — closes P2, unblocks 006
  2. /lead "issue 007 — <description>" — P1 launch blocker
  3. /tdd "<concrete AC>" — closes 003
  4. /coverage-map — surface remaining test gaps before launch
  5. ? /pitch-deck-narrative — low Sim-match (0/5), override or drop

STAGE-APPROPRIATE NEXT SKILL
  → /lead "issue 005 — <description>"
```

If stage is `greenfield`, ISSUE PROGRESS / GRAPH / NEXT UNLOCKS / RISK SURFACE collapse to:

```
ISSUE PROGRESS
  (no issues — start with /write-a-prd)

ISSUE GRAPH
  (no issues yet)

NEXT UNLOCKS
  (no issues yet)

RISK SURFACE
  (none yet — no code to assess)
```

If `/project-status` was invoked with a free-form argument, append:

```
DESCRIPTION DISPATCH
  Your goal: "<arg>"
  → /route "<arg>"
```

---

## Integration

- **Feeds `/route`**: `/project-status` always surfaces `/route "<goal>"` as
  the fallback whenever intent is ambiguous; `/route` then dispatches across
  the installed skill set via its trigger table.
- **Feeds `/lead`**: each IN-PROGRESS multi-layer issue is a candidate for `/lead`.
- **Feeds `/tdd`**: each unmet acceptance criterion becomes a `/tdd` invocation.
- **Feeds `/grill-me`**: any IN-PROGRESS issue with unclear ACs gets prepended
  with a `/grill-me` step before `/lead`.
- **Feeds `/coverage-map` + `/debt-scan` + `/consistency-audit`**: P-ranked
  risks point to the right audit skill (test gaps → `/coverage-map`, TODOs →
  `/debt-scan`, naming → `/consistency-audit`).
- **Pre-launch chain**: at the `pre-launch` stage, recommend the canonical
  `/verify` → `/smoke-test` → `/commit-split` sequence. `/ultrareview` is
  billed/user-triggered and intentionally excluded from recommendations
  (see Billed-Skill Registry).
- Read-only. Never edits, commits, runs migrations, or starts servers.

---

## Completion Criteria

- Every input row in Pre-flight checked (✓ or ✗)
- Stage assigned with confidence
- Work history block populated (or stated empty for fresh repo)
- Every `issues/*.md` classified DONE / IN-PROGRESS / NOT-STARTED
- Issue dependency graph rendered with critical path + most-blocking
- Next-unlocks section populated for IN-PROGRESS and next NOT-STARTED issues
- Risk surface populated (or stated empty for greenfield)
- Situation→skill matrix shows only currently-actionable rows (filtered by
  stage + risks + IN-PROGRESS issues — do not dump every installed skill)
- Class label read from `docs/classify/<project>.md` (or flagged missing
  with default `M` for the filter pass)
- Class-skip filter applied — skills whose `output_size:` for the project's
  class = `skip` are dropped from Situation → Skill matrix and Recommended
  Next Steps
- Billed-Skill Registry exclusion applied — every skill in the registry
  (currently: `/ultrareview`) is absent from `RECOMMENDED NEXT STEPS`,
  `SITUATION → SKILL`, `FRONTEND BUILD`, and `STAGE-APPROPRIATE NEXT SKILL`,
  regardless of stage/class/boost (silent-drop, separate from class-skip)
- Filtered-count surfaced in report (`Filtered: N skills dropped as
  class=<X> skip`)
- Class-Aware Boost pass applied — `(class, stage)` boost row prepends
  skills to recommendation set; class-skip filter still wins; one-line
  `Boosted: ...` summary rendered when a boost row matched
- Stage gating applied — PRE-LAUNCH and POST-CODE-CHANGE matrix groups
  suppressed when current stage ∉ their declared stage set (over-rec
  dampening for `/verify`, `/commit-split`, `/smoke-test`)
- Design-doc presence checked for each IN-PROGRESS issue with frontend
  scope (wireframes / user-flow / design-system / a11y) — gaps surface
  FRONTEND BUILD cluster rows
- FRONTEND BUILD cluster renders only when stage ∈ {planned, building},
  frontend scope detected, AND at least one expected `docs/design/*`
  artifact missing; rows for already-satisfied design docs silent-dropped
- POST-CODE-CHANGE cluster includes UI-verification rows
  (`/responsive-test`, `/visual-regression`, `/a11y-runtime`,
  `/smoke-test`, `/devtools-audit`) gated by stage ∈ {building,
  pre-launch, mature}
- Top-1 auto-elevation surfaces `/ui-wireframe` when stage=building +
  frontend scope + no wireframes (P1 risk auto-elevation still wins)
- Frontend-scope detector (step 2a) run on `issues/*.md`; `frontend_present`
  flag set; `/build-frontend` prepended to recommendations when
  `frontend_present = true` AND class ∈ {S, M, L, XL} AND stage ∈ {planned,
  building} AND frontend-scope issues ≥3 (rule 5a auto-elevation)
- Sim-match line rendered with one of: `OK` / `WARN — …` / `SKIP — …`
  (one-line default; verbose drill-down only on `--verify-verbose`)
- Fixture pool globs **both** `reports/sim100/<class>-*.md` and
  `reports/<class>-*.md`, deduped by slug (prefer sim100 on collision)
- Sanity check **skipped** when class was defaulted to M from missing
  classify doc (one-line SKIP with `run /project-classify first`)
- Sanity check **skipped** when fewer than 3 fixtures available for the
  class (one-line SKIP with fixture count)
- Heading parser handles all observed sim variants:
  `## Fired skills (ordered|grouped, …)` + `## Skipped — (bulk reasons|why)`
- Stage-aware fired_set filter applied — fired counts restricted to
  in-stage phases (current stage ± 1)
- Class-skipped set subtracted from `missing_candidates` before
  flagging (no permanent noise from class-skipped skills)
- Low-confidence (0/N) recommended skills get `?` glyph in both the
  SITUATION → SKILL block and the RECOMMENDED NEXT STEPS list
- Glyph legend rendered when any `?`-prefixed skill is present
- ≤5 ranked next steps, each a copy-pasteable skill invocation
- One stage-appropriate next skill highlighted at the bottom
- `/route` surfaced as fallback whenever stage detection is ambiguous, the
  user passed a free-form arg, or a P0/P1 risk doesn't map to the stage table
