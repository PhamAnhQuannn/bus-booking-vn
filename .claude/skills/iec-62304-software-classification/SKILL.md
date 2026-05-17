---
name: iec-62304-software-classification
description: Classify medical-device software per IEC 62304:2006+A1:2015 — Safety Class A (no injury), B (non-serious injury), C (death or serious injury) — and scope the lifecycle deliverables, SOUP (Software Of Unknown Provenance) handling, and verification activities per class. Use when user says "IEC 62304", "software safety class", "Class A B C", "SOUP", "software lifecycle", "SDP", "SRS", "software architecture", "/iec-62304-software-classification", or before SaMD/medical-device software development. Writes docs/medical/iec-62304-software-classification-<project>.md.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /iec-62304-software-classification — Medical Software Safety Classification & Lifecycle Scope

## Why you'd care

IEC 62304 is the harmonized standard FDA, MDR, and most global regulators expect for medical-device software. Misclassifying Class C as Class B halves the required verification rigor on paper, but it surfaces during the technical file audit and forces a redo of the entire V&V evidence pack — months of clinical-grade test work compressed against the launch date. Getting the class right at design time makes every downstream deliverable proportionate.

## Pre-flight

1. Read `docs/classify/<project>.md`. XS/S → SKIP (medical-device software below M is not a defensible scope).
2. Read `docs/medical/iso-14971-risk-mgmt-file-<project>.md` if present — IEC 62304 §4.3 requires safety class derivation from the ISO 14971 risk analysis; you need the hazard list and initial risk estimates first.
3. Read `docs/medical/fda-510k-pma-pathway-pick-<project>.md` if present — pathway influences how detailed each deliverable must be in the submission package.
4. Confirm device contains software in scope: software as a medical device (SaMD) OR software in a medical device (SiMD, firmware/embedded) OR software used in the manufacture/maintenance of a device (different scope — IEC 62304 still applies for the SaMD/SiMD portions).

## Inputs

- System-level intended use and indications for use.
- ISO 14971 hazard analysis with initial (pre-control) severity estimates per identified hazard.
- System architecture sketch (which software items exist, how they interact, what hardware they control).
- List of SOUP candidates (operating systems, libraries, frameworks, ML model weights, third-party SDKs).
- Network connectivity scope (standalone vs networked vs cloud-hosted SaMD).
- Development team composition (in-house, contractor, offshore, AI-assisted).
- Existing QMS state (ISO 13485 certified, FDA QSR-compliant, neither).

## Process

1. **Hazard-driven classification per software system** (IEC 62304 §4.3) — For each software system (and each software item that can be segregated by architecture), determine the **worst-case** contribution to a hazardous situation, *before* external risk controls outside the software:
   - **Class A** — No injury or damage to health is possible.
   - **Class B** — Non-serious injury is possible.
   - **Class C** — Death or serious injury is possible.
   The classification is the system's contribution to harm, not its likelihood. A bug in a Class C system that *could* cause death qualifies as Class C even if the probability is low.
2. **Architectural segregation to lower class** (§4.3, §5.3) — A higher-class software system can contain lower-class software items if the architecture demonstrably segregates them. The segregation must be argued in the Software Architecture Document (SAD) and verified — typical mechanisms: process isolation, hypervisor partitioning, hardware interlocks, independent redundant channels. Each item inherits the class of the worst hazard it can contribute to. Document segregation rationale per item; auditors probe this aggressively.
3. **Map lifecycle deliverables per class** — The standard's §5 lifecycle scales with class. Build a class-by-deliverable matrix (see Output Format) covering:
   - §5.1 Software Development Planning (SDP) — required for all classes, deeper for B/C.
   - §5.2 Software Requirements Analysis (SRS) — all classes; B/C require traceability to system requirements + risk controls.
   - §5.3 Software Architectural Design (SAD) — B/C only (A may stop at SRS).
   - §5.4 Software Detailed Design — C only at unit-level granularity; B at item-level.
   - §5.5 Software Unit Implementation and Verification — unit verification required for B/C; coding standard + unit test acceptance criteria for C.
   - §5.6 Software Integration and Integration Testing — B/C.
   - §5.7 Software System Testing — all classes; broader coverage for C.
   - §5.8 Software Release — all classes; archived build, known anomalies list, release authorization.
4. **Supporting processes** (always required, scaled by class):
   - §6 Software Maintenance Process — modification request handling, problem-resolution feedback loop, re-classification on change.
   - §7 Software Risk Management Process — bidirectional traceability with ISO 14971 RMF; risk-control measure verification.
   - §8 Software Configuration Management — items under config control, change control, baseline + record. Class C demands stricter version control of every artifact.
   - §9 Software Problem Resolution Process — anomaly recording, investigation, root-cause, corrective action, regression check.
5. **SOUP (Software Of Unknown Provenance) handling** (§5.3.3, §5.3.4, §7.1.3, §8.1.2) — Inventory every piece of software not developed under this IEC 62304 process: OS (Linux kernel, RTOS), libraries (NumPy, TensorFlow, OpenSSL), ML weights (pretrained models), third-party SDKs. For each SOUP item document:
   - Title, manufacturer, unique designator, version.
   - Functional and performance requirements *necessary for its intended use*.
   - System hardware and software requirements (resources it needs).
   - **Published anomaly list** review — search the vendor's bug database and CVE feeds; document anomalies that could affect operation in the intended use.
   - Integration test evidence covering its use.
   - Inclusion in configuration management.
   For Class C, the bar rises: justify SOUP suitability with extra rigor or replace with developed-from-scratch code.
6. **AI/ML-specific overlay** (informative, post-2020 industry practice) — IEC 62304 was written before modern ML. For ML-containing software, augment the deliverables:
   - Treat training data + model weights as SOUP if pretrained, or as developed artifacts under configuration management if trained in-house.
   - Add Good Machine Learning Practice (GMLP, FDA/Health Canada/MHRA 2021) principles to the SDP.
   - Map a Predetermined Change Control Plan (PCCP) to the §6 maintenance process so retraining flows through controlled change.
   - Reference AAMI CR34971 (machine learning AI in medical-device risk management) and forthcoming IEC 62304 Amendment 2 / IEC 81001-5-1 cybersecurity overlay.
7. **Cybersecurity overlay** (IEC 81001-5-1:2021) — For networked or connected SaMD, add the IEC 81001-5-1 activities to the IEC 62304 lifecycle: threat modeling, secure-by-design requirements, security verification, vulnerability management, SBOM (Software Bill of Materials) generation, post-market security monitoring. FDA pre-market cybersecurity guidance (Sept 2023) and MDCG 2019-16 are aligned with this.
8. **Tooling and traceability** — Set up bidirectional traceability from system requirement → software requirement → architectural element → unit → test → risk control. Tools: Polarion, Jama, Helix ALM, Codebeamer, or a disciplined Markdown + Git approach for solo/small teams. The traceability matrix is the artifact reviewers always pull first.
9. **Coding standards and analysis** (Class B/C) — Adopt a coding standard (MISRA C, CERT C/C++, equivalent for managed languages). Static analysis with documented rule deviations. Class C typically requires unit-test coverage targets (statement + decision/branch on safety-relevant code).
10. **Lock the classification + lifecycle scope** — Capture the per-system class, the segregation argument, the deliverable matrix, the SOUP inventory, and the supporting-process plan in the output artifact. This becomes the contract with QA and the basis for the §5.1 Software Development Plan.

## Output Format — `docs/medical/iec-62304-software-classification-<project>.md`

```markdown
# IEC 62304 Software Classification & Lifecycle Scope — <project>
**Date:** <YYYY-MM-DD>
**Author:** <software lead + QA>
**Standard:** IEC 62304:2006 + A1:2015 (+ planned alignment with Amendment 2 when published)
**Linked:** ISO 14971 RMF — `docs/medical/iso-14971-risk-mgmt-file-<project>.md`
**Linked:** FDA pathway — `docs/medical/fda-510k-pma-pathway-pick-<project>.md`

## System decomposition + classification
| Software System | Description | Worst-case Hazard Contribution | Class | Segregation Rationale |
|---|---|---|---|---|
| Inference engine | runs ML model on patient input | wrong triage call → delayed treatment → serious injury | C | none — class C |
| Clinician UI | displays results | misread label → wrong decision → serious injury | C | could segregate to B if read-only display |
| Audit log writer | append-only logs | no patient-impact path | A | process-isolated; no shared state with C items |
| Admin console | user/role management | no clinical decision path | A | network-segregated, no inference data flow |

## Per-class deliverable matrix
| Deliverable (IEC 62304 clause) | A | B | C | Status |
|---|:-:|:-:|:-:|---|
| §5.1 Software Development Plan (SDP) | ✓ | ✓ | ✓ | DRAFT |
| §5.1.6 Software integration plan | — | ✓ | ✓ | DRAFT |
| §5.2 Software Requirements Specification (SRS) | ✓ | ✓ | ✓ | IN PROGRESS |
| §5.2.6 SRS verification | ✓ | ✓ | ✓ | planned |
| §5.3 Software Architectural Design (SAD) | — | ✓ | ✓ | IN PROGRESS |
| §5.3.3 SOUP requirements identification | — | ✓ | ✓ | DRAFT |
| §5.4 Software Detailed Design | — | item-level | unit-level | not started |
| §5.5 Unit Implementation + Verification | — | ✓ | ✓ + coverage | not started |
| §5.5.5 Acceptance criteria for unit verification | — | ✓ | ✓ | TODO |
| §5.6 Software Integration + Integration Testing | — | ✓ | ✓ | not started |
| §5.7 Software System Testing | ✓ | ✓ | ✓ | not started |
| §5.8 Software Release (archived build + known anomalies + authorization) | ✓ | ✓ | ✓ | gate before launch |

## Supporting processes (always required)
| Process | Scope notes for chosen classes |
|---|---|
| §6 Maintenance | modification request → impact analysis → re-classify if class changes → re-verify |
| §7 Risk Management (bridges ISO 14971) | every risk control implemented in software has a traceable test |
| §8 Configuration Management | every SOUP, every source file, every test, every doc under version control with baselines |
| §9 Problem Resolution | anomaly database + corrective action + regression suite |

## SOUP inventory
| SOUP | Version | Functional reqs | Anomaly review | Tests | Class context |
|---|---|---|---|---|---|
| Linux kernel | 6.6.x LTS | scheduling, I/O for inference engine | kernel.org CVE feed reviewed YYYY-MM-DD | covered by system test | C (in C-context) |
| PyTorch | 2.x | tensor ops for inference | PyTorch security advisories reviewed | inference-engine integration tests | C |
| OpenSSL | 3.x | TLS for admin console | CVE feed reviewed | TLS handshake tests | A |
| pretrained model weights | v1.4 | classification function | model card + bias eval | clinical performance study | C |

## AI/ML overlay (if applicable)
- Pretrained weights treated as SOUP under §5.3.3.
- In-house training pipeline + training data under configuration management.
- GMLP 10 principles mapped to SDP sections.
- PCCP defined → routed through §6 maintenance for permitted modifications.

## Cybersecurity overlay (IEC 81001-5-1)
- Threat model: `docs/design/threat-model-<project>.md`
- SBOM: SPDX 2.3 generated from build (CycloneDX alt).
- Vulnerability mgmt: 30-day triage SLA for high CVSS on SOUP.
- Secure-by-design requirements traced into SRS.
- Post-market security monitoring: documented in §6 maintenance plan.

## Traceability
System requirement → SRS → SAD element → unit → unit test → integration test → system test → risk control (ISO 14971) → hazard.
Tool: <Jama / Polarion / Markdown + Git>.

## Coding standard + static analysis (B/C)
- Standard: <MISRA C 2012 / CERT C / Python PEP 8 + Bandit / TypeScript strict + ESLint security>.
- Deviation procedure: documented justification + reviewer sign-off per deviation.
- Static analyzer: <coverity / sonarqube / semgrep>.
- Coverage targets (C): statement ≥95%, decision ≥90% on safety-relevant code.

## Verification gates
- [ ] Every software system classified with segregation rationale.
- [ ] SOUP inventory complete with anomaly review dates.
- [ ] Deliverable matrix locked; missing deliverables have owners + dates.
- [ ] Traceability tool selected and seeded.
- [ ] Coding standard chosen (B/C) and adopted in repo lint config.
- [ ] Cyber overlay applied if networked.
- [ ] AI/ML overlay applied if ML present.

## Risk if misclassified
- Notified body / FDA reviewer reclassifies upward → 3–9 month redo on missing verification evidence.
- Underclassed Class C surfaces in post-market signal → field action + Warning Letter + 483 observations.
- Overclassed Class A burns engineering on unnecessary unit-level traceability — survivable but wasteful.

## Decision log
| Date | Decision | Reasoning | Decider |
|---|---|---|---|
| <YYYY-MM-DD> | Inference engine = Class C | ML output drives clinical decision; failure → serious harm | <SW lead + RA> |
| <YYYY-MM-DD> | Audit log writer = Class A via process isolation | OS-level segregation; no shared mutable state with C items | <SW lead> |
```

## Boundaries

- This skill scopes the classification and lifecycle deliverable plan. Writing each deliverable (SDP, SRS, SAD, unit-test plan) happens in downstream activities and is not produced here.
- IEC 62304 covers the software lifecycle. The system-level risk file (ISO 14971), the usability file (IEC 62366-1), the quality management system (ISO 13485 / QMSR), and the cybersecurity overlay (IEC 81001-5-1) are separate artifacts with their own skills (some not yet built — `qms-iso-13485`, `iec-62366-usability` are placeholders).
- Hardware design controls (IEC 60601 family, IEC 61010) are out of scope.
- This skill assumes the software is determined to be a medical device. Borderline cases (general wellness apps, clinical decision support exclusions under 21st Century Cures Act §3060) should be resolved via `fda-510k-pma-pathway-pick` first.

## Re-run Behavior

Re-run when (a) the system architecture changes such that a software item's worst-case hazard contribution shifts class, (b) a new hazard is added to the ISO 14971 hazard analysis that elevates an item's class, (c) a SOUP is added, removed, or version-bumped to a release with material anomaly changes, (d) the device adds connectivity (Class A LAN-isolated audit log becomes networked → cybersecurity overlay required), (e) ML training data or model weights change in a way the PCCP does not pre-authorize. Always re-run after `iso-14971-risk-mgmt-file` re-runs.

## Auto-chain

- Upstream: `project-classify`, `iso-14971-risk-mgmt-file` (mandatory — class derives from hazards), `fda-510k-pma-pathway-pick` (informs dossier deliverable depth).
- Sibling: `threat-model` (cyber overlay), `phi-minimization` (if SaMD handles PHI).
- Downstream: `safety-case-design` (evidence aggregation across IEC 62304 + ISO 14971 + clinical), `qms-iso-13485` (NOT YET BUILT — overarching QMS that contains the lifecycle process), `regulator-relations-fda` (NOT YET BUILT — submission packaging).
- Sibling for AI/ML: `ai-bias-audit-design`, GMLP principles mapping into SDP.

## Verification

- Each software system has a class + worst-case hazard contribution + segregation rationale.
- Deliverable matrix is complete per class with owners.
- SOUP inventory lists every external software item with anomaly-review date and integration-test coverage.
- Supporting processes (§6–§9) named with concrete tooling.
- Bidirectional traceability tool selected and seeded.
- Cyber overlay (IEC 81001-5-1) applied if networked; AI/ML overlay applied if ML present.
- Decision log captures the class rationale per system.

## Example Trigger

User: "We're building a SaMD that ingests ECG strips and flags arrhythmias for cardiologist review. What's our software lifecycle scope?"

Run `/iec-62304-software-classification`. Expected outcome: inference engine classified Class C (incorrect flag could miss life-threatening arrhythmia → death or serious injury), surrounding UI Class C unless segregated, audit/admin systems Class A behind process isolation; full §5.1–§5.8 + §6–§9 deliverable matrix scoped; SOUP inventory including PyTorch + pretrained model + OS; cybersecurity overlay applied because cloud-hosted; PCCP path defined for periodic model retraining; coding standard + ≥95% statement coverage adopted for inference engine.
