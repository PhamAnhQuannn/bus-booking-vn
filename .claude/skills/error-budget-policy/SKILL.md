---
name: error-budget-policy
description: Written error-budget spend policy — what happens when budget exhausted. Release freeze, focus shift, exec escalation. Outputs policy doc to `docs/operate/error-budget-policy-<service>.md`. Reads `/slo-define`. Use when user says "error budget", "release freeze", "burn rate", "/error-budget-policy", or after `/slo-define` lands.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /error-budget-policy — Budget Spend Rules

## Why you'd care

An SLO without a written spend policy is theater — when the budget burns out in week 3 of the quarter, product wants to ship the launch feature anyway, engineering wants to freeze, and the room argues for two days because nobody agreed up front what "out of budget" actually triggers. A pre-signed policy ("budget exhausted = release freeze for the rest of the period, on-call doubles, reliability work takes priority over feature work") is what converts SLOs from a number on a dashboard into an actual operational lever the team can wield without re-litigating the rules each time.

Invoke as `/error-budget-policy`. SLO without policy is decoration. The policy is the lever.

## Pre-flight
1. `docs/operate/slo-<service>.md` must exist.
2. Identify stakeholders: eng lead, product lead, exec sponsor.
3. Policy is written, signed, posted in repo — not a verbal agreement.

## Inputs
- Service + SLO
- Customer SLA tier
- Release cadence (deploys/week)
- Authority — who can override freeze

## Process

1. **Budget consumption tiers**:

   | Consumed | State | Action |
   |---|---|---|
   | 0–50% | Healthy | Ship freely |
   | 50–75% | Caution | Risky changes (migrations, refactors) require review |
   | 75–100% | Warning | New features halted, only bug fixes + reliability work |
   | >100% | Exhausted | **Release freeze.** Only outage-mitigation merges. Exec notified. |

2. **Freeze rules** — what stops, what continues:

   | Activity | Healthy | Caution | Warning | Exhausted |
   |---|:--:|:--:|:--:|:--:|
   | Feature deploys | ✓ | ✓ | ✗ | ✗ |
   | Bug fixes | ✓ | ✓ | ✓ | ✓ |
   | Migrations | ✓ | review | ✗ | ✗ |
   | Reliability work | ✓ | ✓ | ✓ | ✓ |
   | Customer-incident hotfixes | ✓ | ✓ | ✓ | ✓ |
   | Marketing-driven launches | ✓ | exec sign-off | ✗ | ✗ |

3. **Override authority** — who can lift freeze:
   - Single engineer: no
   - Eng manager: no
   - VP Eng + Product VP joint sign-off: yes, with written justification
   - CEO: yes, but logged for retro

4. **Communication cadence** when budget breached:
   - Slack channel auto-posted on threshold cross (50%, 75%, 100%)
   - Weekly status in eng all-hands while in warning/exhausted
   - Customer-facing only if SLA breach imminent

5. **Recovery plan template** — required when entering exhausted state:
   - Top 3 incident causes from this period
   - Concrete reliability work that earns budget back
   - Estimated time-to-recovery
   - Re-evaluate cadence: weekly

6. **Anti-gaming**:
   - Cannot "reset" budget early; rolls only with time window
   - Cannot redefine SLO mid-period to escape freeze
   - Cannot exclude incidents retroactively without exec sign-off

## Output

Write `docs/operate/error-budget-policy-<service>.md`:

```markdown
# Error Budget Policy — <service>
**Date:** <YYYY-MM-DD> | **SLO ref:** `docs/operate/slo-<service>.md` | **Owner:** <VP Eng>

## Spend tiers
| Consumed | State | Permitted |
|---|---|---|
| 0–50% | Healthy | All deploys |
| 50–75% | Caution | Risky changes need review |
| 75–100% | Warning | Bug fixes + reliability only |
| >100% | Exhausted | Outage-mitigation only |

## Freeze actions
- Feature work pauses
- New migrations blocked
- Marketing launches deferred
- Reliability backlog top-of-queue

## Override
- Requires: VP Eng + VP Product joint written approval
- Logged: `docs/operate/budget-overrides.md`

## Recovery requirements
- Top 3 burn sources documented
- Reliability work scoped + sized
- Re-eval weekly while in exhausted state

## Communication
- 50% / 75% / 100% Slack alerts → #eng-reliability
- Weekly all-hands update during warning+
- Customer comms triggered at <projected SLA breach in 7d>

## Signed by
- VP Eng: <name> <date>
- VP Product: <name> <date>
```

## Verification
- Policy doc signed (not draft).
- Each tier has named permitted/forbidden actions.
- Override authority named (not "leadership").
- Freeze starts automatically on threshold, not via human decision.
- Recovery plan template referenced.
