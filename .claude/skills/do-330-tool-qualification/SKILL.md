---
name: do-330-tool-qualification
description: DO-330 software tool qualification planning. Selects TQL-1 through TQL-5 from criteria 1/2/3 crossed with the using software's DAL, scopes the qualification kit (TOR, TQP, TCS, TQAS, TAS), and distinguishes COTS qualification from developed-tool qualification. Use when user says "DO-330", "tool qualification", "TQL", "TQP", "qualified compiler", "qualified verification tool", "/do-330-tool-qualification", or when any tool output is credited toward DO-178C/DO-254 objectives. Writes docs/safety/do-330-tool-qualification-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 2h
  XL: 4h
---

# /do-330-tool-qualification — TQL Selection and Kit Scope

## Why you'd care

Crediting a coverage tool, autocode generator, or static analyzer toward DO-178C objectives without a qualification kit is the single most common late-program rework. By the time the DER asks "where is the TOR for this tool," redoing the analysis manually is a multi-month slip.

## Pre-flight

- Read `/do-178c-objective-tracing` (software) or `/do-254-hardware` (hardware) first — the using process's DAL is a TQL input.
- Inventory every tool whose output is used without subsequent human review of its full output. Tools whose output is fully re-reviewed by qualified personnel typically do not need qualification.
- Confirm whether each candidate tool is COTS (vendor-supplied kit available) or developed in-house.

## Inputs

- List of candidate tools and how each is used (development vs verification).
- DAL of the software/hardware the tool's output feeds.
- Vendor qualification kit availability and version match.
- In-house tool source availability (if developed).

## Process

1. **Classify each tool's usage criterion per DO-330 §1.4.** Criterion 1: tool output is part of the airborne software and could insert an error. Criterion 2: tool automates verification and could fail to detect an error AND its output reduces other verification activities. Criterion 3: tool could fail to detect an error but does not eliminate other verification. Development tools are typically Criterion 1; verification tools are Criterion 2 or 3.
2. **Cross criterion with using-software DAL to get TQL.** Per DO-178C Table 12-1: Criterion 1 at DAL A → TQL-1, DAL B → TQL-2, DAL C → TQL-4, DAL D → TQL-5. Criterion 2 at DAL A → TQL-4, B/C → TQL-5, D → TQL-5. Criterion 3 → TQL-5 across the board. Record the TQL with derivation.
3. **Decide COTS vs developed.** If the vendor supplies a qualification kit matching the using-software DAL and the tool version is locked, this is a COTS qualification — the team validates the kit and operational environment rather than redeveloping it. If no kit exists or the tool is in-house, this is full developed-tool qualification.
4. **Scope the qualification kit by TQL.** All TQLs require a Tool Operational Requirements document (TOR) and a Tool Qualification Plan (TQP). TQL-1 through TQL-4 add Tool Operational Verification & Validation Cases & Procedures, Tool Configuration Management records, Tool Quality Assurance records, and a Tool Accomplishment Summary (TAS). TQL-1 and TQL-2 add full tool development data (requirements, design, code, low-level test). The kit list grows monotonically as TQL drops in number.
5. **Lock the operational environment.** TOR documents the exact host OS, target compiler version, command-line flags, and the tool's input/output formats. Any deviation from this environment in operational use invalidates the qualification.
6. **Plan known-problem disposition.** Vendor open-problem reports must be reviewed; each problem is either patched, worked around in operational procedure, or accepted with rationale. The disposition list is part of the TAS.
7. **Identify tool-chain dependencies.** A qualified compiler that relies on an unqualified linker is not actually qualified end-to-end. Map the entire chain and qualify each link, or document compensating verification.
8. **Mark the regulator submission.** TAS goes into the certification package alongside the PSAC. Note that there is currently no aviation-specific regulator-relations skill in this library; this is a TODO.

## Output Format — `docs/safety/do-330-tool-qualification-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E
phase: planning | qualification | submission
status: draft | reviewed | DER-signed
---

# DO-330 Tool Qualification Plan — <project>

## Tool inventory and TQL derivation

| Tool | Vendor | Version | Usage | Criterion | Using-SW DAL | TQL | COTS / dev |
|---|---|---|---|:--:|:--:|:--:|---|
| LDRA Testbed | LDRA | 10.x | Structural coverage | 2 | A | TQL-4 | COTS kit |
| VectorCAST | Vector | 2024 SP1 | Unit test + coverage | 2 | A | TQL-4 | COTS kit |
| SCADE Suite KCG | Ansys | R2024 | Autocode generation | 1 | A | TQL-1 | COTS kit |
| In-house DOORS exporter | self | 1.2 | Generate test stubs | 1 | C | TQL-4 | developed |
| Polyspace | MathWorks | R2024a | Static analysis | 3 | A | TQL-5 | COTS kit |

## TQL kit content matrix

| Artifact | TQL-1 | TQL-2 | TQL-3 | TQL-4 | TQL-5 |
|---|:--:|:--:|:--:|:--:|:--:|
| Tool Operational Requirements (TOR) | yes | yes | yes | yes | yes |
| Tool Qualification Plan (TQP) | yes | yes | yes | yes | yes |
| Tool Configuration Management Records | yes | yes | yes | yes | n/a |
| Tool Quality Assurance Records | yes | yes | yes | yes | n/a |
| Tool Operational V&V Cases & Procedures | yes | yes | yes | yes | n/a |
| Tool Accomplishment Summary (TAS) | yes | yes | yes | yes | yes |
| Tool Requirements / Design / Code / LLT | yes | yes | partial | n/a | n/a |

## Operational environment lock

| Tool | Host OS | Target | Flags | I/O format |
|---|---|---|---|---|
| LDRA | RHEL 8.6 | PowerPC e500mc | -O0 -g3 | XML report |
| VectorCAST | Windows 10 LTSC | ARM Cortex-R5 | -O1 -g | HTML + JUnit |
| SCADE KCG | RHEL 8.6 | C99 host-tested | (vendor-locked) | .c/.h |

## COTS kit acceptance procedure

1. Receive vendor kit for exact version.
2. Validate kit version against tool version manifest.
3. Run vendor's operational V&V on team hardware.
4. Document any deviations in TOR.
5. Disposition all open vendor problem reports.

## Developed-tool kit plan (in-house DOORS exporter)

- TOR drafted by SW lead.
- Operational V&V cases written and reviewed independently (TQL-4).
- Tool source under same configuration management as airborne SW.
- TAS submitted with PSAC.

## Tool-chain coupling

| Upstream | Downstream | Qualified? | Compensating control |
|---|---|:--:|---|
| SCADE KCG | gcc cross | partial | qualified compiler-output review |
| LDRA | report renderer | n/a (no credit) | manual review |

## Regulator path

TAS bundled into certification package. Submit to FAA ACO / EASA CM. (No aviation-specific regulator-relations skill yet — TODO.)
```

## Boundaries

- This skill plans qualification scope; it does not perform the V&V activities or write the TOR content for developed tools.
- This skill does not assess whether a tool *can* be qualified — that is a vendor and DER decision.
- DER sign-off on TAS remains with the qualified representative.
- Hardware tool qualification (FPGA synthesizers, place-and-route) follows the same DO-330 framework but is invoked from `/do-254-hardware`.

## Re-run Behavior

- Re-running after a tool version bump invalidates the prior environment lock and triggers a re-qualification check.
- Re-running after a using-software DAL change re-derives the TQL and may add or remove kit artifacts.

## Auto-chain

- `/do-178c-objective-tracing` → this (any credited software tool).
- `/do-254-hardware` → this (any credited hardware tool).
- this → `/safety-case-design` (TAS as evidence).

## Verification

After running:

1. Every tool whose output is credited has a documented criterion, DAL, and TQL.
2. The TQL derivation matches DO-178C Table 12-1.
3. COTS tools have kit version locked to tool version.
4. Developed tools have a TOR draft and an operational V&V plan.
5. Tool-chain coupling is mapped — no unqualified link is silently credited.

## Example Trigger

User: "We're using SCADE for autocode at DAL A and LDRA for coverage. Plan the tool qualification."
→ Classifies SCADE as Criterion 1 → TQL-1, LDRA as Criterion 2 → TQL-4, drafts the kit content matrix, and locks the operational environment for both.
