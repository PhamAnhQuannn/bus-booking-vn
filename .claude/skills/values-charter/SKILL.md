---
name: values-charter
description: Values charter — 4-6 operating values, behaviors per value, anti-patterns, how-we-decide rubric. Outputs to `docs/inception/values-charter-<project>.md`. Use when user says "values", "company values", "operating principles", "first principles", "/values-charter", or before first hire / before scaling team past 5.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /values-charter — Values You Don't Enforce Are Decoration. Pick 4. Hire And Fire By Them.

Values ≠ poster on the wall. Values = the tiebreaker in hard decisions. If you wouldn't fire someone for violating it, it's not a value, it's a preference.

## Why you'd care

Values that emerge organically end up as whatever the founders accidentally rewarded — which is usually overwork and ego. A written charter with behaviors and anti-patterns is what makes culture a designed object instead of a residue.

## Pre-flight
Run before first hire OR when team hits 5. Pairs with `/code-of-conduct`, `/founding-story-narrative`.

## Inputs
- Founder beliefs about how work should happen.
- Examples of behavior you celebrated + behavior you regretted.
- Industry norms (what's table stakes vs differentiating).

## Process
1. **List behaviors you celebrate** (what made you proud).
2. **List behaviors that hurt you** (what should've been called out earlier).
3. **Cluster into 4-6 themes.**
4. **Name each value** — short, memorable, ownable.
5. **Define behaviors that demonstrate it** (3-5 per value).
6. **Define anti-patterns** (what violates it).
7. **Test against the fire test** — would you fire someone for violating it?

## Output
Write `docs/inception/values-charter-<project>.md`:

```markdown
# Values Charter — <project>
**Version:** 1.0
**Date:** <YYYY-MM-DD>
**Number of values:** 4-6

## Why values
- Tiebreaker in ambiguous decisions
- Hiring filter (interview signal)
- Performance signal (review criteria)
- Firing criterion (sustained violation = exit)

If we wouldn't use it to hire / fire / decide, we don't call it a value.

## How we picked these
1. Listed behaviors we celebrated (looked at wins)
2. Listed behaviors we regretted not calling out (looked at scars)
3. Clustered into themes
4. Cut anything that's table stakes (e.g. "be honest" — assumed)
5. Cut anything aspirational without proof we live it

## The values (4-6 max)

### 1. <Value name> (e.g. "Ship the truth")
**What it means:** <1-2 sentences>

**Behaviors that demonstrate this:**
- <behavior 1>
- <behavior 2>
- <behavior 3>

**Anti-patterns (we'd call this out):**
- ❌ <behavior>
- ❌ <behavior>

**Example we're proud of:**
- <real story when someone lived this>

**Hiring signal:**
- <interview question / scenario that tests for it>

---

### 2. <Value name>
[same template]

### 3-6. <Value name>
[same template]

## Fire test (for each value)
| Value | Would we fire for sustained violation? |
|-------|---------------------------------------|
| <V1> | Yes / No |
| <V2> | Yes / No |

If No → not a value, demote to preference.

## How values are used

**Hiring:**
- Each value mapped to 1+ interview question
- "Values interview" = 30-min round
- Hire = 4/5 yes on values + skills bar met
- Veto = 1 value violation in interview process

**Onboarding:**
- Week 1: read values doc + Q&A with founder
- Week 4: write self-reflection on each value
- 90-day review includes values alignment

**Reviews:**
- Each value has 1-5 rating
- Average < 3 → improvement plan
- Sustained < 3 → exit

**Decisions:**
- When 2 options tie on logic, pick the one most aligned with a value
- If a decision violates a value, name it and decide consciously

**Firing:**
- Skill issue → improvement plan
- Values issue → faster exit ramp
- Cultural toxicity (even with skills) → exit regardless

## Anti-patterns in values themselves
- ❌ Generic ("integrity", "excellence", "teamwork") — table stakes
- ❌ Aspirational without proof ("we're transparent" while founder hides cap table)
- ❌ Too many (>7) — none remembered
- ❌ Too cute (puns nobody can apply)
- ❌ Industry copy-paste (Amazon's 16 LPs, Netflix's keeper test) — borrow ideas, not text
- ❌ Founder solo-authored, team never bought in
- ❌ Never referenced after launch

## Examples (curated, adapt — don't copy)
| Co | Sample value | Why it works |
|----|--------------|--------------|
| Netflix | "Highly aligned, loosely coupled" | Specific behavior, testable |
| Amazon | "Disagree and commit" | Resolves ambiguity in disagreement |
| Stripe | "Move with urgency and focus" | Anti-pattern obvious |
| Linear | "Quality is non-negotiable" | Backed by no-bug-backlog |
| Basecamp | "It's not Detroit" | Memorable, anti-burnout |
| Coinbase | "Mission first" | Filter for non-believers |

## Living the values (the hard part)

**At founding (team ≤ 5):**
- Founder lives it visibly daily
- Stories told weekly in team standup
- Anti-patterns named when they happen

**Scaling (team 5-25):**
- Onboarding teaches values
- Reviews score on values
- Hiring trained on values interviews
- Leaders model it (founder doesn't carry alone)

**Scaling (25+):**
- Values team / culture lead
- Annual values survey (anonymous)
- Values reinforced in all-hands stories
- Acquihires evaluated for cultural fit too

## Annual values review
Year-end:
- Were values referenced in actual decisions? (count)
- Did we hire/fire by them? (list cases)
- Are any unused? → cut
- Are we missing one we needed? → add
- Does the team remember them? → survey

If a value isn't load-bearing after 12 months → cut.

## Values vs Code of Conduct
| | Values | Code of Conduct |
|---|--------|----------------|
| What | Aspirational behavior | Minimum behavior |
| Frequency | Daily | Rare (incident only) |
| Enforcement | Reviews, hiring | Investigation, ladder |
| Example | "Ship the truth" | "No harassment" |

Both required. Different purposes.

## Pitfalls flagged
- [ ] 4-6 values, not 7+
- [ ] Each value has behaviors + anti-patterns
- [ ] Fire test passed for each
- [ ] Hiring signal mapped per value
- [ ] Reviews include values rating
- [ ] Real examples cited
- [ ] Annual review scheduled

## Anti-patterns
- ❌ Values on wall, ignored in practice
- ❌ Founder copy-paste from another co
- ❌ 10+ values
- ❌ All aspirational, none lived
- ❌ Founder never references in decisions
- ❌ Hiring loop ignores values
- ❌ Values change every 6 months

## Next
- Code of conduct → `/code-of-conduct`
- Founding story → `/founding-story-narrative`
- Employee handbook → `/employee-handbook-skeleton`
```

## Verification
- 4-6 values stated.
- Behaviors + anti-patterns per value.
- Fire test applied.
- Hiring signal mapped.
- Review integration.
- Annual review scheduled.
