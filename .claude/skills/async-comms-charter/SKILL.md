---
name: async-comms-charter
description: Async-comms charter — default-async stance, response SLAs per channel, DM/channel/thread rules, meeting-replacement gate, DND hours, timezone respect. Outputs to `docs/inception/async-comms-charter-<project>.md`. Use when user says "async", "async-first", "communication norms", "comms charter", "Slack rules", "meeting culture", "/async-comms-charter", or before first remote hire / team past 5.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /async-comms-charter — Default Sync = Default Distracted. Write It Down So Async Wins.

## Why you'd care

A team that defaults to sync without writing the rule down loses two hours of maker time per person per day to chat and meetings. Codify channel SLAs and DND once, ship for a quarter on the focus you reclaim.

Async ≠ slow. Async = thoughtful, durable, parallelizable. Sync ≠ fast. Sync = expensive, lossy, interrupting. Charter sets the default so people don't have to fight for focus every day.

## Pre-flight
Run before first remote hire OR when team hits 5 + lives across timezones. Pairs with `/maker-vs-manager-split`, `/documentation-culture-charter`, `/weekly-operating-rhythm`.

## Inputs
- Team size + timezone spread.
- Tooling (Slack / Discord / Teams / Loom / Notion / Linear / GitHub).
- Current pain (too many meetings? Slack noise? Decisions lost in DMs?).
- Founder's own work style (sets the tone whether they like it or not).

## Process
1. **Declare default** — async-first, sync-by-exception.
2. **Set response SLAs per channel** — predictable beats fast.
3. **Define DM vs channel vs thread rules** — kill the DM-hoarding pattern.
4. **Set the meeting-replacement gate** — every meeting must fail the "could this be a Loom" test.
5. **Lock DND + timezone-respect hours.**
6. **Define recording + decision-capture norms** — async only works if it's searchable later.
7. **Publish + onboard new hires on day 1.**

## Output
Write `docs/inception/async-comms-charter-<project>.md`:

```markdown
# Async Communications Charter — <project>
**Default:** async-first, sync-by-exception
**Owner:** <founder / Chief of Staff>
**Version:** 1.0
**Date:** <YYYY-MM-DD>

## Why async-first
- Maker time is the highest-leverage hour in the co. Defend it.
- Async = durable (searchable later), thoughtful (written = considered), parallelizable (no one blocked waiting for a meeting).
- Sync = expensive (N people × duration), lossy (only in attendees' heads), interrupting (kills 2 hr of focus for 30-min meeting).
- Distributed/remote-first teams have no other choice. Co-located teams pretend they don't need it and pay later.

## The default
**Async wins unless:**
- Decision needs <24 hr turnaround AND has >2 stakeholders disagreeing
- Topic is sensitive (firing, comp, conflict)
- New hire / new relationship — first sync builds rapport
- Brainstorm with high creative bandwidth need

Everything else → async.

## Channel matrix
| Channel | Use for | Response SLA | DND-respecting? |
|---------|---------|--------------|-----------------|
| Slack / Discord channel | Default team comms, decisions, FYIs | 4 hr business hours | Yes — no notifications outside hours |
| Slack DM | 1:1, sensitive, personal | 4 hr biz hours | Yes |
| Email | External, formal, legal, board | 24 hr biz days | Yes |
| Loom / video | Status update, demo, complex explainer | 24 hr to view, 48 hr to reply | Yes |
| Notion / docs | Decisions, RFCs, specs | 48 hr review window | Yes |
| Linear / GitHub | Tickets, code review | 24 hr biz days | Yes |
| Phone / SMS | Genuine urgency only | Immediate | NO (escalation only) |

**Rule:** if it's not on phone/SMS, it's not urgent. Period.

## DM vs channel vs thread
**DM (use sparingly):**
- 1:1 feedback
- Sensitive (HR, comp, personal)
- Quick question to a specific person where answer doesn't matter to others

**Channel (default):**
- Anything 2+ people would benefit from seeing
- Decisions
- Status updates
- Questions ("someone in #eng will know")

**Thread (almost always):**
- Reply to any message that has context
- Side-discussions on a topic
- Detailed back-and-forth

**Anti-pattern:** DM-hoarding (founder → person → person → person to gather info). Use a channel. Make the conversation searchable. Future-you will thank present-you.

## Response time expectations
| Expectation | Reality |
|-------------|---------|
| "Online now" | 5-15 min response, biz hours |
| Active but not @-mentioned | 4 hr response biz hours |
| @-mentioned | 4 hr biz hours |
| @here / @channel | Reserve for true team-wide need. 4 hr biz hours response |
| @everyone | Founder/leadership only. Quarterly events / outages |
| DM | 4 hr biz hours |
| Email | 24 hr biz days |

**Out-of-hours:** no response expected. No guilt. If it's truly urgent → phone.

## The meeting-replacement gate
Before scheduling any meeting, answer:
1. Could a Loom + comments replace this? (90% yes)
2. Could a written doc + 48-hr review replace this? (80% yes)
3. Is the goal decision, brainstorm, or rapport?
   - Decision → write the recommendation + alternatives, async review, sync only if no consensus
   - Brainstorm → sync OK (but record + summarize after)
   - Rapport → sync OK (1:1 or social)

If the meeting survives the gate:
- Agenda required in the calendar invite
- Pre-read shared 24 hr ahead
- Recording on by default
- Decisions + actions captured in writing within 24 hr after

No agenda = no meeting. No pre-read = meeting rescheduled.

## Recurring meeting audit
Every quarter, look at every recurring meeting:
- Did decisions happen? (yes/no)
- Could it be Loom + async? (yes/no)
- Right attendees only? (often half should be optional)
- Right cadence? (weekly often → biweekly)

Cut any meeting where the answer to "did it create value last quarter" is no.

## Loom / video norms
**Use Loom for:**
- Status updates (founder/team weekly)
- Demos (new feature, customer call summary)
- Complex explainers (architecture walkthrough, design rationale)
- 1:1 prep (record context before the live conversation)

**Loom rules:**
- < 10 min ideal, < 20 min max (cut > 20 = make it a doc)
- Title + agenda at top
- Notion / doc link in description for written companion
- 1.5x playback assumed — speak clearly, no filler

## Writing decisions down (the part everyone skips)
Every decision needs:
- **Decision:** what was decided
- **Context:** why (briefly)
- **Alternatives considered:** what we ruled out
- **Owner:** who carries it forward
- **Date:** when

Posted in: the channel where the discussion happened OR a `#decisions` channel OR a Notion decision log.

If a decision isn't written down, it didn't happen — and 3 months from now nobody will remember the why.

## Timezone respect (distributed teams)
| Scenario | Rule |
|----------|------|
| Single-tz team | Everyone honors local 9-6 |
| 2-3 overlapping tz | Find 3-4 hr overlap window for "live" hours |
| Globally distributed | No mandatory live hours; everything async-tolerant |
| Hiring across tz | Job posting states tz expectation |

**Founder rule:** if you send a Slack at 11 pm because that's when you work, schedule-send to next morning their tz. Don't normalize off-hours pressure.

## Do-not-disturb hours
**Default DND:** 6 pm - 9 am local + weekends.

**Exceptions:**
- Phone call (true urgency)
- Customer outage (oncall via dedicated channel)
- Explicit "I'm flexing my hours today" stated by individual

Respect DND visible in Slack/Discord. If they're DND, don't @-mention. Use thread + wait.

## Onboarding the charter (day 1)
New hire week 1:
- Read this charter
- Get tour of channel taxonomy
- Set up DND hours
- Subscribe to channels relevant to role
- Watch 3 sample Loom updates
- Read last 5 decision logs

Week 4: 1:1 with manager — "what's working / not working in async for you?"

## Communication anti-patterns
- ❌ DM-hoarding (everything 1:1 with founder)
- ❌ Slack-as-todo (urgent ping for non-urgent ask)
- ❌ Meeting-as-default ("let's hop on a call" before trying a thread)
- ❌ @here for non-team-wide things
- ❌ Decisions in DMs (unsearchable, ungoverned)
- ❌ Slack at midnight expecting response
- ❌ Loom > 30 min (write it instead)
- ❌ Reply with "ok" or "👍" in a thread that needed an answer
- ❌ Multiple parallel conversations on the same topic in different channels
- ❌ Voice notes (force everyone to listen serially = anti-async)

## Founder-specific
- Schedule-send anything outside team hours
- DM only when it's truly 1:1 — default to channel
- Don't reply faster than the SLA you set (normalizes 5-min response expectation)
- Block 2 maker-hours/day on calendar; defend them
- Don't @here unless it's actually team-wide

## Tooling stack (suggested)
| Layer | Tool | Why |
|-------|------|-----|
| Chat | Slack / Discord | Channels + threads + DND |
| Video async | Loom / Tella | Quick recording + transcript |
| Long-form docs | Notion / Coda | Searchable, versioned, commentable |
| Decision log | Notion DB or `#decisions` channel | Auditable |
| Tickets | Linear / GitHub Issues | Async work tracking |
| Calendar | Google Calendar with shared DND | Visible focus blocks |

## Charter review
Every 6 months:
- Survey team: what's working / not?
- Audit meeting calendar (cut 20%)
- Audit Slack channels (archive dead ones)
- Update SLAs based on actual practice

## Pitfalls flagged
- [ ] Default declared (async-first)
- [ ] Response SLAs per channel
- [ ] DM vs channel vs thread rules
- [ ] Meeting-replacement gate
- [ ] DND + timezone rules
- [ ] Decision-capture norm
- [ ] Onboarding includes charter
- [ ] Review cadence scheduled

## Anti-patterns
- ❌ Async charter without founder modeling
- ❌ No DND respect
- ❌ Sync default with async lip service
- ❌ Slack-at-night culture
- ❌ Decisions never written down
- ❌ Meeting bloat tolerated
- ❌ DM-hoarding by leadership

## Next
- Documentation culture → `/documentation-culture-charter`
- Maker/manager split → `/maker-vs-manager-split`
- Knowledge base → `/knowledge-base-bootstrap`
```

## Verification
- Default async stance stated.
- Response SLAs per channel.
- DM/channel/thread rules.
- Meeting-replacement gate.
- DND + timezone respect.
- Decision-capture norm.
- Onboarding integration.
