---
name: vacation-policy-pre
description: Pre-launch vacation policy — minimum-take floor (not unlimited), founder modeling, cover protocol, sabbatical scaffolding, parental + national leave baseline. Outputs to `docs/inception/vacation-policy-pre-<project>.md`. Use when user says "vacation policy", "PTO", "time off", "unlimited PTO", "sabbatical", "parental leave", "/vacation-policy-pre", or before first hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /vacation-policy-pre — Unlimited PTO Means Zero PTO. Set The Floor Before You Hire.

PTO policy ≠ HR boilerplate. PTO policy = signal to every future hire about whether rest is real. Unlimited PTO empirically reduces time off taken. Founders model it or they break it. Decide before hire #1, not after the burnout post-mortem.

## Why you'd care

Unlimited PTO statistically takes less time off than a 4-week minimum. A pre-launch policy with a floor and a founder-modeled cadence is what prevents the burnout-by-default culture from establishing itself before hire one.

## Pre-flight
Run before first hire OR before founder takes (or fails to take) first real vacation. Pairs with `/burnout-early-warning`, `/mental-health-plan`, `/employee-handbook-skeleton`.

## Inputs
- Jurisdiction (US has near-zero statutory minimums, EU has 20+ statutory days, UK 28).
- Industry norms (eng vs sales vs services).
- Founder vacation history past 2 yr (honest).
- Co-founder + early team expectations.

## Process
1. **Pick model** — minimum-take floor (not unlimited), tracked accrual, or hybrid.
2. **Set floors + ceilings** — statutory + minimum-take + carryover rules.
3. **Cover protocol** — who covers founder / each role during leave.
4. **Founder vacation contract** — actual disconnection, real cover, modeled visibly.
5. **Sabbatical scaffolding** — eligibility tier even if first one is years away.
6. **Parental + medical + bereavement** — baseline humane policies.
7. **Holidays** — national + flex holidays + religious accommodation.
8. **Document + publish before hire #1.**

## Output
Write `docs/inception/vacation-policy-pre-<project>.md`:

```markdown
# Vacation Policy (Pre-launch) — <project>
**Owner:** founder / Head of People
**Date:** <YYYY-MM-DD>
**Version:** 1.0
**Jurisdiction(s):** <US-CA / UK / EU-DE / remote-global etc>

## Why this exists pre-hire
- Default culture is "always-on" unless explicitly designed otherwise
- "Unlimited PTO" empirically reduces days taken (research: ~13 days vs ~17 days under tracked accrual)
- Vacation policy is the most-quoted line in offer letters — get it right
- Founder modeling = the policy. Written words don't matter if founder works through every break
- Burnout costs the co orders of magnitude more than 4 weeks off

## Model pick

| Model | Pros | Cons | Pick if |
|-------|------|------|---------|
| **Unlimited / "flexible"** | Sounds great in recruiting | People take less, asymmetric usage, manager bias | Mature culture with strong manager modeling. **Risky for early-stage.** |
| **Tracked accrual** | Clear, fair, accruable on exit | Admin overhead | Default. Simple. Predictable. |
| **Minimum-take with cap** | Best of both — floor enforced, no over-accrual | Slightly novel, needs explaining | **Recommended for early-stage.** |

**Our pick:** Minimum-take with cap.

## Policy terms

### Annual leave
- **Annual entitlement:** 25 days/year (4 weeks + 5)
- **Minimum-take floor:** 15 days/year required. Manager flags if employee tracking < 10 by Q3.
- **Carryover:** Up to 5 days into next year; expires Q1.
- **Accrual:** Pro-rated monthly from start date.
- **Payout on exit:** Accrued unused days paid at exit (where law requires) or per jurisdiction.

### Public / national holidays
- Country-default holidays observed (US: 11 federal; UK: 8 bank holidays; etc.)
- 3 "flex holidays" — employee picks (religious / cultural / personal — Eid, Diwali, Yom Kippur, Lunar New Year, etc.)
- Holiday on a weekend → next working day off

### Sick leave
- 10 days/year, no doctor's note for first 3 consecutive
- Beyond 10 → short-term disability / unpaid + medical conversation
- Mental health = sick days (same policy, no stigma)

### Parental leave
- Birth parent: 16 weeks paid (or jurisdiction floor if higher)
- Non-birth / adoptive parent: 12 weeks paid
- Phased re-entry: 50% schedule for 2 weeks on return
- Pumping accommodation + space
- Note: pre-Series A may not be financially feasible at full pay — write the target now, fund when you can. Don't promise what you can't fund.

### Bereavement leave
- 5 days paid for immediate family
- 2 days paid for extended family / close friend
- Manager discretion to extend

### Compassionate / personal leave
- 5 days/year for personal emergency / caregiver duties
- Unpaid extension available with notice

### Jury duty / civic duty
- Paid in full
- Voting day: half-day off if no early voting available

### Sabbatical (scaffolded now, first eligible ~yr 4)
- 1 month paid sabbatical after 4 years tenure
- 1 additional month every 4 years thereafter
- Min 4 weeks notice, max 2 people on sabbatical at once
- Sabbatical = no Slack, no email, full cover

## Cover protocol
- Every role has a named backup (see `/raci-chart`)
- Backup briefed 1 week before leave
- Out-of-office message + Slack status set
- No Slack DMs to person on leave
- "Break-glass" contact for true emergency only (defined narrowly)

**Founder cover:**
- Co-founder primary
- 1 senior teammate secondary
- Pre-written contact list for customers / investors during founder leave

## Founder vacation contract
This is the part that decides whether the policy is real.

**Founder commits to:**
- 1+ full week off per quarter (no laptop, no Slack)
- 1+ 2-week vacation per year (real disconnect)
- Annual sabbatical-equivalent (1 mo every 4 yr, even pre-eligible)
- Public visibility — vacation appears on shared calendar, team sees founder absent
- Real cover — co-founder runs the co; founder does not "check in"

**Founder anti-patterns:**
- ❌ "Working remotely from beach" = not vacation
- ❌ "Just checking Slack once a day" = not vacation
- ❌ Cancelling vacation last-minute "things are hectic"
- ❌ Taking 1-day breaks only, never multi-day

If founder breaks the contract: co-founder calls it out. Written rule.

## Working hours norms (separate from PTO but related)
- No emails / Slack expected outside 9-6 local hours (DMs OK, response not)
- Weekends = no expectation
- Calls scheduled within reasonable hours of all attendees
- Async-first by default (see `/async-comms-charter`)

## Time-zone fairness
- Global team: meetings rotate inconvenient hours
- No "8 am for one team / 8 pm for another" permanent pattern
- Holidays: each person's country holidays respected

## Special situations

### Religious accommodation
- Reasonable accommodation per law
- Flex holidays cover most cases
- Prayer / fasting accommodation by manager discretion

### Disability accommodation
- Per ADA / Equality Act / local law
- Confidential conversation with People lead

### Caregiving emergencies
- 5 days personal leave + flexibility on remaining schedule
- No questions for first 5 days

### Major life events
- Wedding: 1 week paid
- Moving (relocation for co): 3 days paid
- Election week (in own country): half-day off voting day

## How requests work
- Request via HR tool 2 wk in advance for >3 days
- Manager + 1 stakeholder approval for >5 days
- Founder approval for >2 wk consecutive (just visibility, not gatekeeping)
- No approval needed for < 3 days
- Sick leave: same-day notification by message

## What manager does
- Tracks minimum-take floor for each report
- Flags Q3 if a report < 10 days taken
- Visibly takes their own PTO
- Doesn't DM people on leave
- Re-entry conversation week 1 back

## What founder does
- Models it. The only thing that matters.
- Visibly absent during own PTO
- Doesn't reward "always-on" behavior in performance reviews
- Calls out anti-patterns when seen

## Compliance basics
- Track accrual in HR tool from day 1
- Maintain records 4+ years (jurisdiction-specific)
- Pay accrued unused PTO at exit (where required by law)
- Holiday + sick + parental comply with local law (jurisdiction varies hugely)
- Engage employment lawyer for multi-jurisdiction setups

## Anti-patterns
- ❌ "Unlimited PTO" with no minimum-take = people take less
- ❌ Policy on paper, founder works through every break
- ❌ Manager DMs report on vacation
- ❌ Slack notifications on personal phone during leave (delete app or mute)
- ❌ Cancelling team PTO "because deadlines"
- ❌ No real cover → person on leave still firefights
- ❌ Parental leave promised but not funded
- ❌ Religious / cultural holidays unrecognized
- ❌ Approval theater for short days
- ❌ Always-on hero culture rewarded in perf reviews

## Pre-launch checklist
- [ ] Model picked (minimum-take with cap)
- [ ] Annual entitlement + floor + carryover defined
- [ ] Sick + parental + bereavement + personal leave baselines
- [ ] Sabbatical scaffolded
- [ ] Holidays + flex holidays defined
- [ ] Cover protocol named (with `/raci-chart`)
- [ ] Founder vacation contract written + visible
- [ ] Compliance reviewed for jurisdiction(s)
- [ ] Policy published before hire #1

## Anti-patterns flagged
- ❌ Unlimited PTO without floor
- ❌ Founder exempt from modeling
- ❌ No cover protocol → person on leave keeps working
- ❌ Parental leave promised but unfunded
- ❌ Manager DMs people on leave
- ❌ Vacation pay-out on exit ignored (legal risk)
- ❌ No jurisdiction review (multi-region landmines)

## Annual review
- Average days taken per person — trending up or down?
- Minimum-take floor breached by anyone?
- Founder broke their own contract?
- Update parental leave funding as co matures
- Sabbatical first eligible — anyone hitting tenure?
- Adjust for new jurisdictions

## Next
- Burnout monitoring → `/burnout-early-warning`
- Mental health plan → `/mental-health-plan`
- Employee handbook → `/employee-handbook-skeleton`
- On-call philosophy → `/on-call-philosophy-pre`
```

## Verification
- Model picked (minimum-take with cap or alternative justified).
- Annual + sick + parental + bereavement + sabbatical defined.
- Holidays + flex + religious accommodation.
- Cover protocol named.
- Founder vacation contract written + visible.
- Jurisdiction compliance reviewed.
- Pre-hire-#1 publish.
