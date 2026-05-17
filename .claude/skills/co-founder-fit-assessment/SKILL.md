---
name: co-founder-fit-assessment
description: Pre-commit co-founder fit audit — skills overlap, values, conflict history, working style, financial alignment. Outputs to `docs/inception/cofounder-fit-<name>.md`. Skip if solo. Use when user says "co-founder", "find co-founder", "co-founder fit", "/co-founder-fit-assessment", or before signing founders' agreement.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /co-founder-fit-assessment — Co-Founder Fit Audit

## Why you'd care

Co-founder split is the single most common cause of early-stage death, and it's also nearly impossible to unwind once equity has vested. A pre-commit fit audit on skills, values, conflict history, and money beliefs catches the divorce-shape before the marriage.

Marriage with money. Run before equity split, not after.

## Pre-flight
Solo dev? Skip. Two+ founders? Run per candidate.

## Inputs
- Candidate name + role intent (technical, GTM, ops).
- Hours together prior (any prior project, hackathon, work).

## Process
1. **Skill overlap matrix** — list 8 functions (eng, design, sales, ops, finance, legal, hiring, support). Mark who covers what. Gap > 2 = co-founder candidate fits or doesn't.
2. **Values audit** — 10 scenarios (lay off friend, accept dirty money, ship vs ethics, fast exit vs slow build). Both answer independently then diff.
3. **Conflict history** — name 3 past conflicts. How resolved? Pattern?
4. **Working style** — async vs sync, maker vs manager, morning vs night, remote vs office.
5. **Financial alignment** — runway each has, dependents, salary minimum acceptable.
6. **Reversibility test** — would you be friends after a breakup?
7. **Verdict** — YES / NOT-YET (defer 3mo trial) / NO.

## Output
Write `docs/inception/cofounder-fit-<name>.md`:

```markdown
# Co-Founder Fit — <name>
**Date:** <YYYY-MM-DD>

## Skill overlap matrix
| Function | You | Them |
|---|---|---|
| Engineering | ... | ... |
| ...

## Values diff
| Scenario | Your answer | Their answer | Aligned? |
|---|---|---|---|
| ...

## Conflict history
- ...

## Working style
- ...

## Financial alignment
- Runway: <you> / <them>
- Salary min: <you> / <them>

## Reversibility
<free text>

## Verdict
YES | NOT-YET (3-mo trial) | NO

## Next
- If YES → `/co-founder-prenup` then `/founders-agreement`
- If NOT-YET → 3-month informal project together, re-run
- If NO → continue solo or keep searching
```

## Verification
- All 8 skill rows filled, 10 values diffed, conflict pattern named, verdict picked.
