---
name: founder-fit
description: Honest assessment of founder/idea fit on motivation, skill, network, time-horizon — kills bad pairings before sunk cost. Outputs to `docs/inception/founder-fit-<project>.md`. No class skip (runs all classes incl. XS). Use when user says "should I be the one", "founder fit", "/founder-fit", or before `/problem-validation` heavy spend.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /founder-fit — Why You, Why Now

## Why you'd care

The honest pre-mortem on whether you're the right person for this idea is cheaper now than 18 months in, when you realize the network or the persistence ceiling was never there. Most founder regret traces back to skipping this check.

Invoke as `/founder-fit`. Anti-mismatch skill. Solo-dev edition: no co-founder politics, just you-vs-idea.

## Pre-flight
None — runs all classes. Even XS gets a 60-sec version.

## Inputs
- Idea slug (links to `docs/inception/idea-<slug>.md` if exists).
- Honest answers — no performing.

## Process
Score 0–4 per dimension. Total / 20.

| Dim | 0 | 2 | 4 |
|---|---|---|---|
| **Motivation** | wouldn't miss it if killed | mild interest | obsessed, think about daily |
| **Skill match** | need to learn 3+ new domains | need to learn 1 | already deep in stack |
| **Network access** | zero target customers in network | a few | 10+ target users I can call today |
| **Time horizon** | <3 mo before bored | 6–12 mo | 3+ yr willing |
| **Pain ownership** | imagine the pain | occasional pain | daily pain w/ workaround |

| Score | Verdict |
|---|---|
| 0–6 | **WALK** — wrong founder, find a different idea |
| 7–12 | **CAUTION** — fix weakest dim before commit |
| 13–16 | **GO** — proceed with eyes open on weak dims |
| 17–20 | **STRONG GO** — rare alignment |

## Output
Write `docs/inception/founder-fit-<project>.md`:

```markdown
# Founder Fit — <project>
**Date:** <YYYY-MM-DD> | **Verdict:** WALK / CAUTION / GO / STRONG GO | **Score:** X/20

| Dimension | Score (0-4) | Note |
|---|---:|---|
| Motivation | X | ... |
| Skill match | X | ... |
| Network access | X | ... |
| Time horizon | X | ... |
| Pain ownership | X | ... |
| **Total** | **X/20** | |

## Weakest dim
<which + plan to address or accept>

## Honest gut
<1 sentence — would you bet a year on this?>

## Decision
<WALK / CAUTION / GO / STRONG GO + 1-line why>
```

## Verification
- All 5 dims scored (no blanks).
- Weakest dim has explicit plan or acceptance.
- Verdict matches numeric score.
