---
name: commercial-grade-dedication
description: Commercial-Grade Dedication (CGD) program per EPRI NP-5652 + NRC NUREG-0800 Section 17.5 — methods 1–4 selection, critical characteristics ID, receipt-inspection plan, dedicating entity, 10 CFR Part 21 reporting. Outputs to `docs/inception/cgd-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/iv-and-v-program-design`, `/counterfeit-screening-program`. Downstream: `/firmware-attestation-design`, `/audit-log-design`. Use when user says "CGD", "commercial grade dedication", "10 CFR Part 21", "EPRI NP-5652", "NUREG-0800", "safety-related part", "dedicating entity", "/commercial-grade-dedication".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /commercial-grade-dedication — CGD Program for Safety-Related COTS

## Why you'd care

If your safety-related system (nuclear, medical-class-III, aviation DAL-A, rail signal) uses ANY commercial off-the-shelf component, you cannot install it as-is. The component must be "dedicated" via a documented technical evaluation, or you face NRC 10 CFR Part 21 reportability, recall, and license-amendment exposure. Skip CGD and a $50 resistor can trigger a $50M plant outage.

> **Effort caveat:** `XL: 8h` covers *program design only* (method selection per part-family, dedicating-entity charter, critical-characteristics rubric, receipt-inspection plan template). Actual CGD program standup: **6–12 months** to qualify dedicating-entity status; per-part dedication packages: **40–200 staff-hours each**; ongoing dedication operation: $300k–$1.5M/yr for nuclear utility supplier; **NRC inspection** annual + ad-hoc. Multiply pre-scoping hours by ~30–80× for program execution.

Invoke as `/commercial-grade-dedication`. L+ only — safety-critical / nuclear / regulated-industrial.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (CGD applies to safety-related licensed facilities)
2. Read `docs/inception/iv-and-v-program-<project>.md` if IV&V scoped.
3. Read `docs/inception/counterfeit-<project>.md` for AS5553 alignment.

## Inputs
- Industry (commercial nuclear / DOE nuclear / medical / aviation / rail / industrial-SIL).
- Safety classification system (NRC 10 CFR 50 App B / ASME NQA-1 / IEC 61508 / IEEE 7-4.3.2).
- Part inventory (active + planned) — software, firmware, hardware, mechanical.
- Existing supplier QA posture (ASL / 10 CFR 50 App B audit).
- Dedicating-entity status (in-house vs third-party qualified).

## Process

1. **Authoritative source stack**:
   - **10 CFR 50 Appendix B** — Quality Assurance Criteria for Nuclear Power Plants (1970, basis).
   - **10 CFR Part 21** — Reporting of Defects and Noncompliance (criminal liability for non-report).
   - **NRC NUREG-0800 Section 17.5** — Quality Assurance Program Description, including CGD acceptance.
   - **EPRI NP-5652 / TR-102260 / TR-102348** — Guideline for the Utilization of Commercial Grade Items (rev now NP-5652-1, June 2020).
   - **EPRI 3002002982** — Plant Engineering: Guideline for the Acceptance of Commercial-Grade Digital Equipment.
   - **EPRI TR-106439** — Guideline on Evaluation and Acceptance of Commercial-Grade Digital Equipment for Nuclear Safety Applications.
   - **ASME NQA-1-2015 (Subpart 2.14)** — CGD requirements in QA-1 framework.
   - **NRC RIS 2002-22** — Use of EPRI Topical Report TR-102348 for CGD of commercial-grade computer software.
   - **IEEE 7-4.3.2** — IEEE Standard Criteria for Programmable Digital Devices in Safety Systems.

2. **Determine applicability** — is CGD required?
   - **Safety classification check**:
     - Nuclear: "Safety-Related" per 10 CFR 50.2 + 10 CFR 50 App B → CGD mandatory.
     - "Augmented Quality" (utility-defined) → CGD often required by procedure.
     - "Non-Safety with Special Treatment Required" (NSST) → utility-specific.
     - "Non-Safety" / commercial-grade-only → CGD not required.
   - **DOE nuclear (DOE Order 414.1D)** — similar framework; uses DOE-STD-3024 + NQA-1.
   - **Medical-device Class III** — IEC 62304 software lifecycle + IEC 60601 (no direct CGD; supplier qualification via 21 CFR 820.50 + ISO 13485 §7.4).
   - **Aviation DAL-A** — RTCA DO-178C/DO-254 with COTS guidance in DO-278A + AC 20-148 reusable-software components.
   - **Rail / SIL-4** — EN 50128/50657 + 50129 use "previously developed software" (PDS) qualification (analogue of CGD).

3. **Critical Characteristics (CC) identification** — the heart of CGD:
   - For each part, identify the **failure modes** that would affect the safety function (per FMEA / FTA).
   - From failure modes, derive the **physical / performance attributes** that prevent those modes — those are critical characteristics.
   - Each CC must be: (a) **observable / measurable**, (b) tied to a documented **acceptance criterion**, (c) verifiable by one of the 4 methods.
   - Document in **Technical Evaluation Report (TER)** — typically 20–80 pages per part family.
   - Example for a digital relay: CC includes setpoint accuracy, response time, EMI/EMC susceptibility, surge withstand, software function determinism, watchdog operation, fail-safe behavior on power loss.

4. **Select CGD Method (1, 2, 3, 4)** per EPRI NP-5652 — pick or combine:
   - **Method 1 — Special Tests and Inspections** (most common for hardware):
     - Direct verification of CC via receipt inspection, performance test, environmental test.
     - Example: dimensional gage of a valve body, electrical test of a circuit board.
     - Strength: empirical, defensible.
     - Weakness: cannot verify some design CCs (e.g., software determinism).
   - **Method 2 — Commercial-Grade Survey of Supplier**:
     - On-site audit of supplier's commercial QA system to gain confidence CCs are controlled in production.
     - Survey checklist per EPRI NP-5652 Appendix; 2-day audit typical.
     - Strength: addresses design + manufacturing controls.
     - Weakness: expires (re-survey every 3 years typical); requires supplier cooperation.
   - **Method 3 — Source Verification** (limited use):
     - Witness specific tests / inspections / operations at supplier facility for the specific lot/serial being purchased.
     - Strength: lot-specific confidence.
     - Weakness: travel + scheduling; not practical for high-volume parts.
   - **Method 4 — Acceptable Supplier / Item Performance Record**:
     - Statistical history of acceptable performance in similar service.
     - Per EPRI NP-5652: minimum sample size + failure rate threshold + similarity of application.
     - Strength: low cost when records exist.
     - Weakness: weak for new parts / new applications; not stand-alone for safety-significant CCs.
   - **Typical mix for digital safety equipment**: Method 1 + Method 2 (mandatory per NRC RIS 2002-22 for software/firmware), with Method 4 supplementing.

5. **Software-specific CGD** (per EPRI TR-106439 / NRC RIS 2002-22):
   - Cannot rely on Method 4 alone for software.
   - Required combinations:
     - Method 2 commercial-grade-survey of developer's software QA (e.g., to IEC 12207 / IEEE 730 / CMMI L3+).
     - Method 1 special tests of safety functions including boundary, negative, stress, fault-injection.
     - Static analysis of source (if available) — MISRA, CERT, structural coverage.
     - Operating-history evidence (Method 4 supplement) — installed base, defect rate.
   - **Configuration control**: every patched/upgraded firmware version triggers new CGD package (or partial re-dedication).

6. **Dedicating Entity (DE) qualification**:
   - The organization performing CGD must itself meet 10 CFR 50 App B (or NQA-1).
   - **In-house DE** (utility or NSSS vendor) — already App B compliant.
   - **Third-party DE** (e.g., Curtiss-Wright Nuclear, Westinghouse, Framatome) — must be on the utility's **Approved Supplier List (ASL)** with audit history.
   - DE responsibilities:
     - Issue CGD certificate of conformance.
     - Maintain dedication record package (retention: life-of-plant + 5 yr, often permanent).
     - Report defects per 10 CFR Part 21 (criminal exposure for failure).

7. **Receipt-inspection (RI) plan** per CGD package:
   - **Visual & dimensional**: serial/lot/batch verification vs PO + COC.
   - **Documentation review**: COC, traveler, test reports, calibration certs, supplier QA records.
   - **Sampling plan**: per ANSI/ASQ Z1.4 or 100% for safety-significant.
   - **Functional / performance test**: per CC list — e.g., loop calibration, software self-test, environmental simulation.
   - **Counterfeit screening** (overlap with AS5553 / AS6081): external visual, X-ray for ICs, decapsulation sample for high-criticality lots, electrical fingerprint.
   - **Disposition**: ACCEPT / REJECT / USE-AS-IS / REPAIR / REWORK / RTV — documented per 10 CFR 50 App B Criterion XV.

8. **10 CFR Part 21 reporting** — the criminal-exposure tripwire:
   - Defect or noncompliance "associated with a substantial safety hazard" must be reported to NRC within **2 business days** of director awareness.
   - Director must "evaluate" within 60 days of discovery.
   - Failure to report = criminal liability under 10 CFR 21.61 + 18 USC.
   - Build internal Part-21 evaluation board (engineering + QA + legal + ops) with documented triage SOP.

9. **CGD record package contents** (per NRC inspection):
   - Procurement spec referencing safety classification + CCs.
   - Technical Evaluation Report (TER).
   - Method selection rationale.
   - Supplier survey report (if Method 2).
   - Receipt inspection report.
   - COC + traveler.
   - Special test results.
   - Counterfeit screening evidence (per industry).
   - Dedication certificate.
   - 10 CFR 21 evaluation log.
   - Configuration management linkage (parent assembly, plant procedure).
   - Retention: life-of-plant minimum (US fleet currently 60–80 yr operating licenses).

10. **NRC inspection regime**:
    - **Vendor Inspections** (NRC Region IV / HQ) — biannual to triennial for active vendors on the QA Vendor Inspection Plan.
    - **IP 43002 procedure** — Vendor Inspection Program.
    - **Utility inspections**: ROP (Reactor Oversight Process) baseline + supplemental for procurement findings.
    - **Common findings**: incomplete CC justification, Method 4 over-reliance, software CGD shortcuts, supplier survey expirations.

11. **Cost + headcount**:
    - **Per-part TER (simple hardware)**: 40–80 staff-hours @ ~$150/hr loaded = $6k–$12k.
    - **Per-part TER (digital / safety-significant)**: 200–500 staff-hours = $30k–$75k.
    - **Supplier survey (Method 2)**: 2–4 staff @ 2 days on-site + report = $15k–$30k.
    - **Software CGD package**: $50k–$250k depending on scope.
    - **DE qualification audit**: $40k–$80k + annual surveillance.
    - **Annual CGD program operation** (mid-size utility supplier): $400k–$2M.

12. **Failure modes that trigger findings or recall**:
    - CC identified but not measured during RI.
    - Method 4 over-relied without test or survey backup.
    - Supplier survey expired (>3 yr) and not refreshed.
    - Software change at supplier not communicated → undocumented config drift.
    - Counterfeit part slipped RI (overlap with AS5553 finding).
    - Part-21 evaluation not closed within 60 days.

13. **Cross-industry CGD analogues** (if not nuclear):
    - **Medical**: IEC 62304 + 21 CFR 820.50 supplier qualification + 21 CFR 820.80 receiving acceptance.
    - **Aviation**: DO-178C software DAL + DO-254 hardware + AC 20-148 reusable component qualification.
    - **Rail SIL-4**: EN 50128 PDS qualification.
    - **DOE nuclear**: DOE-STD-3024 + NQA-1 Subpart 2.14 (same as commercial nuclear).
    - **Industrial SIL (IEC 61508)**: "proven-in-use" qualification (Route 2S) — analogue of Method 4.

## Output

Write `docs/inception/cgd-<project>.md`:

```markdown
# Commercial-Grade Dedication Program — <project>
**Date:** <YYYY-MM-DD>
**Industry:** Commercial Nuclear (10 CFR 50 App B)
**Safety classification framework:** 10 CFR 50.2 Safety-Related + Augmented Quality
**Dedicating-entity model:** In-house (Y1) → certified for external dedication (Y3)

## 1. Authoritative source stack
| Doc | Cite | Applies to |
|---|---|---|
| 10 CFR 50 App B | NRC | QA framework |
| 10 CFR Part 21 | NRC | Defect reporting (criminal) |
| NUREG-0800 §17.5 | NRC | QA acceptance |
| EPRI NP-5652-1 | EPRI 2020 | CGD methods 1–4 |
| EPRI TR-106439 | EPRI | Digital CGD |
| NRC RIS 2002-22 | NRC | Software CGD policy |
| ASME NQA-1-2015 Subpart 2.14 | ASME | CGD QA-1 |
| IEEE 7-4.3.2 | IEEE | Programmable safety |

## 2. Part inventory (safety-related)
| Part family | Safety-class | CGD scope | Method primary | Method secondary |
|---|---|---|---|---|
| Digital protective relay | Safety-Related | full | M1 + M2 | M4 |
| Analog isolator | Safety-Related | full | M1 | M2 |
| Solenoid valve | Safety-Related | full | M1 | M4 |
| Embedded firmware | Safety-Related | full | M1 + M2 + M4 supp | — |
| Network switch (DCS) | Augmented | partial | M2 | M1 |
| Industrial PC | Augmented | partial | M2 | M4 |

## 3. Critical Characteristics matrix (excerpt — digital relay)
| CC ID | Description | Source (FMEA) | Acceptance criterion | Verification method |
|---|---|---|---|---|
| CC-01 | Setpoint accuracy ±2% | Trip miss | spec §3.2 | M1 calibration |
| CC-02 | Response time ≤25 ms | Slow trip | spec §3.4 | M1 timed test |
| CC-03 | EMI immunity IEC 61000-4-3 | Spurious trip | IEEE C37.90.2 | M2 (supplier cert) + M1 spot |
| CC-04 | Watchdog operation | Stuck CPU | design req | M1 fault injection |
| CC-05 | Power-loss fail-safe | Unsafe state | safety analysis | M1 + M2 |
| CC-06 | Firmware integrity | Bit flip / corruption | hash + signed | M2 + M1 digital sig |
| CC-07 | Boundary input handling | Range fault | M1 boundary test | M1 |

## 4. Method-selection rationale
- **Digital relay**: M1 + M2 mandatory per NRC RIS 2002-22 (software). M4 supplements (installed base >50,000 units, defect rate <10 ppm 5-yr).
- **Analog isolator**: M1 primary (deterministic electrical); M2 backup at 3-yr cadence.
- **Solenoid valve**: M1 + M4 (operating history sufficient for non-digital).
- **Network switch**: M2 commercial-grade survey of Cisco Industrial; M1 spot tests for network-storm robustness.

## 5. Supplier survey schedule (Method 2)
| Supplier | Last survey | Next due | Coverage |
|---|---|---|---|
| ABB (relay) | 2024-09 | 2027-09 | software + hardware QA |
| Phoenix Contact | 2025-01 | 2028-01 | manufacturing controls |
| Eaton | 2024-04 | 2027-04 | design + mfg |
| Cisco Industrial | 2025-06 | 2028-06 | firmware release process |

## 6. Receipt-inspection (RI) plan
| Inspection step | Performed by | Criterion | Record |
|---|---|---|---|
| Documentation review | QC inspector | COC + traveler + cal cert present | RI form §1 |
| Visual + dimensional | QC inspector | per drawing rev <rev> | RI form §2 |
| Counterfeit screening | Authorized lab | per AS5553 Rev D, lot-sample | RI form §3 + report |
| Functional / CC test | Test engineer | CC-01 through CC-07 pass | test data sheet |
| Disposition | QA Manager | ACCEPT / REJECT | RI form §5 |

## 7. Dedicating Entity (DE) standing
- **In-house DE certification**: 10 CFR 50 App B + NQA-1 audited (last <date>); next surveillance <date>.
- **Authorized to dedicate**: relays, isolators, valves, sensor families A/B/C.
- **Third-party DE used**: Curtiss-Wright Nuclear for embedded-firmware CGD packages (ASL audit current).

## 8. 10 CFR Part 21 program
- Director responsible: VP Engineering
- Evaluation board: Eng + QA + Legal + Ops
- Evaluation SLA: 60 days from discovery to disposition
- Report SLA: 2 business days from director awareness if reportable
- Annual training to all engineering + procurement: completed Q1
- Last Part-21 evaluations (12 mo): 4 open / 7 closed non-reportable / 1 reported

## 9. CGD record package template
- [ ] Procurement spec (safety classification + CC list)
- [ ] Technical Evaluation Report (TER)
- [ ] Method-selection rationale
- [ ] Supplier survey report (if M2)
- [ ] Receipt-inspection report
- [ ] COC + traveler + lot/serial trace
- [ ] Counterfeit screening evidence
- [ ] Special test results
- [ ] Dedication certificate
- [ ] 10 CFR 21 evaluation closure
- [ ] Configuration management linkage

## 10. Cost roll-up (annual run-rate)
| Activity | Cost |
|---|--:|
| Per-part TER (hardware) avg $9k × 30 parts | $270k |
| Per-part TER (digital) avg $50k × 6 parts | $300k |
| Supplier surveys (4 × $22k) | $88k |
| RI lab capacity (1 FTE + equipment) | $200k |
| DE annual surveillance | $60k |
| Software CGD package (1/yr) | $150k |
| Counterfeit-screening lab fee (overlap) | $80k |
| Training + Part-21 program | $40k |
| **Annual run-rate** | **~$1.19M** |

## 11. NRC inspection readiness
- IP 43002 vendor-inspection prep binder maintained
- Last NRC vendor inspection: <date> — 2 NCVs / 0 violations
- Open CARs: 3 (CC-05 measurement traceability; M2 survey expiry tracking; CGD record digitization)
- Next inspection window: <quarter>

## 12. Risk + critical path
- Without TER per part: NRC violation, part cannot be installed
- Without M2 supplier survey current: digital CGD invalid → forced re-dedication of installed inventory
- Without Part-21 evaluation discipline: criminal liability + civil penalties
- Without counterfeit screening: hidden CGD failure → Part-21 trigger after the fact

## 13. 90-day program standup
1. Safety classification + CC list per part family (week 1–4)
2. TER template + method-selection rubric finalized (week 2–6)
3. Supplier survey schedule mapped to 36-mo cycle (week 4–8)
4. RI lab tooling validated for CCs (week 6–10)
5. DE qualification audit kickoff (week 8–12)
6. Part-21 evaluation board chartered + first dry-run (week 10–12)
```

## Verification
- [ ] Safety classification framework + applicable regs cited.
- [ ] CC list defined per safety-related part family with FMEA traceability.
- [ ] Method selection (1/2/3/4) justified per part with software CGD policy honored.
- [ ] Receipt-inspection plan addresses every CC.
- [ ] Dedicating-entity qualification status documented.
- [ ] 10 CFR Part 21 evaluation SOP + reporting SLA in place.
- [ ] Cost + headcount realistic for industry (nuclear $400k–$2M/yr).
