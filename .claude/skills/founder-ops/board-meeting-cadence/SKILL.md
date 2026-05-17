---
name: board-meeting-cadence
description: Founder / CEO / chief of staff responsibility — board meeting cadence — quarterly + interim, pre-read 1 week ahead, agenda template, minutes, executive session, action tracking. Outputs to `docs/inception/board-meeting-cadence-<project>.md`. Use when user says "board meeting", "board cadence", "board pre-read", "board deck", "executive session", "chief of staff board prep", "CEO board agenda", "/board-meeting-cadence", or post-board-formation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /board-meeting-cadence — Board Meetings Are Either Forcing Function Or Theater. No Middle.

Good cadence = decisions made, founder forced to think strategic, investors stay aligned. Bad cadence = status report theater + founder burns 2 weeks prepping a deck nobody reads.

## Why you'd care

Board meetings without pre-reads, agendas, and minutes become founder-therapy sessions or surprise interrogations. A cadence is the structure that makes governance useful instead of reactive.

## Pre-flight
Run after `/board-of-directors-setup`. Pairs with `/investor-update-cadence`, `/kpi-dashboard-investors`.

## Inputs
- Board composition (from `/board-of-directors-setup`).
- Fiscal calendar (quarter ends).
- Investor expectations (term sheet usually mandates 4+ meetings / yr).
- Board portal / tooling choice.

## Process
1. **Lock meeting count** — 4 quarterly + 2-4 interim per year.
2. **Set annual calendar** — pick dates 12 months ahead, lock in invites.
3. **Standardize agenda** — same skeleton every meeting.
4. **Pre-read 1 week ahead** — non-negotiable.
5. **Run meeting with closed/executive session protocol.**
6. **File minutes + resolutions within 1 week.**
7. **Track action items** between meetings.

## Output
Write `docs/inception/board-meeting-cadence-<project>.md`:

```markdown
# Board Meeting Cadence — <project>
**Meetings per year:** 4 quarterly + 2-4 interim
**Duration:** 2-3 hours per meeting
**Pre-read lead time:** 1 week
**Tooling:** <Diligent / Boardable / Carta board portal / Notion>

## Meeting count by stage
| Stage | Quarterly | Interim | Total / yr | Why |
|-------|-----------|---------|-----------|-----|
| Seed | 4 | 0-2 | 4-6 | Don't over-burden tiny team |
| Series A | 4 | 2-4 | 6-8 | More coordination needed |
| Series B+ | 4 | 4-6 | 8-10 | Committees + audit |
| Pre-IPO | 4 | 6-8 | 10-12 | Audit + comp + governance |

Term sheets usually mandate 4+. More than 12 = drag.

## Annual calendar template
| Meeting | Month | Type | Focus |
|---------|-------|------|-------|
| Q1 | Feb | Quarterly | Annual plan approval, prior-yr financials |
| Interim | Mar | Strategic | Specific topic deep-dive |
| Q2 | May | Quarterly | Quarter-end review |
| Q3 | Aug | Quarterly | Mid-year strategy, headcount plan |
| Interim | Oct | Strategic | Fundraise prep or M&A topic |
| Q4 | Nov | Quarterly | Next-year plan draft, comp review |

Lock dates 12 months ahead. Director calendars fill fast.

## Standard agenda (quarterly, 2.5 hr)
| Block | Time | Owner | What |
|-------|------|-------|------|
| Welcome + minutes approval | 5 min | Chair | Approve prior minutes |
| CEO update | 20 min | CEO | Last quarter highlights + concerns |
| Financials | 20 min | CFO | P&L, cash, runway, key variances |
| KPI dashboard | 15 min | CEO/COO | North star + leading metrics |
| Strategic topic 1 | 30 min | Owner | Decision required |
| Strategic topic 2 | 30 min | Owner | Decision required |
| Approvals | 10 min | Chair | Option grants, banking, contracts |
| Closed session | 15 min | Independent + investors | No founders/officers |
| Executive session | 5 min | Board only | No staff |
| Action items recap | 5 min | Secretary | Owner + date |

Total: 155 min ≈ 2.5 hr. Budget overrun = ruthless cut topic 2.

## Pre-read structure (sent 1 week ahead)
```
# Board pre-read — Q<N> 2026

## Executive summary (1 page)
- 3 wins
- 3 risks
- 3 asks of the board

## Financials
- P&L (actual vs plan)
- Cash + runway
- Burn multiple (net new ARR / net burn)
- Top-line forecast next 2 quarters

## KPI dashboard
- North star metric trend
- Leading indicators (pipeline, retention, NPS)
- Cohort retention curves
- Hiring against plan

## Strategic topics (decision required)
1. <topic + recommendation + alternatives>
2. <topic + recommendation + alternatives>

## Operational deep-dives (FYI)
- Product roadmap
- GTM update
- People update
- Tech / infra update

## Approvals needed
- <option grant batch>
- <new banking relationship>
- <major vendor contract>

## Risks register
- Top 5 risks + mitigation status

## Appendix
- Detailed financials
- Hiring plan
- Pipeline detail
```

Length cap: 30-50 pages. Beyond that = nobody reads.

## Board deck templates (reference)
- Sequoia board deck (industry standard)
- a16z board deck (founder-friendly variant)
- Carta board deck (templated)
- DGV (David Sacks) board deck

Don't reinvent — adapt one.

## Closed session protocol
**Closed session** = independent directors + investor directors (NO founders/officers).
- Last 15 min of meeting
- Topics: CEO performance, founder dynamics, sensitive HR
- CEO told outcomes 1 week later
- Lead investor + independent run it

**Executive session** = directors only (no staff, no observers).
- 5 min after closed
- Records: a brief summary in minutes
- Used for: confidential strategic moves

## Founder prep checklist (the week before)
- [ ] Pre-read drafted day -10
- [ ] CFO + COO reviewed day -9
- [ ] Lead investor pre-call day -7 (no surprises rule)
- [ ] Final pre-read sent day -7
- [ ] Independent director pre-call day -5 (optional)
- [ ] Materials in board portal day -7
- [ ] Agenda confirmed day -3
- [ ] Logistics confirmed day -1 (Zoom / room / dial-in)

**No-surprises rule:** lead investor knows everything in the deck before others. Surprises kill trust.

## In-meeting facilitation
- Chair runs the clock. Not CEO.
- Strategic topics → start with founder POV → board reaction → vote/decision
- Use a parking lot for off-topic items
- Capture decisions verbatim in real time
- End every topic with: decision, owner, date

## Minutes + resolutions
Within 1 week:
- Draft minutes (Secretary)
- Circulate for director sign-off
- File signed minutes in corporate records
- Resolutions filed separately (e.g. option grants need standalone consent)

Required content in minutes:
- Date, attendees, quorum confirmed
- Approvals (with director vote tally)
- Material decisions + reasoning
- Action items + owners + dates
- Closed session occurred (yes/no, no content)

DON'T include in minutes:
- Verbatim discussion (creates discovery risk)
- Personnel-sensitive details
- Speculation on M&A targets

Counsel reviews minutes for first 2-3 meetings until template stabilizes.

## Off-cycle decisions (written consent)
For decisions between meetings:
- Action by Written Consent of the Board (no meeting needed)
- Requires unanimous director sign-off (Delaware default — check charter)
- Used for: option grants, banking, routine approvals
- Counsel drafts, founder collects e-signatures (DocuSign / Carta)

Don't abuse — strategic decisions need actual discussion.

## Action item tracking
Between meetings:
| ID | Item | Owner | Due | Status |
|----|------|-------|-----|--------|
| Q1-01 | Hire VP Sales | CEO | 2026-Q2 | In progress |
| Q1-02 | Set option pool refresh | CFO | 2026-Q2 | Done |
| Q1-03 | Customer concentration plan | CRO | 2026-Q3 | Not started |

Review at start of next meeting. Stale items = visible accountability.

## Board portal options
| Tool | Best for | Cost |
|------|----------|------|
| Diligent | Series B+ | $$$ |
| Boardable | Seed-Series A | $$ |
| Carta board portal | Already on Carta | Included |
| Notion + shared drive | Pre-seed / lean | Free |

At seed: Notion + DocuSign + Carta resolutions is enough.

## Cost of board meeting (founder POV)
- 10-15 hr prep (CEO)
- 5-10 hr prep (CFO + COO)
- 3 hr meeting × 5 attendees = 15 person-hr
- 2 hr post-meeting recap + minutes

Total: ~50 person-hr / meeting × 6 meetings = 300 hr / yr. Worth it if decisions happen, else kill 2 meetings / yr.

## Annual board self-evaluation
Once a year:
- Anonymous survey to all directors
- Rate: meeting effectiveness, info quality, founder candor, peer engagement
- Independent director compiles + presents at Q4
- 3 actions to improve next year

Skip in year 1. Start year 2.

## Pitfalls flagged
- [ ] Annual calendar locked 12 months ahead
- [ ] Pre-read 1 week ahead, no exceptions
- [ ] Standard agenda used every meeting
- [ ] Lead investor pre-briefed before pre-read
- [ ] Closed + executive session protocols
- [ ] Minutes filed within 1 week
- [ ] Action items tracked between meetings
- [ ] Board portal chosen

## Anti-patterns
- ❌ Pre-read sent day-of
- ❌ Status-report meeting (no decisions)
- ❌ Founder runs the clock (chair's job)
- ❌ No closed session ever (independent never speaks freely)
- ❌ Verbatim discussion in minutes (discovery risk)
- ❌ 80-page deck (nobody reads)
- ❌ Surprising lead investor in the room
- ❌ Skipping written consents on option grants (cap table error)

## Next
- Investor cadence → `/investor-update-cadence`
- KPI dashboard → `/kpi-dashboard-investors`
- Board setup → `/board-of-directors-setup`
```

## Verification
- Meeting count + duration per stage.
- Annual calendar template.
- Standard agenda blocks.
- Pre-read structure.
- Closed + executive session protocol.
- Minutes + resolutions rules.
- Action item tracking.
