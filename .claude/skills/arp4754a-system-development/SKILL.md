---
name: arp4754a-system-development
description: ARP4754A civil-aircraft system-development process planning — function-development assurance level (FDAL) and item DAL (IDAL) allocation, Assurance of Compliance (AoC) matrix, requirements capture and validation, integration of DO-178C and DO-254 below. Use when user says "ARP4754A", "FDAL", "IDAL", "system development", "AoC matrix", "function allocation", "/arp4754a-system-development", or before subordinate software or hardware DAL is set. Writes docs/safety/arp4754a-system-development-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /arp4754a-system-development — System-Level DAL Allocation and AoC

## Why you'd care

ARP4754A is the bridge between aircraft-level safety analysis and the software/hardware certification standards. Skip it and the program is left guessing what DAL a given LRU should be — either over-certifying everything at DAL A and burning budget, or under-allocating and rebuilding the evidence base after FHA review.

## Pre-flight

- Pair this with `/arp4761-safety-assessment` from the first day of the program. The two processes are interleaved by design.
- Confirm the certification basis (Part 23/25/27/29, CS-equivalent) and any special conditions.
- Identify the aircraft-level function list before decomposing to items.

## Inputs

- Aircraft-level function inventory (e.g. "Provide pitch control", "Provide nav guidance").
- Preliminary architecture options (federated, IMA, mixed).
- Reused or COTS items and their prior service-history claims.
- Customer or program directive on Means of Compliance (MoC) preferences.

## Process

1. **Capture aircraft- and system-level functions.** Each function is a verb-noun statement at the aircraft level, decomposed to system functions and then to items (LRUs / boards / software components). The function tree is the spine of every downstream allocation.
2. **Define the Function Development Assurance Level (FDAL).** FDAL is the development rigor applied at the function level — driven by the FHA hazard classification from `/arp4761-safety-assessment`. Catastrophic → FDAL A, Hazardous → FDAL B, Major → FDAL C, Minor → FDAL D, No Safety Effect → FDAL E.
3. **Allocate Item Development Assurance Levels (IDAL).** IDAL is per item (component). ARP4754A Table 5 allows IDAL reduction below FDAL when architectural mitigations (independence, dissimilarity, monitoring) are credited. Document each reduction with the architectural argument.
4. **Build the Assurance of Compliance (AoC) matrix.** AoC matrix maps each safety objective to one or more Means of Compliance: analysis, similarity, test, simulation, or in-service experience. Each MoC is bound to specific evidence items.
5. **Capture and validate requirements.** ARP4754A draws a sharp line between *validation* (right requirement) and *verification* (built right). Validation arguments include analysis, test, similarity, engineering judgement, and modeling. Every requirement has a captured validation argument.
6. **Plan derived requirements review.** A derived requirement has no parent at the next level up — it was introduced by the design. Each derived requirement must be fed back to the safety process for hazard re-assessment. Programs that skip this re-feed introduce silent hazards.
7. **Lock the configuration-management and SQA processes.** ARP4754A §6 requires CM and SQA processes scoped to the system level — distinct from DO-178C SCM/SQA which only cover software. Define the system-level CM database and the SQA audit cadence.
8. **Integrate DO-178C and DO-254 below.** Map every software item to a DO-178C objective plan via `/do-178c-objective-tracing`, every complex electronic hardware item to a DO-254 plan via `/do-254-hardware`. Simple hardware follows AC 20-152 simple-EH guidance.
9. **Mark the regulator path.** FAA ACO or EASA CM at TC, STC, or major change. No aviation-specific regulator-relations skill yet in this library — TODO.

## Output Format — `docs/safety/arp4754a-system-development-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E (highest in scope)
phase: function-capture | allocation | validation | integration | closure
status: draft | reviewed | DER-signed
---

# ARP4754A System Development Plan — <project>

## Aircraft and system function tree

| ID | Level | Function | Parent |
|---|---|---|---|
| F-AC-01 | Aircraft | Provide longitudinal control | — |
| F-SYS-01 | System | Pitch axis control | F-AC-01 |
| F-SYS-02 | System | Pitch trim | F-AC-01 |
| F-ITEM-01 | Item | Primary FCC pitch loop | F-SYS-01 |
| F-ITEM-02 | Item | Secondary FCC pitch loop | F-SYS-01 |

## FDAL / IDAL allocation

| Function/Item | FHA hazard | FDAL | IDAL | Independence/dissimilarity argument |
|---|---|:--:|:--:|---|
| F-SYS-01 Pitch axis | FHA-012 Catastrophic | A | — | — |
| F-ITEM-01 Primary | (inherits) | A | B | dual-channel dissimilar; monitor at IDAL A |
| F-ITEM-02 Secondary | (inherits) | A | B | dual-channel dissimilar |
| Monitor | (inherits) | A | A | independent comparator |

## AoC matrix

| Safety objective | MoC | Evidence | Owner |
|---|---|---|---|
| Pitch axis loss < 1e-9/fh | analysis | FTA-PITCH-01 | Safety |
| Pitch hardover detection < 50 ms | test + analysis | TR-MON-44, FTA-PITCH-02 | V&V + Safety |
| FCC SW DAL A | similarity (not used) / dev | DO-178C plan | SW |
| FCC HW DAL A | dev | DO-254 plan | HW |

## Validation argument register

| Req ID | Statement | Validation method | Evidence |
|---|---|---|---|
| HLR-PITCH-001 | System shall detect hardover ≤ 50 ms | analysis + test | MEM-VAL-PITCH-001 |
| HLR-PITCH-002 | Latency ≤ 20 ms end-to-end | analysis | TIMING-MODEL-01 |

## Derived requirements register

| Derived req | Origin | Re-fed to safety? | New hazard? |
|---|---|:--:|:--:|
| HLR-PITCH-DER-001 (RAM scrub period) | design | yes | no |
| HLR-PITCH-DER-002 (BIT coverage 99%) | design | yes | no |

## System CM and SQA

- CM tool: <name>; covers system reqs, ICDs, architecture artifacts.
- SQA audit cadence: gate-driven (PDR, CDR, TRR, FRR).

## Integration with DO-178C / DO-254

| Item | DAL | Subordinate plan |
|---|:--:|---|
| FCC pitch SW | B | /do-178c-objective-tracing |
| FCC pitch FPGA | B | /do-254-hardware |
| Monitor SW | A | /do-178c-objective-tracing |
| Power-supply card | n/a (simple) | AC 20-152 |

## Regulator path

Submit to FAA ACO / EASA CM at TC / STC / major change. (No aviation-specific regulator-relations skill yet — TODO.)
```

## Boundaries

- This skill plans system development and allocation; it does not perform the safety analysis itself (that is `/arp4761-safety-assessment`).
- This skill does not write requirements; it defines the framework in which requirements are captured and validated.
- DER and authority sign-off remains with the qualified representative.

## Re-run Behavior

- Re-running after an architecture change rebuilds the function tree and re-derives IDAL from FDAL with the new independence arguments.
- Re-running after a derived-requirement batch refreshes the safety re-feed log.

## Auto-chain

- `/arp4761-safety-assessment` ↔ this (interleaved; FHA hazard feeds FDAL).
- this → `/do-178c-objective-tracing` (software items).
- this → `/do-254-hardware` (complex electronic hardware items).
- this → `/do-326a-cyber-airworthiness` (security architecture shares the function tree).
- this → `/safety-case-design` (evidence aggregation).

## Verification

After running:

1. Every aircraft-level function decomposes to system functions and items with unique IDs.
2. Every function and item has an FDAL or IDAL with FHA traceback.
3. IDAL reductions below FDAL have a documented architectural argument.
4. The AoC matrix names a MoC and evidence ID per safety objective.
5. Derived requirements are re-fed to the safety process and tracked.

## Example Trigger

User: "New eVTOL program, Part 23-equivalent. Start the ARP4754A plan with pitch and roll axes at Catastrophic."
→ Captures aircraft and system functions, allocates FDAL A to pitch and roll, derives IDAL B per channel with dissimilar dual-channel argument, and builds the AoC matrix tying each safety objective to a Means of Compliance.
