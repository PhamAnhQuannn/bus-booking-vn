---
name: elevator-pitch
description: 30 / 60 / 120-second pitch variants — who, what, why-now, why-you. Outputs to `docs/inception/elevator-pitch-<project>.md`. Use when user says "elevator pitch", "30-second pitch", "intro line", "what do you do", "/elevator-pitch", or before networking / fundraising / customer calls.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /elevator-pitch — Three Lengths, One Promise

## Why you'd care

A founder who can't compress the pitch into 30 seconds will lose every airport-bar introduction, half the warm-intro emails, and most of the first 15 seconds of every investor call — because the listener's attention budget collapses long before the founder reaches the value prop. Pre-writing 30/60/120-second variants is what stops the pitch from drifting into product features ("it uses Postgres and Temporal") instead of the customer problem; the discipline of compression also surfaces whether the founder actually knows what they're building.

If you can't say it in 30 seconds you don't know what you're building. Three versions: hallway, intro call, full overview.

## Pre-flight
None. Pairs with `/messaging-pillars`, `/tagline-shortlist`, `/pitch-deck-narrative`.

## Inputs
- Positioning statement.
- Messaging pillars (`/messaging-pillars`).
- Target audience for each variant (peer founder / investor / customer / journalist).

## Process
1. **Three length budgets:**
   - 30 sec (~75 words) — hallway / cold intro
   - 60 sec (~150 words) — networking event / warm intro
   - 120 sec (~300 words) — investor first call / customer disco
2. **Five-part skeleton** (compress to fit):
   - **Hook** — pain in customer's words
   - **What** — what you do (no jargon)
   - **For whom** — exact ICP
   - **Why now** — market shift, regulation, tech unlock
   - **Why you** — unfair advantage / traction signal
3. **No-jargon rule** — your mom test version. If grandma doesn't get it, rewrite.
4. **Variants by audience:**
   - Investor: hook + market + traction + ask
   - Customer: hook + outcome + proof + CTA
   - Recruit: hook + mission + team + opportunity
   - Press: hook + why-now + zeitgeist
5. **Practice loop** — record yourself, time it, cut 30%. Read aloud, not on screen.
6. **Cold test** — say to 5 strangers (real strangers, not friends). What did they hear back?

## Output
Write `docs/inception/elevator-pitch-<project>.md`:

```markdown
# Elevator Pitch — <project>
**Date:** <YYYY-MM-DD>
**Audience variants:** investor / customer / recruit / press

## 30-sec (hallway, ~75 words)
> "Indie SaaS teams lose ~2 hours a week debugging stuck background jobs. We're <project> — a drop-in queue dashboard that alerts on stuck workers in 30 seconds and lets you retry from the UI. We're for the 10-30 dev Rails/Node shop that Datadog over-charges. Three pilots, $2k MRR, mean-time-to-resolution down 70%."

## 60-sec (networking, ~150 words)
> [Same hook + expand traction + name a backer / signal]
> Add: "We just closed a pre-seed with <X>, launching on Product Hunt next month."

## 120-sec (investor first call, ~300 words)
> [Full version with market sizing + competitive gap + roadmap]

## Audience variants
### Investor (60s)
- Hook (pain + market)
- What we do
- Traction (MRR, retention, LTV/CAC if known)
- Why now (post-monolith microservice fanout, queue sprawl)
- Ask (raising $X to do Y)

### Customer (60s)
- Hook (their pain, their words)
- Outcome (what changes)
- Proof (case study)
- CTA (book a 15-min demo)

### Recruit (60s)
- Mission
- Team origin
- Stage (pre-seed, 3 in seat)
- Why this hire matters

### Press (60s)
- Zeitgeist (why this is a story now)
- The angle (contrarian, milestone, founder narrative)
- Numbers

## Cold-test results
| Tester | Length used | What they heard back | Match? |
|--------|-------------|----------------------|--------|
| A | 30s | "Background-job monitor" | partial |
| B | 30s | "Anti-stuck-worker alerts" | yes |
| C | 60s | "Datadog competitor" | wrong — fix positioning line |
| D | 30s | "Queue dashboard with retry" | yes |
| E | 60s | "Indie SaaS observability tool" | yes |

## Banned phrases
- "We're like Uber for X"
- "Disrupting the industry"
- "AI-powered" (unless central)
- "End-to-end platform"
- "Best-in-class"
- "Mission-driven" (show, don't tell)

## Next
- Pitch deck → `/pitch-deck-narrative`
- One-pager → `/one-pager-teaser`
- Apply to investor outreach → `/investor-target-list`
```

## Verification
- 3 length variants written (30 / 60 / 120 sec).
- 4 audience variants for 60s.
- Cold-test logged with 5 strangers.
- No jargon, no banned phrases.
- Five-part skeleton present in each variant.

---

## Variants

### Variant A — Hard 30-sec only (pre-conference / hallway)

When you only need the shortest version, dialed for ≤75 words and conversation-opener.

**Process:**
1. **30 sec = ~75 words.** Count them.
2. **Three-sentence frame:** sentence 1 = hook + who you serve; sentence 2 = what changes for them; sentence 3 = proof + ask.
3. **Memorized but not robotic** — say aloud 50x.
4. **End with a question** — turns monologue into conversation.

**Hook bank (memorize 3):**
- Stat: "SMBs lose $X/yr to manual returns"
- Quote: "<customer> said 'where do I sign?'"
- Question: "Know how much time SMB ops spend on returns?"
- Contrast: "Enterprise has Loop. SMB has spreadsheets."

**Rehearsal checklist:** memorized 3 versions (investor / customer / friend); ≤75 words each; timed at 30 sec read aloud; ends in question/CTA; co-founder + 2 friends sanity-checked; mirror-rehearsed + recorded.

### Variant B — Tagline shortlist (when pitch needs a stamp)

Generate + score tagline candidates — clarity, distinctiveness, memorability, TM-clear. Outputs `docs/inception/tagline-shortlist-<project>.md`.

**Process:**
1. **Decide if you need one** — if name + 1-line subhead already clear, skip.
2. **Pick tagline job:** Promise (Nike: "Just Do It") / Category-define (Slack: "Where work happens") / Differentiator (Avis: "We try harder") / Outcome (M&M's).
3. **Generate 30+ candidates** across 5 angles: Benefit-led, Outcome-led, Contrarian, Insider phrase, Poetic.
4. **Cut to 8** — kill the obvious, derivative, generic.
5. **Score on 5 axes (1–5 each):** Clarity, Distinctive, Memorable, On-voice, TM-safe.
6. **Pressure test** — text it cold to 5 ICP. Can they repeat it 30 sec later?
7. **Shortlist 3** for final brand review + TM screen via `/trademark-pre-screen`.

**Banned patterns:** "The X of Y", "Reimagined / reinvented", "AI-powered", "Simple, fast, beautiful" trio, "Made for X" unless X is sharp.

### Variant C — One-pager teaser (warm-intro tool)

One physical page (A4/Letter). Forwarded by intro-er, read in 90 sec, prompts a meeting. Outputs `docs/inception/one-pager-teaser-<project>.md`.

**Layout (top half / bottom half):**
- **Top half:** logo + tagline + 1-paragraph what-we-do + traction tile (4 boxes: MRR, customers, growth rate, unit-econ flagship).
- **Bottom half:** market (1 line bottom-up) + why-us (2 sentences) + use of funds (3–4 line items) + ask + contact (founder name + email + LinkedIn).

**What-we-do template:** "We <verb> <ICP> <noun-of-pain> so they can <outcome>. <Tech approach in one line>."

**Distribution:** PDF + tracked web link (DocSend / Pitch). Warm intros only. CTA: "Reply if you want the deck." Wait 48h, soft follow-up if no reply.

**Anti-patterns:** two pages "to fit more", mission-statement filler, buzzwords, charts that don't render at 100% zoom, logos of "potential customers" who haven't bought.

### Variant D — Founding story (origin moment for press / about / hiring)

The story you'll tell a thousand times. Outputs `docs/inception/founding-story-<project>.md`.

**Five-beat arc:**
1. **Status quo** — life before insight.
2. **Inciting moment** — the specific scene that lit the fuse (one date, sensory detail).
3. **Conviction build** — what you tried / learned / saw repeated.
4. **Decision** — when you committed and what it cost.
5. **Mission forward** — where it leads.

**Three length variants:** Tweet (280 chars), About-page paragraph (~150 words), Pitch/podcast version (~500 words).

**Honesty audit:** no invented scenes; no exaggerated titles/numbers; no timeline compression that misleads; no "we've been working on this for years" if not true.

**Listener test:** tell 3 listeners. Do they remember the inciting moment 24h later? (Immediate recall doesn't count.)

**Why-this-founder check:** if the answer to "what unfair experience makes you the right person?" is "anyone could do this", problem.

**Why-now check:** what changed in the world in the last 1–3 years that makes the timing right? Tech unlock (API, model, hardware), regulatory shift, behavior change, market vacuum.
