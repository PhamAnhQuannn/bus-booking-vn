---
name: do-326a-cyber-airworthiness
description: DO-326A airworthiness security process planning — PASA, SAS, SDS, SUR flow, threat condition severity (catastrophic / hazardous / major / minor / no safety effect), DO-356A methods, and DO-355 continuing airworthiness. Use when user says "DO-326A", "cyber airworthiness", "aircraft security", "PASA", "SAS", "threat condition", "DO-356A", "DO-355", "/do-326a-cyber-airworthiness", or before submitting cyber compliance for a new TC, STC, or major change. Writes docs/safety/do-326a-cyber-airworthiness-<project>.md.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /do-326a-cyber-airworthiness — Airworthiness Security Process Plan

## Why you'd care

Cyber airworthiness is now a default certification expectation for any aircraft with external connectivity — IFE, EFB datalink, ACARS, ADS-B in, satcom. Treating it as a security overlay rather than an airworthiness process is how programs discover at gate-five that the entire threat scenario set must be redone with DER independence.

## Pre-flight

- Read `/arp4754a-system-development` first — the security process runs in parallel with the safety process and shares the function/item architecture.
- Read `/arp4761-safety-assessment` — threat condition severity maps to the same five-tier hazard scale.
- Confirm the certification basis includes the security special condition (FAA SC, EASA CS-25.1319 or equivalent).
- Confirm whether continuing airworthiness obligations (DO-355) apply to the operator and the type certificate holder.

## Inputs

- Aircraft connectivity map: every wired and wireless interface crossing an aircraft information security domain boundary.
- Functional architecture from ARP4754A.
- Safety hazard list from ARP4761 (cyber threats often reuse the same hazard outcomes).
- Operator concept of operations relevant to information security.

## Process

1. **Define the aircraft information security perimeter and domains.** Identify Closed/Private (control), Aircraft Information Services, Passenger Information & Entertainment Services, and Passenger-Owned Devices per ARINC 664 / DO-326A conventions. Every interface crossing a domain boundary is a candidate threat surface.
2. **Run the Preliminary Aircraft Security Assessment (PASA).** Enumerate threat scenarios per interface using a STRIDE-style decomposition adapted to airborne context (spoofing, tampering, eavesdropping, denial, elevation, repudiation). Assign each threat scenario a Threat Condition severity: Catastrophic, Hazardous, Major, Minor, or No Safety Effect — the same scale as ARP4761.
3. **Build the Security Aspects of Certification (SAS) draft.** SAS is to security what PSAC is to software — the early plan submitted to the authority for Stage of Involvement. It captures scope, process choice (DO-326A + DO-356A), security DAL allocation, and certification-liaison plan.
4. **Apply DO-356A security methods.** For each threat scenario above No Safety Effect, document the security measure (preventive, detective, recovery) and its assurance level. DO-356A method tables map measure types to threat conditions. Catastrophic threats require multiple independent measures.
5. **Author the Security Design Specification (SDS).** SDS captures the security architecture: domains, crossings, measures per crossing, key management, secure boot, software signing, and detection / logging. SDS feeds the system-level requirements that ARP4754A then traces into DO-178C/DO-254.
6. **Plan the Security Vulnerability Analysis (SVA) and Security Effectiveness Assurance.** Vulnerability analysis is informed by industry feeds (CVE, ICS-CERT) plus pen-test results on representative hardware. Effectiveness assurance ties each measure to a verification activity at the appropriate independence level.
7. **Plan continuing airworthiness per DO-355.** DO-355 covers the in-service obligations: vulnerability monitoring, patch authorization, field loadable software security, and incident reporting to the authority. Identify the type certificate holder's organizational obligation and the operator's obligation.
8. **Author the Security Accomplishment Summary (SUR).** SUR is the closure document — like the SAS, it goes to the authority. It evidences that every PASA threat scenario has a closed measure with verification.
9. **Mark the regulator path.** FAA Special Condition for cyber or EASA CS Cybersecurity (e.g. Part-IS) is the submission target. No aviation-specific regulator-relations skill exists in this library yet — TODO.

## Output Format — `docs/safety/do-326a-cyber-airworthiness-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
dal-level: A | B | C | D | E
phase: PASA | SAS | SDS | SUR | continuing-airworthiness
status: draft | reviewed | DER-signed
---

# DO-326A Airworthiness Security Plan — <project>

## Information security domain map

| Domain | Description | Examples |
|---|---|---|
| Closed/Private (ACD) | Flight-critical control | FCC, FMS, autopilot bus |
| Aircraft Information Services (AISD) | Operational | EFB datalink, ACARS, maint |
| Passenger Info & Entertainment (PIESD) | IFE | seatback, cabin Wi-Fi server |
| Passenger-Owned Devices (POD) | Bring-your-own | passenger phones, laptops |

## Domain-crossing interfaces

| ID | From | To | Medium | Protocol |
|---|---|---|---|---|
| IF-01 | AISD | ACD | ARINC 429 gateway | filtered |
| IF-02 | PIESD | AISD | unidirectional diode | one-way |
| IF-03 | POD | PIESD | Wi-Fi | TLS + isolation |
| IF-04 | Ground | AISD | satcom | mutual TLS + cert pinning |

## PASA threat scenario catalog (excerpt)

| ID | Interface | Threat | STRIDE class | Threat condition | Initial measure |
|---|---|---|:--:|:--:|---|
| TC-001 | IF-04 | Spoofed datalink command alters FMS route | S | Catastrophic | mutual TLS + signed messages + crew confirmation |
| TC-002 | IF-04 | Eavesdrop on weather upload | I | No safety effect | TLS confidentiality |
| TC-003 | IF-03 | Compromised passenger device attacks PIESD | E | Major | isolation + IDS |
| TC-004 | IF-01 | Maint laptop pivots to ACD | E | Hazardous | one-way gateway + signed config |

## DO-356A measure assurance levels

| Threat condition | Min independent measures | Effectiveness assurance |
|---|:--:|---|
| Catastrophic | 2 | independent verification + pen test |
| Hazardous | 2 | independent verification |
| Major | 1 | verification with review |
| Minor | 1 | review |
| No Safety Effect | optional | n/a |

## SAS outline

1. Aircraft and system scope.
2. Process: DO-326A + DO-356A; DO-355 for continuing AW.
3. Security DAL allocation (parallel to safety DAL).
4. Schedule and certification liaison.

## SDS outline

1. Architecture (domains, crossings, gateways).
2. Cryptographic key management (KMS, rotation, ground keying).
3. Secure boot and software signing chain.
4. Detection and logging (what is logged, where, retention).
5. Incident response interface to operator.

## DO-355 continuing airworthiness obligations

| Activity | TC holder | Operator |
|---|:--:|:--:|
| Vulnerability monitoring | yes | informed |
| Patch authorization | yes | apply |
| Field-loadable software signing | yes | verify |
| Incident reporting to authority | shared | shared |

## SUR closure plan

- Every PASA TC-NNN has a measure ID and verification evidence ID.
- Pen-test report on representative hardware closes effectiveness assurance.
- Submit SUR to FAA / EASA at type certification.

## Regulator path

FAA Special Condition for cyber / EASA Part-IS or CS cyber. (No aviation-specific regulator-relations skill in this library yet — TODO.)
```

## Boundaries

- This skill plans the airworthiness security process; it does not perform the pen test or implement cryptographic measures.
- This skill does not cover ground IT security for the operator (covered by ISO 27001 / NIST CSF elsewhere).
- DER and authority sign-off remains with the qualified representative.
- Software implementation of security measures still flows through DO-178C objective tracing.

## Re-run Behavior

- Re-running after a connectivity change rebuilds the domain-crossing inventory and PASA.
- Re-running after a published CVE that affects the type triggers SVA refresh and may invalidate SUR closure.

## Auto-chain

- `/arp4754a-system-development` → this (architecture is shared).
- `/arp4761-safety-assessment` → this (threat-condition severity reuses hazard scale).
- this → `/do-178c-objective-tracing` (security measures with software content).
- this → `/do-254-hardware` (security measures with hardware content).
- this → `/safety-case-design` (security case is parallel to safety case in the dossier).

## Verification

After running:

1. Every interface crossing a domain boundary appears in the PASA.
2. Every PASA threat scenario has a Threat Condition assignment.
3. Every measure above No Safety Effect has an assurance plan per DO-356A.
4. Continuing airworthiness responsibilities (DO-355) split between TC holder and operator is explicit.
5. SAS and SUR outlines are submission-ready.

## Example Trigger

User: "We've added satcom datalink to the FMS. Run the cyber airworthiness plan."
→ Adds the satcom interface to the domain-crossing map, enumerates spoofing/tampering/eavesdrop scenarios, classifies the FMS-route spoof as Catastrophic, and drafts the SAS update for FAA submission.
