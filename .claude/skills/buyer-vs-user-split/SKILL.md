---
name: buyer-vs-user-split
description: Map buyer / user / payer / champion / blocker split in the buying group. B2B sales reality. Outputs to `docs/inception/buyer-user-split-<project>.md`. Use when user says "buyer vs user", "buying committee", "champion", "economic buyer", "/buyer-vs-user-split", or before B2B sales motion.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /buyer-vs-user-split — Different People, Different Pitches

## Why you'd care

B2B deals stall in the dark — between a champion who can't sign and an economic buyer who never saw a demo. Mapping the buying group up front means your collateral, demo, and pricing land at the right person at the right step, not the wrong combination.

The person using the product is rarely the one signing the check. Mapping wrong = stalled deals.

## Pre-flight
None. Pairs with `/buyer-persona-deep`, `/sales-playbook-skeleton`.

## Inputs
- Beachhead segment.
- 3-5 wins or in-flight deals to reverse-engineer.

## Process
1. **Identify the roles** in target customer's buying group:
   - **User** — uses the product daily; cares about UX + workflow
   - **Buyer (champion)** — initiates the search, drives the project
   - **Economic buyer** — signs the check, cares about ROI + risk
   - **Technical buyer** — IT/security gate, cares about integration + compliance
   - **End influencer** — staff / customers downstream of the user
   - **Blocker** — finance / procurement / incumbent vendor advocate
2. **Map per role** for target segment — title, motivation, top pain, what kills the deal for them.
3. **Pitch per role** — one-line value prop tuned to each.
4. **Identify gatekeepers** — who must say yes (vs who can veto silently).
5. **Sequencing** — typical deal walks champion → technical → economic. Plan touch sequence.
6. **Single-decider check** — for SMB, often one person = user + buyer + economic. State this if true.

## Output
Write `docs/inception/buyer-user-split-<project>.md`:

```markdown
# Buyer vs User Split — <project>
**Date:** <YYYY-MM-DD>

## Buying group map
| Role | Title (target) | Motivation | Top pain | Kills deal if... |
|------|----------------|-----------|----------|-------------------|
| User | Floor manager | "make my shift easier" | Reseating waitlist | Adds clicks vs paper |
| Champion | GM | "make the room run smoother" | No-shows | No quick win in week 1 |
| Economic buyer | Owner | "ROI in 90 days" | Lost revenue, staff cost | Annual contract too long |
| Technical buyer | (none) — single-owner SMB | — | — | — |
| End influencer | Wait staff, hosts | "don't break my routine" | Training burden | Steeper than current paper |
| Blocker | Incumbent POS vendor | Renewal lock-in | Risk of POS conflict | Integration breaks ticket flow |

## Pitch per role
**User:** "Two-tap reseating from your phone."
**Champion:** "Cuts no-show revenue loss by <X>% in 30 days, demonstrable to owner."
**Economic buyer:** "Pays for itself in <Y> covers. Month-to-month — cancel anytime."
**Influencer staff:** "Replaces the paper book; same workflow + alerts on no-shows."
**Blocker (POS vendor):** "Read-only POS integration; we never touch your ticket flow."

## Gatekeepers
- **Must say yes:** <Owner / Champion>
- **Can veto silently:** <Wait staff at adoption, POS vendor at integration>

## Deal sequence
1. Land champion (free trial / demo)
2. Champion brings owner — show ROI math
3. Staff trial week 1 — capture buy-in
4. Owner signs

## Single-decider scenarios
- Single-owner bistro < 20 staff: User = Champion = Economic buyer → 1 pitch tuned to "make my night easier AND pay for itself"

## Risks
- If champion leaves company → deal dies. Mitigation: get owner in conversation by week 2.
- If staff resist at training → owner backs out. Mitigation: 1-page staff onboarding sheet.

## Next
- Deep persona per role → `/buyer-persona-deep`
- Sales script per role → `/sales-playbook-skeleton`
- Discovery questions → `/customer-interview-script`
```

## Verification
- All 6 roles addressed (or marked N/A for SMB single-decider).
- Per-role pitch differs meaningfully.
- Gatekeepers vs vetoers separated.
- Deal sequence numbered.
