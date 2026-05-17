---
name: idea-kill-list
description: Maintain rolling list of dead ideas with kill-reason so you stop re-pitching the same dead horse. Outputs to `docs/inception/kill-list.md` (single file, append-only). No class skip. Use when user says "killed it", "shelve idea", "/idea-kill-list", or after `/problem-validation` returns KILL.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /idea-kill-list — Graveyard Ledger

## Why you'd care

Founders re-pitch the same dead idea to themselves every 6 months because they forgot exactly why they killed it last time. The append-only kill list prevents the rerun and the wasted re-validation effort.

Invoke as `/idea-kill-list`. Cumulative kill log. Prevents re-litigating dead ideas every 3 months.

## Pre-flight
1. Read `docs/inception/kill-list.md` if exists. Else create.

## Inputs
- Idea slug + 1-line pitch.
- Kill reason (one of: NO_DEMAND / NO_FOUNDER_FIT / TOO_LATE / TOO_EARLY / REGULATORY_BLOCK / TECH_INFEASIBLE / OPPORTUNITY_COST / OTHER).
- Evidence (link to validation/spike/pivot doc if exists).
- Resurrect-when condition (what would make this worth revisiting?).

## Process
1. Append row to table. Newest on top.
2. If duplicate slug exists → update reason + date instead of duplicate row.

## Output
Append to `docs/inception/kill-list.md`:

```markdown
# Idea Kill List

| Date | Slug | Pitch | Reason | Evidence | Resurrect when |
|---|---|---|---|---|---|
| 2026-05-10 | acme-bot | Slack bot for X | NO_DEMAND | docs/inception/validation-acme-bot.md | LLM cost drops 10x |
| ... | ... | ... | ... | ... | ... |
```

## Verification
- Reason matches enum (no freeform).
- Evidence link valid (file exists) OR explicit "no formal eval, gut kill".
- Resurrect condition concrete (not "if things change").
