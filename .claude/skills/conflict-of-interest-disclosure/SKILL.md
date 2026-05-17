---
name: conflict-of-interest-disclosure
description: Pre-commit conflict-of-interest disclosure — employer non-compete, prior IP, side projects, family ties, gov work, conflicting equity. Outputs to `docs/inception/coi-disclosure-<project>.md`. Use when user says "conflict of interest", "COI", "non-compete check", "moonlighting", "/conflict-of-interest-disclosure", or before signing founders' agreement.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /conflict-of-interest-disclosure — COI Audit

## Why you'd care

A founder's old employer non-compete or a side-project IP claim that surfaces during Series A diligence kills the round in a week. Disclosing and resolving conflicts at the founders'-agreement stage is what makes the cap table actually clean when it gets stress-tested.

Surface conflicts before they become lawsuits.

## Pre-flight
None. Required before `/founders-agreement`, `/ip-assignment-agreement`.

## Inputs
- Current/recent employer.
- Side projects.
- Family business.
- Government/military service.
- Existing equity in other companies.

## Process
1. **Employer non-compete** — read your offer letter + handbook. Industry, geo, duration. Trade secret clauses. Inventions assignment.
2. **Moonlighting policy** — explicit ban? Disclosure required? On-clock tooling/IP use?
3. **Prior IP** — open-source contributions, patents, papers. Cleanly separable?
4. **Side projects** — list every one of last 5 years. Active or dormant? Customers? Revenue?
5. **Family ties** — spouse/sibling/parent in competing or supplier company?
6. **Gov work** — security clearance, gov contract, ITAR/EAR exposure.
7. **Equity holdings** — minority stakes in other startups? Competing? Advisory shares?
8. **Resolution plan** — disclose, renegotiate, divest, delay until exit, separate IP, etc.

## Output
Write `docs/inception/coi-disclosure-<project>.md`:

```markdown
# Conflict of Interest Disclosure — <project>
**Date:** <YYYY-MM-DD>

## Current employer
- Company: ...
- Non-compete scope: <industry / geo / duration>
- Inventions assignment clause: <yes/no, what it covers>
- Moonlighting policy: <text>

## Prior IP
- Patents: ...
- Open source: ...
- Papers: ...

## Side projects (last 5 yrs)
| Project | Status | Customers | Revenue |
|---|---|---|---|
| ... | ... | ... | ... |

## Family ties
<list>

## Gov work
<clearance / contracts / ITAR / EAR>

## Equity holdings
| Company | % | Vested? | Competitor? |
|---|---|---|---|
| ... | ... | ... | ... |

## Resolution plan
- ...

## Verdict
NO-CONFLICTS | DISCLOSED-OK | NEEDS-LEGAL-REVIEW | BLOCKED-UNTIL-RESOLVED

## Next
- If BLOCKED → resolve before `/founders-agreement`
- If NEEDS-LEGAL → counsel review
- Always → `/ip-assignment-agreement` includes prior-IP carve-outs
```

## Verification
- Every category answered (NONE is fine if true).
- Verdict picked.
- "NOT LEGAL ADVICE" flag present.
