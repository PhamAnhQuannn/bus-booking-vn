---
name: pitch-deck-narrative
description: Pitch deck narrative arc — tighten 10-slide deck into a story investors can't put down. Outputs to `docs/inception/pitch-deck-narrative-<project>.md`. Use when user says "pitch narrative", "deck story", "narrative arc", "tighten deck", "/pitch-deck-narrative", or after `/sequoia-deck-skeleton`.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /pitch-deck-narrative — Slides Are Lego, Narrative Is The Build

Deck skeleton is the parts list. Narrative is what you actually pitch. Investors don't read decks — they remember stories.

## Why you'd care

Investors see hundreds of decks. A deck that walks through bullet points loses. A deck that tells a story they can't put down gets the second meeting — and the second meeting is where checks happen.

## Pre-flight
Run after `/sequoia-deck-skeleton`. Pairs with `/founding-story-narrative`, `/demo-day-script`.

## Inputs
- Built deck (10 slides).
- Founder origin story.
- Customer quotes (verbatim).

## Process
1. **3-act structure:** setup (problem world) → conflict (why broken) → resolution (what we do + proof).
2. **One villain** — name the thing you're fighting (status quo / incumbent / pain).
3. **One hero** — the customer, not you.
4. **Emotional arc** — outrage → hope → confidence.
5. **Story before stats** — anecdote first, numbers as backup.
6. **Slide ↔ story mapping** — each slide should land one beat.
7. **Practice spoken** — write it like a speech, not a doc.
8. **Time per slide:** 1-2 min main slides, 3 min product demo, 30 sec ask.

## Output
Write `docs/inception/pitch-deck-narrative-<project>.md`:

```markdown
# Pitch Deck Narrative — <project>
**Pairs with:** `docs/inception/sequoia-deck-skeleton-<project>.md`
**Total length:** 15-20 min spoken + Q&A

## Act 1 — The world (slides 1-2)
**Beat:** "Here's what's broken."

### Slide 1 — Company Purpose (1 min)
> "We help SMB ecom ops teams automate returns. Here's why that matters."

Land: 1 sentence + pause. Don't rush.

### Slide 2 — Problem (2 min)
**Story:** Open with anecdote.
> "Last year I sat next to a Shopify ops manager at <event>. She told me her team spends 30% of their week on returns. Not selling — returns. Manually opening emails, refunding in Stripe, updating spreadsheets. She's not unique — every SMB ops team I called said the same thing."

**Then numbers:**
> "$X bn in SMB returns processed manually every year. The big platforms cost $50k/yr. SMBs can't afford them. So they hire ops people to do it by hand."

**Land emotional beat:** "This shouldn't exist in 2026."

## Act 2 — The conflict (slides 3-6)
**Beat:** "Here's why no one solved it."

### Slide 3 — Solution (2 min)
> "We built <product>. Plug in Shopify, we handle the rest. Returns approved, refunds issued, customers notified. In 1 day, not 3 months."

Screenshot. Demo gif. Let them see it work.

### Slide 4 — Why Now (1.5 min)
> "Three things changed in the last 2 years that made this possible..."

1. LLMs got cheap enough for returns-email parsing
2. Shopify opened the returns API
3. SMB ops teams went remote → process pain became visible

> "5 years ago, impossible. 5 years from now, obvious. This is the window."

### Slide 5 — Market Size (2 min)
**Skip the top-down framing.**
> "Here's the bottom-up: 1.7M Shopify stores with >$1M GMV. Average $X/yr returns spend. That's a $Y bn addressable market. We don't need 1% — we need 0.1%."

### Slide 6 — Competition (2 min)
**Be honest.**
> "Three real players. Loop is the enterprise leader — great product, $50k/yr, 3-month integration. AfterShip is mid-market. We're the only one priced + onboarded for sub-$10M GMV stores. Where they're stronger: <X>. Why it doesn't matter for our segment: <Y>."

## Act 3 — The resolution (slides 7-10)
**Beat:** "Here's what we're doing about it + why we win."

### Slide 7 — Product (3 min — demo)
**Live demo or recorded.** 90 sec walkthrough max.

> "Let me show you. Sarah at <customer> connects Shopify. Webhook fires on a return request. Our system parses the email, checks the policy, refunds, emails the customer. 11 seconds end-to-end."

### Slide 8 — Business Model (1.5 min)
> "$400/mo flat, scales to $2k/mo at top tier. ACV $4,500. 7-day payback. NDR 115%. Gross margin 82%."

### Slide 9 — Team (1.5 min)
**One paragraph per founder. Why YOU.**
> "Founder A spent 4 years at <ecom co> watching this exact problem. Founder B built a scraper platform used by 10k+ ops teams. We've been collecting this pain for years."

### Slide 10 — Ask (1 min)
> "We're raising $1.5M at $12M cap. $1M already committed. Closing in 4 weeks. The money buys us: 2 engineers, content engine scale, 18 months runway to $2M ARR and Series A readiness. Who's in?"

## Narrative checks
- [ ] Hero = customer, not us
- [ ] Villain named (status quo / incumbent / pain)
- [ ] Anecdote before any chart
- [ ] One emotional spike per act
- [ ] Demo lands the wow moment
- [ ] Ask is concrete + closes loop
- [ ] No slide explains itself — narrator does

## Spoken vs slide content
| Slide says | You say |
|-----------|---------|
| "$25k MRR" | "We hit $25k MRR 4 months in — 18% MoM since" |
| "42 customers" | "42 paying SMBs. Started with 3 design partners." |
| "LTV:CAC 35:1" | "We acquire for $400, they pay us $4.5k over 18 months" |
| "Why Now" | "5 years ago this was impossible. Here's what changed." |

## Q&A prep (top 10 expected)
- [ ] What's the biggest risk? → answered honestly
- [ ] Why won't Shopify build this? → strategic answer
- [ ] How do you get to $100M ARR? → math, not handwave
- [ ] Why aren't bigger ones doing this? → segment economics
- [ ] What's your moat? → not "AI", concrete answer
- [ ] Who's the leader / who's lead? → status
- [ ] How long is runway? → months + burn
- [ ] What's the worst feedback you've gotten? → ready
- [ ] What if Loop drops price? → contingency
- [ ] What's the founder dynamic? → honest

## Anti-patterns
- ❌ Slide-reading
- ❌ Numbers without story
- ❌ Mission opener ("Our mission is to...")
- ❌ Future tense everything ("we will, we plan")
- ❌ Hero = us (it's the customer)
- ❌ Burying the ask
- ❌ Defensive answers in Q&A

## Pitfalls flagged
- [ ] 3-act arc clear
- [ ] Anecdote in problem slide
- [ ] Villain named
- [ ] Demo as wow moment
- [ ] Q&A practiced 30+ times
- [ ] Ask concrete + closes

## Next
- Refine ask sizing → `/runway-model`
- One-pager → `/one-pager-teaser`
- Demo day cut → `/demo-day-script`
- Investor list → `/investor-target-list`
```

## Verification
- 3-act arc.
- Customer = hero.
- Anecdote opens problem.
- Demo is wow moment.
- Ask is last + concrete.
- Q&A top-10 prepped.
