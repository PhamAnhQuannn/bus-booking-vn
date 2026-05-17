---
name: do-254-hardware
description: DO-254 hardware design assurance for complex electronic hardware (FPGA, ASIC, PLD) — DAL A–D mapping, design data items, elemental analysis, advisory circular AC 20-152 guidance, and tool qualification interface. Use when user says "DO-254", "complex electronic hardware", "CEH", "FPGA certification", "ASIC certification", "elemental analysis", "AC 20-152", "/do-254-hardware", or before submitting hardware for FAA/EASA compliance. Writes docs/safety/do-254-hardware-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 2h
  XL: 4h
---

# /do-254-hardware — Complex Electronic Hardware Assurance Plan

## Why you'd care

DO-254 is the hardware analogue of DO-178C and applies to any complex electronic hardware — FPGAs, ASICs, complex PLDs — in airborne systems. Programs that treat the FPGA as "just hardware" and skip the design data items and elemental analysis end up redoing the synthesis-to-place-and-route trace at the worst possible time, after the board is already in environmental qualification.

## Pre-flight

- Read `/arp4754a-system-development` first — hardware IDAL must be allocated by the system process.
- Read `/arp4761-safety-assessment` — hardware hazard contributions feed the FHA and FTA.
- Distinguish *simple* electronic hardware (e.g. passive networks, fixed-function buffers) from *complex* hardware. Simple hardware follows AC 20-152 simple-EH guidance and does not invoke this skill.
- If synthesis, place-and-route, or simulation tools are credited, pair with `/do-330-tool-qualification`.

## Inputs

- Hardware item inventory with complexity classification (CEH vs simple).
- IDAL per item from `/arp4754a-system-development`.
- Target device (FPGA family, ASIC node, PLD family) and vendor toolchain.
- Reused IP cores and their prior service history or qualification status.

## Process

1. **Confirm CEH classification per item.** Anything with state, configurable logic, or non-trivial timing is complex electronic hardware. Document the classification per item with a short justification — this is the most-disputed line item in DO-254 reviews.
2. **Confirm IDAL per CEH item.** DAL A through D from the system process. DAL E hardware needs no DO-254 plan beyond CM. DAL A and B trigger the most-stringent design data and elemental analysis requirements.
3. **Plan the Hardware Design Assurance Plan (HDAP).** HDAP is the hardware analogue of the PSAC — submitted to the authority for Stage of Involvement review. It captures process choice, IDAL allocation, design lifecycle, and certification liaison.
4. **Enumerate the required design data items.** Hardware Requirements Document (HRD), Hardware Design Document (HDD), Hardware Verification Plan and Procedures, Configuration Management records, Process Assurance records, and Hardware Accomplishment Summary (HAS). DAL A and B add advanced verification methods.
5. **Apply elemental analysis for DAL A and B.** Per AC 20-152 and DO-254 §6.3, DAL A and B hardware require elemental analysis or an equivalent advanced verification method (formal verification, safety-specific analysis, service experience). Define which method per item and the closure criteria.
6. **Plan requirements-based verification.** Each HRD item needs requirements-based test on representative hardware (or a qualified simulator with TQL via `/do-330-tool-qualification`). Robustness includes timing margins, temperature corner cases, and asynchronous interface stress.
7. **Identify reused IP and previously developed hardware.** Vendor IP cores need a Previously Developed Hardware (PDH) argument: prior service experience, alternative MoC, or full re-qualification. Document the disposition per core.
8. **Plan environmental qualification interface.** DO-160 is the environmental qualification standard that runs alongside DO-254. Categories per environment (temperature, vibration, EMI, HIRF, lightning) are scoped here and executed under DO-160. Note that DO-254 design data and DO-160 evidence both land in the certification dossier.
9. **Mark the regulator path.** HDAP and HAS submit to FAA ACO / EASA CM via AC 20-152. No aviation-specific regulator-relations skill in this library — TODO.

## Output Format — `docs/safety/do-254-hardware-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E
phase: planning | development | verification | certification
status: draft | reviewed | DER-signed
---

# DO-254 Hardware Design Assurance Plan — <project>

## Hardware item inventory

| Item | CEH? | Device | IDAL | Reused IP? |
|---|:--:|---|:--:|:--:|
| FCC FPGA | yes | Xilinx Kintex Ultrascale | A | partial (MIG, GTH) |
| Monitor PLD | yes | Microsemi RTAX-S | A | no |
| Power-supply card | no (simple) | discrete | n/a | n/a |
| EICAS display FPGA | yes | Intel Cyclone V | C | yes (display IP) |

## Design data item plan

| Artifact | DAL A | DAL B | DAL C | DAL D |
|---|:--:|:--:|:--:|:--:|
| Hardware Requirements Document (HRD) | yes | yes | yes | yes |
| Hardware Design Document (HDD) | yes | yes | yes | subset |
| Hardware Verification Plan (HVP) | yes | yes | yes | subset |
| Hardware Verification Procedures | yes | yes | yes | subset |
| CM records | yes | yes | yes | yes |
| Process Assurance records | yes | yes | yes | yes |
| Hardware Accomplishment Summary (HAS) | yes | yes | yes | yes |
| Elemental analysis or equivalent | yes | yes | n/a | n/a |

## Advanced verification method (DAL A/B only)

| Item | Method | Tool | TQL (via /do-330) |
|---|---|---|:--:|
| FCC FPGA | elemental analysis | Mentor Questa + custom | TQL-5 |
| Monitor PLD | formal verification | OneSpin / Synopsys VC Formal | TQL-5 |

## Previously developed hardware (PDH) disposition

| IP core | Source | Argument | Evidence |
|---|---|---|---|
| Xilinx MIG (DDR4) | vendor | prior service + vendor data | service-history report |
| GTH transceiver | vendor | prior service | service-history report |
| Display IP | vendor | re-qualification | full HRD + HDD generated |

## DO-160 environmental scope

| Category | Section | Severity | Owner |
|---|---|---|---|
| Temperature/altitude | §4 | F2 | HW |
| Vibration | §8 | S/M | HW |
| EMI | §21 | M | HW |
| HIRF | §20 | Cat H | HW |
| Lightning indirect | §22 | Z2 | HW |

## Regulator path

HDAP and HAS submit via AC 20-152 to FAA ACO / EASA CM. (No aviation-specific regulator-relations skill yet — TODO.)
```

## Boundaries

- This skill plans hardware assurance; it does not write RTL, run synthesis, or perform environmental qualification.
- This skill does not classify simple vs complex electronic hardware on its own — that classification needs DER concurrence.
- DER and authority sign-off remains with the qualified representative.
- DO-160 environmental qualification is scoped here but executed under a separate plan.

## Re-run Behavior

- Re-running after an IDAL change re-derives design data item requirements and may add or remove elemental analysis.
- Re-running after a device family change re-evaluates reused IP disposition.

## Auto-chain

- `/arp4754a-system-development` → this (IDAL allocation).
- `/arp4761-safety-assessment` → this (hazard traceback).
- this → `/do-330-tool-qualification` (credited synthesis / verification tools).
- this → `/safety-case-design` (evidence aggregation).

## Verification

After running:

1. Every hardware item is classified CEH vs simple with justification.
2. Every CEH item has an IDAL with system-process traceback.
3. Design data item list matches DAL per DO-254 Appendix A.
4. DAL A and B items have an elemental analysis or equivalent method with tool TQL identified.
5. Reused IP has a documented PDH disposition.

## Example Trigger

User: "FCC uses a Kintex FPGA at DAL A and a small Microsemi PLD for the monitor at DAL A. Plan the DO-254."
→ Confirms both as CEH, sets the design data item list at DAL A for each, picks elemental analysis for the FPGA and formal verification for the monitor PLD, and flags the synthesis tool for /do-330 qualification.
