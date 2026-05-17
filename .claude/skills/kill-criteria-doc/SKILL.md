---
name: kill-criteria-doc
description: Predefine kill criteria — what observations will force us to pivot or shut down. Outputs to `docs/inception/kill-criteria-<project>.md`. Use when user says "kill criteria", "when to quit", "pivot trigger", "shutdown rules", "/kill-criteria-doc", or before committing 6+ months of effort.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /kill-criteria-doc — Decide When To Quit Before You Want To Quit

## Why you'd care

Without predefined kill criteria, you'll keep extending the runway on a dying idea because every individual month feels too soon to quit. Writing the criteria in advance removes the sunk-cost veto from the decision.

Founders almost never quit on time. Predefine kill triggers when you're rational, not when you're sunk-cost-emotional.

## Pre-flight
Run after `/north-star-metric-pick`, `/runway-model`. Pairs with `/pivot-decision`, `/assumption-register`.

## Inputs
- Critical assumptions (from `/assumption-register`).
- Runway model.
- Personal runway / fallback options.
- Family / partner expectations.

## Process
1. **5 dimensions of kill criteria:**
   - **Traction** — NSM / revenue / growth signal
   - **Unit economics** — LTV:CAC / payback ratio
   - **Burn** — months runway left
   - **Team** — founder/co-founder still committed
   - **Personal** — health, finances, relationship strain
2. **Set the threshold per dimension** — specific, measurable, not "if it feels bad."
3. **Set the timing per dimension** — when do we measure?
4. **Three response tiers per trigger:**
   - **Yellow** — escalation: investigate root cause, replan
   - **Orange** — material pivot: kill one bet, double on another
   - **Red** — full shutdown: wind down, return capital
5. **Pre-commit to action** — written + signed by both founders before triggers fire.
6. **Designated reviewer** — third party (advisor / board) reviews when criteria hit (helps overcome founder denial).
7. **Re-review quarterly** — criteria can shift as company evolves.
8. **Distinguish pivot from kill** — pivot = same problem, different solution; kill = shut down.

## Output
Write `docs/inception/kill-criteria-<project>.md`:

```markdown
# Kill Criteria — <project>
**Date:** <YYYY-MM-DD>
**Founders signed:** Founder A, Founder B
**Designated reviewer:** Advisor X (committed to honest read)
**Review cadence:** Quarterly + on any trigger fire

## Why this exists
> "The biggest mistake founders make is quitting too late."
We write these now while we're rational, so future-emotional-us has guardrails.

## Triggers by dimension

### 1. Traction (NSM + revenue)
| Trigger | Measure at | Response |
|---------|-----------|----------|
| < 3 WCAW median by M6 | Month 6 | 🟡 Investigate activation, replan Q3 |
| < 4 WCAW median by M9 | Month 9 | 🟠 Pivot product wedge or ICP |
| < 4 WCAW + < $100k ARR by M12 | Month 12 | 🔴 Shutdown or hard pivot |

### 2. Unit economics
| Trigger | Measure at | Response |
|---------|-----------|----------|
| LTV:CAC < 2:1 on best channel | M9 | 🟡 Cut bad channels, retest |
| Payback > 24mo on all channels | M9 | 🟠 Pricing rework + channel pivot |
| LTV:CAC < 1.5 on all channels at M12 | M12 | 🔴 Business doesn't economically work — kill |

### 3. Burn / runway
| Trigger | Measure at | Response |
|---------|-----------|----------|
| < 9 mo runway with no path to bridge | Continuous | 🟡 Cut burn 20%, accelerate revenue |
| < 6 mo runway + < $150k ARR | Continuous | 🟠 Cut burn 40%, founders-only mode |
| < 3 mo runway + no investor traction | Continuous | 🔴 Wind down responsibly |

### 4. Team
| Trigger | Measure at | Response |
|---------|-----------|----------|
| Co-founder considering leaving | Anytime | 🟠 Direct convo + advisor mediation |
| Co-founder leaves | Anytime | 🔴 Restructure or shut down (depends on stage) |
| Key employee quits citing direction loss | Anytime | 🟡 Honest re-assessment |

### 5. Personal
| Trigger | Measure at | Response |
|---------|-----------|----------|
| Personal runway < 6 mo + no salary path | Anytime | 🟠 Move to consulting income + part-time founder |
| Health serious deterioration | Anytime | 🔴 Pause / handoff / shutdown — health > company |
| Partner relationship serious strain | Anytime | 🟡 Reduce hours, get help, reassess |

## Pivot vs Kill — how to tell
| | Pivot | Kill |
|---|-------|------|
| Problem still real? | yes | no / no longer in scope |
| Customers still want fix? | yes | no |
| Personal energy left? | yes | no |
| Runway for another swing? | yes | no |
| Co-founder aligned? | yes | no |

If all 5 = yes → pivot. If 2+ = no → kill.

## Shutdown checklist (if red triggered)
1. Inform investors (transparent, fast)
2. Customer comms: 30/60/90-day wind down per `/sunset-plan`
3. Return remaining capital (pro-rata to investors)
4. Cancel vendor contracts
5. Wind down legal entity (Delaware C-Corp dissolution)
6. Data export + delete per privacy policy
7. Founders' joint post-mortem + share publicly (helps future founders)

## Designated reviewer protocol
- When any 🟠 or 🔴 trigger fires, call Advisor X within 7 days
- 30-min review call: are we in denial? real or false alarm?
- Advisor has explicit permission to push back hard
- Decision rests with founders; reviewer just keeps us honest

## What this isn't
- Not a contract to investors (these are internal)
- Not a "we'll quit at the first sign of trouble" (that's the 🟡 tier)
- Not unchangeable — review quarterly

## Pitfalls flagged
- [ ] Triggers are measurable + dated (not vibes)
- [ ] 3-tier response (yellow / orange / red)
- [ ] Both founders signed
- [ ] Designated reviewer named + committed
- [ ] Pivot vs kill heuristic explicit
- [ ] Shutdown checklist drafted (don't rebuild under pressure)
- [ ] Quarterly review cadence

## Next
- Pivot toolkit when triggered → `/pivot-decision`
- Sunset plan if killing → `/sunset-plan`
- Risk register pairing → `/risk-register`
- Founders agreement → `/founders-agreement`
```

## Verification
- 5 dimensions covered.
- Triggers measurable + dated.
- 3-tier response per trigger.
- Pivot vs kill distinguishable.
- Shutdown checklist drafted.
- Designated reviewer named.
- Both founders signed.
