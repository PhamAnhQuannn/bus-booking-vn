---
name: build-frontend
description: Full UI feature lifecycle orchestrator. Phase-gated chain — spec → design → pattern pick → cross-cut → build → verify → gate → ship. Halts between phases for user confirm. Invokes sub-skills via Skill tool. Use when user says "build frontend", "ship the UI", "frontend lifecycle", "/build-frontend", or when /project-status detects frontend-scope issues and class ∈ {S, M, L, XL}.
output_size:
  XS: skip
  S: 2h
  M: 4h
  L: 8h
  XL: 12h
---

# /build-frontend — Full UI Feature Lifecycle Orchestrator

Invoke as `/build-frontend` (optionally `/build-frontend "<slice>"` or `/build-frontend --phase=<N>`).
Phase-gated chain that walks a UI feature from spec to ship. Halts between phases for user
confirmation. Reads `/project-classify` and `/project-status` output before firing.

Sits next to `/lead` (multi-layer dispatcher), `/plan` (multi-agent research), `/autopilot`
(status-driven loop). `/build-frontend` is the **frontend-vertical** lens — same pattern
as `/plan`, narrowed to UI work.

---

## Why you'd care

Shipping one UI slice end-to-end touches ~20 skills across spec/design/cross-cut/build/verify.
Chasing the right order manually is the kind of work that decays into "I'll just `/tdd` it"
and skip a11y, i18n, analytics, perf, and visual-regression along the way. `/build-frontend`
runs the lifecycle in a phase-gated chain so nothing falls off the back.

---

## Pre-flight (read-only)

| Input                                                            | Tool     | Fallback / action                                                  |
|------------------------------------------------------------------|----------|--------------------------------------------------------------------|
| `docs/classify/<project>.md` (label `**Class: <XS\|S\|M\|L\|XL>**`) | Read    | flag missing; recommend `/project-classify`; default `M`           |
| Latest `/project-status` output                                  | recall   | re-invoke `/project-status` if absent                              |
| `issues/*.md` (PRD excluded)                                     | Glob+Read | infer scope by filename if no scope field                          |
| `CLAUDE.md`                                                      | Read     | flag missing — onboarding context absent                           |
| Existing artifacts: `docs/design/**`, `docs/qa/**`                | Glob     | track which phase outputs already exist (skip re-run)              |

### Skip / early-exit conditions

- **class = XS** → exit. Print `XS class skipped — frontend lifecycle overkill. Use /tdd directly.`
- **No UI-scope issues** (no scope matches frontend keyword set, see below) → exit. Recommend `/project-status` to re-survey.
- **stage = greenfield AND no PRD** → exit after firing `/write-a-prd` only. Resume `/build-frontend` after PRD lands.

### Frontend-scope keyword set

Match any of these in issue scope/title:
`page`, `component`, `ui`, `ux`, `form`, `dashboard`, `nav`, `modal`, `wizard`,
`onboarding`, `landing`, `paywall`, `table`, `chart`, `search`, `card`, `tab`,
`screen`, `view`, `layout`.

---

## How sub-skills fire

Every step in every phase invokes:

```
Skill(skill="<slug>", args="<contextual args>")
```

**Class-skip rule.** Before invoking, read the sub-skill's `output_size:` block. If
`output_size[<project class>] == skip`, drop the step silently and note in the phase summary
under `Skills skipped`. If the sub-skill has no `output_size:` block, treat it as always-on
(matches `/project-status` filter convention).

**Already-present rule.** If the expected artifact exists (e.g. `docs/design/wireframe-<slice>.md`
present before Phase 2 fires), skip the step and note `Skills skipped: /<slug> (artifact present)`.

---

## Phase 1 — Spec

Sequence (fire in order, skip if artifact present):

1. `/write-a-prd` — only if `issues/*-prd.md` absent
2. `/prd-to-issues` — only if `issues/*.md` (non-PRD) absent
3. `/edge-case-enum` — per UI slice
4. `/acceptance-criteria` — per slice
5. `/prioritize` — if more than ~10 issues unranked

**Halt gate** at phase end (see Halt-gate format below).

---

## Phase 2 — Design

Sequence:

1. `/user-flow` — per multi-step slice
2. `/ui-wireframe` — per slice
3. `/visual-mood-board` — once per project
4. `/design-system` — once per project
5. `/typography-hierarchy-spec` — once per project
6. `/motion-direction-spec` — once per project
7. `/design-review` — first pass on design docs

**Halt gate.**

---

## Phase 3 — Pattern Pick

Per-issue dispatcher. For each UI slice, match the issue scope to the right pattern skill:

| Scope keyword               | Fire                  |
|-----------------------------|-----------------------|
| `form`, `wizard`, `signup`, `checkout` | `/form-design`        |
| `table`, `list`, `grid`     | `/data-table-design`  |
| `dashboard`, `kpi`, `metrics` | `/dashboard-layout`   |
| `nav`, `menu`, `sidebar`    | `/nav-pattern-pick`   |
| `chart`, `graph`, `viz`     | `/chart-type-pick`    |
| `search`, `filter`, `autocomplete` | `/search-ux`     |
| `onboarding`, `welcome`, `first-run` | `/onboarding-flow` |
| `paywall`, `upgrade`, `pricing-gate` | `/paywall-pattern` |
| `cta`, `button`             | `/cta-hierarchy`      |

Multiple matches per slice are allowed. Order: form/table/dashboard first, decorative last.

**Halt gate.**

---

## Phase 4 — Cross-cut

Sequence:

1. `/a11y-design` — per slice
2. `/i18n-design` — once per project, **only if** PRD declares `i18n: true` (or class XL by default)
3. `/analytics-spec` — once per project
4. `/error-boundary-wire` — once per project

**Halt gate.**

---

## Phase 5 — Build

Sequence:

1. `/scaffold-feature` — per slice
2. `/form-wire` — only if slice has forms
3. `/tdd` — per acceptance criterion

**Halt gate.** This phase is the most code-mutating — expect long output.

---

## Phase 6 — Verify

Sequence:

1. `/smoke-test` — golden-path Playwright walk
2. `/responsive-test` — viewport × prefers-* matrix
3. `/a11y-runtime` — axe-core + keyboard walk
4. `/visual-regression` — pixel-diff baseline
5. `/perf-audit` — Lighthouse vs `docs/nfr.md` budgets
6. `/coverage-map` — surface any remaining test gaps

**Halt gate.**

---

## Phase 7 — Gate

Final review pass before ship:

1. `/design-review` — second pass on built UI vs design docs
2. `/anti-generic-design-check` — 13-tell generic checklist

**Halt gate.** A failure here is a design-debt finding, not a build blocker — user decides
whether to address now or ticket for later.

---

## Phase 8 — Ship

1. `/commit-split` — group changes into scoped commits

Then surface `/ultrareview` as a recommendation:

> Pre-launch review available. Run `/ultrareview` (billed, user-triggered) when ready.

Never auto-invoke `/ultrareview`.

---

## Halt-gate format

At the end of every phase, emit:

```
PHASE <N> — <NAME>  COMPLETE
────────────────────────────
Skills fired:    /<a>, /<b>, /<c>
Skills skipped:  /<x> (class=<X> skip), /<y> (artifact present)
Artifacts:       <path-1>, <path-2>
Open issues:     <count> still IN-PROGRESS for this phase
Next phase:      <N+1> — <NAME>

Reply 'continue' to proceed, 'stop' to halt here, or '/skip <N>' to jump to a later phase.
```

Wait for explicit user reply before invoking the next phase. Reply tokens:

- `continue` → fire next phase
- `stop` → exit cleanly, print resume hint (`/build-frontend --phase=<N+1>`)
- `/skip <N>` → fast-forward to phase N (skip-by-user, log in summary)
- any other text → treat as user direction; re-evaluate, do not auto-continue

---

## Failure handling

If a sub-skill fails (Skill tool returns error or sub-skill reports `[FAILED]`):

```
PHASE <N> — <NAME>  FAILED at /<failed-skill>
─────────────────────────────────────────────
Error (verbatim):
<error text>

Recommended next step:
  /route "<failed-skill> failed: <one-line summary>"

To retry this phase after fixing: /build-frontend --phase=<N>
```

Never retry silently. Never auto-rollback completed phases. Never proceed past a failure.

---

## Stage-aware behavior

`/build-frontend` reads the detected stage from `/project-status` and adapts entry point:

| Stage from `/project-status` | Entry phase                          |
|------------------------------|--------------------------------------|
| greenfield                   | Phase 1 step 1 (`/write-a-prd` only, then exit) |
| spec'd                       | Phase 1 step 2 (`/prd-to-issues`)    |
| planned                      | Phase 1 step 3 (`/edge-case-enum`)   |
| building                     | Phase 5 (build/verify focus); back-fill Phases 1–4 only for slices with missing artifacts |
| mature                       | Phase 6 (verify)                     |
| pre-launch                   | Phase 7 (gate) → Phase 8 (ship)      |

The `--phase=<N>` arg overrides stage-based entry.

---

## Cross-skill references

- **Read by `/project-status`** — surfaced as top-1 when `frontend_present = true AND class ∈ {S, M, L}` AND stage ∈ {planned, building} (auto-elevation rule 5a).
- **Read by `/autopilot`** — Step 6 dispatch via Skill tool when `/project-status` recommends `/build-frontend`.
- **Feeds `/lead`** — any multi-layer slice (touches auth + UI + DB) inside Phase 5 escalates: pause Phase 5 and recommend `/lead "<slice>"` before resuming.
- **Feeds `/grill-me`** — if a UI slice spec has < 3 acceptance criteria or > 3 ambiguous terms, Phase 1 step 4 prepends `/grill-me "<slice>"` before `/acceptance-criteria`.
- **Honors class skip** — every sub-skill's `output_size[<class>]=skip` is respected; never overrides the filter.

---

## Invocation forms

| Form                                  | Behavior                                                 |
|---------------------------------------|----------------------------------------------------------|
| `/build-frontend`                     | Auto-detect scope from `issues/*.md`; start from stage entry phase |
| `/build-frontend "<slice>"`           | Narrow to one slice (matched by issue title or slug)      |
| `/build-frontend --phase=<N>`         | Resume from phase N; skip phases 1..(N-1)                 |
| `/build-frontend --dry-run`           | Print phase plan only; do not invoke any sub-skill        |

---

## Completion criteria

- Every phase 1–8 either fired or explicitly skipped (`/skip` or class-skip)
- For each UI slice: wireframe + a11y design + tests + smoke run exist (Phase 2/4/5/6 artifacts present)
- No `[FAILED]` sub-skill calls outstanding
- `/commit-split` has produced at least one commit (or `[SPLIT NEEDED]` flagged for user)
- `/ultrareview` surfaced but not auto-invoked
- Final summary printed:

```
/build-frontend COMPLETE
────────────────────────
Phases run:     8 / 8 (skipped: <list with reasons>)
Slices shipped: <N>
Artifacts:      <count> design docs, <count> tests, <count> commits
Open follow-ups: <list any deferred Phase 7 findings>
Next:           /ultrareview (when ready)
```

---

## Never do

- Never invoke `/ultrareview` automatically — billed, user-triggered only.
- Never push to remote — `/commit-split` produces local commits only.
- Never edit code outside the slice scope (sub-skills like `/tdd` and `/scaffold-feature` handle code mutation; `/build-frontend` itself is the conductor).
- Never re-fire a sub-skill in the same run after success — idempotent within a run.
- Never silently re-attempt after `[FAILED]`.
- Never proceed past a halt gate without explicit user reply.
