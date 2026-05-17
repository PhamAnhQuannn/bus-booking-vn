---
name: founder-journaling-cadence
description: Founder journaling cadence — daily intent + evening review, weekly retro, monthly pattern pass, prompts, tooling, privacy posture. Outputs to `docs/inception/founder-journaling-cadence-<project>.md`. Use when user says "journaling", "founder journal", "daily review", "weekly retro", "reflection practice", "/founder-journaling-cadence", or before/during seed stage.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /founder-journaling-cadence — The Unexamined Week Repeats Itself. Journal Or Forget Why.

## Why you'd care

Founders forget what they believed last quarter and re-litigate decided questions every week — the time tax is enormous and invisible. A structured journal cadence externalizes the decision trail so you stop paying interest on resolved debates.

Journal ≠ diary. Journal = forcing-function for clarity, pattern detection, early-warning system. The thing you write is the thing you remember. The thing you don't write becomes a vibe you can't name in therapy 18 months later.

## Pre-flight
Run at founding OR when "the days blur together" / "I can't remember what I decided last week" becomes true. Pairs with `/weekly-operating-rhythm`, `/mental-health-plan`, `/burnout-early-warning`.

## Inputs
- Founder writing comfort (typed / handwritten / voice-to-text).
- Current reflection habit (none / sporadic / structured).
- Tooling pref (Notion / Day One / Roam / Obsidian / paper).
- Privacy posture (founder-only / shared with co-founder / partial public).

## Process
1. **Pick cadence** — daily core + weekly retro + monthly pattern pass.
2. **Pick format** — short prompts, not free-form essays (essays die first).
3. **Pick tool** — one tool, always available, frictionless.
4. **Set time + trigger** — anchor to existing habit (coffee, end-of-day).
5. **Define prompts** — same prompts every day for pattern detection.
6. **Set privacy posture** — founder-only by default; opt-in shared sections.
7. **Schedule the pattern pass** — monthly review or signal is wasted.

## Output
Write `docs/inception/founder-journaling-cadence-<project>.md`:

```markdown
# Founder Journaling Cadence — <project>
**Founder:** <name>
**Tool:** <Notion / Day One / Roam / Obsidian / paper>
**Cadence:** daily + weekly + monthly
**Privacy:** founder-only (default)
**Date:** <YYYY-MM-DD>

## Why journal as a founder
- Founder days blur — without writing, weeks vanish from memory
- Decisions need their *why* preserved for future-you
- Patterns (burnout, conflict, energy dips) only visible across weeks
- Writing forces clarity — half of catastrophic worries die on the page
- The journal is the only honest 1:1 a solo founder gets
- 18 months from now you will not remember why you killed the X feature — your journal will

## The cadence

### Daily (5-10 min)
Two touchpoints — morning intent, evening review.

**Morning (3-5 min, with coffee):**
- 1 thing if-I-do-it-today-is-a-win
- Top 3 todos (ranked)
- Energy: 1-10
- Mood: 1-10
- 1 worry sitting in the back of my head (name it to defuse it)

**Evening (3-5 min, end of work):**
- Did the 1 win happen? Y/N + why
- What energized me today?
- What drained me today?
- 1 thing I learned
- 1 decision I made (decision + why)
- Tomorrow's 1 win

If you only do one of the two — keep the evening review.

### Weekly retro (20-30 min, Friday afternoon or Sunday)
- Wins this week (3)
- Misses this week (3)
- What surprised me?
- Energy trend (graph of daily 1-10 scores)
- Top 3 things I'm avoiding (name avoidance)
- 1 thing I want to do differently next week
- Investor / customer / team signal worth noting
- Decisions logged this week (link to /decision-log)

### Monthly pattern pass (60 min, last Friday of month)
- Read all weekly retros from the month
- Patterns: what came up 3+ times?
- Energy: trend across weeks
- Avoidance: still avoiding the same thing? Why?
- Decisions: any I'd reverse with hindsight?
- Health signals (sleep, exercise, social) trending up/down?
- Burnout early-warning checklist (see `/burnout-early-warning`)
- Adjust next month's priorities based on patterns

### Quarterly (90 min, with co-founder if applicable)
- 3 month rollup
- Goals vs reality
- Founder-fit check ("am I still the right person for this seat?")
- Health + relationship + finance pulse
- Sabbatical / break consideration if patterns concerning

## Prompt bank (rotate or pick favorites)
**For clarity:**
- What would I tell next-quarter-me about this week?
- If I had to advise a founder going through this exact moment, what would I say?
- What's the question I'm avoiding asking myself?

**For decisions:**
- What did I decide today, and what was the alternative?
- What would change my mind on <recent decision>?
- What am I assuming that might be wrong?

**For energy:**
- When did time disappear today? (flow state signal)
- What conversation drained me most?
- What 30-min slot today regenerated me?

**For team:**
- Who on the team did I underweight this week?
- Who needs feedback I haven't given?
- Who am I avoiding a hard conversation with?

**For self:**
- Sleep last night: hours + quality 1-10
- Did I exercise? (Y/N)
- Last non-work conversation longer than 10 min?
- When did I last laugh today?

## Tooling

| Tool | Best for | Watch out |
|------|----------|-----------|
| Notion | Structured DBs, cross-link to decisions, OKRs | Easy to over-template |
| Day One | Mobile-first, photo support, end-to-end encrypted | Less linkable |
| Roam / Logseq | Daily notes graph, bidirectional links | Learning curve |
| Obsidian | Local-first, plain markdown, plugin ecosystem | Setup heavy |
| Paper / Moleskine | Friction-free, no notifications | Not searchable, lossy |
| Apple Notes / iA Writer | Lowest-friction typed | No structure enforcement |

**Default pick:** Notion for the DB linking (decision log, OKR review, team 1:1s) + a paper notebook for raw morning thinking. Use one or both — but commit to one as canonical.

## Privacy posture
- **Default:** founder-only, encrypted at rest
- **With co-founder:** opt-in shared section ("Co-founder visible") for trust signals + things to discuss
- **Therapist / coach:** export specific entries; do not share whole journal
- **Public writing:** journal → distilled blog post is fine; raw journal is not
- **In M&A / fundraise diligence:** journal is *not* a company record; keep it personal device, personal account

**Rule:** if you'd censor it knowing someone else might read it, the journal isn't doing its job. Keep it private.

## Anchoring to existing habits
| Trigger | Action |
|---------|--------|
| Coffee in the morning | Morning entry (3 prompts) |
| Closing laptop end-of-day | Evening entry (5 prompts) |
| Friday 4pm calendar block | Weekly retro |
| Last Friday of month | Monthly pattern pass |
| Quarterly off-site / planning | Quarterly rollup |

Anchor or it won't happen. Standalone reminders fail by week 3.

## When journaling matters most (and is hardest)
- High-stress weeks: counterintuitively the time you most need it
- Pre-fundraise: capture deltas in conviction
- Post-incident / post-firing: process before next decision
- Co-founder conflict: write before talking
- Big customer win or loss: pattern is in the contrast

**Anti-pattern:** "I'll start again next week when things calm down." Things don't calm down. The journal is the calming mechanism.

## Founder-burnout signals visible in the journal
- Energy score < 5 for 5+ days running
- Evening "1 thing I learned" → blank for a week
- Weekly retro skipped 2 weeks in a row
- Same avoidance item 4+ weeks in a row
- Sleep tracking: < 6 hr for 7+ nights
- "Last non-work conversation > 10 min" → blank for 10+ days

If 3+ signals true → trigger `/burnout-early-warning` checklist + talk to therapist/coach + cut something this week.

## Sharing distilled outputs
- Decisions worth team-knowing → `/decision-log` (not journal raw)
- Strategy crystalized → memo to team / board (not journal raw)
- Patterns worth peer-discussion → founder peer group (curated)
- Posts → blog (rewritten, never copy-paste)

The journal feeds public outputs; it is not itself public.

## Anti-patterns
- ❌ Free-form essays — die first, format matters
- ❌ Journaling for an audience — kills honesty
- ❌ Skipping during stress — exactly when needed
- ❌ Reading prior entries never — pattern detection requires re-reading
- ❌ Five different tools — pick one
- ❌ Treating it as work output — it's input, not deliverable
- ❌ Letting co-founder/spouse read raw without invitation
- ❌ AI-summarize-my-life — defeats the writing-forces-clarity purpose

## Onboarding the practice
**Week 1:** evening review only, 3 prompts
**Week 2:** add morning intent, 3 prompts
**Week 3:** add weekly retro, Friday 4pm
**Week 4:** start tracking energy + sleep
**Month 2:** first monthly pattern pass
**Month 3:** quarterly rollup pilot

Ramp slowly. Habit > intensity.

## Pitfalls flagged
- [ ] Cadence picked (daily + weekly + monthly)
- [ ] Tool chosen, one canonical
- [ ] Prompts defined (short, repeatable)
- [ ] Anchored to existing habit
- [ ] Privacy posture set
- [ ] Pattern-pass scheduled
- [ ] Burnout signals defined

## Anti-patterns flagged
- ❌ Sporadic, no cadence
- ❌ Free-form essays only
- ❌ Multiple tools
- ❌ Never re-read
- ❌ Treating as work output

## Next
- Burnout monitoring → `/burnout-early-warning`
- Mental health plan → `/mental-health-plan`
- Weekly operating rhythm → `/weekly-operating-rhythm`
```

## Verification
- Cadence defined (daily / weekly / monthly / quarterly).
- Prompts banked, not free-form.
- Tool picked, one canonical.
- Anchored to existing habit.
- Privacy posture explicit.
- Burnout signals defined.
- Monthly pattern pass scheduled.
