---
name: board-deck-template
description: Quarterly board deck skeleton — KPIs, financials, product, GTM, people, risks, asks; 48-hour pre-read rule; per-slide Decision/Discussion/FYI tagging. Outputs to `docs/inception/board-deck-template-<project>.md`. Use when user says "board deck", "board meeting", "quarterly board", "board materials", "board pre-read", "board pack", "/board-deck-template", or before first board meeting / quarterly cadence. Upstream: `/kpi-dashboard-investor-grade`, `/investor-update-monthly`, `/board-of-directors-setup`. Downstream: `/data-room-prep`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /board-deck-template — Run the Meeting Before You Walk In

## Why you'd care

The worst board meetings are status-updates dressed as governance — the board sits through 45 minutes of "what we did" and has 15 minutes left for the three decisions that matter. Pre-read 48 hours prior + per-slide D/D/FYI tagging + a real asks slide is what turns your highest-cost meeting into actual leverage instead of slides nobody acts on.

## Pre-flight
- Read `/kpi-dashboard-investor-grade` — the KPI slide pulls verbatim from there.
- Read `/investor-update-monthly` — the monthly cadence; the board deck is the quarterly upgrade, not a replacement.
- Read `/board-of-directors-setup` — composition, observer rights, materials policy.
- Confirm a doc-share tool (Docsend, Notion, Google Drive). Avoid email-attachments — no read receipts, no version control.

## Inputs
- Last quarter's KPIs (from `/kpi-dashboard-investor-grade`) with QoQ deltas.
- This quarter's financials (P&L, balance sheet, cash flow, runway).
- Product shipped + roadmap next quarter.
- GTM funnel + pipeline + win/loss.
- Headcount, key hires, key departures.
- Top 3 risks with mitigations.
- 2–4 specific decisions or topics needing the board.

## Process

1. **Lock the cadence.** Quarterly is the standard board cadence for seed/Series A/B (monthly is for crisis). Calendar 8 boards/year for a 4-meeting + 4-update rhythm: 4 meetings (Q1/Q2/Q3/Q4) + 4 written-only updates in the in-between months for material events (annual planning, key hire, term-sheet announcement, etc.).

2. **The 48-hour pre-read rule.** Distribute the deck **48 hours before the meeting**, with a one-line note: "Please read the pre-read. The meeting will not recap slides — we will start at slide 1, ask 'questions or concerns?' for 5 min, and move on." This is the Fred Wilson / John Doerr discipline. Boards that read prevent recap theater and free 75% of meeting time for decisions. If a board member hasn't read it, that's their failure to surface, not yours to remediate live.

3. **Tag every slide D / D / FYI.** Top-right corner of each slide carries one of:
   - **D – Decision needed** (board vote or guidance required)
   - **D – Discussion** (input wanted, no vote)
   - **FYI** (informational; will not be presented, read at home)

   Slide-time allocation derives from tags: FYI slides get 0 minutes of presentation. Decision slides get the most. This is how a 90-minute meeting actually fits in 90 minutes.

4. **The canonical 9-section skeleton.** Order matters — decisions surface early, FYI sweeps later:

   | # | Section | Tag | Min |
   |---:|---|---|---:|
   | 1 | Cover + agenda + asks summary | FYI | 2 |
   | 2 | TL;DR (3 bullets) | D-Discussion | 5 |
   | 3 | KPIs (NSM + 6–8 metrics + QoQ delta + vs plan) | D-Discussion | 15 |
   | 4 | Financials (P&L, cash, burn, runway, vs budget) | D-Decision (budget approvals) | 15 |
   | 5 | Product (shipped, in-flight, next quarter) | D-Discussion | 10 |
   | 6 | GTM (pipeline, win/loss, CAC, payback) | D-Discussion | 10 |
   | 7 | People (org chart, key hires, departures, comp/equity grants) | D-Decision (grants, hires) | 10 |
   | 8 | Risks + mitigations (top 3) | D-Discussion | 10 |
   | 9 | Asks (specific, numbered) | D-Decision | 10 |
   | + | Appendix (detailed financials, cohort tables, customer list) | FYI | 0 |

5. **TL;DR slide — Suster/Lemkin discipline.** Three bullets only:
   - One about progress (the NSM with QoQ delta).
   - One about the single biggest issue.
   - One about the single biggest ask.

   Boards remember the TL;DR; everything else is footnote.

6. **KPIs slide — definitions discipline.** Same metrics, same definitions, every quarter. If a metric stops appearing or is replaced, dedicate a callout slide to explain why — silent metric swaps destroy trust. Show:
   - Current quarter value
   - Last quarter value
   - vs. plan (from last quarter's budget)
   - 4-quarter trailing chart

   Highlight any metric off plan by ≥10% in red, with a one-line "why" annotation.

7. **Financials slide — vs. plan, always.** Board's #1 job is fiduciary; financials are their primary instrument. Each line shows actual vs budget (prior-quarter-approved). Runway calc explicit: cash / current-net-burn. If runway dips below 12 months, that's a slide of its own — call it out, don't bury it.

8. **People slide — equity grants need a board vote.** Any equity grant requires board approval (this is in your stock plan); list grants pending vote with name, role, # of options, vesting. If a key person left, name them, name the cause, name the remediation. Boards forgive bad news; they don't forgive being surprised.

9. **Risks slide — top 3 only.** Source from `/risk-register`. Each risk shows: description, likelihood × impact, mitigation owner, timeline. Risks the board can help with go to the Asks slide.

10. **Asks slide — board as leverage.** 2–4 specific asks. Examples:
    - "Approve the FY26 hiring plan (slide 12) — 6 new hires, $1.4M additional cash burn."
    - "Approve the option grant for new VP Eng (slide 14) — 0.85% over 4yr, 1yr cliff."
    - "Discussion: should we open a Series A conversation now (15 months runway) or push to Q3?"
    - "Intros needed: CRO candidates with B2B SaaS infra experience."

    Each ask has a clear D – Decision or D – Discussion tag and a slide reference.

11. **Pre-read discipline — the 1:1s.** 7–10 days before the meeting, do a 30-minute 1:1 with each board director. Walk them through the deck-in-progress, surface the asks, get pre-alignment. The meeting itself then becomes a ratification of pre-aligned decisions, not a discovery session. Suster: "if the board meeting is the first time a director sees an ask, you've failed."

12. **Executive session by default.** Reserve the last 15 minutes for board-only (no observers, no founders for half of it). This is when the board talks about CEO performance, founder mental health, capital strategy without management in the room. If you skip executive session, board members will catch up off-cycle and you lose visibility into what they're actually worried about.

13. **Minutes + action items — within 48 hours after.** Same-day minutes are too fresh; 7-days-late is delinquent. 48-hour minutes capture: decisions made, votes recorded (with abstains), action items with owner + date, follow-up materials promised. File in the data room (see `/data-room-prep`). These are the corporate-records artifact diligence will eventually request.

14. **Anti-patterns to forbid:**
    - 60-slide deck for a 90-min meeting (presents one slide / 1.5 min — recap theater).
    - Deck shared at the meeting start (no pre-read possible).
    - No D/D/FYI tags (every slide gets equal time → asks slide rushed).
    - "Strategy" slides that are vibes, not decisions (move to a strategy off-site).
    - Surprise bad news (board's biggest grievance — get on a phone call before the deck).
    - No executive session.
    - Late minutes (>1 week post-meeting).
    - Different KPI definitions across the year.

## Output

Write `docs/inception/board-deck-template-<project>.md`:

```markdown
# Board Deck Template — <project>
**Cadence:** quarterly (4 meetings + 4 written interim updates per year)
**Pre-read rule:** distributed 48 hours before meeting via <Docsend / Notion / Drive>
**Meeting length:** 90 minutes board + 15 minutes executive session
**Owner:** CEO drafts; CFO + chief-of-staff support

## Pre-meeting 1:1 cadence
- 7–10 days before meeting
- 30 min per director
- Goal: walk through deck-in-progress, surface asks, pre-align on decisions

## Slide skeleton (D = Decision, Disc = Discussion, FYI = informational)

| # | Slide | Tag | Min | Owner | Content |
|---:|---|---|---:|---|---|
| 1 | Cover + agenda + asks summary | FYI | 2 | CEO | meeting date, attendees, agenda timing, asks list (1-line each) |
| 2 | TL;DR | Disc | 5 | CEO | 3 bullets: progress, biggest issue, biggest ask |
| 3 | KPIs | Disc | 15 | CEO | NSM + 6–8 metrics, QoQ Δ, vs plan, 4Q trailing |
| 4 | Financials | D | 15 | CFO | P&L vs plan, cash, net burn, runway, FY budget vote if applicable |
| 5 | Product | Disc | 10 | CTO/CPO | shipped, in-flight, next quarter, roadmap risks |
| 6 | GTM | Disc | 10 | CRO | pipeline, win/loss, CAC, payback, segment mix |
| 7 | People | D | 10 | CEO | org chart, key hires/departures, equity grants for approval |
| 8 | Risks | Disc | 10 | CEO | top 3 from /risk-register, mitigations, owners |
| 9 | Asks | D | 10 | CEO | 2–4 specific decisions/discussions, slide refs |
| 10+ | Appendix | FYI | 0 | various | detailed financials, cohort tables, customer list, references |
| -- | Executive session | -- | 15 | board chair | board-only; CEO out for half |

## TL;DR slide rules
- 3 bullets only
- One about progress (NSM with QoQ Δ)
- One about biggest issue
- One about biggest ask

## KPIs slide rules
- Same metrics, same definitions, every quarter
- Show: current Q | last Q | vs plan | 4Q trailing chart
- ≥10% off plan → red + one-line "why"
- Metric replacement = dedicated callout slide (no silent swaps)

## Financials slide rules
- Actual vs budget for every line
- Runway = cash / current-net-burn (explicit)
- Runway <12 months = standalone slide
- FY budget vote required at the first board of the new fiscal year

## People slide rules
- Equity grants pending vote: name, role, # options, vesting
- Departures: name, cause, remediation
- Comp adjustments for execs require board vote

## Risks slide rules
- Top 3 from /risk-register only
- Show: description, likelihood × impact, mitigation owner, timeline
- Board-actionable risks → also appear on Asks slide

## Asks slide rules
- 2–4 specific asks, numbered
- Each tagged "D – Decision" or "D – Discussion"
- Slide reference for backup
- Examples:
  - "Approve FY26 hiring plan (slide 12) — 6 hires, $1.4M added burn"
  - "Approve option grant for VP Eng (slide 14) — 0.85% / 4yr / 1yr cliff"
  - "Discuss: open Series A conversation now (15mo runway) or Q3?"

## Pre-read discipline
- Deck distributed 48 hours before meeting
- Note attached: "Meeting will not recap slides. Read pre-read. We start at slide 1, 5 min Q&A, then move on."
- Track open rate on Docsend
- 1:1s with each director 7–10 days prior

## Executive session
- Last 15 min of every meeting
- Board-only; CEO out for ~half
- Topics: CEO perf, founder mental health, capital strategy, succession
- Skip = lose visibility into what board's worried about

## Minutes + action items
- Within 48 hours after meeting
- Capture: decisions, votes (with abstains), action items (owner + date), follow-up materials promised
- File in data room (`/data-room-prep`)

## Anti-patterns enforced
- ❌ 60-slide deck for 90 min
- ❌ Deck shared at meeting start
- ❌ Untagged slides (no D/D/FYI)
- ❌ Vibes-only "strategy" slides
- ❌ Surprise bad news in deck (call directors first)
- ❌ No executive session
- ❌ Late minutes (>1 week)
- ❌ Inconsistent KPI definitions across the year

## Annual board calendar
| Month | Type | Notes |
|---|---|---|
| Q1 mid | Board meeting | FY budget approval |
| Q1 end | Written update | |
| Q2 mid | Board meeting | |
| Q2 end | Written update | |
| Q3 mid | Board meeting | annual strategy / planning off-site adjacent |
| Q3 end | Written update | |
| Q4 mid | Board meeting | year-end review, comp decisions |
| Q4 end | Written update | |

## References
- KPI definitions: `/kpi-dashboard-investor-grade`
- Monthly cadence: `/investor-update-monthly`
- Composition + observers: `/board-of-directors-setup`
- Risks: `/risk-register`
- Diligence storage: `/data-room-prep`
```

## Verification
- 48-hour pre-read distribution is on the calendar, recurring quarterly.
- Every slide carries a D / D / FYI tag; FYI slides get zero presentation time.
- KPI definitions match `/kpi-dashboard-investor-grade` verbatim across quarters.
- Asks slide has 2–4 numbered items, each with slide reference.
- Pre-meeting 1:1s with each director are scheduled 7–10 days prior.
- Executive session is on the agenda for every meeting.
- Minutes filed within 48 hours and archived in the data room.
