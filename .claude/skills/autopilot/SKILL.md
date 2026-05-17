---
name: autopilot
description: Status-driven self-execution loop for the project. Each cycle invokes /project-status, picks the top RECOMMENDED NEXT STEP, optionally pre-runs /grill-me when /project-status flagged spec gaps, executes the picked skill via the Skill tool, then re-surveys. When the picked skill is /commit-split, autopilot also auto-stages and commits each group from the returned plan (one plan-level confirm; never push). Stops when /project-status surfaces /ultrareview as top step (billed, user-triggered — suggest+exit, never invoke) or recommendation set empties; also stops on stuck-rec, subskill failure, [SPLIT NEEDED] commit plan, or /route ambiguity. Pre-launch chain is fully delegated to /project-status (no hardcoded chain). Auto-approves subskill internal APPROVAL gates (e.g. /plan Phase 1/2/3 confirmations, /commit-split RISKY group re-confirms) by treating the artifact's own recommendation as the best-choice answer. CONTENT gates (subskill needs user-supplied data) still halt via subskill-input-block. Use when the user wants to advance the project semi-autonomously across multiple slices ("autopilot", "auto run", "self-drive", "auto commit", "advance project automatically", "/autopilot").
output_size:
  XS: 10m
  S: 20m
  M: 30m
  L: 1h
  XL: 1h
---

# /autopilot — Status-Driven Self-Execution Loop

## Why you'd care

Manually re-running /project-status, picking the next skill, and invoking it for every slice burns a maker's whole afternoon on context-switching. Autopilot closes that loop so your hands-on time is spent only where the recommendation is wrong.

Invoke as `/autopilot`. Closes the loop between `/project-status` (recommends) and the executor skills (`/lead`, `/tdd`, `/grill-me`, `/commit-split`, etc.). Picks the top recommendation each cycle, runs it via the Skill tool, re-surveys, repeats. Runs autonomously — no per-cycle or plan-level confirm. Halts only on subskill failure, stuck-detection, `[SPLIT NEEDED]` commit plans, /route ambiguity, `/ultrareview` recommendation (suggest+exit, never invoke), or empty recommendation set.

Sits adjacent to `/loop` (timing-only repeater — not state-aware) and `/route` (one-shot dispatch — no loop). `/autopilot` is the only skill that **chains skill→skill** based on live project state.

---

## Operating mode

- **Auto-level:** Full auto. No per-cycle confirm, no plan-level confirm, no pre-launch chain confirms. Each cycle prints an informational status card then proceeds. User can interrupt at any time by typing in the chat.
- **Heavy-skill policy:** `/lead`, `/plan`, `/commit-split`, and any other subskill that emits internal pause-for-approval gates run as black-box invocations BUT autopilot auto-approves every APPROVAL gate they produce (see § Subskill gate auto-approval). Net effect: a single /autopilot cycle picks `/plan` and runs it through Triage → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 in one pass without prompting the user.
- **Auto-approve protocol:** When a subskill reaches an APPROVAL gate ("pause for confirmation", "present and wait", "approve / changes / abort"), autopilot responds `approve` with the artifact's own recommended choice as rationale, prints a one-line trace, and the subskill continues. APPROVAL gates that contain explicit `[KILL]`, `[ABORT]`, `[RED FLAG]`, `STRONG-PASS == false`, or "do not proceed" annotations in the artifact are NOT auto-approved — they convert to a halt (see § Stop rules).
- **Stop rules:** `top_rec == /ultrareview` (suggest+exit, never invoke) **OR** `RECOMMENDED NEXT STEPS` empty **OR** same recommendation 2x in a row (stuck) **OR** stuck-branch escalation (same rec 3x **OR** same subskill failed 3x consecutive) **OR** any subskill failure **OR** `[SPLIT NEEDED]` in /commit-split plan **OR** /project-status surfaces /route as top step (ambiguous goal) **OR** subskill prompts for input autopilot can't synthesize from upstream artifacts (subskill-input-block). No max-iteration cap. Pre-launch stage does NOT exit — autopilot keeps cycling (Step 7 delegated loop) until /ultrareview surfaces or the rec set empties.
- **Read-only outside subskills:** /autopilot itself never edits files (other than via subskills), never pushes. Step 6.5 commit loop is the only direct git side-effect — local commits only, never push.

---

## Subskill gate auto-approval

Autopilot intercepts every subskill internal gate during Step 6 execution. Classify each gate before responding:

### APPROVAL gate (auto-approve)

Signal phrases the parent (Claude running /autopilot) must recognize as APPROVAL:
- "pause for confirmation"
- "present the [synthesis|plan|outcome|draft] to the user"
- "approve / changes / abort"
- "does this [plan|design|breakdown] look right"
- "get confirmation before proceeding"
- numbered approve-style menus where one option is "approve" or "proceed"

When detected:
1. Read the artifact the subskill just produced (synthesis, plan, outcome, etc.).
2. Scan for kill-flags: `[KILL]`, `[ABORT]`, `[RED FLAG]`, "do not proceed", "STRONG-PASS == false", "verdict: KILL", "verdict: PIVOT" (problem-validation), "split needed", etc.
3. If ANY kill-flag present → escalate to **gate-kill halt** (see Stop rules). Do NOT auto-approve.
4. Otherwise → respond `approve` with the artifact's recommended choice quoted verbatim as rationale. Print:
   ```
   ┌─ AUTO-APPROVE ─────────────────────
   │ Subskill:  /<skill>
   │ Gate:      <gate name, e.g. "Phase 2 outcome">
   │ Choice:    <verbatim from artifact, e.g. "Large track">
   │ Why:       artifact contains no kill-flags; best-choice == artifact recommendation
   └────────────────────────────────────
   ```
5. Subskill continues. Autopilot resumes wait for subskill completion or next gate.

### CONTENT gate (do NOT auto-approve)

Signal phrases that mean the subskill needs user-supplied data:
- "describe the problem"
- "what's your tech stack"
- "give me a long, detailed description"
- "interview the user relentlessly"
- "ask the user for ..." (where ... is not a yes/no on an artifact)
- "check with the user which modules they want tests for"
- `[SPLIT NEEDED]` in /commit-split

When detected → route to the existing `subskill-input-block` halt (Step 3 stop check). Print the input-block card and exit. Never fabricate user content.

### Tie-breaker: ambiguous gate

If a gate could read as either category, treat as CONTENT (safer — halts rather than silently approves with no artifact backing).

### Auto-approval counter

Maintain `auto_approvals_this_cycle = 0`. Increment on each successful auto-approve. Print in the cycle card (Step 4) as `Auto-approved gates: <N>`.

---

## Pre-flight (cycle 1 only)

1. Print banner:
   ```
   ─────────────────────────────────────
   AUTOPILOT — starting
   Auto-level:  Full auto (no confirms)
   Stop on:     ultrareview-rec | empty-recs | repeat-rec | subskill-failure | split-needed | route-ambiguity | subskill-input-block
   ─────────────────────────────────────
   ```
2. Initialize in-session state (these are mental notes — no state file):
   - `cycle_n = 0`
   - `previous_recommendation = null`
   - `last_subskill_result = null`

---

## Loop body (one cycle)

### Step 1 — Survey

Invoke `/project-status` via the **Skill tool**:

```
Skill(skill="project-status")
```

Wait for completion. Capture its full output.

### Step 2 — Parse

From the output, extract:

| Field | Source section in /project-status output |
|---|---|
| `stage` | `STAGE:` line at the top |
| `top_rec` | First entry under `RECOMMENDED NEXT STEPS` — verbatim slash-command + arg string |
| `top_rec_reason` | Trailing prose after the `—` on that same line |
| `pregrill_flagged` | `SITUATION → SKILL` row that says `→ /grill-me "<X>" then …` for the picked slice |
| `route_fallback` | `DESCRIPTION DISPATCH` block — only present if /project-status got a free-form arg; ignore for /autopilot |

If `/project-status` recommends `/route "<goal>"` as the top step (ambiguity case), pause and ask the user for the concrete goal — do not auto-pick a skill from /route's output without confirmation.

### Step 3 — Stop check

Apply in order. First match exits the loop.

| Condition | Action |
|---|---|
| `top_rec == "/ultrareview"` | Print /ultrareview suggest banner (Step 7 format), exit cleanly. Never invoke. |
| `RECOMMENDED NEXT STEPS` empty | Print pre-launch-complete summary (if stage=pre-launch) or generic-done summary, exit. |
| `stage == "pre-launch"` | Enter Step 7 delegated loop — do NOT exit on stage alone. Continue to Step 4 with pre-launch-loop exit conditions in force. |
| `last_subskill_result == "failure"` | Print failure summary, exit. |
| Subskill prompts for input no upstream artifact supplies (e.g. `/write-a-prd` asks for product description on a target with no product) | Print subskill-input-block halt card (format below), exit. |
| Subskill artifact contains kill-flag (`[KILL]`, `[ABORT]`, `[RED FLAG]`, "verdict: KILL/PIVOT", "do not proceed", "STRONG-PASS == false") | Print gate-kill halt card (format below), exit. |
| `top_rec == previous_recommendation` (verbatim string match) | Print "loop stuck" diagnostic, ask user `force-skip / halt / pick different skill`, then act. |

If none match → continue.

### Step 4 — Cycle status (informational)

Print the cycle card and continue immediately — no prompt, no wait:

```
─────────────────────────────────────
AUTOPILOT — cycle <N>
Stage:           <stage>
Last completed:  <previous_recommendation or "—">
Picked next:     <top_rec>
Why picked:      <top_rec_reason>
Pre-grill:       <"yes — <slice>" if pregrill_flagged else "skipped">
Auto-approved:   <N> gates this cycle (0 if subskill not yet executed)
─────────────────────────────────────
```

Continue to Step 5. User can interrupt the chat at any time to halt manually.

### Step 5 — Pre-flight /grill-me (conditional)

Only if `pregrill_flagged == true`:

```
Skill(skill="grill-me", args="<slice title parsed from top_rec>")
```

`/grill-me` is interactive — it asks the user questions. /autopilot waits silently for it to complete, then continues.

### L-track auto-/plan gate

Before Step 6 fires, classify `top_rec` as **L-track** if any hold:

| Signal | Source |
|---|---|
| Tag `L-track` in `top_rec_reason` | `/project-status` reason prose |
| Lead-tier `T2` or `T3` annotation | `/project-status` tier line |
| Slice spans `> 3` files | `/project-status` scope/file-count field |
| Cross-domain (≥ 2 domains per /commit-split taxonomy) | `/project-status` domain list |

If **L-track == true** AND `skill_name != "plan"`:

**Planning-skill allowlist (skip /plan pre-pass for these — they ARE planning artifacts themselves):**

| Skill | Reason exempted |
|---|---|
| `/plan` | already the gate target |
| `/write-a-prd` | PRD = plan artifact |
| `/prd-to-issues` | decomposes the PRD plan |
| `/regulatory-preflight` | XL-planned planning artifact |
| `/threat-model-pre` | pre-design plan |
| `/data-flow-diagram-pre` | pre-design plan |
| `/pen-test-procurement-plan` | pre-design plan |
| `/lean-canvas` | S-inception planning artifact |
| `/idea-capture` | S-inception planning artifact |
| `/problem-validation` | S-inception planning artifact |
| `/founder-fit` | S-inception planning artifact |
| `/acceptance-criteria` | scoping artifact |
| `/traceability-matrix` | scoping artifact (when on disk) |
| `/prioritize` | scoping artifact (when on disk) |

If `skill_name` matches any allowlist row → **SKIP** the /plan pre-pass; proceed straight to Step 6 with the original `top_rec`. Rationale: running `/plan` before a planning-class skill double-plans and wastes a turn (per BRAIN #28).

Otherwise (non-allowlisted L-track skill, e.g. `/lead`, `/tdd` on multi-layer slice):

1. Hard-enforce a `/plan` pre-pass — not a suggestion, not skippable:
   ```
   Skill(skill="plan", args=<top_rec arg string>)
   ```
2. Wait for `/plan` completion. Capture its output as `plan_artifact`.
3. On `/plan` failure → treat as subskill failure (Step 6 failure path, no fallback to direct execution).
4. On `/plan` success → continue to Step 6 with the original `top_rec`; the planned slice now executes against the plan.

Do **not** route to direct execution for non-allowlisted L-track work. Previous "suggest /plan" behavior is replaced by this gate.

### Step 6 — Execute the picked skill

Parse `top_rec` into `{ skill_name, args }`:
- `top_rec = '/lead "issue 002 — Prisma schema + Neon"'`
- → `skill_name = "lead"`, `args = 'issue 002 — Prisma schema + Neon'`

Invoke:

```
Skill(skill=<skill_name>, args=<args>)
```

Capture result. Heavy skills (`/lead`, `/plan`) may take many turns and produce code edits, commits inside `/commit-split`, etc. /autopilot does not interfere — it waits for return.

Determine `last_subskill_result`:
- `success` if subskill returned without error and met its own completion criteria
- `failure` otherwise — capture the error message verbatim

Branch on `skill_name`:
- `skill_name == "commit-split"` → continue to Step 6.5 (auto-commit subroutine)
- otherwise → continue to Step 8 (state update, loop)

### Step 6.5 — /commit-split auto-execution (conditional)

Runs only when the subskill from Step 6 was `/commit-split`. /commit-split is plan-only — it returns a COMMIT PLAN but never stages or commits. Autopilot consumes that plan and executes it here.

#### 6.5a — Parse plan

Extract from /commit-split output:

| Field | Source |
|---|---|
| `groups[]` | each `Group N [domain] — N files` block; capture `index`, `domain`, `files[]`, `message`, `depends_on`, `post_commit_hooks[]` |
| `split_needed[]` | files under `[SPLIT NEEDED]` block |
| `plan_shape` | `pragmatic` if /commit-split offered both [A] strict + [B] pragmatic; `strict` otherwise |

If `split_needed[]` is non-empty → halt. Print:

```
─────────────────────────────────────
AUTOPILOT — HALT (commit-split needs manual resolution)
[SPLIT NEEDED] files cannot be auto-committed:
  <verbatim list from plan>
Resolve domain assignment, then re-invoke /autopilot.
─────────────────────────────────────
```

If /commit-split offered both [A] and [B], pick default via scaffold-landing heuristic:

```
is_scaffold_landing =
  (commits_in_repo  < 10)              # git rev-list --count HEAD
  AND (untracked_count >= 20)          # git ls-files --others --exclude-standard | wc -l
  AND (untracked_domain_count >= 3)    # classify per /commit-split taxonomy
```

- `is_scaffold_landing == true`  → default = [B] pragmatic
- otherwise                      → default = [A] strict

#### 6.5b — Auto-decide plan shape (no confirm)

Print the plan summary card and proceed straight to the commit loop — no prompt, no wait:

```
─────────────────────────────────────
AUTOPILOT — auto-commit ready
Plan shape:    <pragmatic | strict>  (auto-picked: <A | B>)
Groups:        <N>
First group:   <domain> — <file count> files
               "<commit message first line>"
Last group:    <domain> — <file count> files
               "<commit message first line>"
Post-commit:   <list of RUN-AFTER-COMMIT hooks across all groups, or "none">
─────────────────────────────────────
```

Plan shape was already auto-picked in 6.5a via the scaffold-landing heuristic. Continue to 6.5c.

#### 6.5c — Commit loop

For each group in dependency order:

1. `git add <files...>` — exact file list parsed from plan. Never `-A` / `.`.
2. `git commit -m "<message>"` — use HEREDOC if message is multi-line.
3. Capture commit exit code + short-sha (`git rev-parse --short HEAD`).
   - `0` → continue
   - non-zero → halt loop, jump to 6.5d
4. If group declares `RUN AFTER COMMIT: <cmd>`:
   - Run cmd via Bash.
   - On non-zero exit → halt loop, jump to 6.5d (record cmd + exit + stderr).
5. Print progress line: `  [✓] <K>/<N> <domain> — <short-sha> <message-first-line>`

After all groups land cleanly:

```
─────────────────────────────────────
AUTOPILOT — auto-commit complete
Groups:        <N>/<N>
New commits:   <short-sha-list>
Hooks ran:     <list, or "none">
─────────────────────────────────────
```

Set `last_subskill_result = success`. GOTO Step 8.

#### 6.5d — Auto-commit failure

```
─────────────────────────────────────
AUTOPILOT — HALT (auto-commit failure)
Group <K>/<N>: <domain>
Command:       <git add | git commit | post-commit hook>
Exit code:     <code>
Stderr:
  <verbatim>

State:         <K-1> commits landed; group <K> may be partially staged.
Recovery:      `git status` to inspect.
               `git restore --staged <files>` to unstage if needed.
               Resolve, then re-invoke /autopilot.
─────────────────────────────────────
```

Set `last_subskill_result = failure`. Exit autopilot. No auto-rollback — preserve diagnostic state.

### Step 7 — Pre-launch loop (stage = pre-launch)

When `stage = pre-launch`, do NOT run a hardcoded chain. /project-status
is the routing source — including for pre-launch — and already
class-routes the chain correctly (XL prepends ops cluster
`/dr-drill → /rollback-plan → /deploy-health-gate → /prod-smoke`;
XS/S/M/L emit `/verify → /smoke-test → /commit-split → /ultrareview`
directly via stage table).

Re-enter the survey loop with these exit conditions instead of the
generic stage-based exit:

- `RECOMMENDED NEXT STEPS` from /project-status is empty → print
  pre-launch-complete summary, exit.
- `top_rec == /ultrareview` → print the suggest banner (billed,
  user-triggered, never invoke), exit cleanly.
- `previous_recommendation == top_rec` → stuck rules from Step 3 still
  fire (2x soft, 3x escalation to /lead).

Each cycle runs Step 6 normally (execute `top_rec` via the Skill tool).
After each subskill returns, the loop re-surveys; /project-status walks
the boost list and stage table one slot at a time. Missing-from-disk
boost skills (`/dr-drill` etc. before they exist) are silent-dropped by
/project-status at the matrix layer; autopilot never sees them.

`/ultrareview` suggest banner format:

```
─────────────────────────────────────
AUTOPILOT — pre-launch complete
/project-status surfaced /ultrareview as the top step.
Run it manually when ready (billed, user-triggered):

  /ultrareview

Cycles run:    <N>
Stage at exit: pre-launch
─────────────────────────────────────
```

The pre-launch chain is now data-driven (single source of truth =
/project-status), not duplicated in autopilot. If any subskill in the
chain fails, halt with the standard subskill-failure exit (Step 3
failure path).

### Step 8 — Update state, loop

```
previous_recommendation = top_rec
cycle_n += 1
GOTO Step 1
```

---

### Stuck-branch recovery strategy

Tracks deeper stalls than the 2x-rec exit. Maintain across cycles:

- `rec_repeat_count` — increments each cycle `top_rec == previous_recommendation`, resets on change
- `subskill_fail_streak[skill_name]` — increments each consecutive failure of that skill, resets on success

A branch is **stuck** when either:

| Trigger | Threshold |
|---|---|
| Same `/project-status` recommendation returned | 3 cycles in a row |
| Same subskill failed | 3 consecutive invocations |

On stuck:

1. **Pause autopilot** — do not re-survey, do not auto-pick. Freeze cycle state.
2. **Escalate to `/lead`** with the failure trace:
   ```
   Skill(skill="lead", args="stuck-branch escalation: <top_rec> — fail-trace: <verbatim last 3 outcomes>")
   ```
3. **Surface to user** with explicit options:
   ```
   ─────────────────────────────────────
   AUTOPILOT — STUCK-BRANCH ESCALATION
   Trigger:       <rec-repeat-3x | subskill-fail-3x>
   Branch:        <top_rec>
   Fail trace:    <verbatim last 3 outcomes>
   /lead escalation result: <summary>

   Choose:
     [rollback]       revert recent commits / discard staged changes
     [switch-path]    pick a different recommendation from /project-status
     [debug-manual]   exit autopilot; debug by hand
   ─────────────────────────────────────
   ```
4. Wait for user choice. No auto-resume — user must re-invoke `/autopilot` after resolution.

This supersedes the 2x-rec stuck check when the 3x threshold is crossed; the 2x check still fires earlier as a soft signal.

---

## Stuck detection — diagnostic format

When `top_rec == previous_recommendation`, print:

```
─────────────────────────────────────
AUTOPILOT — STUCK
Cycle <N>'s recommendation is identical to cycle <N-1>:
  → <top_rec>
The last skill ran but did not change /project-status's top recommendation.
Likely cause: subskill produced no observable progress (no new files,
no new tests, no AC closed).

Choose:
  [force-skip]   skip this rec; ask /project-status for the next-best
  [halt]         exit autopilot
  [different]    tell me which skill to run instead
─────────────────────────────────────
```

---

## Subskill failure — exit format

```
─────────────────────────────────────
AUTOPILOT — HALT (subskill failure)
Cycle <N>: <skill_name> "<args>"
Last good cycle: <N-1>  (last_completed: <previous_recommendation>)

Error from <skill_name>:
  <verbatim error or failure summary>

Autopilot does not auto-retry. Resolve manually, then re-invoke /autopilot.
─────────────────────────────────────
```

---

## Subskill input-block — exit format

```
─────────────────────────────────────
AUTOPILOT — HALT (subskill input-block)
Cycle <N>: <skill_name> "<args>"
Subskill prompted for input no upstream artifact supplies:
  <verbatim prompt text>

Upstream checked:
  - PRD:             <present|absent>
  - classify doc:    <present|absent>
  - issues/:         <present|absent>
  - top_rec args:    <verbatim or "empty">

Resolve options:
  - Supply the missing artifact (e.g. write PRD by hand) and re-invoke /autopilot.
  - Pick a different slice via /route or manual skill invoke.
  - Reclassify target if greenfield-on-meta target was wrong (e.g. skill library has no product surface).
─────────────────────────────────────
```

---

## Gate-kill — exit format

```
─────────────────────────────────────
AUTOPILOT — HALT (gate-kill)
Cycle <N>: <skill_name> "<args>"
Gate:          <gate name, e.g. "Phase 2 outcome", "problem-validation verdict">
Kill-flag:     <verbatim flag found, e.g. "verdict: KILL">
Artifact excerpt (5 lines around flag):
  <verbatim>

Autopilot does not auto-approve over a kill-flag.
Resolve manually (re-run subskill with new inputs, or pick different slice), then re-invoke /autopilot.
─────────────────────────────────────
```

---

## Halt-on-user format

```
─────────────────────────────────────
AUTOPILOT — halted by user
Cycles run:        <N>
Skills completed:  <list>
Stage at halt:     <stage>
Resume any time with /autopilot.
─────────────────────────────────────
```

---

## Never do

- Never invoke `/ultrareview` — it is user-triggered and billed. When /project-status surfaces it as `top_rec`, print suggest banner (Step 7 format) and exit.
- Never hardcode a pre-launch chain. `/project-status` is the routing source; `/autopilot` is the executor. New stages, new class-routings, new boost skills land in `/project-status` — `/autopilot` picks them up automatically via the Step 7 delegated loop.
- Never push, deploy, or run destructive git operations.
- Never auto-push. Step 6.5 auto-commit is local-only — `git push` is always manual.
- Never run `git add -A` or `git add .` inside Step 6.5. Always stage the explicit file list parsed from /commit-split's plan.
- Never auto-execute a /commit-split plan that contains `[SPLIT NEEDED]` entries — halt and surface to user.
- Never auto-execute when /project-status surfaces /route as the top step — pause and surface the ambiguity to the user.
- Never silently retry a failed subskill or a failed commit group.
- Never invoke a skill that is not in `.claude/skills/*/SKILL.md` (relative to repo root — skill name must be on disk before calling Skill tool).
- Never treat `/grill-me` on a slice with upstream content as a stop — it interrogates known material and resumes; not a failure.
- DO halt when a subskill prompts for input no upstream artifact supplies (PRD body / product description / problem statement on a greenfield target with no seed) — this is `subskill-input-block`. Surface to user; do not fabricate input.
- Never auto-approve a CONTENT gate (subskill asking for user-supplied data the autopilot harness cannot synthesize — e.g. PRD body, problem description, `[SPLIT NEEDED]` domain assignment). Route to subskill-input-block halt.
- Never auto-approve an APPROVAL gate when the subskill artifact contains a kill-flag (`[KILL]`, `[ABORT]`, `[RED FLAG]`, "verdict: KILL/PIVOT", "do not proceed", "STRONG-PASS == false"). Convert to gate-kill halt.
- Never fabricate an answer to a gate. Auto-approval must quote the artifact's own recommendation verbatim — never invent a choice not present in the artifact.

---

## Cross-skill references

| Skill | Role in /autopilot |
|---|---|
| `/project-status` | Survey + recommendation source — invoked at top of every cycle |
| `/grill-me` | Pre-flight clarifier when /project-status flags spec gaps |
| `/lead`, `/plan` | Heavy executors — black-box invocations |
| `/tdd`, `/verify`, `/smoke-test` | Light executors — same invocation pattern |
| `/commit-split` | Light executor with auto-exec wrapper — when picked, /autopilot parses returned COMMIT PLAN and auto-stages+commits each group via Step 6.5 without pause. /commit-split itself stays plan-only; if the plan contains `[SPLIT NEEDED]`, /autopilot halts for manual resolution. |
| `/route` | Used only when /project-status itself surfaces /route as top step — autopilot does not auto-route; asks the user |
| `/loop` | NOT used — /loop is timing-based, not state-aware |

---

## Completion criteria

A clean /autopilot session ends with one of:

- **pre-launch exit** — pre-launch chain ran, /ultrareview suggested, exit summary printed
- **stuck exit** — stuck-detection fired; user chose `halt` or `force-skip` led to clean halt
- **stuck-branch escalation** — 3x-rec or 3x-subskill-fail tripped; /lead escalation surfaced; user chose rollback / switch-path / debug-manual
- **failure exit** — subskill failure or commit-loop failure surfaced verbatim, no retry
- **split-needed exit** — /commit-split plan flagged `[SPLIT NEEDED]`; halted for manual domain assignment
- **route-ambiguity exit** — /project-status surfaced /route as top step; paused for user goal
- **subskill-input-block exit** — subskill emitted a CONTENT gate (required user-supplied data the autopilot harness could not synthesize from upstream artifacts); halted with input-block card. APPROVAL gates do NOT cause this exit — they auto-approve.
- **gate-kill exit** — subskill artifact contained explicit kill-flag (e.g. /problem-validation verdict KILL/PIVOT, "STRONG-PASS == false", "do not proceed"); autopilot did not auto-approve, surfaced the artifact + flag, exited.
- **user interrupt** — user typed something in chat that interrupts mid-cycle

In all cases, the exit summary prints `Cycles run: N` and the latest stage.
