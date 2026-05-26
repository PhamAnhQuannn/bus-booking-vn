# class-filter — Class-Aware Skill Filter + Boost

READ WHEN: `docs/classify/<project>.md` exists. If absent, skip this file
entirely: flag "⚠ no class label — run `/project-classify` first" in the
report and default to class `M` for any class-gated decision.

---

## Class-Aware Skill Filter

Every recommendation must respect the project's class. After reading
`docs/classify/<project>.md`, extract the `**Class: <XS|S|M|L|XL>**` label.
For each candidate skill in the Situation → Skill matrix and Recommended
Next Steps:

1. Read its frontmatter `output_size:` block (universal across the skill set).
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

The filter above is **drop-only**: it removes skills whose
`output_size[class] = skip`. But validate-routing baseline 2026-05-15
(decision #26) showed three cells failing not because wrong skills surfaced,
but because **the right skills weren't ranked into top-5**. L planned fired
PRD-track; XL planned fired `-pre` regulatory family; XL building fired
platform/infra cluster — `/project-status` was emitting generic stage-table
picks for all three.

This block adds an **additive boost layer**: skills here are prepended to the
candidate set (capped at 5) before the stage-table fills remaining slots.

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
6. Stage-table top recommendation (core's per-stage table) appends after the
   boost set, filling remaining slots up to 5.
7. P1 auto-elevation still wins over everything — it prepends a
   risk-driven step to position 1 regardless of boost set.
8. **Open-PR elevation (post-boost, pre-cap).** If `open_pr_count ≥ 1` AND
   stage ∈ {`building`, `mature`, `pre-launch`} → prepend `/pr-inbox` to
   position 1 (shifting boost + stage-table picks down by one). Still apply
   the cap of 5. Rule 7 (P1 risk) still wins when both fire — risk-driven
   remediation owns position 1; `/pr-inbox` slots to position 2.

Render a one-line summary in the report:

```
Boosted (class=<X> stage=<Y>): <skill-1>, <skill-2>, <skill-3> (+ <N-3> more)
```

If no boost row matches `(class, stage)` → emit nothing; fall through to
default stage-table behavior.
