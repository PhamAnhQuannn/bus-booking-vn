---
name: plan
description: Multi-agent research, planning, and execution workflow for non-trivial tasks. Run when the user asks to plan/implement a feature, refactor a subsystem, or work through a complex change end-to-end. Triages by complexity (Small/Medium/Large), spawns parallel research/design/QA agents, and gates progress through validation phases.
---

# /plan — Multi-Agent Research, Planning & Execution Workflow

Invoke as `/plan <problem>`. The problem is: $ARGUMENTS

Execute each phase in order. Announce each phase header to the user before starting it.

---

## Why you'd care

Non-trivial changes accumulate hidden coupling: schema, auth, payment, and UX touch each other in ways no single agent will spot in one pass. Triaging and parallelizing the work prevents the half-finished PR that nobody can review.

## TRIAGE — Complexity Assessment

Before Phase 1, classify the task:

| Track   | Criteria                                                              | Phases run                         |
| ------- | --------------------------------------------------------------------- | ---------------------------------- |
| **Small**  | Single file, no schema change, no auth/payment touch                | 1 (1–2 lenses) → 3 → 4 → 5 → 6     |
| **Medium** | Multi-file, no schema change, limited blast radius                  | 1 (2–3 lenses) → 3 → 4 → 5 → 6     |
| **Large**  | Schema change, payment/auth touch, or cross-cutting concern         | All phases                          |

(Schema-change examples: Prisma migration, Alembic revision, ActiveRecord migration, Django `makemigrations`.)

Announce the track to the user and get confirmation before proceeding.

---

## PHASE 1 — Research

### Pre-check (all tracks, before spawning any agent)

Read `CLAUDE.md` (if present) and any **Mistake Log** section. If any entry matches the current problem domain, copy the relevant entries verbatim into every research agent prompt below. This runs before the fan-out — not after.

### Fan-out

Spawn **≤5 Sonnet sub-agents in parallel**, each approaching the problem independently from a distinct lens. Assign one lens per agent from this set (pick the most relevant ≤5 based on the track):

1. **Technical feasibility** — what constraints, unknowns, or blockers exist?
2. **Edge cases & failure modes** — what breaks, when, and why?
3. **Alternative approaches** — what are 2–3 completely different ways to solve this?
4. **Security & data integrity** — what are the auth, validation, and data-safety risks?
5. **Migration safety** — does this require a schema change (Prisma / Alembic / ActiveRecord / etc.), and if so, what is the safe migration path?

Each agent prompt must be self-contained (no shared context). Each returns: a short findings brief (≤300 words).

### Synthesis (Fan-in)

Spawn **1 Opus agent** with all research briefs as input. It produces:
- A consolidated research summary (what we know, what we don't)
- The 2–3 most important open questions
- A recommended approach direction
- **[Small/Medium tracks only]** Acceptance criteria (bulleted, concrete, testable) — the definition of done

Present the synthesis to the user and **pause for confirmation** before continuing.

---

## PHASE 2 — Outcome Definition *(Large track only)*

Using the Phase 1 synthesis, spawn **≤5 Sonnet sub-agents in parallel**, each independently defining what "done" looks like:

1. From the **user perspective** — what behavior changes, for each of the project's primary personas (per PRD)?
2. From the **system/data perspective** — what state is different in the database?
3. From the **failure/edge case perspective** — what no longer breaks?
4. From the **API/interface contract perspective** — what inputs/outputs are locked in (route handlers, server actions, RPC, etc.)?
5. From the **testability perspective** — what can be verified, and how (the project's test stack — e.g. Vitest + Playwright, pytest, RSpec)?

Each returns: a concrete outcome definition (≤200 words, specific and falsifiable).

### Synthesis (Fan-in)

Spawn **1 Opus agent** with all outcome definitions. It produces:
- A single unified **Expected Outcome** statement (the definition of done)
- Acceptance criteria (bulleted, concrete, testable)

Present to the user and **pause for confirmation**.

---

## PHASE 3 — Step Planning

### Fan-out

Using the confirmed outcome, spawn **≤5 Sonnet sub-agents in parallel**, each independently breaking the problem into implementation steps:

1. Agent focused on **minimal path** — fewest changes to reach the outcome
2. Agent focused on **correctness** — steps ordered to avoid broken intermediate states (uses `/atomic-file-edit` when removing/renaming a symbol used in multiple files)
3. Agent focused on **test-first** — steps that build test coverage alongside implementation (chains into `/tdd`)
4. Agent focused on **rollback safety** — steps that are individually revertible; includes the rollback procedure if a step cannot be undone
5. Agent focused on **migration safety** — identifies *where in the step sequence* the schema-migration command (e.g. `prisma migrate dev`, `alembic upgrade head`, `rails db:migrate`) must be called; confirms schema changes are sequenced strictly before application code changes

Each returns: an ordered step list with brief rationale per step.

### Synthesis (Fan-in)

Spawn **1 Opus agent** with all step plans. It produces:
- A **merged implementation plan**: numbered steps, each with: what to do, why this order, and the file(s) affected
- Flags any conflicting assumptions between the plans
- Identifies which steps require gates from `/lead` (Schema Gate, Payment Gate, Security Gate)
- **Rollback procedure** for any irreversible step (Prisma migrations, payment config changes)

Present the plan to the user and **pause for confirmation** before entering the working loop.

---

## PHASE 4 — Working Loop

This loop runs until the QA agent reports all criteria met, **up to 3 iterations**. If 3 iterations pass without a QA PASS, stop and surface the remaining failures to the user for guidance.

### 4a. Execution

Spawn **1 Sonnet lead agent** that:
- Holds the confirmed plan and current step
- Spawns **≤5 Haiku sub-agents** to execute leaf-level steps only

**Before delegating any step to a Haiku agent, the Sonnet lead checks:**
- [ ] Does this step touch only one file?
- [ ] Does this step require reading zero additional files for context?
- [ ] Is this step free of schema changes (Prisma / Alembic / ActiveRecord / etc.)?
- [ ] Is this step free of cross-module side effects?

If any check fails, the Sonnet lead executes that step itself — it does not delegate.

A **tracker Haiku agent** runs alongside: it re-reads the plan after each step, compares actual file state to expected, and flags drift back to the Sonnet lead. The Sonnet lead processes tracker feedback and corrects course before proceeding to the next step.

### 4b. QA

After each implementation pass, spawn **1 Sonnet QA agent with no prior conversation context**. Provide it only:
- The Expected Outcome and acceptance criteria from Phase 1 or 2
- The relevant files that were changed

The QA agent independently assesses whether the implementation meets the criteria. It returns:
- PASS or FAIL
- For FAIL: specific gaps (file:line, what's wrong, what's expected)

**If FAIL**: feed the QA report back to the Sonnet lead agent and repeat Phase 4a for the failing items only. Do not re-run passing items.

**If PASS**: proceed to Phase 5.

---

## PHASE 5 — Validation (Fan-out)

Spawn **≤6 sub-agents** (Sonnet) to validate against real conditions. Worked example below uses Next.js + Prisma + pnpm + vitest — substitute your stack's verify commands (`uv run pytest`, `go test ./...`, `bundle exec rspec`, etc.) or invoke `/verify` which detects them.

1. **Unit/integration tests** — run the project's test command (e.g. `pnpm test`, `pytest`, `go test ./...`), report failures
2. **Type checking** — run the project's typecheck command (e.g. `pnpm tsc --noEmit`, `mypy`, `tsc`), report errors
3. **Lint** — run the project's lint command (e.g. `pnpm next lint`, `ruff`, `eslint`), report violations
4. **Browser / runtime behavior** — invoke `/smoke-test` to derive prioritized angles, then execute each angle via Playwright MCP (`browser_navigate`, `browser_fill_form`, `browser_snapshot`, `browser_take_screenshot`); take screenshots at key states; report PASS/FAIL per angle
5. **DB state validation** — connect to the dev database and verify actual row state matches expected outcome (per the project's domain entities — e.g. orders, transfers, listings, posts)
6. **Regression check** — identify any files changed that could affect features outside the current scope; spot-check those areas

Each agent returns: PASS or FAIL with specifics.

### Synthesis (Fan-in)

Spawn **1 Opus agent** with all validation reports. It produces:
- Overall PASS / FAIL verdict
- Prioritized list of remaining issues (if any)
- Confidence assessment

**If any FAIL**: return to Phase 4 working loop with the validation failures as the new input. The iteration counter increments. Repeat until Opus gives an overall PASS or the counter reaches 3.

**If PASS**: proceed to Phase 6.

---

## PHASE 6 — Release Checklist

Before marking the plan complete, verify each item:

Worked example below uses Next.js + Prisma + pnpm. Substitute your stack's commands or invoke `/verify`.

```
RELEASE CHECKLIST
─────────────────
[ ] All acceptance criteria met (QA PASS)
[ ] Typecheck exits 0 (e.g. `pnpm tsc --noEmit`, `mypy`)
[ ] Lint clean (e.g. `pnpm next lint`, `ruff`)
[ ] Schema migration applied (if schema changed) — e.g. `prisma migrate dev`, `alembic upgrade head` succeeded
[ ] Rollback procedure documented (if migration ran)
[ ] No PII logged (phone numbers, payment tokens, raw webhook bodies)
[ ] No client-originated price/amount accepted by server (server recomputes from authoritative source)
[ ] Smoke test: golden path passes (per `/smoke-test` for this project)
[ ] DB state: domain-entity statuses correct after flow completes
[ ] Mistake Log updated — new failure pattern recorded in CLAUDE.md (if any)
```

Present the checklist to the user. The plan is complete only when all items are checked.
