---
name: do-178c-objective-tracing
description: DO-178C software-level objective tracing and structural coverage planning for airborne software. Maps DAL A–E objective sets (71 at DAL A), builds bidirectional traceability from high-level requirements through low-level requirements, source code, and tests, and selects MC/DC vs decision vs statement coverage per DAL. Use when user says "DO-178C", "DAL", "software certification", "MC/DC", "structural coverage", "objective trace", "/do-178c-objective-tracing", or when scoping airborne software for FAA/EASA submission. Writes docs/safety/do-178c-objective-tracing-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /do-178c-objective-tracing — DAL-Indexed Objective and Coverage Plan

## Why you'd care

A DO-178C audit fails when the DER asks for a single high-level requirement and you cannot show its low-level decomposition, source implementation, and verification result on one screen. Objective-by-objective tracing planned up front is the difference between a clean Stage of Involvement 4 and re-flying the entire test campaign late in the program.

## Pre-flight

- Read `/arp4754a-system-development` output first — software DAL must be allocated by the system process before tracing makes sense.
- Read `/arp4761-safety-assessment` to confirm the hazard classification that drives the DAL.
- Confirm the target certification basis (Part 23/25/27/29, CS-23/25/27/29, or military equivalent) and the cognizant authority (FAA ACO, EASA CM, TCCA).
- If tool outputs will be credited toward objectives, `/do-330-tool-qualification` must run alongside.

## Inputs

- System-level requirements allocated to software, with DAL per function.
- Software life-cycle data plan (PSAC draft) if one exists.
- Target programming language, RTOS, and target processor architecture.
- Existing requirement-management tool (DOORS, Jama, Polarion) and test framework.
- Reused or COTS software components and their prior service history.

## Process

1. **Confirm DAL per software component.** DAL A (catastrophic) requires the full 71 objectives, DAL B (hazardous) 69, DAL C (major) 62, DAL D (minor) 26, DAL E (no safety effect) zero with documented rationale. Record the DAL with a traceback to the FHA hazard ID from `/arp4761-safety-assessment`.
2. **Enumerate the objective set by table.** Walk DO-178C Annex A Tables A-1 through A-10 and mark applicability per DAL. Note independence requirements: at DAL A and B several verification objectives require independence between author and verifier. Capture this in the responsibility matrix.
3. **Build the bidirectional traceability skeleton.** Establish four trace layers: system-allocated requirement → high-level software requirement (HLR) → low-level software requirement (LLR) → source code unit → test case → test result. Every artifact at every layer needs an ID. Orphan LLRs and untraced source are the two most common audit findings.
4. **Select structural coverage per DAL.** DAL A requires Modified Condition/Decision Coverage (MC/DC) per DO-178C §6.4.4.2, DAL B requires Decision Coverage (DC), DAL C requires Statement Coverage. Document the coverage tool, its qualification status (TQL via `/do-330-tool-qualification`), and the analysis procedure for any uncovered code.
5. **Define dead-code and deactivated-code policy.** Dead code (unreachable, no requirement) must be removed. Deactivated code (present but disabled in this configuration) must be traced to a requirement that justifies its presence and to evidence that its activation paths are blocked. Both policies are written before the first build.
6. **Plan the requirements-based test campaign.** Each HLR needs normal-range and robustness tests; each LLR needs at least one test that exercises it. Robustness includes boundary, out-of-range, and erroneous-input cases. At DAL A and B, test procedures and test results must be reviewed with independence.
7. **Plan the data and control coupling analysis.** DAL A and B require analysis of inter-component data and control coupling (DO-178C §6.4.4.2.c). Identify the tool or manual procedure, the coupling matrix format, and the closure criteria.
8. **Lock the Plan for Software Aspects of Certification (PSAC) outline.** Capture the five required plans: PSAC, SDP (Development), SVP (Verification), SCMP (Config Mgmt), SQAP (Quality Assurance). The PSAC is the contract with the authority — submit it for Stage of Involvement 1 review before coding begins in earnest.
9. **Mark the FAA/EASA submission path.** Note in the body: submit PSAC to FAA ACO or EASA CM per the certification basis. There is currently no aviation-specific regulator-relations skill in this library; this is a TODO for the pack.

## Output Format — `docs/safety/do-178c-objective-tracing-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E
phase: planning | development | verification | certification
status: draft | reviewed | DER-signed
---

# DO-178C Objective Tracing and Coverage Plan — <project>

## DAL allocation summary

| Component | Function (from ARP4754A) | Hazard ref (FHA) | DAL | Objective count |
|---|---|---|:--:|---:|
| FCC primary loop | Pitch axis control | FHA-012 | A | 71 |
| FMS nav | Lateral guidance | FHA-031 | B | 69 |
| EICAS display | Crew alerting | FHA-044 | C | 62 |

## Objective applicability matrix

| Table | Title | DAL A | DAL B | DAL C | DAL D | Verification independence |
|---|---|:--:|:--:|:--:|:--:|---|
| A-1 | Software Planning Process | all | all | all | subset | per-objective |
| A-2 | Software Development Processes | all | all | all | subset | A/B require independence on verification rows |
| A-3 | Verification of Outputs of Software Requirements Process | all | all | all | subset | A/B |
| A-4 | Verification of Outputs of Software Design Process | all | all | subset | none | A/B |
| A-5 | Verification of Outputs of Software Coding & Integration | all | all | all | subset | A/B |
| A-6 | Testing of Outputs of Integration Process | all | all | all | subset | A/B |
| A-7 | Verification of Verification Process Results | all | all | all | subset | A/B |
| A-8 | Software Configuration Management | all | all | all | all | n/a |
| A-9 | Software Quality Assurance | all | all | all | all | always |
| A-10 | Certification Liaison | all | all | all | all | n/a |

## Traceability skeleton

| Layer | ID prefix | Tool | Owner |
|---|---|---|---|
| System req allocated to SW | SYS-SW- | DOORS | Systems |
| High-level SW req | HLR- | DOORS | SW lead |
| Low-level SW req | LLR- | DOORS | SW eng |
| Source unit | file:function | git | SW eng |
| Test case | TC- | test framework | V&V |
| Test result | TR- | CI | V&V |

## Structural coverage policy

| DAL | Coverage required | Tool | Tool qualification |
|---|---|---|---|
| A | MC/DC | LDRA / VectorCAST | TQL-5 via /do-330 |
| B | Decision | LDRA / VectorCAST | TQL-5 |
| C | Statement | gcov + custom | TQL-5 if credited |

## Dead and deactivated code

- Dead code: removed pre-merge; CI gate fails the build.
- Deactivated code: traced to LLR-DEACT-NNN with activation-block evidence.

## Data and control coupling (DAL A/B only)

- Tool: <name + TQL>
- Procedure: <reference>
- Closure: 100% of inter-component pairs analyzed.

## PSAC outline

1. System overview and DAL allocation.
2. Software life-cycle (process selection).
3. Software life-cycle data (artifacts).
4. Additional considerations (previously developed software, tool qualification, alternative methods).
5. Schedule and certification-liaison plan.

## Regulator path

Submit PSAC to FAA ACO or EASA CM per certification basis. (No aviation-specific regulator-relations skill in this library yet — TODO.)
```

## Boundaries

- This skill plans objective coverage and traceability; it does not write the requirements, code, or tests themselves.
- This skill does not perform Stage of Involvement audits — it produces the evidence the DER reviews.
- DER and ODA sign-off remains with the qualified engineering representative. This skill produces the artifacts; approval is theirs.
- Hardware DAL allocation is out of scope — see `/do-254-hardware`.

## Re-run Behavior

- Re-running after a DAL change rebuilds the objective applicability matrix and flags any previously closed objectives that now need rework (e.g. DAL C → DAL B adds Decision Coverage requirements).
- Re-running after requirement churn refreshes the trace skeleton but preserves IDs.

## Auto-chain

- `/arp4754a-system-development` → this (DAL allocation must precede objective planning).
- `/arp4761-safety-assessment` → this (hazard classification drives DAL).
- this → `/do-330-tool-qualification` (any credited tool needs TQL).
- this → `/safety-case-design` (evidence aggregation downstream).

## Verification

After running:

1. Every component listed has a DAL with FHA hazard traceback.
2. The objective applicability matrix matches DO-178C Annex A for the selected DALs.
3. Structural coverage criterion per DAL matches §6.4.4.2.
4. The traceability skeleton has IDs for all four layers and is enforceable in the requirement-management tool.
5. Dead-code and deactivated-code policies are written before code freeze.

## Example Trigger

User: "We're targeting Part 23 amendment 64 for a new autopilot. Pitch and roll loops are DAL B, the navigation page is DAL C. Plan the DO-178C objective trace."
→ Builds DAL-indexed objective matrix (69 objectives for B, 62 for C), defines coverage per DAL (DC for B, Statement for C), and writes the PSAC outline with the FAA ACO submission path noted.
