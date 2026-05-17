---
name: catastrophe-mode-design
description: Catastrophe-mode design — fail-safe vs fail-operational vs fail-secure modes per function, degraded operation envelopes, ARP 4754A / DO-178C DAL A-E / IEC 62366 / ISO 26262 ASIL A-D / NRC patterns. Outputs to `docs/inception/catastrophe-modes-<project>.md`. Reads `/project-classify` to skip XS/S/M. Companion to `/iv-and-v-program-design`, `/failure-design`. Use when user says "fail-safe", "fail-operational", "fail-secure", "graceful degradation", "catastrophe mode", "degraded operation", "DO-178 DAL", "ASIL", "FAR Part 25", "IEC 62366", "/catastrophe-mode-design".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /catastrophe-mode-design — Failure-Mode Behavior + Degraded Envelopes

## Why you'd care

Safety-critical systems must keep working — or fail in a known, recoverable way — when components fail. "Crash and restart" is not an answer when a flight control surface stops responding mid-approach, an infusion pump over-doses, a reactor protection trip fails to scram, or a steer-by-wire system loses comms with the steering rack. Pick the right fail mode per function before you design the architecture; you cannot retrofit fail-operational onto a fail-fast codebase.

> **Effort estimate caveat:** `XL: 8h` covers *catastrophe-mode taxonomy + per-function picks + degraded-envelope spec*. Actual implementation of redundancy / lockstep / monitor-actuator / triplex voter architectures is **multi-year + multi-million** and tied to certification gates (DO-178C DAL A, ISO 26262 ASIL D, IEC 62304 Class C, NRC 10 CFR Part 50 Appendix A GDC-21).

Invoke as `/catastrophe-mode-design`. L+ safety-critical only.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/ivv-<project>.md` if exists.
4. Read existing failure analysis (FMEA, FTA, STPA, FHA).

## Inputs
- System function inventory.
- Hazard analysis output (FHA / PHA / FMEA / STPA).
- Domain regime: aviation (ARP 4754A / DO-178C / FAR Part 25 / 23 / 27 / 29), medical (IEC 62304 / IEC 62366 / IEC 60601), nuclear (10 CFR 50 App A / IEEE 603 / 7-4.3.2), automotive (ISO 26262 / FuSa), rail (EN 50126/8/9), industrial (IEC 61508).
- Pilot / operator / patient in the loop? Recovery time available?
- Redundancy budget (mass, power, $).

## Process
1. **Define the three primary failure-mode philosophies**:
   - **Fail-safe** — on failure, transition to a state where harm is impossible/minimized. Example: brake-by-wire defaults to hydraulic backup; reactor scram on loss-of-power; railroad signal defaults red. Cheap, common, suitable when "stop everything" is acceptable.
   - **Fail-operational** — function continues despite failure. Required when "stop everything" is itself catastrophic (mid-flight, surgical procedure mid-cut). Requires redundancy. Expensive.
   - **Fail-secure** — on failure, deny access / lock down. Used in security domains (badge reader fails locked, not unlocked). Sometimes conflicts with fail-safe (fire door wants to fail-safe open; security wants fail-secure closed — code resolves by life-safety).
   - **Fail-silent** — failed unit produces no output (vs spurious output); enables downstream voter to mask. Foundation for triplex.
   - **Fail-stop** — unit halts cleanly on detection; pairs with fail-operational architecture (a fail-stop unit + a hot spare = fail-operational).
2. **Per-function mode picks** — every safety function in inventory gets a mode classification:
   - Hazard severity (Catastrophic / Hazardous / Major / Minor / No Effect — ARP 4761) drives the floor.
   - Exposure time + recovery time available drives op-vs-safe choice.
   - Pilot-in-loop / operator authority: short reaction time (sub-second) often requires fail-operational; longer (minutes) may allow fail-safe with alarm.
3. **DAL / ASIL / SIL / Class assignment** drives implementation rigor:
   - **DO-178C DAL A** (Catastrophic) — required MC/DC structural coverage, formal methods option, full IV&V independence
   - **DAL B** (Hazardous) — Decision coverage; high independence
   - **DAL C** (Major) — Statement coverage
   - **DAL D** (Minor) — minimal
   - **DAL E** (No effect) — no DO-178C
   - **ISO 26262 ASIL A-D** parallel for auto
   - **IEC 62304 Class A/B/C** for medical software (C = death/serious-injury possible)
   - **IEC 61508 / 61511 SIL 1-4** for industrial functional safety
   - **NRC IEEE 7-4.3.2 / 1012 Integrity Level 4** for safety-related nuclear
4. **Architecture patterns** map to mode:
   - **Single-channel with watchdog** — fail-safe at low criticality
   - **Duplex (1oo2 voter)** — fail-stop when units disagree; covers fail-silent failures
   - **Triplex (2oo3 voter)** — fail-operational through one failure; common in flight control (e.g., F-16 quadruplex, 777 triplex)
   - **Quadruplex** — fail-operational through two failures (military fly-by-wire)
   - **Monitor-Actuator (M-A) pair** — actuator does the function; independent monitor cross-checks; mismatch → fail-safe; lighter than triplex
   - **Lockstep CPUs** — two CPUs run same instructions; hardware compare detects single-event upset; auto-recovery
   - **Diverse redundancy** — different teams + different languages + different processors for common-cause-failure avoidance (rare; e.g., Airbus A320 ELAC + SEC computers)
   - **Hot standby / cold standby** — switchover policy
5. **Degraded operating envelopes** — when function partially fails, system may continue with reduced capability:
   - **Reversion modes** — Airbus Normal Law → Alternate Law → Direct Law → Mechanical Backup as systems fail
   - **Operator alerted** — degraded mode must announce itself
   - **Performance envelope** — degraded mode may restrict speed, altitude, load, dose rate
   - **Time-limited operation** — some degraded modes are emergency-only with mission-time limit (return to base, complete current cut, reach safe state)
6. **Aviation patterns** (FAR Part 25 / 23 / 27 / 29 + EASA CS-25):
   - **§25.1309** — equipment / systems / installation; failure conditions; probability targets
     - Catastrophic ≤ 1E-9 / flight hour
     - Hazardous ≤ 1E-7
     - Major ≤ 1E-5
     - Minor ≤ 1E-3
   - **ARP 4754A** — system development assurance
   - **ARP 4761** — safety assessment process (FHA / PSSA / SSA / FMEA / FTA / CCA)
   - **DO-178C** software side; **DO-254** hardware side; **DO-160G** environmental
7. **Medical patterns** (IEC 62304 + IEC 60601 + IEC 62366):
   - **IEC 60601-1** general; -1-8 alarm systems; -2-* specific device types
   - **ISO 14971** risk management; risk acceptable / ALARP
   - **IEC 62304 Class C** — fail-safe required if life threatened; manufacturer must demonstrate hazard mitigation
   - **IEC 62366 usability engineering** — recovery from use error
   - **FDA Premarket Approval (PMA) / 510(k)** require fail-mode documentation
8. **Nuclear patterns** (NRC):
   - **10 CFR 50 Appendix A GDC 21** — protection system reliability and testability
   - **10 CFR 50 Appendix B** — QA criteria
   - **IEEE 603** — safety systems criteria
   - **IEEE 7-4.3.2** — digital safety system criteria
   - **Defense-in-depth**: redundant + diverse + independent
   - Reactor Protection System: 2oo4 / 2oo3 logic typical for scram
9. **Automotive patterns** (ISO 26262):
   - **ASIL D** — most strict (e.g., steering, braking)
   - **Safety goals → functional safety reqs → technical safety reqs → SW safety reqs**
   - **ASIL decomposition** allowed if independent (e.g., ASIL D = ASIL B + ASIL B if redundant)
   - **Safe state** declared per safety goal; fault tolerant time interval (FTTI) bounds detection + mitigation
10. **Common-cause failure (CCF) avoidance**:
    - **Diverse hardware** — different CPUs (PowerPC + ARM), different compilers
    - **Diverse software** — different teams, different languages (Ada + C), N-version programming (controversial; CCF may persist in spec)
    - **Physical separation** — redundant channels in different bays/wings; cable runs separated
    - **Power diversity** — different busses / different sources
    - **Cooling diversity** — different chillers
    - **Operating system diversity** — RTOS + bare metal mix
11. **Failure detection mechanisms**:
    - **Built-in test (BIT)** — power-on + continuous + initiated BIT
    - **Watchdog timers** — independent; cannot be petted by failed code
    - **Sanity checks** — range checks, sign checks, rate-of-change
    - **Cross-channel compare** — voter logic
    - **Heartbeat + leader election** — distributed systems
12. **Recovery / reset**:
    - **Automatic reset** with bounded attempts (3 typical) then fail-safe lockout
    - **Manual reset** required for higher criticality (operator must acknowledge fault before re-enabling)
    - **Latched fault** — system remains in safe state until ground maintenance / surgical pause / shutdown
13. **MISRA C / SPARK Ada / DO-178C coding** — language-level safety:
    - **MISRA C:2012** — 159 mandatory + 21 advisory rules for safety-critical C
    - **SPARK Ada** — formally provable subset; common in aviation / rail
    - **CERT C** — security-critical
    - **AUTOSAR C++14** — auto industry
    - Plus static analysis (Coverity, Polyspace, Astrée, GrammaTech CodeSonar)

## Output
Write `docs/inception/catastrophe-modes-<project>.md`:

```markdown
# Catastrophe-Mode Design — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Safety Lead / Chief Engineer>
**Domain regime:** <FAR Part 25 / IEC 60601 / NRC 10 CFR 50 / ISO 26262 / IEC 61508>
**Standards bundle:** <ARP 4754A + DO-178C + DO-254 / IEC 62304 + 60601 + 62366 / etc.>

## Hazard summary (from FHA)
| Function | Failure | Severity | Probability target | DAL/ASIL/SIL |
|---|---|---|---|---|
| Surface command | erroneous output | Catastrophic | ≤1E-9 /fh | DAL A |
| Surface command | loss | Hazardous | ≤1E-7 | DAL B |
| Crew display | misleading | Hazardous | ≤1E-7 | DAL B |
| Crew display | loss | Major | ≤1E-5 | DAL C |
| Maintenance log | corruption | Minor | ≤1E-3 | DAL D |

## Per-function mode picks
| Function | Mode | Rationale | Pattern |
|---|---|---|---|
| Primary flight control | fail-operational | Catastrophic; sub-second recovery | triplex 2oo3 + diverse compilers |
| Hydraulic backup | fail-safe | Hazardous; pilot-can-revert | M-A pair |
| FADEC engine | fail-operational | Hazardous; engine-out is recoverable but degraded | duplex w/ cross-monitor |
| Cabin pressurization | fail-safe (revert to dump) | Major | single + watchdog |
| Crew alerting | fail-safe (silent alarm path) | Hazardous | duplex announce |
| Cabin lighting | fail-operational (battery backup) | Minor | redundant power |

## Degraded envelopes
| Mode | Trigger | Envelope | Time limit | Crew notification |
|---|---|---|---|---|
| Normal | nominal | full | unlimited | none |
| Alternate Law | flight ctrl computer #1 lost | reduced bank angle limit | unlimited | ECAM caution |
| Direct Law | additional ctrl computer loss | manual trim, no envelope protect | unlimited | ECAM warning |
| Mechanical Backup | all FCC lost | limited control via pitch trim + rudder | land ASAP | red light + aural |

## Architecture patterns selected
- **Primary flight ctrl:** triplex 2oo3 voter, diverse compilers (Ada SPARK + C MISRA), diverse CPUs (PowerPC + ARM), physical separation across wing bays
- **FADEC:** duplex with cross-channel compare; channel A fail-stop → channel B takes over
- **Brake/anti-skid:** dual-channel with monitor-actuator
- **EFB (electronic flight bag):** single-channel, DAL D (non-critical)

## CCF avoidance plan
- HW diversity: PowerPC e500 + ARM Cortex-R5
- SW diversity: SPARK Ada (channel A) + MISRA C (channel B)
- Compiler diversity: GreenHills + WindRiver Diab
- Physical separation: ≥18 in between redundant channels per FAA AC 25.1309-1B
- Power diversity: bus 1 + bus 2 + battery
- Cooling: redundant fans per bay

## Detection mechanisms
| Layer | Mechanism | Coverage target |
|---|---|---|
| HW | lockstep CPUs, ECC RAM, BIT | >99% |
| OS | watchdog, partition violation detection | >99% |
| App | sanity ranges, cross-channel vote | >95% per channel |
| System | end-to-end ack, BIT initiated periodic | >90% latent fault detection |

## Recovery + reset policy
- Automatic reset: up to 3 attempts within 5 sec, then latched safe state
- Manual reset: pilot must acknowledge fault on MFD before re-arm
- Latched-safe: requires ground maintenance reset

## Standards compliance
- ARP 4754A System Dev Assurance: in compliance (PSSA + SSA drafted)
- ARP 4761 safety analyses: FHA done, PSSA in progress, SSA at CDR
- DO-178C: DAL A SW objectives 71/71 (with IV&V); MC/DC required
- DO-254: DAL A HW objectives complete
- DO-160G: env qualification per RTCA
- FAR Part 25 §25.1309: probability targets met per quantitative analysis

## Coding standard
- Channel A: SPARK Ada 2012 + GNATprove formal methods (DAL A claims)
- Channel B: MISRA C:2012 + Polyspace + Coverity
- Banned constructs: malloc, recursion, dynamic dispatch, function pointers (except via cert'd RTOS)
- Stack budget: static analysis + 50% headroom

## Tooling
- Static analysis: Polyspace Code Prover (TQL-5 qualified) + Astrée
- Coverage: VectorCAST (MC/DC for DAL A; qualified)
- Modeling: SCADE Suite (qualified code gen for DAL A)
- RTOS: VxWorks 653 (ARINC 653 partitioning, DO-178C cert kit)
- Hypervisor: PikeOS / LynxOS-178 alternative

## Failure-injection test plan
- HW fault injection: pin-level + clock-glitch (DAL A requirement)
- SW fault injection: forced exceptions, partition crossings, watchdog freezes
- System fault injection: hot pull single channel mid-flight (sim)
- Common-cause sim: simultaneous channel failures from common spec defect

## Risk register
| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| CCF in shared spec | H | M | independent FHA reviewers + N-version on highest-criticality |
| Voter mass / power cost | M | H | early prototype |
| Compiler cert kit gap | M | M | book Greenhills cert support contract Y1 |
| Pilot training for degraded modes | H | M | sim cards + procedure published |

## Cost + schedule impact
- Triplex vs simplex: +3× HW cost + 3× analysis + 2× test
- DAL A vs DAL C IV&V: +25% engineering hours
- Total catastrophe-mode budget: +35-50% over commercial baseline

## 90-day plan
1. Per-function FHA classification locked (week 1-4)
2. Mode pick reviewed by Chief Engineer + IV&V (week 4-6)
3. Architecture pattern decisions for top 5 functions (week 4-8)
4. CCF strategy + diversity plan (week 6-10)
5. Coding-standard decisions per channel (week 8-12)
6. Tooling procurement (week 8-12)
```

## Verification
- Every safety function has a mode picked (fail-safe / fail-operational / fail-secure) with hazard rationale.
- DAL / ASIL / SIL / Class assigned per function with quantitative probability target.
- Architecture pattern (single / duplex / triplex / M-A / lockstep) chosen per function.
- Degraded envelopes named with operator notification + time limits.
- CCF avoidance plan covers HW + SW + physical + power + cooling diversity.
- Detection coverage targets quantified per layer.
- Recovery policy explicit (auto attempts → latched safe → manual reset).
- Coding standard chosen (MISRA / SPARK / CERT / AUTOSAR) with tool qualification.
