---
name: customer-advisory-board
description: Customer advisory board — pick 6-10 customer reps, quarterly cadence, roadmap influence, no equity. Outputs to `docs/inception/customer-advisory-board-<project>.md`. Use when user says "CAB", "customer advisory board", "customer council", "roadmap council", "/customer-advisory-board", or post-PMF.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /customer-advisory-board — Customers Decide Roadmap. Not Loudest. Not Newest. Real Users.

## Why you'd care

Roadmap fights in the conference room get replaced with "the CAB voted this 7-2 last quarter, here's the recording" — and suddenly the loudest internal stakeholder stops being the arbiter of priority. Six-to-ten power users meeting quarterly with a structured agenda, no equity, and a closed influence loop is the cheapest high-signal channel in the company, and the alternative is shipping what the loudest sales rep saw in one demo last Tuesday.

CAB ≠ advisory board. No equity. No FAST. Just 6-10 power users meeting quarterly to shape product and validate roadmap. Cheapest signal in the company.

## Pre-flight
Run post-PMF or when roadmap fights start. Pairs with `/jtbd`, `/customer-interview-script`, `/roadmap-12-month`.

## Inputs
- Top 20 customers by ARR / engagement / NPS.
- Roadmap draft (next 2 quarters).
- 3-5 hard product questions to put on the table.

## Process
1. **Pick 6-10 customer reps** — power users, multiple personas.
2. **No equity, no NDA cliffs** — just hospitality + early access.
3. **Quarterly virtual meeting** (90 min) + annual in-person.
4. **Draft agenda 2 weeks ahead** — share pre-read.
5. **Run meeting with strict format** — no demo, all dialog.
6. **Publish notes within 1 week** — what you heard + what changes.
7. **Close the loop next quarter** — show what shipped from last CAB.

## Output
Write `docs/inception/customer-advisory-board-<project>.md`:

```markdown
# Customer Advisory Board — <project>
**Members:** 6-10
**Cadence:** quarterly virtual + 1 annual in-person
**Compensation:** none (hospitality + early access + swag)

## CAB vs Advisory Board
| | CAB | Advisory Board |
|---|-----|---------------|
| Who | Real paying customers | Operators / experts |
| Compensation | None | Equity (FAST) |
| Cadence | Quarterly group | Monthly 1:1 |
| Purpose | Roadmap + product feedback | Strategic + intros |
| Agreement | Charter (lightweight) | FAST agreement |

Don't confuse. Don't bundle.

## Member selection
| Criteria | Why |
|----------|-----|
| ARR > $X (top 20%) | Skin in game |
| Active user (last 30 days) | Real feedback, not stale |
| Mix of personas | Buyer + power user + admin |
| Industry diversity | Catch segment drift |
| Articulate (writes, presents) | Will speak up |
| Reachable (responds < 48 hr) | Engagement signal |
| Willing public reference (preferred) | Marketing flywheel |

Avoid:
- ❌ Friends or relationship-only customers
- ❌ Free / trial accounts
- ❌ Single super-loud user dominating
- ❌ All-buyers no-users (or vice versa)
- ❌ Customers on the verge of churn (separate convo)

## Member outreach script
```
Subject: Invite — <product> Customer Advisory Board

Hi <name>,

We're forming a 6-10 person customer advisory board for <product>. Goal: 4 conversations a year on what we should build, kill, and prioritize.

Why you: <specific reason — e.g. "you've shaped how we think about workflow X" / "your team's usage led to feature Y">.

Commitment:
- 90-min virtual call once per quarter
- Optional 1 in-person dinner per year (we cover travel)
- Pre-read review (~30 min ahead of each meeting)

In return:
- Early access to features 30-60 days before GA
- Direct line to product + founders
- Influence over roadmap (we publish what shifts based on each session)
- Annual customer dinner

No equity, no NDA beyond standard, no obligation past current quarter.

Sound interesting?

<founder>
```

## Charter (1-pager)
```
# CAB Charter — <product>

## Purpose
Shape product roadmap. Validate priorities. Surface unmet needs.

## Membership
- 6-10 customers
- 2-yr renewable term
- 1 rep per organization

## Cadence
- Quarterly 90-min virtual
- Annual in-person dinner
- Pre-read 1 week ahead
- Notes within 1 week after

## Confidentiality
- Standard mutual NDA
- Other members' identity confidential outside CAB
- Public reference: opt-in case-by-case

## Compensation
None. Hospitality + early access + influence.

## Termination
Either side, anytime, no penalty.
```

## Quarterly meeting agenda (90 min)
| Block | Time | What |
|-------|------|------|
| Welcome + intros | 10 min | Round-robin: 1 thing in product that worked, 1 that didn't |
| Roadmap review | 20 min | Founder walks next-quarter roadmap (10 min) + Qs (10 min) |
| Deep-dive topic 1 | 20 min | Specific question, group discusses |
| Deep-dive topic 2 | 20 min | Second question |
| Open mic | 15 min | Anything we missed |
| Wrap + next steps | 5 min | Recap, dates, asks |

**No demo. No deck-heavy slides. Conversation, not presentation.**

## Pre-read template (sent 1 week ahead)
```
# CAB Q<N> 2026 pre-read

## Since last CAB
- Shipped: <X, Y, Z>
- Killed: <feature A — why>
- Learned: <surprise>

## Next quarter roadmap (draft)
1. <theme 1> — <one-sentence why>
2. <theme 2>
3. <theme 3>

## Hard questions for the group
1. <e.g. should we build native integration or rely on Zapier?>
2. <e.g. is pricing the blocker for team plans?>
3. <e.g. what would make you switch to a competitor?>

## What we'll ask in the meeting
- React to the roadmap (any "no, don't build that"?)
- Vote on top 3 priorities
- Share use case that's not yet served

## Logistics
- Date / time / Zoom link
- 90 min
- Recorded for absent members (audio only)
```

## Meeting facilitation rules
- 1 facilitator (PM or founder), 1 note-taker
- Each member speaks in every block (don't let 1 person dominate)
- Founder talks < 30% of total time
- "What would you change?" beats "What do you like?"
- Capture quotes verbatim — they're roadmap fuel
- End with: 3 decisions / shifts triggered by this meeting

## Post-meeting follow-up (within 1 week)
```
# CAB Q<N> 2026 — recap

## What we heard (top themes)
1. <theme + 2-3 supporting quotes>
2. <theme>
3. <theme>

## What's changing
- Roadmap: <X moves up, Y pushed, Z killed>
- Pricing: <Z adjustment>
- Process: <onboarding tweak>

## What's NOT changing (and why)
- <feature request we're declining + reason>

## Next CAB
- Date
- Pre-read topic
- Action items per member (optional)

Thank you for the time.
```

## Roadmap-influence loop (the killer feature)
Each CAB:
1. Start: review what shifted since last quarter because of CAB
2. End: name 3 things this quarter's CAB caused to shift

If members never see their input change anything, they disengage in 2 cycles.

## Annual in-person dinner (optional but high-leverage)
- 1 dinner / year, founder hosts
- Pair members with each other (peer network = stickiness)
- Bring head of product + head of CS
- No agenda, just conversation
- Cover travel for non-local members

## Tracking sheet
| Member | Org | Persona | ARR tier | Joined | Last attended | Influence score | Reference? |
|--------|-----|---------|----------|--------|---------------|----------------|-----------|
| <A> | <co> | Power user | $50K | 2026-01 | 2026-Q1 | 3 changes | Yes |
| <B> | <co> | Admin | $120K | 2026-01 | 2026-Q1 | 1 change | Pending |

## Rotation policy
- 2-yr term, renewable
- Rotate 20-30% per year
- Sunsetting members: thank-you note + alumni status + "rejoin anytime"
- New members: invite when a unique persona / segment isn't covered

## Pitfalls
- ❌ All same persona / same industry → groupthink
- ❌ Founder lectures, members listen → no signal
- ❌ Loud member dominates → others quit
- ❌ Notes not published → members feel unheard
- ❌ Pay equity / cash → distorts feedback
- ❌ NDA-heavy → silences candor
- ❌ Re-invent every quarter → no rhythm

## When NOT to run a CAB
- Pre-PMF: too few customers; do 1:1 interviews via `/customer-interview-script`
- Enterprise w/ 5 customers: do 1:1 quarterly business reviews instead
- Self-serve PLG w/ 10K users: use forum + product analytics, not CAB

## Pitfalls flagged
- [ ] 6-10 members, diverse personas
- [ ] Charter signed
- [ ] No equity, no cash
- [ ] Quarterly cadence on calendar
- [ ] Pre-read 1 week ahead
- [ ] Notes published within 1 week
- [ ] Influence loop closed (last → this)
- [ ] Annual in-person scheduled

## Anti-patterns
- ❌ Equity for CAB members (you'll regret it)
- ❌ Sales pitch dressed as CAB
- ❌ One CAB to rule all segments
- ❌ Demo-heavy meeting
- ❌ No-show founder
- ❌ No post-meeting recap

## Next
- Advisor program → `/advisor-program-design`
- JTBD → `/jtbd`
- Roadmap → `/roadmap-12-month`
```

## Verification
- CAB vs advisor-board distinction stated.
- Member selection criteria.
- Charter template.
- 90-min agenda format.
- Pre-read + recap templates.
- Influence loop named.
- Rotation policy.
