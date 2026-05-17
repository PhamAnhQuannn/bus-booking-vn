---
name: letter-of-intent
description: Get signed/written non-binding LOI from prospects committing to evaluate or buy at price X. Outputs to `docs/inception/loi-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "LOI", "letter of intent", "soft commitment", "/letter-of-intent", or for B2B/enterprise sales motion.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /letter-of-intent — Soft Commitment Capture

## Why you'd care

Verbal interest evaporates by the time you ship; a signed LOI at price X is the only customer-validation signal that survives contact with the calendar. The artifact is also what a Series A investor expects to see for enterprise GTM.

Invoke as `/letter-of-intent`. B2B real signal. Verbal ≠ written.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (LOI = enterprise dance)
   - M+ → recommended for B2B
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- 5–20 named B2B prospects.
- Price tier under test.
- LOI template (legal-reviewed if possible).

## Process
1. **Draft LOI template** — non-binding, includes:
   - Problem statement (their words from interview).
   - Solution outline (1 paragraph).
   - Pricing range ($X–$Y).
   - Conditions for purchase ("once X feature exists, by Y date").
   - Signature block + date.
2. **Pitch in person/call** — never cold-email LOI.
3. **Follow-up email** — attach LOI within 24h of meeting.
4. **Track**:
   - Said YES verbally (weak)
   - Asked to share with team (medium)
   - Returned signed LOI (STRONG)
5. **Conversion goal** — ≥25% of pitched prospects sign = strong.

## Output
Write `docs/inception/loi-<project>.md`:

```markdown
# Letter of Intent — <project>
**Date:** <YYYY-MM-DD> | **Pitched:** N | **Signed:** N

## LOI template
- File: `docs/inception/loi-template.md` (or PDF)
- Price range: $X–$Y
- Conditions: <list>

## Pipeline
| # | Org | Contact | Pitched date | Status | Signed date | Notes |
|--:|---|---|---|---|---|---|
| 1 | <org> | <name> | YYYY-MM-DD | SIGNED | YYYY-MM-DD | Wants feature X |
| 2 | <org> | <name> | YYYY-MM-DD | YES-VERBAL | — | "send me the contract" |
| 3 | <org> | <name> | YYYY-MM-DD | NO | — | "budget frozen Q4" |

## Funnel
- Pitched: N
- Verbal yes: N
- Asked to share: N
- Signed LOI: N
- Conversion: X%

## Total committed value
- Sum of LOI ranges: $X–$Y/yr
- Discounted (50% close rate): $X/yr

## Verdict
**ENTERPRISE-DEMAND-PROVEN / WARM-NOT-COMMITTED / NO-DEMAND**

## Next
- PROVEN → start build with named pilot customers
- WARM → 1 more iteration on LOI conditions
- NO → /idea-kill-list (B2B pivot or kill)
```

## Verification
- LOI signed (verbal ≠ signature).
- ≥5 pitched (1 yes from 1 ask = no signal).
- Conditions in LOI specific (vague = won't convert).
- Conversion rate computed.
