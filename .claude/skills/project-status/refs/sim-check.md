# sim-check — Sim Sanity Check + full output template + completion criteria

READ WHEN: ≥3 same-class fixtures exist under `D:\Skills\reports\sim100\<class>-*.md`
or `D:\Skills\reports\<class>-*.md`. If <3 fixtures (or class was defaulted to M
from a missing classify doc), emit the one-line `SKIP` in the report and do NOT
read further. Also read this file when you want the full annotated output
example or the exhaustive completion checklist.

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

The class filter drops class-skipped skills from the recommendation set.
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
was deemed overkill for solo-dev cadence.

---

## Output Format (full annotated example)

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

- **Feeds `/route`**: always surface `/route "<goal>"` as the fallback
  whenever intent is ambiguous; `/route` dispatches across the installed
  skill set via its trigger table.
- **Feeds `/lead`**: each IN-PROGRESS multi-layer issue is a `/lead` candidate.
- **Feeds `/tdd`**: each unmet acceptance criterion becomes a `/tdd` invocation.
- **Feeds `/grill-me`**: any IN-PROGRESS issue with unclear ACs gets prepended
  with a `/grill-me` step before `/lead`.
- **Feeds `/coverage-map` + `/debt-scan` + `/consistency-audit`**: P-ranked
  risks point to the right audit skill.
- **Pre-launch chain**: at `pre-launch`, recommend `/verify` → `/smoke-test`
  → `/commit-split`. `/ultrareview` is billed/user-triggered and excluded.
- Read-only. Never edits, commits, runs migrations, or starts servers.

---

## Completion Criteria (exhaustive)

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
  (currently: `/ultrareview`) is absent from all recommendation slots,
  regardless of stage/class/boost (silent-drop, separate from class-skip)
- Filtered-count surfaced in report (`Filtered: N skills dropped as
  class=<X> skip`)
- Class-Aware Boost pass applied — `(class, stage)` boost row prepends
  skills to recommendation set; class-skip filter still wins; one-line
  `Boosted: ...` summary rendered when a boost row matched
- Stage gating applied — PRE-LAUNCH and POST-CODE-CHANGE matrix groups
  suppressed when current stage ∉ their declared stage set
- Design-doc presence checked for each IN-PROGRESS issue with frontend
  scope — gaps surface FRONTEND BUILD cluster rows
- FRONTEND BUILD cluster renders only when stage ∈ {planned, building},
  frontend scope detected, AND at least one expected `docs/design/*`
  artifact missing; satisfied design docs silent-dropped
- POST-CODE-CHANGE cluster includes UI-verification rows gated by stage ∈
  {building, pre-launch, mature}
- Top-1 auto-elevation surfaces `/ui-wireframe` when stage=building +
  frontend scope + no wireframes (P1 risk auto-elevation still wins)
- Frontend-scope detector run on `issues/*.md`; `frontend_present` set;
  `/build-frontend` prepended when `frontend_present = true` AND class ∈
  {S, M, L, XL} AND stage ∈ {planned, building} AND frontend-scope issues ≥3
- Sim-match line rendered: `OK` / `WARN — …` / `SKIP — …` (verbose only on
  `--verify-verbose`)
- Fixture pool globs **both** `reports/sim100/<class>-*.md` and
  `reports/<class>-*.md`, deduped by slug (prefer sim100 on collision)
- Sanity check skipped when class defaulted to M (one-line SKIP)
- Sanity check skipped when <3 fixtures (one-line SKIP with count)
- Heading parser handles all observed sim variants
- Stage-aware fired_set filter applied (current stage ± 1)
- Class-skipped set subtracted from `missing_candidates` before flagging
- Low-confidence (0/N) recommended skills get `?` glyph in both
  SITUATION → SKILL and RECOMMENDED NEXT STEPS
- Glyph legend rendered when any `?`-prefixed skill present
- ≤5 ranked next steps, each a copy-pasteable skill invocation
- One stage-appropriate next skill highlighted at the bottom
- `/route` surfaced as fallback whenever stage detection is ambiguous, the
  user passed a free-form arg, or a P0/P1 risk doesn't map to the stage table
