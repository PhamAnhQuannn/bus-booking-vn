---
name: burnout-early-warning
description: Burnout early-warning system — Maslach signals, leading indicators (sleep/energy/cynicism/withdrawal), weekly self-scoring, threshold actions, recovery protocol. Outputs to `docs/inception/burnout-early-warning-<project>.md`. Use when user says "burnout", "exhaustion", "founder fatigue", "early warning", "fried", "/burnout-early-warning", or at founding / quarterly.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /burnout-early-warning — Burnout Doesn't Announce Itself. Build The Detector Before You Need It.

## Why you'd care

Founders cross into burnout months before they notice — by then a six-week recovery turns into six months and the company suffers the whole way. Leading-indicator scoring catches the slope early, when stepping back for a week still works.

Burnout ≠ "I'm tired this week". Burnout = systemic depletion across exhaustion + cynicism + reduced efficacy. Founders hit it months before they notice — by then 6-week recovery becomes 6 months. Detector first, action thresholds second, recovery protocol third.

## Pre-flight
Run at founding OR after first 90 days of full-time founding. Pairs with `/founder-journaling-cadence`, `/mental-health-plan`, `/founder-time-allocation`.

## Inputs
- Honest self-baseline on Maslach axes today.
- Sleep / energy / mood data (from journaling if active).
- Calendar load past 4 weeks.
- Personal events past 12 mo.

## Process
1. **Adopt a model** — Maslach (exhaustion / cynicism / efficacy) is canonical.
2. **List leading indicators** — sleep, energy, withdrawal, cognitive markers.
3. **Set weekly self-score** — same 8-10 items each Sunday.
4. **Set threshold actions** — green / yellow / red triggers + specific responses.
5. **Pre-commit recovery protocol** — what you do *before* you collapse.
6. **Wire feedback loop** — therapist / partner / co-founder sees scores.
7. **Schedule the review** — monthly trend + quarterly deep look.

## Output
Write `docs/inception/burnout-early-warning-<project>.md`:

```markdown
# Burnout Early-Warning System — <project>
**Founder:** <name>
**Date:** <YYYY-MM-DD>
**Reviewer:** therapist / coach / co-founder / partner
**Cadence:** weekly score + monthly trend + quarterly deep

## Why early-warning
- Burnout creeps for 3-6 months before it crashes; the crash is the slow part that became visible
- Subjective "I'm fine" is the most unreliable signal; structured scoring beats it
- Recovery from late-stage burnout = 6-12 mo. Recovery from caught-early = 2-6 weeks
- The cost of looking weekly is 3 minutes; the cost of missing it is the company

## Model: Maslach Burnout Inventory (adapted)
Three axes — burnout = elevated on all three sustained:

1. **Exhaustion** — emotional + physical depletion
2. **Cynicism / depersonalization** — detachment, negativity, distance from work + people
3. **Reduced efficacy** — feeling ineffective, low accomplishment, "what's the point"

One axis elevated for a week = noise.
Two axes elevated for 2+ weeks = yellow.
All three elevated for 2+ weeks = red.

## Weekly self-score (Sunday evening, 3 min)
Score each 0-3 (0 = never this week, 3 = nearly daily).

**Exhaustion**
1. Drained at end of the day even after a good night's sleep
2. Tired starting the day, before work begins
3. Don't want to do work I usually enjoy

**Cynicism**
4. Resentful of teammates / customers / investors
5. "What's the point" thoughts about the work
6. Withdrawing from team chat / DMs / calls

**Efficacy**
7. Doubt I'm the right person for this seat
8. Can't remember a meaningful win the past 2 weeks
9. Decisions feel impossibly hard

**Health floors**
10. Sleep < 7 hr 3+ nights this week (0 = no, 3 = every night)
11. No exercise this week (0 = exercised 3x+, 3 = zero)
12. No non-work social contact this week (0 = had several, 3 = none)

**Total:** sum 0-36

| Total | Zone | Action |
|-------|------|--------|
| 0-8 | Green | Continue, log it |
| 9-16 | Yellow | Cut 1 commitment this week, talk to therapist/peer |
| 17-24 | Orange | Cut 30% of week, call therapist, talk to co-founder/partner |
| 25-36 | Red | Stop now. Recovery protocol. Tell tier-3 person today. |

Also: any single 0-3 hit of "3" on items 1, 5, 7, 10 for 3+ consecutive weeks = elevate one zone regardless of total.

## Leading indicators (the canary signals)
Watch for these even when score is green — they predict yellow weeks ahead.

**Sleep:**
- < 6 hr for 4+ nights in 2 wks
- Sleep latency > 30 min consistently
- Waking 3am+ with work thoughts
- Weekend sleep "catching up" (debt accumulating)

**Energy:**
- Need 3+ coffees to function
- Crash at 2-3pm daily
- Cannot focus > 30 min on deep work
- Reading = 3 lines and lost

**Cognitive:**
- Can't remember what you did yesterday
- Decisions paralysis on small things
- Re-reading the same paragraph 4 times
- Forgetting commitments / appointments

**Behavioral:**
- Skipping meals or eating only junk
- Cancelling exercise repeatedly
- Avoiding co-founder / spouse conversations
- Phone-doomscrolling at night
- Drinking daily

**Emotional:**
- Crying easily / rage easily / numb
- Withdrawing from team Slack
- Cancelling 1:1s
- "I just need to push through this week" → 4+ weeks in a row

**Physical:**
- Recurring colds / illness / GI issues
- Tension headaches daily
- Tight shoulders / jaw clenching
- Weight ± 5 kg unintentional in 3 mo

## Threshold actions

### Green (0-8) — Maintain
- Continue weekly score
- Hold all floors (see `/mental-health-plan`)
- Hold the line on commitments

### Yellow (9-16) — Course-correct this week
- Cut 1 commitment / meeting / project
- Schedule therapist within 7 days
- 1 day completely off (no Slack, no email)
- Talk to co-founder / partner about it
- Re-read journal: what triggered the rise?

### Orange (17-24) — Aggressive intervention
- Cut 30% of week's commitments
- Therapist within 48 hr
- Tell co-founder + partner — they need to know
- 3-day micro-break this month
- Reduce alcohol / caffeine
- Sleep priority: 8 hr/night for 1 wk
- Identify the 1 thing that *most* needs to stop

### Red (25-36) — Stop
- Cancel non-critical meetings this week
- Therapist same-day or next-day
- Tell tier-3 person today
- If thoughts of self-harm: see `/mental-health-plan` crisis playbook
- 1-2 week pause (vacation / leave / sabbatical)
- Consider: co-founder runs the co for 2 weeks
- Bloodwork (rule out thyroid / Vit D / hormones)
- After stabilization: structural change, not just rest

## Recovery protocol (pre-committed, written now)
Decide *now* what 1-2 weeks of recovery looks like, so you're not deciding under burnout-impaired judgment.

**Week 1 recovery:**
- Out of office, full pause
- Co-founder + 1 senior teammate own incident response (if any)
- Phone off Slack / email
- 9 hr sleep nightly target
- 30 min movement daily (walk, swim, yoga — not intense)
- 1 hr outside daily
- 1 person check-in daily (partner / therapist / friend)
- No alcohol
- No major decisions

**Week 2 recovery:**
- Same baseline
- Add: 1 hr "process work" with therapist mid-week
- Begin to look at what *structurally* needs to change
- Draft "what comes back when I return" list

**Re-entry:**
- 1-week ramp at 50% capacity
- New floor: at least 1 of the things that broke me is removed
- Weekly score continues at higher attention

**Pre-decided owner during recovery:** <name + contact>
**Pre-decided clients/investors to notify:** <list + template>

## Structural causes — what to look for after a yellow-orange-red
- Pace too high to sustain (cut scope)
- Wrong seat (founder doing IC work / vice versa — see `/founder-time-allocation`)
- Isolation (no peer group, see `/mental-health-plan`)
- Money stress (see `/personal-runway-check`)
- Co-founder friction (unresolved conflict)
- Customer / investor relationship draining
- Identity over-fusion with the co
- Health condition undiagnosed

Recovery without structural change = burnout returns in 4-8 weeks.

## Sharing scores
- **Therapist:** sees full score weekly
- **Partner / spouse:** sees zone + trend
- **Co-founder:** sees zone only (preserves agency)
- **Investors / team:** never the score, but yellow-orange-red affects communication

Build trust pre-burnout that disclosure is safe. Hiding the score is the most common failure mode.

## Anti-patterns
- ❌ Self-scoring then ignoring trends
- ❌ "I'll start tracking when things calm down" — won't
- ❌ Hiding orange/red from partner/co-founder/therapist
- ❌ Push-through culture as identity ("I always work like this")
- ❌ "Just need this quarter" → 4 quarters running
- ❌ Treating yellow as green to avoid the action
- ❌ Recovery without structural change
- ❌ Skipping medical (thyroid / vit D / sleep apnea masquerade as burnout)
- ❌ Solo recovery without therapist
- ❌ Comparison to others ("they work harder" → others may be silently burning too)

## Monthly trend pass (15 min)
- Plot 4 weekly scores
- Trend up / flat / down?
- Highest single item across 4 wks?
- Leading indicators present?
- Action: hold / adjust / escalate

## Quarterly deep look (60 min, with therapist if possible)
- 12-week trend
- Structural causes still present?
- Any zone breach unaddressed?
- Recovery protocol still feasible (right backup person, right reserve cash)?
- Update this doc

## Pitfalls flagged
- [ ] Model adopted (Maslach 3-axis)
- [ ] Weekly score defined + scheduled
- [ ] Threshold actions explicit
- [ ] Recovery protocol pre-committed
- [ ] Backup person named
- [ ] Reviewer (therapist/partner/co-founder) wired in
- [ ] Monthly + quarterly review scheduled

## Anti-patterns flagged
- ❌ Score collected, never reviewed
- ❌ No threshold actions
- ❌ No recovery protocol
- ❌ Solo scoring, no second eyes
- ❌ Push-through as virtue
- ❌ Hiding scores from those who could help

## Next
- Mental health plan → `/mental-health-plan`
- Journaling cadence → `/founder-journaling-cadence`
- Personal runway → `/personal-runway-check`
- Vacation policy → `/vacation-policy-pre`
```

## Verification
- Maslach 3-axis model named.
- Weekly score sheet defined + scheduled.
- Threshold zones + actions explicit.
- Recovery protocol pre-committed.
- Backup person named.
- Reviewer wired in.
- Monthly + quarterly review scheduled.
