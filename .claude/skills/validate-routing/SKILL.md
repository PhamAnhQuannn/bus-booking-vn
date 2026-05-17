---
name: validate-routing
description: Sweep all sim100 fixtures and validate /project-status recommendation accuracy per (class, stage) cell. Mental-runs /project-status against each fixture via Explore sub-agents; aggregates top-K hit rate, precision, recall; surfaces systematic miss + over-recommend skills. Use when user says "validate routing", "check skill recommendations", "audit /project-status", "/validate-routing", or when ≥10 skills added since last baseline.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 3h
  XL: 3h
---

# /validate-routing — Aggregate harness for /project-status accuracy

Library-maintenance meta-skill. Sweeps the full sim100 fixture pool,
mental-runs `/project-status` against every (class, stage) cell, then
aggregates precision/recall + systematic miss/over-recommend tables.
Anchors a baseline an audit can cite; complements (does not replace) the
inline 5-sample sim sanity check in `/project-status`.

Read-only. Never edits `/project-status` or any other skill. Emits one
dated report.

---

## Why you'd care

The inline sim sanity-check in `/project-status` samples 5 same-class
fixtures per call. It catches per-call drift but cannot measure
library-wide precision/recall, cannot surface systematic misses across
all 460+ skills, and cannot anchor a baseline for "did the last wave of
edits help or hurt routing?"

`/validate-routing` answers those questions. Run it after every wave of
skill additions or `/project-status` edits — diff against the prior
dated report to see whether routing got better, worse, or stayed the
same.

---

## When This Skill Applies

Re-baseline triggers (manual invoke — no CI/cron):

- ≥10 new skills added since last baseline (count by `git diff` on
  `.claude/skills/*/SKILL.md`)
- `/project-status` SITUATION→SKILL matrix edited
- `/project-classify` rubric edited
- User explicitly asks "validate routing", "audit /project-status",
  "check skill recommendations", or types `/validate-routing`
- Quarterly cadence sanity baseline (BRAIN #24 deferred trigger:
  "5%-quarter wrong-skill rate")

Skip when:
- Invoked from a product directory — this is library meta-tooling,
  exits with `SKIP — meta-skill, run from D:\Skills root only`
- Class label resolves (output_size XS/S/M = `skip`) — frontmatter
  conformance only

---

## Pre-flight

| Input | Tool | Fallback |
|---|---|---|
| `D:\Skills\reports\sim100\*.md` ≥100 fixtures | Glob | abort with count |
| `D:\Skills\.claude\skills\project-status\SKILL.md` present | Read | abort — required for sub-agent prompts |
| Current ISO date (for report filename) | env / system | `YYYY-MM-DD` |

---

## Inputs

| Param | Default | Notes |
|---|---|---|
| fixture pool path | `D:\Skills\reports\sim100\` | sim100 only; legacy 50-pool excluded |
| stage cuts | `planned`, `building`, `pre-launch` | greenfield/spec'd trivial; mature/operate phase-marker sparse |
| top-K | 5 | matches `/project-status` Recommended Next Steps cap |
| acceptance threshold | ≥80% top-K hit rate per (class, stage) | PASS ≥80%, WARN 70–79%, FAIL <70% |

---

## Process (8 steps)

1. **Glob fixtures.** `D:\Skills\reports\sim100\<class>-*.md` → expect
   100–101 files (5 classes × 20–21 each). Dedup by slug. Take 100;
   drop oldest if 101.

2. **Parse each fixture.** Per file:
   - Extract `**Class: <X>**` from Profile block.
   - Extract phase markers `### <Phase> (<count>)` or `## Phase <N> — <name>`
     under `## Fired skills (...)` section.
   - Tokenize comma-separated unslashed skill names per phase →
     `fired_set` per phase. Slash-prefixed slashed names get
     normalized.
   - Tokenize `## Skipped — (bulk reasons|why)` section → `skip_set`.

3. **Map sim phases → 3 stage cuts.**
   - **planned** = Inception ∪ Discovery ∪ Design ∪ Planning
   - **building** = Build
   - **pre-launch** = Testing ∪ Release
   - XS sims often lack inline `### <Phase>` markers — derive from
     per-phase aggregate table when present, else best-effort split
     using ordered-brief context.

4. **Dispatch mental-run sub-agents.** For each (class × stage) cell =
   15 cells, dispatch 1 Explore sub-agent with:
   - List of ~20 fixture paths for that class
   - Stage cut definition (phase union)
   - Verbatim `/project-status` Stage Detection + SITUATION→SKILL +
     Class-Aware Skill Filter + Recommended Next Steps sections
     (re-pasted each call — no shared memory)
   - Output requirement: JSON array per fixture
     `{"fixture": "<slug>", "class": "<X>", "fired_in_stage": [...],
     "predicted_top5": ["/a", "/b", "/c", "/d", "/e"]}`

5. **Parallelize in waves.** 5 sub-agents per wave (one per class), 3
   waves (one per stage). Each sub-agent reads ~20 fixtures + mental-runs
   ~20 predictions = manageable context per call.

6. **Compute metrics per cell.**
   - top-1 hit: predicted[0] ∈ fired_in_stage
   - top-5 hit: predicted[0..4] ∩ fired_in_stage ≠ ∅
   - precision: |predicted ∩ fired| / 5
   - recall: |predicted ∩ fired| / |fired|

7. **Aggregate library-wide.**
   - **Systematic miss**: skill in fired_set of ≥30% same-class fixtures
     AND in predicted_top5 of <5% of those fixtures
   - **Systematic over-recommend**: skill in predicted_top5 of ≥30%
     same-class fixtures AND in fired_set of <10% of those fixtures

8. **Render report** at `D:\Skills\reports\validate-routing-<YYYY-MM-DD>.md`.

---

## Mental-run sub-agent prompt template (canonical — paste verbatim)

```
You are mental-running /project-status against frozen product simulations.

INPUTS:
- Fixture paths (read each one): <list of ~20 paths>
- Declared stage cut: <planned | building | pre-launch>
- Stage cut definition (phase union):
  planned    = Inception ∪ Discovery ∪ Design ∪ Planning
  building   = Build
  pre-launch = Testing ∪ Release

- /project-status canonical logic (verbatim — re-read on every call,
  do not rely on training memory):

[PASTE Stage Detection table]
[PASTE Situation → Skill Matrix]
[PASTE Class-Aware Skill Filter]
[PASTE Recommended Next Steps]

TASK:
For each fixture file:
  1. Read the Profile block. Extract Class (XS/S/M/L/XL).
  2. Read the `## Fired skills (...)` section. Extract the in-stage
     fired skill set (union of skills in matching phases per stage cut).
     Sim format uses comma-separated unslashed names — normalize to
     /<kebab-slug> form.
  3. Mental-run /project-status for this fixture at the declared stage:
       a. Apply Class-Aware Skill Filter (drop output_size=skip for
          this class).
       b. Apply Stage Detection to confirm stage classification.
       c. Walk Situation → Skill Matrix → pick top-5 skills the
          Recommended Next Steps section would emit.
  4. Do NOT consult the fired-skills set when picking predictions —
     fired set is blinded ground truth for accuracy measurement.

OUTPUT — strict JSON array, no commentary:
[
  {
    "fixture": "<slug, e.g. xs-cli-todo>",
    "class": "<X>",
    "fired_in_stage": ["/skill-a", "/skill-b", ...],
    "predicted_top5": ["/a", "/b", "/c", "/d", "/e"]
  },
  ...
]
```

---

## Output Format (report shape)

```markdown
# Validate-routing baseline — <YYYY-MM-DD>

## Summary
| Class | Planned T5 | Building T5 | Pre-launch T5 | Verdict |
|-------|-----------:|------------:|--------------:|---------|
| XS    | …%         | …%          | …%            | PASS / WARN / FAIL |
| S     | …          | …           | …             | …       |
| M     | …          | …           | …             | …       |
| L     | …          | …           | …             | …       |
| XL    | …          | …           | …             | …       |

Library overall top-5 hit: …%  (acceptance gate: ≥80% per cell)
Cells at FAIL (<70%): N
Cells at WARN (70–79%): N

## Per-cell drill-down (15 cells)
### XS × planned (N=20)
- Top-5 hit: …% | Top-1: …% | Precision: 0.… | Recall: 0.…
- Sample misses: <slug>: predicted [/a,/b,/c,/d,/e]; fired [/x,/y,/z]; ∩ = ∅
- Sample wins: <slug>: top-1 = /idea-capture (fired = yes)

## Systematic misses (across library)
| Skill | Fires (N/100) | Predicted (N/100) | Miss-rate |

## Systematic over-recommends
| Skill | Predicted (N/100) | Fires (N/100) | Over-rate |

## Methodology
- 100 sim100 fixtures × 3 stage cuts = 15 (class, stage) cells
- 1 mental-run per (fixture × stage) = ~300 mental-runs across 15 sub-agents
- Sub-agents fed verbatim /project-status SITUATION→SKILL + Class-Aware Filter + Recommended Next Steps sections
- Acceptance threshold: ≥80% top-5 hit rate per (class, stage) cell

## Verification anchors
- Known-good anchor: XS × pre-launch must show /code-archive in top-5 ≥80% — observed: …
- Synthetic-break canary: rerun 1 XS×building wave with /project-status SITUATION→SKILL redacted — recall delta must be ≥20pp — observed Δ: …

## Re-introduction trigger (BRAIN #24)
"5%-quarter wrong-skill rate" — bypassed; user-triggered re-introduction.

## Caveats
- Mental-run fidelity gap: sub-agents may under-fire class-skip subtraction (P1.3)
- Phase-to-stage mapping for XS sims relies on aggregate table (no inline ### markers)
- Top-K=5 per /project-status default; varying K not measured this pass
```

---

## Verification anchors

### After SKILL.md exists
1. Glob check: `D:\Skills\.claude\skills\validate-routing\SKILL.md` returns 1 file
2. Frontmatter parse: `output_size:` contains all 5 classes; XS/S/M = skip; L/XL = 3h

### After baseline run completes
1. **Known-good cell anchor** — XS × pre-launch top-5 hit ≥80% AND
   `/code-archive` in top-5 of ≥80% of XS pre-launch cells (the most
   over-determined cell in the library). If this anchor fails, the
   harness has a bug; reject the baseline.
2. **Synthetic-break canary** — rerun 1 cell (XS × building, N=20)
   with `/project-status` SITUATION→SKILL section **redacted** from
   the sub-agent prompt. Top-5 recall must drop ≥20pp vs the
   real-prompt baseline. If it does not, sub-agents are hallucinating
   from training memory rather than deriving from the prompt; harness
   invalid until prompt fixed.
3. **Report file exists** at `reports/validate-routing-<YYYY-MM-DD>.md`
   with all 15 cells populated (or `SKIP — N<3` for sparse cells).
4. **BRAIN entry appended** with baseline numbers quoted from report.

---

## Boundaries

- Read-only. Never edits `/project-status`, `/project-classify`, or any
  other skill.
- Never edits the sim100 fixture pool.
- Emits exactly 1 dated report + 1 BRAIN entry (the latter manual on
  baseline runs).
- No CI / cron / `/loop` wiring — manual invoke only.

---

## Re-run Behavior

Manual re-baseline. Diff the new dated report against the prior dated
report (same filename pattern `validate-routing-YYYY-MM-DD.md`). Look
for:
- Per-cell top-5 hit rate movement ≥5pp (regression candidate)
- Systematic miss table churn (skill newly above miss-rate threshold)
- Systematic over-recommend table churn (same)

If a cell moves WARN/FAIL, open a `/project-status` SITUATION→SKILL
edit ticket; do not edit /project-status mid-run.

---

## Auto-chain

Reads `/project-status` SKILL.md verbatim. No downstream firing —
terminal skill. Does not auto-chain into `/route` / `/lead` / `/plan`.

The report itself is the artifact. The user decides next action from
the systematic miss/over-recommend tables (typically a `/project-status`
SITUATION→SKILL matrix edit, then re-run `/validate-routing` to
confirm the fix).

---

## Example Trigger

```
> validate routing
> /validate-routing
> audit /project-status against sim100
> we just added 10 skills — re-baseline routing
```

Each opens this skill, dispatches the 15 mental-run sub-agents,
aggregates, and emits `reports/validate-routing-<today>.md`.
