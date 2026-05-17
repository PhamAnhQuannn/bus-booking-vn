---
name: arp4761-safety-assessment
description: ARP4761 civil-aircraft safety assessment process — FHA → PSSA → SSA → CCA (PRA + ZSA + CMA) flow with FTA / FMEA / Markov-analysis tools, hazard classification (Catastrophic / Hazardous / Major / Minor / No Safety Effect), and quantitative failure-rate budgets. Use when user says "ARP4761", "FHA", "PSSA", "SSA", "FTA", "FMEA", "common cause analysis", "particular risks", "zonal safety", "safety assessment", "/arp4761-safety-assessment", or before DAL allocation. Writes docs/safety/arp4761-safety-assessment-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /arp4761-safety-assessment — FHA-to-SSA Flow With Common-Cause Coverage

## Why you'd care

The safety assessment is what tells the program that the autopilot is DAL A rather than DAL C. Run it late and DAL allocations are guesses; run it without common-cause analysis and a single zonal fire or shared bus loss collapses every "independent" channel argument in the FTA.

## Pre-flight

- Pair this with `/arp4754a-system-development` from day one. The two processes are interleaved.
- Confirm the certification basis (Part 23/25/27/29, CS-equivalent) and the applicable target failure-rate budgets (e.g. CS-25 §1309: 1e-9/fh for Catastrophic).
- Identify zonal layout and shared resources (electrical, hydraulic, pneumatic, data bus) early — they drive CCA.

## Inputs

- Aircraft-level function list (shared with ARP4754A).
- Preliminary architecture options.
- Reused-equipment failure-rate data and prior service history.
- Zonal drawing set and routing for shared resources.

## Process

1. **Run the Functional Hazard Assessment (FHA).** Aircraft-level FHA enumerates loss-of-function and malfunction conditions per phase of flight; system-level FHA decomposes to system contributions. Each hazard is classified Catastrophic, Hazardous, Major, Minor, or No Safety Effect with quantitative budgets per certification basis.
2. **Establish quantitative safety budgets.** Per CS-25 / Part 25 §1309 reference: Catastrophic ≤ 1e-9/fh, Hazardous ≤ 1e-7/fh, Major ≤ 1e-5/fh, Minor ≤ 1e-3/fh. Adjust per certification basis. These budgets feed PSSA top events.
3. **Run the Preliminary System Safety Assessment (PSSA).** PSSA decomposes each FHA hazard into a Fault Tree (FTA) and allocates failure-rate budgets to items. PSSA outputs are the IDAL allocations that ARP4754A consumes.
4. **Author the System Safety Assessment (SSA).** SSA closes the PSSA — every top event has a quantitative FTA with item failure rates from data sheets or test, every FMEA item is traced to an FTA basic event, and the budget is shown closed.
5. **Run Common Cause Analysis (CCA).** CCA has three pillars: Particular Risks Analysis (PRA — fire, lightning, HIRF, ice, tire burst, engine rotor burst), Zonal Safety Analysis (ZSA — what shares a zone and can cascade), and Common Mode Analysis (CMA — design errors, software faults, common hardware part). CCA invalidates many independence claims in the raw FTA.
6. **Apply FTA, FMEA, and Markov as appropriate.** FTA for top-down quantitative analysis. FMEA for bottom-up component-level effects. Markov when the system has repair, reconfiguration, or sequence-dependent behaviour the static FTA cannot capture.
7. **Document derived safety requirements.** Each architectural mitigation introduces derived requirements (independence, monitor coverage, latency budgets). Feed these to ARP4754A requirements capture.
8. **Plan in-service safety monitoring.** Closure of an SSA assumes failure rates from the data sheet. In-service monitoring (event reporting, MEL, AD response) feeds back to confirm or revise. Define the operator obligation.
9. **Mark the regulator path.** FHA and SSA are submitted to FAA ACO / EASA CM. No aviation-specific regulator-relations skill in this library — TODO.

## Output Format — `docs/safety/arp4761-safety-assessment-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E (highest in scope)
phase: FHA | PSSA | SSA | CCA | closure
status: draft | reviewed | DER-signed
---

# ARP4761 Safety Assessment — <project>

## Aircraft FHA (excerpt)

| ID | Function | Failure condition | Phase | Effect | Classification | Budget /fh |
|---|---|---|---|---|:--:|---:|
| FHA-AC-012 | Provide longitudinal control | Total loss of pitch control | cruise | uncontrolled descent | Catastrophic | ≤ 1e-9 |
| FHA-AC-013 | Provide longitudinal control | Pitch hardover | cruise | upset | Hazardous | ≤ 1e-7 |
| FHA-AC-031 | Provide nav guidance | Misleading lateral | cruise | CFIT risk | Hazardous | ≤ 1e-7 |
| FHA-AC-044 | Provide crew alerting | Loss of EICAS | any | crew workload | Major | ≤ 1e-5 |

## System FHA decomposition

| Aircraft FHA | System contributor | System hazard |
|---|---|---|
| FHA-AC-012 | FCC | Total FCC loss |
| FHA-AC-012 | Sensors | All AoA loss |
| FHA-AC-013 | FCC | Erroneous hardover output undetected |

## PSSA top-event allocation

| FHA | Top event | Budget /fh | Architectural mitigation |
|---|---|---:|---|
| FHA-AC-012 | FCC total loss | 1e-9 | dual-dissimilar + standby + manual reversion |
| FHA-AC-013 | Undetected hardover | 1e-7 | independent monitor with 50 ms detect |

## FTA basic events (excerpt)

| BE | Description | Source | λ (/fh) |
|---|---|---|---:|
| BE-FCC-A-LOSS | FCC channel A loss | data sheet + test | 1e-5 |
| BE-FCC-B-LOSS | FCC channel B loss | data sheet + test | 1e-5 |
| BE-MON-FAIL | Monitor undetected fail | data sheet | 1e-4 |
| BE-CCF-FCC | Common-cause both FCC | CCA-CMA | 1e-7 |

## FMEA linkage

Every FMEA mode for FCC, sensors, actuators traces to one or more BEs above.

## Common Cause Analysis

### Particular Risks Analysis (PRA)

| Risk | Affected items | Mitigation |
|---|---|---|
| Engine rotor burst (zone Z3) | FCC-A bus, hyd-A | shield + routing offset |
| Lightning Zone 2 | antenna LRUs | bonding + transient protection |
| HIRF Cat H | all avionics | DO-160 §20 qualification |
| Ice (pitot) | air-data probes | heated + triple redundant |

### Zonal Safety Analysis (ZSA)

| Zone | Items present | Failure cascade risk | Mitigation |
|---|---|---|---|
| Z3 (engine bay) | hyd lines, FCC-A bus | fire / fluid spray | separation + firewall |
| Z11 (avionics bay) | FCC A & B, FMS | shared volume | physical separation per ARP4761 |

### Common Mode Analysis (CMA)

| Common cause | Items | Mitigation |
|---|---|---|
| Same processor errata | FCC-A and FCC-B | dissimilar processors |
| Same OS bug | FCC-A and FCC-B | dissimilar OS or qualified single-version |
| Shared maintenance error | both channels | staggered maint intervals |

## Derived safety requirements (feed to ARP4754A)

| ID | Statement |
|---|---|
| DSR-PITCH-001 | Monitor shall detect hardover within 50 ms |
| DSR-PITCH-002 | Channel A and B shall use dissimilar processors |
| DSR-PITCH-003 | Zone Z11 separation shall meet ARP4761 §A guidance |

## In-service monitoring plan

- Event categories: FCC-fault, monitor-trip, sensor-disagree.
- Reporting cadence to TC holder: monthly batch.
- Failure-rate refresh: annual.

## Regulator path

FHA and SSA to FAA ACO / EASA CM at TC / STC / major change. (No aviation-specific regulator-relations skill yet — TODO.)
```

## Boundaries

- This skill plans and structures the safety assessment; it does not produce the quantitative FTA gates or run the actual Markov solver.
- This skill does not allocate DAL on its own — DAL allocation is `/arp4754a-system-development` consuming the FHA output.
- DER and authority sign-off remains with the qualified representative.

## Re-run Behavior

- Re-running after an architecture change refreshes PSSA top-event allocations and may flag previously closed budgets that are now over.
- Re-running after in-service data refresh updates basic-event failure rates and re-evaluates SSA closure.

## Auto-chain

- this ↔ `/arp4754a-system-development` (interleaved; FHA hazards feed FDAL).
- this → `/do-178c-objective-tracing` (software DAL via system process).
- this → `/do-254-hardware` (hardware DAL via system process).
- this → `/do-326a-cyber-airworthiness` (threat-condition severity reuses this hazard scale).
- this → `/safety-case-design` (evidence aggregation).

## Verification

After running:

1. Every aircraft-level function has at least one FHA failure condition with phase-of-flight context.
2. Every Catastrophic and Hazardous hazard has a PSSA top event with quantitative budget.
3. SSA closure shows FTA budget met with real basic-event failure rates.
4. CCA covers all three pillars: PRA, ZSA, CMA.
5. Derived safety requirements are fed back to ARP4754A requirements capture.

## Example Trigger

User: "Run the FHA for the new eVTOL. We have pitch, roll, lift-fan thrust, and battery state as aircraft-level functions."
→ Builds aircraft FHA with phase-of-flight columns, classifies battery-state-loss hazards at hover as Catastrophic, allocates quantitative budgets, and outlines the PSSA top-event structure with CCA pillars for the shared battery bus.
