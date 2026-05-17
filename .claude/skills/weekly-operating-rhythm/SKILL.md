---
name: weekly-operating-rhythm
description: Weekly operating rhythm — Monday plan, daily check-in, Friday review, monthly retro, quarterly OKRs. Outputs to `docs/inception/weekly-operating-rhythm-<project>.md`. Use when user says "weekly rhythm", "operating cadence", "weekly review", "OKR cadence", "standup cadence", "/weekly-operating-rhythm", or first 90 days.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /weekly-operating-rhythm — No Rhythm = Drift. Same Day, Same Time, Same Questions.

Founder rhythm = forcing function. Without it, urgent crowds out important and the week vanishes. With it, every week ends with a written delta.

## Why you'd care

Without a planned rhythm, the week dissolves into reactive interrupts and the quarterly OKR is news to half the team. A repeating cadence is what makes execution predictable across people and time zones.

## Pre-flight
Run in first 30 days. Pairs with `/founder-time-allocation`, `/maker-vs-manager-split`.

## Inputs
- Team size (solo / 2-5 / 5-15).
- Current goals (this quarter).
- Existing meetings + their actual ROI.
- Tooling (Notion / Linear / Slack / calendar).

## Process
1. **Pick anchors:** Monday-AM plan, Friday-PM review. Non-negotiable.
2. **Layer daily check-in** (solo = journal, team = 10-min async).
3. **Layer monthly retro** (last Friday of month, 60 min).
4. **Layer quarterly planning** (last week of quarter, half day).
5. **Cut every recurring meeting that doesn't ladder to a goal.**
6. **Block deep-work hours on calendar** — not optional.
7. **Audit cadence quarterly** — kill, add, tune.

## Output
Write `docs/inception/weekly-operating-rhythm-<project>.md`:

```markdown
# Weekly Operating Rhythm — <project>
**Team size:** <solo / 2-5 / 5-15>
**Quarter goals:** <3 OKRs>
**Tools:** <Linear / Notion / Slack / Calendar>

## The cadence stack
| Layer | When | Duration | Purpose |
|-------|------|----------|---------|
| Quarterly planning | Last week of Q | 4 hr | Set OKRs, kill stale bets |
| Monthly retro | Last Fri of month | 60 min | What worked / didn't / change |
| Weekly plan | Mon 9-9:30 AM | 30 min | Top 3 outcomes for the week |
| Weekly review | Fri 4-5 PM | 60 min | Score week, archive, queue next |
| Daily check-in | Daily 9 AM | 5-10 min | Today's #1 + blocker |
| Deep-work blocks | Daily AM | 3-4 hr | Build / write / think |
| 1:1s (post-hire) | Weekly | 30 min/report | Coach + unblock |

## Monday plan (30 min)
1. Read Friday review (last week's notes)
2. Pick top 3 outcomes for the week (not tasks — outcomes)
3. Pre-block deep-work hours (4 × 3-hr blocks min)
4. Pre-schedule customer calls
5. Note 1 thing to learn this week

Template:
```
# Week of <YYYY-MM-DD>

## Top 3 outcomes
1. <ship X to <customer>>
2. <close Y deal>
3. <hire <role> reach offer stage>

## Calendar locks
- Mon-Thu 8-12 deep work
- Mon/Wed/Fri 1-3 customer calls
- Tue/Thu 1-3 ops / admin

## Learning goal
- <1 thing, e.g. "read 3 churn-analysis posts">

## Carrying over
- <unfinished from last week + why>
```

## Daily check-in (solo: 5 min journal; team: 10 min async Slack)
- Yesterday: shipped / learned
- Today: #1 outcome
- Blocker: <what / who>

Solo founder version = end-of-day journal, 3 lines, no team needed.

## Friday review (60 min)
1. **Score the 3 outcomes** (done / partial / no)
2. **What worked** (3 bullets)
3. **What didn't** (3 bullets + why)
4. **Customer notes** (paste call notes, look for patterns)
5. **Metric check** (KPI dashboard — see `/kpi-dashboard-investors`)
6. **Investor / advisor pings** (any update? any ask?)
7. **Archive** week's notes to `/weekly/YYYY-WW.md`
8. **Pre-stage Monday** plan (5 min)

Template:
```
# Week review <YYYY-WW>

## Outcomes scored
1. <outcome> — DONE/PARTIAL/NO
2. ...
3. ...

## Worked
- ...

## Didn't
- ...

## Customer signal (notes from calls)
- <pattern 1>
- <pattern 2>

## Metrics delta
- ARR: $X → $Y (+Z%)
- New logos: N
- Churn: N
- WAU: N

## Decisions made this week
- <decision + why>

## Carry to next week
- ...
```

## Monthly retro (last Fri, 60 min)
1. **OKR progress** — % done on each Q OKR
2. **Hiring funnel** — open / in-progress / closed
3. **Pipeline review** — top 5 deals + stage
4. **Burn check** — actual vs plan, runway months
5. **What to stop / start / continue** (5-min each)
6. **Update investor update draft** (use `/investor-update-cadence`)
7. **Health check** — energy, sleep, exercise

## Quarterly planning (last week of Q, 4 hr)
1. **Review last Q OKRs** — score each 0-1
2. **Customer truth session** — top 3 things customers want
3. **Pick 3 OKRs** for next Q (max 3 — more = no focus)
4. **Resource map** — who owns what, gaps
5. **Kill list** — bets that didn't ladder up
6. **Communicate** — all-hands + investor update

OKR format:
- Objective: <qualitative goal, inspiring>
- KR1: <quantitative, measurable>
- KR2: <quantitative>
- KR3: <quantitative>
Max 3 Os, max 3 KRs each.

## Calendar template (solo founder)
| Time | Mon | Tue | Wed | Thu | Fri |
|------|-----|-----|-----|-----|-----|
| 8-9 | Plan week | Journal | Journal | Journal | Journal |
| 9-12 | Deep work | Deep work | Deep work | Deep work | Customer calls |
| 12-1 | Lunch | Lunch | Lunch | Lunch | Lunch |
| 1-3 | Customer calls | Ops batch | Customer calls | Hiring | Investor / fundraise |
| 3-5 | Async / inbox | Customer calls | Deep work | Customer calls | **Weekly review** |
| Eve | Async | Async | Strategy / think | Async | Off |

## Calendar template (5-person team)
| Time | Mon | Tue | Wed | Thu | Fri |
|------|-----|-----|-----|-----|-----|
| 9-9:15 | Async standup | Async standup | Async standup | Async standup | Async standup |
| 9:30-10 | Weekly plan (sync) | — | — | — | — |
| 10-12 | Deep work | Deep work | Deep work | Deep work | Deep work |
| 1-2 | 1:1s | 1:1s | Customer calls | 1:1s | Demo / show-and-tell |
| 2-4 | Deep work | Customer calls | Deep work | Customer calls | Deep work |
| 4-5 | Async | Async | Async | Async | **Weekly review** |

## Meetings to kill
- ❌ Status update meetings (replace with Loom / written update)
- ❌ Standups > 10 min
- ❌ Recurring meetings without agenda
- ❌ "Sync to align" without decision needed
- ❌ All-hands more than weekly (pre-50)
- ❌ Brainstorms without a decision-maker present

## Meeting rules (when you do meet)
- Agenda or no meeting (1 sentence: "decision needed: X")
- Default 25 / 50 min (not 30 / 60)
- One owner, one note-taker
- End with: decisions made + owners + deadlines
- No agenda by start time → reschedule

## Deep-work protection
- Block 8-12 AM every day on calendar
- Slack DND on
- Phone in drawer
- 1 task per block (not 3)
- Hard rule: no meetings before 11 AM

## Async vs sync defaults
| Activity | Sync | Async |
|----------|------|-------|
| Decision with >3 inputs | Sync 25 min | — |
| Status update | — | Loom or Notion |
| Strategy debate | Sync after async pre-read | Pre-read |
| Code review | — | PR comments |
| Customer call | Sync | — |
| 1:1 | Sync 30 min | — |
| All-hands | Sync 30 min | Loom recap |

## Pitfalls flagged
- [ ] Monday plan + Friday review on calendar
- [ ] Top-3 outcome discipline (not 10)
- [ ] Deep-work blocks pre-booked
- [ ] Monthly retro scheduled
- [ ] Quarterly planning blocked
- [ ] Meetings without agendas killed
- [ ] Weekly archive folder live

## Anti-patterns
- ❌ Daily standup that drags 30+ min
- ❌ Friday review skipped when "too busy"
- ❌ More than 3 weekly outcomes
- ❌ OKRs > 3 per quarter
- ❌ No deep-work block on calendar
- ❌ Recurring meetings nobody questions
- ❌ Weekly review without metric check

## Next
- Time allocation → `/founder-time-allocation`
- Maker vs manager → `/maker-vs-manager-split`
- Mental health → `/mental-health-plan`
```

## Verification
- Cadence stack defined.
- Templates per layer.
- Calendar example.
- Meeting kill list.
- Deep-work blocks specified.
- Async vs sync rules.
