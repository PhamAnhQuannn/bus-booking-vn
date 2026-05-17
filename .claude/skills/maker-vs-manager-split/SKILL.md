---
name: maker-vs-manager-split
description: Maker vs manager schedule split — preserve 4-hour deep-work blocks for builders, batch all meetings into manager days. Outputs to `docs/inception/maker-vs-manager-split-<project>.md`. Use when user says "maker vs manager", "maker schedule", "meeting day", "deep work protection", "Paul Graham", "/maker-vs-manager-split", or after first hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /maker-vs-manager-split — One Meeting Mid-Morning Kills The Whole Day. Stop Doing That.

## Why you'd care

Mixed maker/manager days produce two-hour blocks that aren't enough for deep work and ten-minute gaps that aren't long enough for meetings — the whole week shreds. Batching by day reclaims the deep-work hours that ship the product.

Maker work needs 3-4 hr unbroken blocks. Manager work fits 30-min slots. Mixing the two = no deep work happens. Pick which mode each day is in, before the calendar fills up.

## Pre-flight
Run after first hire OR when founder feels "busy but nothing built". Pairs with `/founder-time-allocation`, `/weekly-operating-rhythm`.

## Inputs
- Role mix on team (engineers / sales / ops).
- Calendar export (last 4 weeks).
- Self-assessment: which mode are you in 80% of the time?

## Process
1. **Tag each person maker / manager / hybrid.**
2. **Pick maker days vs manager days** (or maker AM / manager PM).
3. **Lock no-meeting hours** on calendar (default 9 AM - 1 PM).
4. **Move all 1:1s, reviews, syncs** to manager day or PM.
5. **Founder hybrid rule:** 2 days maker-pure, 2 days manager-pure, 1 mixed.
6. **Enforce 25/50 min meetings** (never 30/60).
7. **Use Loom + async** to replace 50% of sync time.

## Output
Write `docs/inception/maker-vs-manager-split-<project>.md`:

```markdown
# Maker vs Manager Split — <project>

## The principle (Paul Graham, 2009)
- **Maker schedule:** half-day or full-day blocks. One meeting cuts the day in two; neither half is enough to do hard work.
- **Manager schedule:** day in 30-min slots. Schedule changes hour by hour; each slot has fresh task.
- Cost of a meeting on a maker = entire day, not 30 min.

## Role tagging
| Role | Mode | Why |
|------|------|-----|
| Founder (pre-hire) | Maker 70% / Mgr 30% | Build dominates |
| Founder (post-1st-hire) | Mgr 60% / Maker 40% | Coordination cost rises |
| Founder (CEO mode, $1M+ ARR) | Mgr 80% / Maker 20% | Selling > building |
| Engineer | Maker 80% / Mgr 20% | Output = code shipped |
| Designer | Maker 70% / Mgr 30% | Output = artifacts |
| Sales | Mgr 80% / Maker 20% | Output = calls + pipeline |
| Customer success | Mgr 70% / Maker 30% | Output = responses |
| Founder ops / chief of staff | Mgr 90% / Maker 10% | Coordination is the job |

## Day-pattern templates

### Template A: maker days + manager days (best for engineers)
- **Mon, Tue, Thu:** maker days — zero meetings before 3 PM
- **Wed, Fri:** manager days — meetings allowed all day

### Template B: maker AM + manager PM (best for solo founder)
- **Every day:** 8 AM - 12 PM maker block, 1 PM - 5 PM open for meetings
- **Friday PM:** weekly review + plan

### Template C: focus week (best for build sprints)
- **Sprint week:** Mon-Fri all maker, only emergency meetings
- **Recovery week (next):** catchup on async, customer calls, meetings allowed
- Alternate 2-week sprint / 1-week ops

## No-meeting hours
| Day | Block | Owner |
|-----|-------|-------|
| Mon | 8 AM - 12 PM | Everyone |
| Tue | 8 AM - 12 PM | Everyone |
| Wed | 8 AM - 10 AM | Everyone |
| Thu | 8 AM - 12 PM | Everyone |
| Fri | 8 AM - 11 AM | Everyone |

Calendar-block these. Decline overlapping invites.

## Meeting consolidation rules
- All 1:1s on one day (e.g. Wednesdays)
- All customer calls in afternoon blocks
- All vendor calls Tuesdays 2-4 PM
- All interviews Thursdays
- All investor updates first Friday of month

## 25/50 minute meetings
- Default 25 min, not 30 (5 min for break / next-meeting)
- Default 50 min, not 60
- 90-min meetings → split into 2 × 50 min on different days

## Async-first defaults
| Activity | Sync OK? | Async preferred |
|----------|----------|----------------|
| Status updates | ❌ | Loom / Notion |
| Decision with pre-read | ❌ | Pre-read async, sync only if no consensus |
| Brainstorm | ✅ | sync required |
| Conflict / hard convo | ✅ | sync required |
| Code review | ❌ | PR comments |
| Design review | ⚠️ | async pre-read + 25-min sync |
| Customer call | ✅ | sync |
| Standup | ❌ | async Slack |
| All-hands | ✅ | sync (record for absent) |

## Meeting kill criteria
Kill any recurring meeting if:
- No agenda by start time
- Last 3 meetings produced no decisions
- Same group + same topic appears in another meeting
- Could be 5-line Loom + comments
- One person talks 80% of the time → 1:1 not meeting
- Attendance below 70%

## Founder-specific rules
- **No meetings before 11 AM** on maker days
- **Batch context-switches** — 4 customer calls back-to-back beats 1 per day
- **Calendar audit weekly** — delete 1 recurring meeting / week first month
- **Default "no" to new recurring meetings** — propose async first

## When you must meet a maker (as manager)
- Schedule at start or end of day, never middle
- Send agenda 24 hr ahead
- Make it 25 min, ask if 10 will do
- Prefer Slack DM > meeting

## Signs you're mixing modes badly
- Calendar looks fine but nothing ships
- Inbox / Slack always open during "build" time
- Engineers say "I have no time" but ship 1 PR/week
- Every meeting starts late + ends late
- You leave the office tired but with no artifact

## Tools that help
| Tool | What |
|------|------|
| Calendly + manager-day filter | Bookers only see manager-day slots |
| Reclaim.ai | Auto-blocks deep work + defends |
| Clockwise | Consolidates fragmented blocks |
| Slack DND schedule | Auto on during deep work |
| Notion / Linear | Async-first decision logs |
| Loom | Replaces 50% of status meetings |

## Pitfalls flagged
- [ ] Roles tagged maker / manager
- [ ] No-meeting hours on calendar
- [ ] Meetings batched to specific days
- [ ] 25/50 min defaults set
- [ ] Async-first defaults agreed
- [ ] Calendar audit on weekly review
- [ ] Founder day-pattern picked

## Anti-patterns
- ❌ 30-min meeting mid-morning on a maker day
- ❌ "Quick syncs" with no agenda
- ❌ Sales person trying to keep maker calendar
- ❌ Recurring meetings nobody cancels
- ❌ Letting engineers be on Slack all day
- ❌ Stand-ups longer than 10 min
- ❌ Founder defaulting to "yes" on every meeting request

## Next
- Time allocation → `/founder-time-allocation`
- Weekly rhythm → `/weekly-operating-rhythm`
- Async charter → `/async-comms-charter`
```

## Verification
- Role tagging table.
- Day-pattern picked.
- No-meeting hours blocked.
- Meeting batching rules.
- Async-first defaults.
- Founder rule defined.
