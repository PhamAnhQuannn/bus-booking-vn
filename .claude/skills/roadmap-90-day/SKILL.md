---
name: roadmap-90-day
description: 90-day execution roadmap from inception → first launch milestone. Bands work into 30/60/90 with explicit go/no-go gates per band. Outputs to `docs/inception/roadmap-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "90 day plan", "roadmap", "first quarter plan", "/roadmap-90-day", or after `/inception-gate-review` returns PROCEED.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /roadmap-90-day — 30/60/90

Invoke as `/roadmap-90-day`. Forces banded plan with gates, not Gantt fantasy.

## Why you'd care

Inception that doesn't band into 30/60/90 with go/no-go gates becomes a vibes-driven backlog. The roadmap is what converts "we're working on it" into a defensible "here's our next checkpoint."

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/time-to-revenue-<project>.md` if exists — pull honest TTR.
3. Read `docs/inception/north-star-metric-<project>.md` if exists.
4. Read `docs/inception/kill-criteria-<project>.md` if exists.

## Inputs
- Target launch date (or "TBD per honest TTR").
- Top 3 outcomes (not features) for the 90-day window.

## Process
1. **30-day band** — what proves the riskiest assumption? Single outcome.
2. **60-day band** — what gets to first usable end-to-end slice?
3. **90-day band** — what enables first paid customer (or NSM trigger)?
4. **Per-band gate** — go/no-go check at end of each band; tied to NSM and kill-criteria.
5. **Buffer** — last 10 days of each band reserved for unknowns.

## Output
Write `docs/inception/roadmap-<project>.md`:

```markdown
# 90-Day Roadmap — <project>
**Date:** <YYYY-MM-DD> | **Target launch:** <date>

## Day 0–30 — Prove riskiest assumption
**Outcome:** <single outcome>
**Build:**
- ...
**Gate (day 30):**
- [ ] <evidence threshold>
- [ ] NSM leading indicator: <X>
- → PROCEED to band 60 / DEFER 14 days / KILL

## Day 31–60 — First end-to-end slice
**Outcome:** <single outcome>
**Build:**
- ...
**Gate (day 60):**
- [ ] <demo-able end-to-end>
- [ ] No kill-criteria triggered
- → PROCEED / DEFER / KILL

## Day 61–90 — First paid customer / NSM trigger
**Outcome:** <single outcome>
**Build:**
- ...
**Gate (day 90):**
- [ ] First $X revenue OR <NSM threshold>
- → PROCEED to scale band / PIVOT / KILL

## Buffer policy
Last 10 days of each band = no new scope. Bug-fix + carry-over only.
```

## Verification
- Each band has 1 outcome (not 5).
- Each band has explicit gate with measurable check.
- Total scope ≤ honest TTR × class buffer.
