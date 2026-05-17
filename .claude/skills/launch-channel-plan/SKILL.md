---
name: launch-channel-plan
description: Sequence launch channels (Product Hunt, Hacker News, Reddit, podcasts, press) for launch day + week. Outputs to `docs/inception/launch-channels-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "launch channels", "PH", "HN", "/launch-channel-plan", or before launch day.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /launch-channel-plan — Launch Day Channels

## Why you'd care

Without a sequenced channel plan, launch day is a single uncoordinated push to one audience and the long-tail compounding never happens. Sequencing PH/HN/Reddit/press across a launch week multiplies the same content's reach.

Invoke as `/launch-channel-plan`. One-shot launches die in 48h. Plan the 30 days after.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/community-audit-<project>.md` + `betalist-ph-pre-launch-<project>.md` if exists.

## Inputs
- Launch date (firm).
- Pre-launch waitlist size + engagement.
- Founder's existing audience.

## Process
1. **Channel sequencing** — staggered, not all-in-one:
   - **T-7 days:** warm pre-launch (waitlist, IH, Twitter audience)
   - **T-1:** hunters lined up (PH "scheduled hunt"), HN "Show HN" draft, press embargo if any
   - **T-0 launch day:** PH submission 12:01am PT, HN Show HN 8am PT, Twitter announcement, LinkedIn, newsletter
   - **T+1:** Reddit (subs allowing), niche communities
   - **T+3:** podcast outreach (10 podcasts)
   - **T+7:** retrospective + iterate
   - **T+14:** content recap, lessons-learned post
   - **T+30:** "1 month in" milestone post
2. **Asset checklist per channel** — copy, image, video, OG image, thread outline.
3. **Hunter / sponsor lined up** — PH top hunter outreach 4 wks pre.
4. **Damage-control plan** — site goes down, abuse, snark in comments.

## Output
Write `docs/inception/launch-channels-<project>.md`:

```markdown
# Launch Channel Plan — <project>
**Launch date:** <YYYY-MM-DD>

## Day-by-day timeline
| When | Channel | Asset | Owner |
|---|---|---|---|
| T-7 | Email waitlist (warm) | "Launching Tuesday" email | founder |
| T-7 | Twitter teaser | image+thread | founder |
| T-2 | PH hunter confirm | DM <hunter handle> | founder |
| T-1 | HN Show HN draft | post copy | founder |
| T-0 12:01 PT | Product Hunt | image, GIF, comment | founder |
| T-0 8:00 PT | Hacker News | Show HN post | founder |
| T-0 10:00 | Twitter + LinkedIn | thread + carousel | founder |
| T-0 12:00 | Newsletter blast | sub list | founder |
| T+1 | r/<sub> | self-post (rules-compliant) | founder |
| T+3 | Podcast outreach | 10 emails | founder |
| T+7 | Retrospective post | IH + Twitter | founder |
| T+14 | Lessons recap | blog | founder |
| T+30 | "1 month in" | thread + blog | founder |

## Per-channel assets
### Product Hunt
- Tagline (≤60 char): <X>
- Description (260 char): <X>
- Hero image (1270×760): linked
- GIF demo (≤3MB): linked
- First-comment template: <X>

### Hacker News
- Title: "Show HN: <product> – <one-line>"
- Post body: <draft>

### Twitter
- Thread (8 tweets): drafted
- Hero image: linked

## Hunter / amplifier list
- PH hunter: <@handle>, confirmed <date>
- Tier-1 amplifiers (Twitter): <list>, DM'd <date>

## Damage control
- Site downtime: status page + Twitter holding message
- Abuse / snark: don't engage, mute, focus on signal
- Server scaling: <plan>

## Success criteria
- PH: top 5 of day → strong; top 10 → OK; outside top 10 → reset
- HN: front page ≥3hr → strong; top 30 → OK
- Signups: <X> in week 1
- Paid conversions: <Y>

## Verdict pre-launch
**READY / NEEDS-WORK** (gaps: <list>)
```

## Verification
- Day-by-day timeline T-7 to T+30 covered.
- Per-channel assets specified (not vague "share on Twitter").
- Hunter/amplifier confirmed not assumed.
- Damage-control plan present.
- Success criteria quantified per channel.
