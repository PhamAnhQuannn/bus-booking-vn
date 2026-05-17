---
name: regret-minimization
description: Bezos-style 80-yr-old regret test for go/no-go on idea — cuts through analysis paralysis with one honest question. Outputs to `docs/inception/regret-<project>.md`. No class skip. Use when user says "should I do this", "regret test", "/regret-minimization", or stuck on commit.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /regret-minimization — 80-yr-old Test

Invoke as `/regret-minimization`. Bezos framework. 10 min. Use when paralyzed.

## Why you'd care

Founders who spend six months on the should-I-do-this question burn the runway they were trying to protect. Bezos's 80-year-old test cuts through the analysis paralysis in one honest question.

## Pre-flight
None.

## Inputs
- Idea + 30-sec context.
- Two scenarios to compare (usually: BUILD vs DON'T BUILD).

## Process
1. **Project to age 80** — imagine looking back. Which choice will you regret more?
2. **Cost of inaction** — what do you lose by NOT trying? (time window, learning, optionality)
3. **Cost of action** — worst-case if it fails (money, time, reputation, opportunity cost).
4. **Asymmetry check** — is downside capped (worst = lose N months)? Upside uncapped?
5. **Verdict** — REGRET-IF-DONT / REGRET-IF-DO / EITHER-OK.

## Output
Write `docs/inception/regret-<project>.md`:

```markdown
# Regret Test — <project>
**Date:** <YYYY-MM-DD> | **Verdict:** REGRET-IF-DONT / REGRET-IF-DO / EITHER-OK

## Scenario A: BUILD
- Cost: <time, money, opportunity>
- Worst case: <concrete>
- Upside: <if it works>

## Scenario B: DON'T BUILD
- Cost: <what you lose by not trying>
- Lost optionality: <window closes? skill not learned?>

## Age-80 self
<1-2 sentences — which is the bigger regret?>

## Asymmetry
- Downside capped at: <X months / $Y>
- Upside ceiling: <unbounded / $Z>

## Decision
<verdict + 1 line>
```

## Verification
- Both scenarios have concrete cost numbers.
- Asymmetry explicitly stated.
- Decision tied to age-80 self answer, not gut.
