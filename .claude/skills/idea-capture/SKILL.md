---
name: idea-capture
description: Structured 1-pager for raw idea before any validation work — forces problem/customer/why-now/unfair-advantage in 5 min. Outputs to `docs/inception/idea-<slug>.md`. No project-classify gate (runs pre-classify). Use when user says "new idea", "capture this", "/idea-capture", or before `/project-classify`.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /idea-capture — Raw Idea 1-Pager

## Why you'd care

Raw ideas decay within hours and most are never re-evaluated because nothing forced them onto paper. The 5-minute capture preserves the spark and surfaces the obvious holes before any validation spend.

Invoke as `/idea-capture`. Pre-classification idea snapshot. 5 min max. Forces shape on a vibe.

## Pre-flight
None. Runs before `/project-classify`. If `docs/inception/idea-<slug>.md` already exists → load + offer update.

## Inputs
- Idea name (slug-able).
- 1-line pitch.

## Process
1. **One-sentence pitch** — "Tool/service for X that does Y so Z."
2. **Problem** — 2 sentences. What hurts? Who hurts?
3. **Customer** — segment + persona (rough OK).
4. **Why now** — what changed (tech, regulation, behavior) that opens window?
5. **Unfair advantage** — what do you uniquely have (skill, network, data, time)?
6. **Smallest version** — what could ship in 1 week?
7. **Kill switch** — what evidence in 30 days = abandon?

## Output
Write `docs/inception/idea-<slug>.md`:

```markdown
# Idea — <name>
**Date:** <YYYY-MM-DD> | **Status:** RAW

## Pitch
<one sentence>

## Problem
<2 sentences>

## Customer
<segment + persona>

## Why now
<1-2 sentences on the window>

## Unfair advantage
<your edge>

## Smallest version
<1-week shippable slice>

## 30-day kill switch
<evidence threshold>

## Next
- Run `/project-classify` to size
- Then `/problem-validation` to evidence
```

## Verification
- Each section filled (no blanks).
- Pitch is one sentence (not paragraph).
- Kill switch is concrete (number/date), not vibes.
