---
name: ledger-harvest
description: Turn a real project's skill-recommendation ledger (.skill-ledger.jsonl) into ground-truth routing fixtures + a wrong/missing findings report. The bridge from REAL usage → validation data, closing the loop that synthetic sims can't. Reads a project's `.skill-ledger.jsonl` (every /project-status + /route recommendation tagged invoked/helped/wrong/missing), emits (a) real routing fixtures in the sim100 format keyed off actual fired sets, and (b) a findings report that feeds `/findings-to-issues` against the skill library itself. Use when user says "harvest the ledger", "turn usage into fixtures", "what skills misfired", "/ledger-harvest", or after a real dogfood build. Distinct from `/validate-routing` (grades routing against fixtures — this skill MAKES the fixtures from real usage).
output_size:
  XS: skip
  S: 30m
  M: 30m
  L: 1h
  XL: 1h
---

# /ledger-harvest — Real usage → ground-truth fixtures

Invoke as `/ledger-harvest [path-to-.skill-ledger.jsonl]` (defaults to `./.skill-ledger.jsonl`).

## Why you'd care

The whole validation stack (`/validate-routing`, the 100-sim sweeps, the 20-PM evals) is **synthetic** — the same model generates the fixtures and grades the routing, so it measures self-consistency, not correctness. The only way out of that closed loop is real usage: which skill did a real build actually need, which one fired wrongly, which one was missing entirely. `/ledger-harvest` converts that recorded experience into (a) fixtures keyed off *real* fired-sets (so `/validate-routing` can grade against ground truth, not synthetic peers) and (b) findings that become fix-issues against the library. Without this, the library can never know if it's actually right — only that it's internally consistent.

## The ledger format (`.skill-ledger.jsonl`)

One JSON object per line, appended whenever `/project-status` or `/route` surfaces a recommendation during real work:

```json
{"ts":"2026-05-27T14:03:00Z","source":"project-status|route","project":"FeatureBoard","class":"S","stage":"planned","recommended":["/write-a-prd","/prd-to-issues"],"chosen":"/write-a-prd","outcome":"helped","note":"clean PRD in one pass"}
```

Outcome tags (the load-bearing field):
- **`invoked`** — recommendation was followed (neutral; the skill ran).
- **`helped`** — invoked AND it produced the right artifact / unblocked the step. (ground-truth positive)
- **`wrong`** — recommended but inappropriate for the situation (a routing miss). (library bug)
- **`missing`** — the situation needed a skill that doesn't exist / wasn't surfaced. `note` names what was needed. (library gap)

## Pre-flight
1. Read the ledger file (default `./.skill-ledger.jsonl`; abort with a clear message if absent — "no ledger yet; run real work with the instrumentation hook first").
2. Read `docs/classify/<project>.md` for the class (each ledger line also carries `class`; cross-check).
3. Count lines; if <5, emit `SKIP — ledger too thin (N<5), keep building`.

## Process
1. **Parse** every line → records. Drop malformed lines (report count).
2. **Group by stage** (planned / building / pre-launch per the `/validate-routing` cut definitions). Within each stage, the union of `chosen` where `outcome ∈ {invoked, helped}` is the **real fired-set** for that (class, stage) — the ground truth.
3. **Emit real fixtures.** For each (class, stage) with ≥1 helped/invoked record, write a fixture in the sim100 shape to `reports/sim100/<class>-<project>-real.md` with a `source: real` front-matter tag and a `## Fired skills` section built from the real fired-set. These AUGMENT the synthetic pool — never overwrite a synthetic fixture. The `source: real` tag lets `/validate-routing` weight or segment them.
4. **Build the findings table.** Two finding classes:
   - **wrong** rows: `(source, stage, recommended, chosen, note)` — a skill that was surfaced but shouldn't have been. Fingerprint = `hash(source+stage+chosen+normalized-note)`.
   - **missing** rows: `(stage, note→needed-capability)` — a gap. Fingerprint = `hash(stage+normalized-note)`.
5. **Write the report** to `docs/qa/ledger-harvest-<YYYY-MM-DD>.md` (findings table + the real fired-set per cell + a one-line "loop status": how many real fixtures now exist vs synthetic-only cells).
6. **Hand off to `/findings-to-issues`** with the report path so `wrong`/`missing` findings become `issues/NNN-fix-*.md` against the **library** (`D:\Skills\issues/`), entering the `/autopilot` cycle. Non-interactive; fingerprint-deduped by `/findings-to-issues`' own ledger so the same gap isn't re-filed.

## Output Format

```markdown
# Ledger harvest — <project> — <YYYY-MM-DD>
Ledger lines: N (M malformed dropped) | class: <X>

## Real fired-sets (ground truth)
| Stage | Real fired-set (helped/invoked) | New fixture |
|-------|---------------------------------|-------------|
| planned | /write-a-prd, /prd-to-issues, … | reports/sim100/<class>-<project>-real.md |

## Findings → library
| # | type | stage | detail | fingerprint |
|---|------|-------|--------|-------------|
| 1 | wrong   | building | /route surfaced /X for "<intent>" — inappropriate; chose /Y | ab12… |
| 2 | missing | design   | needed "<capability>", no skill existed | cd34… |

## Loop status
- (class,stage) cells with ≥1 real fixture: N / 15
- Findings filed to D:\Skills\issues via /findings-to-issues: N (M deduped)
```

## Verification
- Real fixtures carry `source: real` and never overwrite a synthetic `reports/sim100/*.md`.
- Every `wrong`/`missing` ledger record appears once in the findings table (fingerprint-deduped).
- `/findings-to-issues` invoked with the report path; resulting issue count reported.
- If the ledger had zero `wrong` and zero `missing` over a real build, SAY SO loudly and flag it as suspicious — a real end-to-end build that hit no routing miss and no gap usually means the ledger wasn't capturing honestly (check the hook fired on every recommendation).

## Cross-skill references
- **Consumes:** a project's `.skill-ledger.jsonl` (written by the instrumentation hook).
- **Feeds:** `reports/sim100/*-real.md` (read by `/validate-routing`), `/findings-to-issues` (→ `D:\Skills\issues/`).
- **Distinct from:** `/validate-routing` (grades routing against fixtures); this skill manufactures real fixtures + findings from lived usage.
