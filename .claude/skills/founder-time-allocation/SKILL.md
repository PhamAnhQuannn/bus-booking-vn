---
name: founder-time-allocation
description: Founder time allocation — % budget across product / sales / hiring / fundraise / ops. Outputs to `docs/inception/founder-time-allocation-<project>.md`. Use when user says "founder time", "time budget", "where does my time go", "time allocation", "/founder-time-allocation", or quarterly review.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /founder-time-allocation — Default-Allocation = Whatever Yells Loudest. That's Wrong.

## Why you'd care

Founders default to whatever's loudest — usually email and Slack — and quietly under-spend on sales and hiring until the runway runs out. The explicit % budget is the only way to notice the drift before the quarter ends.

Founder = scarce resource. Hours spent on inbox / Slack / vendor calls = hours not spent on the only thing the company cannot do without you.

## Pre-flight
Run quarterly. Pairs with `/weekly-operating-rhythm`, `/maker-vs-manager-split`.

## Inputs
- Stage (pre-product / pre-revenue / scaling).
- Time log last 2 weeks (calendar export).
- Current bottleneck (sales / product / hiring).

## Process
1. **Audit actual time** — calendar export + 1-week log.
2. **Compare to ideal allocation by stage.**
3. **Identify drift** — where actual >> ideal.
4. **Cut, delegate, or batch** the drift.
5. **Lock the new allocation** in calendar (block by category).
6. **Review weekly Friday** — same time, same metric.

## Output
Write `docs/inception/founder-time-allocation-<project>.md`:

```markdown
# Founder Time Allocation — <project>
**Stage:** <pre-product / pre-revenue / scaling>
**Total founder hours/week:** <50-70 realistic>
**Review cadence:** weekly Friday

## Ideal allocation by stage
| Activity | Pre-product | Pre-revenue | Scaling |
|----------|------------|-------------|---------|
| Customer dev / sales | 30% | 40% | 30% |
| Product / build | 40% | 30% | 15% |
| Hiring | 0% | 10% | 25% |
| Fundraise | 5% | 10% | 10% |
| Ops / admin | 5% | 5% | 5% |
| Strategy / thinking | 15% | 5% | 10% |
| Other (community, content) | 5% | 0% | 5% |

## Actual time audit (last 2 weeks)
| Activity | Hours | % | Ideal % | Drift |
|----------|-------|---|---------|-------|
| Customer calls | 8 | 12% | 30% | -18% UNDER |
| Coding | 30 | 45% | 30% | +15% OVER |
| Email / Slack | 14 | 21% | <10% | +11% OVER |
| Hiring | 2 | 3% | 10% | -7% UNDER |
| Vendor / admin | 6 | 9% | 5% | +4% OVER |
| Fundraise | 4 | 6% | 10% | -4% UNDER |
| Thinking | 2 | 3% | 5% | -2% UNDER |

Total: 66 hr/wk.

## Drift fixes
| Drift | Fix |
|-------|-----|
| Coding +15% | Stop coding past 2pm; afternoons = customer/ops |
| Email/Slack +11% | Inbox 2x daily (10am, 4pm); turn Slack off in deep work blocks |
| Vendor/admin +4% | Batch Tuesday 1-3pm; outsource bookkeeping |
| Customer -18% | Lock 3 customer calls/day, 10am-12pm |

## Time-block calendar template
| Day | AM (8-12) | PM (1-5) | Evening |
|-----|-----------|----------|---------|
| Mon | Deep work / build | Customer calls | Async / inbox |
| Tue | Deep work / build | Customer calls + ops batch | Async |
| Wed | Hiring (interviews) | Customer calls | Strategy / thinking |
| Thu | Deep work / build | Customer calls | Async |
| Fri | Customer calls | Investor / fundraise | Weekly review + plan next |

## Drains to delete
- [ ] Recurring vendor calls — defer to async
- [ ] Status update meetings — Loom instead
- [ ] Internal standups longer than 10 min
- [ ] Calendar-tetris with VAs — give them write access
- [ ] "Quick chat" requests with no agenda
- [ ] Newsletter / Twitter scrolling
- [ ] Multi-tasking in meetings

## Outsourcing checklist
| Task | Outsource to | Cost |
|------|-------------|------|
| Calendar / inbox triage | EA (Magic / Athena / VA) | $20-50/hr |
| Bookkeeping | Pilot / Bench | $200-500/mo |
| Legal / contract review | Cooley GO / Atrium | per-doc |
| Recruiting sourcing | Riviera / Sourceress | per-hire fee |
| Design (one-off) | Dribbble freelancer | $50-150/hr |
| Content production | Freelance writer | $100-300/post |
| Customer support tier 1 | VA / Intercom auto | $20/hr |

## Energy management (not just time)
- Map peak hours: when are you sharpest? Block for hardest work.
- Map slump hours: when are you dull? Schedule low-cognition tasks (admin, calls you've done 100x).
- Default: AM = deep, PM = shallow. Override per personal rhythm.

## Founder vs CEO mode
- **Founder mode** (pre-product to early product): 70% making, 30% selling
- **CEO mode** (post-revenue): 30% making, 70% selling/hiring/fundraising
- Switching too late = bottleneck. Switching too early = product dies.

## Saying no template
- "Not now — focused on X for the next N weeks. Ping me <date>."
- "Best person for this: <name>."
- "Won't get the attention it deserves from me right now."
- Default to no. Reverse only if clear ROI.

## Pitfalls flagged
- [ ] Actual time audited (not guessed)
- [ ] Drift quantified
- [ ] Calendar blocks created
- [ ] Drains listed + cut
- [ ] Outsourcing list defined
- [ ] Weekly review on calendar

## Anti-patterns
- ❌ "I'm busy" without numbers
- ❌ Saying yes to everything
- ❌ Coding when nobody is buying
- ❌ Inbox = priorities
- ❌ Meetings without agenda
- ❌ Recurring calls that should be Loom updates
- ❌ Founder doing $20/hr work

## Next
- Weekly rhythm → `/weekly-operating-rhythm`
- Maker vs manager → `/maker-vs-manager-split`
- Mental health → `/mental-health-plan`
```

## Verification
- Actual time audited.
- Ideal by stage referenced.
- Drift quantified.
- Calendar blocks defined.
- Drains identified.
- Outsourcing checklist.
