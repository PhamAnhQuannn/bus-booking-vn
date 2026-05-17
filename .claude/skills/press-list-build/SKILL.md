---
name: press-list-build
description: Build a targeted press list — journalists by beat, outreach template, embargo workflow, follow-up cadence. Outputs to `docs/inception/press-list-<project>.md`. Use when user says "press list", "PR launch", "journalist outreach", "media kit", "/press-list-build", or before a launch / fundraise announcement.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /press-list-build — Most Press Outreach Gets Ignored. Targeted Wins.

Generic "to TechCrunch tips@" gets 0% response. 25 hand-picked beat-matched journalists with a tailored angle gets 5-10%. Build the list first.

## Why you'd care

Generic "please cover us" emails get archived unread. A list segmented by beat with a thesis-fit angle per journalist is what turns launch day into actual coverage rather than crickets.

## Pre-flight
Run after `/launch-channel-plan`. Pairs with `/founding-story-narrative`, `/data-room-bootstrap`.

## Inputs
- News hook (launch / fundraise / data / partnership).
- Embargo or breaking? (embargo = more time + control; breaking = race).
- Target outlets (TechCrunch / The Information / Forbes / Axios / industry trades).
- 1-2 spokespeople available (founder + customer).

## Process
1. **News hook test** — is there genuinely news? "We launched a feature" is not news. "We raised $X" / "We grew 10x" / "We have novel data" is.
2. **Beat mapping** — every journalist covers a beat. Match the beat to the angle:
   - Productivity SaaS → "Future of Work" beats
   - AI tools → "AI / ML" beats
   - Fintech → "Fintech" beats
3. **Source the list:**
   - Muck Rack / Cision (paid)
   - LinkedIn searches "Reporter at X"
   - Read their last 5 articles before adding
   - Twitter (often public + responsive)
4. **Tiering:**
   - **Tier 1** — top-of-mind outlets (TechCrunch, The Information, Bloomberg) — 5 journalists
   - **Tier 2** — industry trades (Built In, Fast Company) — 10
   - **Tier 3** — niche / newsletter / podcast — 10
   - Total = 25 active outreach targets
5. **Angle per journalist** — each journalist needs a tailored hook (don't blast). 1 paragraph why this is interesting to *their* readers.
6. **Embargo workflow:**
   - Tier 1 only — gets advance access 5-7 days before announce
   - Embargo email: clear date + time + what they get
   - Don't pitch competitors same beat under embargo (will torch you)
7. **Outreach template:**
   - Subject: ≤ 50 chars, specific
   - First sentence: angle for THEIR reader
   - 2nd: 1 stat + 1 quote
   - 3rd: ask (15 min call / embargo Q&A / send press kit?)
   - Total: ≤ 150 words
8. **Press kit:** logo (SVG + PNG), product screenshots, founder bios + photos, 1-page fact sheet, hi-res images.
9. **Follow-up cadence:** Day 0 send → Day 3 nudge → Day 7 last touch → drop.
10. **Embargo lift day:** 6am Eastern publish; thank journalists who covered.

## Output
Write `docs/inception/press-list-<project>.md`:

```markdown
# Press List — <project>
**Date:** <YYYY-MM-DD>
**News hook:** $4M seed raise + 10k user milestone
**Announce date:** 2026-06-04
**Embargo:** Yes — Tier 1 only, lifts 6am ET on announce day

## News hook check
- ✓ Genuine news: $4M raise + named investors
- ✓ Stat: 10k users in 6 months (real growth)
- ✓ Spokesperson: founder + lead investor available
- ✓ Customer quote: 2 customers willing to be quoted on the record

## Target list (25)
### Tier 1 (5)
| Journalist | Outlet | Beat | Angle for them | Status |
|------------|--------|------|----------------|--------|
| Jane Smith | TechCrunch | Future of Work | "Async ops tools eating Notion's lunch" | Pitching |
| John Doe | The Information | Enterprise SaaS | "$4M seed, distributed sales pattern" | Pitching |
| Alex Lee | Bloomberg | Productivity | "Operators leaving Notion for purpose-built" | Pitching |
| Sara Patel | Forbes | SMB SaaS | "How 50-500 person co-ops automate" | Pitching |
| Mike Chen | Axios | Tech | "Seed funding climbs in productivity" | Pitching |

### Tier 2 (10)
| Journalist | Outlet | Beat | Angle |
|------------|--------|------|-------|
| ... | Fast Company | Innovation | <angle> |
| ... | Built In | Startups | <angle> |
| ... | (8 more) | | |

### Tier 3 (10)
| Person | Outlet/Newsletter | Reach | Angle |
|--------|--------------------|-------|-------|
| ... | Lenny's Newsletter | 500k | <angle> |
| ... | Department of Product | 80k | <angle> |
| ... | (8 more) | | |

## Outreach template
```
Subject: <specific hook for THEIR beat, ≤50 char>

Hi <name>,

Loved your <recent piece on X — 1 sentence specific>. I wanted to share something that fits your beat:

<1-sentence news hook with stat>. <1-sentence founder quote or customer quote>.

Happy to share an exclusive look at <data/customer/exec> if useful — under embargo until June 4 if you want first look.

<your name>
<title>, <company>
```

## Press kit
- [ ] Logo SVG + PNG (transparent + colored)
- [ ] Product screenshots (5 hi-res, captioned)
- [ ] Founder bios + headshots (2400x2400)
- [ ] 1-page fact sheet (PDF)
- [ ] Customer quotes (3 named, with permission)
- [ ] Funding info (round size, valuation if disclosed, lead, follow-on)
- [ ] Hosted: press.<domain> or Notion public

## Embargo workflow
- T-7 days: Tier 1 outreach with embargo offer
- T-5 days: Embargo confirmations + Q&A
- T-3 days: Tier 2 + 3 outreach (no embargo, briefed for day-of)
- T-1 day: Reminder + draft confirmation
- T-0 6am ET: Embargo lifts, simultaneous publish
- T+1 day: Thank-you emails to covering journalists

## Follow-up cadence
| Day | Action |
|-----|--------|
| 0 | Send pitch |
| 3 | Nudge: "Just floating to top of inbox" |
| 7 | Last touch: "If not a fit, no worries, who else to talk to?" |
| 14 | Drop (no further outreach this cycle) |

## What we won't do
- ❌ Spray-and-pray to general@ inboxes
- ❌ Embargo break (career-ending with journalists)
- ❌ Pitch competing-outlet journalists on same exclusive
- ❌ Press release wire-service alone (no journalist outreach)
- ❌ Fake or unverified stats
- ❌ Pay-to-play "media kit" services

## Measurement
- Pitches sent: 25
- Response rate target: 25% (6 responses)
- Coverage target: 5-8 outlets
- Tier 1 hits: 1-2
- Social referrals from coverage: track UTMs

## Pitfalls flagged
- [ ] News hook is genuinely news (not feature launch)
- [ ] Each journalist gets a tailored angle (not blast)
- [ ] Embargo only to Tier 1 (broken embargoes torch you)
- [ ] Press kit hosted + linked
- [ ] Follow-up cadence respects journalist time
- [ ] Customer quotes have written permission
- [ ] Funding numbers approved by lead investor for disclosure

## Next
- Launch channels overall → `/launch-channel-plan`
- Founding story → `/founding-story-narrative`
- Newsletter feature pitches → `/newsletter-pitch-list`
- Podcast pitches → `/podcast-pitch-list`
```

## Verification
- News hook genuinely newsworthy.
- 25 named journalists with beats + angles.
- Outreach template ≤ 150 words.
- Embargo workflow only to Tier 1.
- Follow-up cadence capped at 3 touches.
- Press kit hosted + complete.
- Coverage targets quantified.
