---
name: findings-to-issues
description: Non-interactive bridge that turns a fingerprinted findings report into fix-issue files in issues/. Reads a findings table (from /product-ready-gate, /debt-scan, /perf-audit, /security-review-deep — any report with a fingerprint+severity column), dedupes against a ledger, applies a severity gate (P0/P1 halt to user, P2/P3 auto-issue) and a per-session cycle cap, then writes `issues/NNN-fix-*.md` in the standard issue template so /autopilot picks them up next cycle. Never prompts the user, so it never halts autopilot. Never invokes /write-a-prd (that one is interactive and would stall the loop). Use when a scan/gate produced findings that should become tracked fix work, or when /product-ready-gate returns BLOCKED.
output_size:
  XS: skip
  S:  30m
  M:  30m
  L:  1h
  XL: 1h
---

# /findings-to-issues — findings report → fix-issue files

Invoke as `/findings-to-issues "<report-path>"`. Parse the findings, dedupe, gate by severity, and write `issues/NNN-fix-*.md`. No prompts — this is the loop-safe bridge between a scan/gate and `/autopilot`'s build queue.

## Why you'd care

A readiness gate or a scan produces a list of problems, but a problem in a report is not work `/autopilot` can pick up — only `issues/*.md` files are. The obvious wire, "feed the problems to `/write-a-prd`", **breaks the loop**: `/write-a-prd` is interactive (it asks the user to describe the product), so `/autopilot` treats it as a CONTENT gate and halts. This skill is the missing, *non-interactive* bridge: report in, issue files out, no questions asked. `/autopilot` re-globs `issues/` every cycle, so the fix-issues this writes get auto-discovered and built next cycle — the gate→fix→re-gate loop closes with no autopilot change.

It is also reusable: any report that carries a `fingerprint` + `severity` column (`/debt-scan`, `/perf-audit`, `/security-review-deep`) can be piped through it.

## Inputs

- **Report path** (required) — a markdown report with a `## Findings` table whose columns include `fingerprint`, `severity` (P0–P3), `category`, `check`, `file`, `message`, and (optional) `suggested-fix`.
- **Ledger** — `.understand/findings-ledger.json` (created on first run). Tracks dedup + cycle state.

## The three loop-safety guards

This skill is the enforcement point for all three guards (the gate computes findings; this skill decides what becomes an issue and when to stop).

1. **Fingerprint + dedup.** The ledger maps `fingerprint → { count, issue_file, status, first_seen }`. Before writing an issue for a finding, look it up:
   - **New fingerprint** → write the issue, ledger `status: open`, `count: 1`.
   - **Known, prior issue still open** → do NOT write a duplicate; bump `count`.
   - **Known, prior issue marked DONE but the finding is back** (`count` would become ≥ 2 with a DONE predecessor) → the fix didn't take, or it's flaky. Do NOT recreate. Set `status: escalated` and add it to the escalation list surfaced to the user. This is what stops an unfixable finding from spinning the loop forever.

2. **Severity gate.**
   - **P0 / P1** (data loss, security, broken build, core-UX breakage) → **HALT**. Do not auto-create. Add to the escalation list with `[HALT — P0/P1]`. Critical problems always reach a human; they are never silently looped.
   - **P2 / P3** → auto-create the fix-issue and continue.

3. **Cycle cap.** The ledger holds `gate_fix_cycles`. Increment it once per invocation that produces ≥ 1 finding. If `gate_fix_cycles > 3`, stop: do not create more issues, summarize the residual findings, and hand to the user. The cap resets to 0 when `/product-ready-gate` next returns READY (the gate writes the reset; this skill honors it).

**Termination guarantee:** the loop ends on READY, on any P0/P1, on a repeat fingerprint (DONE predecessor), or at the cycle cap. It cannot run forever.

## Process

1. **Read the report.** Parse the `## Findings` table into rows. If no findings table or zero rows → emit `no findings — nothing to do`, exit (no ledger write).
2. **Load (or init) the ledger** `.understand/findings-ledger.json`.
3. **Increment `gate_fix_cycles`.** If now > 3 → cycle-cap stop (summarize residual, exit).
4. **For each finding, in severity order (P0 first):**
   - Apply the severity gate. P0/P1 → escalation list, skip creation.
   - Apply dedup. Known-open → bump count, skip. Known-DONE-returning → escalate, skip.
   - Otherwise (new P2/P3) → write the issue file.
5. **Write each issue** to `issues/NNN-fix-<slug>.md`. `NNN` = next free number in `issues/` (zero-padded, continues the existing sequence). Template + frontmatter below.
6. **Write the ledger** back.
7. **Emit a one-line summary** (no prompt): `<N> issues created · <M> deduped · <K> escalated to user (P0/P1 or repeat)` plus, if any, the escalation list.

## Issue file format

Use the standard `/prd-to-issues` template so downstream skills (`/prioritize`, `/acceptance-criteria`, `/tdd`, `/project-status`) read it natively.

Frontmatter:
```yaml
---
priority: must        # P0/P1 → must (only reaches here if user un-halts); P2/P3 → should
source: product-ready-gate   # or debt-scan / perf-audit / security-review-deep
fingerprint: a3f9c1
severity: P2
---
```

Body:
```markdown
## Parent PRD

`issues/prd.md` (fix-issue derived from a readiness finding — no parent slice)

## What to build

Fix: <finding message>. Surfaced by <source> in <category>/<check> at `<file>`.
<suggested-fix, if present>

## Acceptance criteria

- [ ] The originating check passes: <check> on `<file>` reports no error.
- [ ] `/product-ready-gate` no longer emits fingerprint `<fingerprint>`.

## Blocked by

None - can start immediately.
```

The acceptance criteria are written so re-running the gate is the literal definition of done — when the check passes, the fingerprint disappears, the dedup ledger sees the finding gone, and the loop advances.

## Verification

- No interactive prompt is ever issued (autopilot must never halt on this skill).
- Every created issue has a `fingerprint` + `severity` + `source` in frontmatter.
- Re-running on the same report creates **zero** new issues (all deduped) — idempotent.
- A P0/P1 finding is **never** auto-created — it appears only in the escalation list.
- A finding whose prior issue is DONE is escalated, not recreated.
- `gate_fix_cycles > 3` produces a cycle-cap stop, not more issues.
- `/write-a-prd` is never invoked.

## Cross-skill references

- **Upstream:** `/product-ready-gate` (BLOCKED → here), `/debt-scan`, `/perf-audit`, `/security-review-deep` (any fingerprinted findings report).
- **Downstream:** `/project-status` (re-globs `issues/` and picks the fix-issue), `/tdd` / `/scaffold-feature` (builds the fix), `/prioritize` (ranks fix-issues among the backlog). Loop closes back at `/product-ready-gate`.
