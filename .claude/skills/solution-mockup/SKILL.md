---
name: solution-mockup
description: Lo-fi mockup (Figma/paper) for interview feedback before code. Outputs to `docs/inception/solution-mockup-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "mockup", "wireframe for validation", "show users before building", "/solution-mockup", or after `/mvp-scope`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /solution-mockup — Lo-Fi Validation Mockup

Invoke as `/solution-mockup`. Mockup ≠ design. Crude on purpose.

## Why you'd care

Coding a mockup costs ten times as much as drawing one and gets ten times less feedback because users hesitate to criticize "finished" work. Low-fi is what gets the brutal honesty you actually need.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/mvp-scope-<project>.md` — must features only.

## Inputs
- Must-feature list.
- Primary persona's day-in-life.
- Tool: Figma / Excalidraw / paper photos / Balsamiq.

## Process
1. **Map happy-path screens** — list every screen user touches in primary job.
2. **Sketch crude** — boxes + labels, no polish (polish = bias feedback toward aesthetics).
3. **Annotate intent** — what each screen accomplishes.
4. **Click-through** — Figma prototype or arrow diagram.
5. **Show 5 users** (from interview-log) — silent watch first 30s, then ask:
   - "What do you think this is?"
   - "Where would you click first?"
   - "What do you expect to happen next?"
   - NO leading questions, NO defending design.
6. **Log reactions verbatim** — confusion points = signal.
7. **Iterate** — round 2 mockup with top 3 changes.

## Output
Write `docs/inception/solution-mockup-<project>.md`:

```markdown
# Solution Mockup — <project>
**Date:** <YYYY-MM-DD> | **Tool:** <X> | **Round:** N

## Screen list
1. <screen> — purpose
2. ...

## Mockup links
- Figma: <url>
- (or attach screenshots in `docs/inception/mockup-<project>/`)

## User sessions
### #1 — <name> — <date>
- First click: <where> (expected: <where>) — match Y/N
- "What is this?" → "<verbatim>"
- Confusion: <where>, <why>
- Suggested change: "<verbatim>"

### #2 ...

## Common confusion points (≥3 users)
1. <point> — N users
2. ...

## Iteration plan (round 2)
1. <change> — fixes <confusion>
2. ...

## Verdict
**MOCKUP-VALIDATED / NEEDS-ITERATION / WRONG-DIRECTION**
```

## Verification
- ≥5 user sessions logged (1–2 = anecdote).
- Verbatim quotes only (no paraphrase).
- No leading questions in script.
- Iteration items tied to confusion points.
