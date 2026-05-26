# situation-matrix — full Situation → Skill dispatch map

READ WHEN: rendering the `SITUATION → SKILL` block, or enumerating actionable
skills beyond the per-stage top recommendation. Not needed for a plain status
read.

---

## Situation → Skill Matrix

Render only the **currently-actionable rows** in the report (filter by stage +
IN-PROGRESS issues + risks); this file is the source of truth. At invocation,
list `.claude/skills/*/SKILL.md` (Glob) and silently drop any row whose target
skill is not installed locally.

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

CLASS-SPECIFIC BUILD (boost — see class-filter.md Class-Aware Boost)
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

OPEN PRs (open_pr_count ≥ 1; stage ∈ {building, mature, pre-launch})
  Open PRs need review                        → /pr-inbox   (triages each PR, surfaces the right /code-review + /pr-review + /architect-review + always-on /security-review-deep + /perf-review + /observability-review + /backcompat-review commands per PR — single dispatcher, no enumeration here)

PRE-LAUNCH (all issues DONE, stage ∈ {pre-launch, mature} ONLY — suppressed otherwise)
  Fixed sequence                              → /verify → /smoke-test → /commit-split (then manually run /ultrareview — billed, never auto-recommended; see Billed-Skill Registry in core)
  Class XL pre-launch (ops cluster — boost)   → /dr-drill, /rollback-plan, /deploy-health-gate, /prod-smoke

GREENFIELD / SPEC'D
  No PRD                                      → /write-a-prd
  PRD exists, no issues                       → /prd-to-issues
```

**Stage gating (P3.5 — over-rec dampening):** The PRE-LAUNCH and POST-CODE-CHANGE groups render **only** when the current detected stage is in their declared stage set. Suppress them entirely for `stage ∈ {greenfield, spec'd, planned}` (the baseline showed `/verify` over-recommended at 62–68% in XS/S non-pre-launch cells). Caller can still invoke `/verify`, `/commit-split`, `/smoke-test` directly — gating affects only what `/project-status` recommends.

**FRONTEND BUILD gating:** The FRONTEND BUILD group renders **only** when (a) detected stage ∈ `{planned, building}`, (b) ≥1 IN-PROGRESS or next-up NOT-STARTED issue maps to a frontend scope (per the universal-trigger frontend row in core's Issue Progress Classification), AND (c) at least one expected `docs/design/*` artifact is missing for that slice. Rows for already-satisfied design docs are silent-dropped (e.g. `docs/design/wireframes/<slice>.md` exists → omit the `/ui-wireframe` row). Cluster suppressed entirely on backend-only repos and on stages outside `{planned, building}`.

For free-form intent ("I want to do X but unsure which skill"), defer to
`/route "<X>"` — it owns the trigger table and reads git state.

---

## When `/route` Surfaces

Codify the fallback rules so the skill never silently swallows ambiguity:

1. **Stage detection ambiguous** (≥2 stage rows tie) → top step is `/route "<your goal>"`.
2. **`/project-status` invoked with free-form arg** (e.g. `/project-status help me decide what to ship next`) → run the audit, then surface `/route "<the arg>"` as the second step so the description gets dispatched.
3. **IN-PROGRESS issue spans 3+ domains AND no `dependencies:` field** → second step is `/route "<issue title>"` so trigger-table sequencing kicks in.
4. **P0/P1 risk doesn't map to a stage-table row** (e.g. "secret in repo") → `/route` matches via its security trigger row; surface as the top step regardless of stage.

Otherwise (clear stage, clear next issue, no ambiguity) — recommend the
specific skill directly. Do not bury the right answer behind a dispatcher.
