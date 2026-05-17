---
name: co-founder-prenup
description: Co-founder breakup pre-agreement — vesting, acceleration, departure triggers, IP, non-compete, mediation. Outputs to `docs/inception/cofounder-prenup-<project>.md`. Skip if solo. Use when user says "co-founder prenup", "founder breakup terms", "what if co-founder leaves", "/co-founder-prenup", before `/founders-agreement`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /co-founder-prenup — Co-Founder Breakup Terms

## Why you'd care

The vesting, acceleration, IP, and departure-trigger terms are easy to agree on while everyone still likes each other and nearly impossible afterward. Writing them in advance is what keeps a co-founder split from taking the company down with it.

The doc you write when you still like each other.

## Pre-flight
Solo? Skip. Multiple founders + `/co-founder-fit-assessment` verdict YES? Run.

## Inputs
- Founders list + role + initial equity stake.

## Process
1. **Vesting schedule** — 4yr cliff 1yr standard? Custom?
2. **Acceleration** — single-trigger (acquisition) vs double-trigger (acquisition + termination). Common: double.
3. **Departure triggers** — voluntary, fired-for-cause, fired-without-cause, disability, death. Equity treatment per trigger.
4. **IP assignment** — all pre-formation IP listed + assigned to company. Side projects carve-outs?
5. **Non-compete + non-solicit** — duration, geography, scope. (Many states unenforceable — note.)
6. **Buyback rights** — company can repurchase unvested + early-vested at FMV or original price?
7. **Mediation clause** — neutral 3rd party before lawyers.
8. **Drag-along / tag-along** — on acquisition.

## Output
Write `docs/inception/cofounder-prenup-<project>.md`:

```markdown
# Co-Founder Prenup — <project>
**Date:** <YYYY-MM-DD>

## Vesting
- Schedule: <4yr/1yr cliff>
- Acceleration: <single/double>

## Departure triggers
| Trigger | Vesting effect | Equity treatment |
|---|---|---|
| Voluntary quit | stop vesting | unvested forfeit |
| Fired for cause | stop + claw | vested may be repurchased |
| Fired without cause | accelerate N months | retain |
| Disability/death | accelerate | retain |

## IP
- Pre-formation IP list: <items>
- Side project carve-outs: <list>

## Non-compete / Non-solicit
- Duration: ... | Geography: ... | Scope: ...

## Buyback
<terms>

## Mediation
<mediator class / process>

## Drag/tag-along
<terms>

## Next
- `/founders-agreement` to formalize with counsel
- `/ip-assignment-agreement` per founder
```

## Verification
- All 8 sections non-empty.
- Counsel review flagged: "NOT LEGAL ADVICE — review with attorney before signing."
