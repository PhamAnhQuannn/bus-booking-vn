---
name: skills-gap-inventory
description: Founder skills matrix — what you have, what you lack, what you'll learn vs hire vs outsource. Outputs to `docs/inception/skills-gap-<project>.md`. Use when user says "skills gap", "what do I lack", "hire vs learn", "/skills-gap-inventory", or before `/first-hire-plan`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /skills-gap-inventory — Founder Skills Matrix

Solo founders eat all functions. Know what you'll burn time learning vs delegate.

## Why you'd care

Founders who don't honestly inventory their gaps end up either bottlenecked on the work they hate or outsourcing the things they should have learned. The matrix turns vibes into a hire-vs-learn-vs-outsource decision.

## Pre-flight
None. Feeds `/first-hire-plan` and `/contractor-vs-employee-decision`.

## Inputs
- Idea slug, product class (XS→XL), tech stack rough.

## Process
1. **List 12 functions** — product, eng-backend, eng-frontend, design/UX, devops/infra, security, data/analytics, marketing, sales, customer success, finance/accounting, legal/compliance.
2. **Rate self 0–3 per function** — 0=zero, 1=can read, 2=can ship, 3=can teach.
3. **Criticality 1–5 per function** — how load-bearing for THIS product (XS chess vs XL bank).
4. **Gap score** — criticality − self. Positive = gap.
5. **Strategy per gap** — LEARN (4–8 wks), CONTRACT (per-project), HIRE (FT), DEFER (post-PMF), OUTSOURCE-SAAS (use tool).
6. **Time-to-fill** — when does each gap bite? (Pre-launch, beta, scale.)

## Output
Write `docs/inception/skills-gap-<project>.md`:

```markdown
# Skills Gap — <project>
**Date:** <YYYY-MM-DD>

## Matrix
| Function | Self (0–3) | Criticality (1–5) | Gap | Strategy | Bites at |
|---|---|---|---|---|---|
| Product | ... | ... | ... | ... | ... |
| Eng-backend | ... | ... | ... | ... | ... |
| Eng-frontend | ... | ... | ... | ... | ... |
| Design/UX | ... | ... | ... | ... | ... |
| Devops/infra | ... | ... | ... | ... | ... |
| Security | ... | ... | ... | ... | ... |
| Data/analytics | ... | ... | ... | ... | ... |
| Marketing | ... | ... | ... | ... | ... |
| Sales | ... | ... | ... | ... | ... |
| Customer success | ... | ... | ... | ... | ... |
| Finance/accounting | ... | ... | ... | ... | ... |
| Legal/compliance | ... | ... | ... | ... | ... |

## Top 3 burning gaps
1. <function> — <strategy> — <by when>
2. ...
3. ...

## Next
- HIRE gaps → `/first-hire-plan`
- CONTRACT gaps → `/contractor-vs-employee-decision`
- LEARN gaps → schedule learning blocks
- OUTSOURCE-SAAS → `/vendor-eval` per tool
```

## Verification
- All 12 rows filled.
- Top 3 gaps ranked.
- Strategy keyword used (LEARN/CONTRACT/HIRE/DEFER/OUTSOURCE-SAAS).
