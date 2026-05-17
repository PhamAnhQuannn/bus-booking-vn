---
name: beachhead-segment-pick
description: Pick the beachhead segment — narrowest, urgent, reachable, wallet-bearing slice to win first. Aulet "Disciplined Entrepreneurship" step. Outputs to `docs/inception/beachhead-<project>.md`. Use when user says "beachhead", "first segment", "where to start", "/beachhead-segment-pick", or after `/market-segmentation`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /beachhead-segment-pick — Win Narrow First

## Why you'd care

A horizontal pitch to "everyone" produces zero references, zero word-of-mouth, and zero compounding. Picking a narrow, urgent, wallet-bearing tribe first is how the product gets the first ten happy customers who tell the next hundred.

A startup that addresses everyone reaches no one. Pick one tribe.

## Pre-flight
Run after `/market-segmentation` (or have 5-10 candidate segments).

## Inputs
- 5-10 candidate segments from market segmentation.
- Founder reach / network advantage notes.

## Process
1. **List candidates** — 5-10 segments (industry × role × company-size × geography).
2. **Score per segment** on 6 axes 1-5:
   - **Pain intensity** (5 = hair on fire, 1 = nice-to-have)
   - **Wallet** (5 = budget exists today, 1 = no budget)
   - **Reachability** (5 = you can email/call/visit, 1 = no path)
   - **Homogeneity** (5 = they talk to each other, 1 = scattered)
   - **Compelling reason to buy now** (5 = deadline/regulation/incident, 1 = nothing forcing)
   - **Adjacent expansion** (5 = winning here opens 3+ neighbors, 1 = dead-end)
3. **Sum scores** — top 1-2 emerge. Avoid picking the highest TAM if it scores low on reach/urgency.
4. **Persona zoom** — for top pick, define one buyer + one user + their daily workflow.
5. **Reachable list test** — can you name 10 specific people in this segment by end of week? If no, segment is fictional.
6. **Kill criteria** — what would make you abandon this beachhead? (e.g., < X% close rate after 20 conversations).

## Output
Write `docs/inception/beachhead-<project>.md`:

```markdown
# Beachhead Segment — <project>
**Date:** <YYYY-MM-DD>

## Scoring matrix
| Segment | Pain | Wallet | Reach | Homog. | Why now | Adjacent | Total |
|---------|------|--------|-------|--------|---------|----------|-------|
| Rails background-job teams, US, 10-50 devs | 5 | 4 | 5 | 4 | 4 | 4 | **26** |
| Enterprise platform teams, US, 500+ devs | 4 | 5 | 2 | 3 | 2 | 3 | 19 |
| ... | ... | ... | ... | ... | ... | ... | ... |

## Pick
**Segment:** <name>
**Total score:** <X>/30
**Tiebreaker (if any):** <reasoning>

## Persona
- **Buyer:** <role, name a real example>
- **User:** <role, name a real example>
- **Workflow trigger:** <when/why they look for a tool>

## Reachable list test
| # | Name | Company | How I'll reach |
|---|------|---------|----------------|
| 1 | ... | ... | LinkedIn warm intro |
| 2 | ... | ... | Industry meetup |
| ... | ... | ... | ... |

(Target: 10 names by <date>)

## Compelling reason to buy now
<event, regulation, deadline, recent incident>

## Adjacent expansion order
1. <beachhead>
2. <neighbor 1> (shared <attribute>)
3. <neighbor 2>

(See `/bowling-pin-sequence` for expansion plan.)

## Kill criteria
- < <X>% positive interview rate after <Y> conversations
- Cannot name 10 reachable contacts after <Z> days
- Pain rated < 3 by < 7/10 prospects

## Next
- Expansion plan → `/bowling-pin-sequence`
- ICP detail → `/ideal-customer-profile`
- Buyer detail → `/buyer-persona-deep`
- Run interviews → `/mom-test-protocol`
```

## Verification
- ≥ 5 candidates scored.
- One segment selected with score rationale.
- Persona names real example.
- 10-name reachable list test target dated.
- Kill criteria numeric.
