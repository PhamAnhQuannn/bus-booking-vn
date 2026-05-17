---
name: iv-and-v-program-design
description: Independent Verification & Validation (IV&V) program design — agent selection, independence model (technical/managerial/financial), IEEE 1012 SIL levels, V-model lifecycle integration, NASA NPR 7150.2 Class B/C, FAA / FDA / NRC patterns. Outputs to `docs/inception/ivv-<project>.md`. Reads `/project-classify` to skip XS/S/M. Companion to `/catastrophe-mode-design`, `/commercial-grade-dedication`. Use when user says "IV&V", "IVV", "independent verification", "IEEE 1012", "NASA NPR 7150", "safety case", "DO-178 IV", or "/iv-and-v-program-design".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /iv-and-v-program-design — IV&V Program + Agent Selection

## Why you'd care

Independent V&V is mandatory for safety-critical systems (aerospace, medical, nuclear) and self-attestation isn't acceptable — without an IV&V agent in place, you can't certify. The program design picks the agent and the independence model before the contract demands it.

> **Why you'd care:** Safety-critical software (aviation, medical, nuclear, automotive, space) requires an independent party — not the development team, not the prime — to verify and validate the system. Without an IV&V program in place from requirements onward, you discover defects at integration test when fixes cost 100× what they would at requirements review, AND you can't certify because no independent evidence exists. The IV&V agent is hired *before* you ship the first requirement.

> **Effort estimate caveat:** `XL: 8h` covers *program design* — independence model, agent selection criteria, IEEE 1012 task tailoring, V-model integration plan. Actual IV&V program runs **the full lifecycle** of the safety-critical product (multi-year, $500k-$10M+ depending on system class). IV&V cost typically 5-15% of dev cost on Class B/C systems, more for fail-fatal.

Invoke as `/iv-and-v-program-design`. L+ safety-critical only.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/regulatory-<project>.md` for governing regime (FDA / FAA / NRC / etc.).
3. Read `docs/inception/catastrophe-<project>.md` if exists (failure modes drive IV&V depth).
4. Read program safety case skeleton.

## Inputs
- Domain: aviation (DO-178C / DO-254 / ARP 4754A), medical (IEC 62304 / 510(k) / PMA), nuclear (10 CFR 50.55a / IEEE 7-4.3.2), automotive (ISO 26262), space (NASA NPR 7150.2 / ECSS-Q-ST-80C), rail (EN 50128), defense (MIL-STD-882E).
- Hazard analysis output: Catastrophic / Hazardous / Major / Minor / No Effect (or domain equivalent).
- Software level / SIL / DAL / ASIL / Class.
- Acquisition model: government PM owns / prime contractor / commercial product.
- Dev team size + maturity.

## Process
1. **Map domain regime to IV&V framework**:
   - **Aviation (FAA / EASA)** — DO-178C Section 11.4 mandates an Independent role for DAL A & B (some objectives also require independence at C); DO-254 for hardware similar. ARP 4754A system-level.
   - **Medical (FDA / EU MDR)** — IEC 62304 § 8 (configuration management) + § 9 (problem resolution) require independent verification activities scaled by software safety class A/B/C. ISO 14971 risk management overlay.
   - **Nuclear (NRC)** — 10 CFR 50.55a; IEEE 7-4.3.2 (safety-system criteria); IEEE 1012 explicitly mapped; SRP Chapter 7 / BTP 7-14 IV&V expectations.
   - **Automotive (ISO 26262)** — independence levels I0/I1/I2/I3 prescribed per ASIL A-D. Confirmation review independence required for ASIL C/D.
   - **Space (NASA)** — NPR 7150.2 (current rev D) classes A/B/C/D/E/F/G/H; **NASA IV&V Facility at Fairmont WV** runs program-funded IV&V on Class A/B and selected Class C. ECSS-Q-ST-80C for ESA.
   - **Rail (CENELEC)** — EN 50128 SIL 0-4; T2/T3/T4 task tables with independence column.
   - **Defense (MIL-STD-882E)** — software hazard analysis + IV&V per program.
2. **IEEE 1012-2016** (Standard for Software Verification and Validation):
   - **Integrity Levels 1-4** map to consequence severity.
   - **V&V tasks** prescribed per lifecycle phase (concept, requirements, design, implementation, test, installation, operation, maintenance).
   - **Minimum V&V tasks** vs **optional** vs **rigorous** scale by integrity level.
   - **Independence column** in task tables — Technical / Managerial / Financial independence requirements.
3. **Three forms of independence** (IEEE 1012 + NPR 7150.2):
   - **Technical Independence** — IV&V team uses different personnel, tools, techniques, data than dev team. Cannot be the same engineers who wrote the code.
   - **Managerial Independence** — IV&V reports through a different management chain than dev. NOT the dev manager's report-up. Often a separate director or a customer rep.
   - **Financial Independence** — IV&V budget separate; cannot be cut by dev manager to hit dev cost goals. Direct customer line preferred.
   - **Full independence (IV&V-3)** — all three. **Modified (IV&V-2)** — technical + one of mgr/fin. **Embedded IV&V (IV&V-1)** — technical only. Embedded is cheaper but weakest evidence.
4. **IV&V agent selection criteria**:
   - **Domain pedigree** — has done same DAL / SIL / Class before; references from peer programs.
   - **Tooling parity** — can run the build / analysis chain independently (not just paperwork review).
   - **Standards literacy** — fluent in DO-178C / IEC 62304 / ISO 26262 etc.; not a generalist QA firm.
   - **Independence guaranteed** — no dev-side conflict (same firm consulting on dev side ≠ independent).
   - **Geographic + clearance fit** — for defense, US persons + clearance; for medical, FDA submission experience.
   - **Common agents** — NASA IV&V Facility (gov-only), Engility/SAIC/Leidos (defense), TÜV SÜD / TÜV Rheinland / SGS-TÜV / Exida (industrial), DNV (maritime/energy), UL / CSA (medical/consumer), Charles River Analytics, Ansys medini (tool-vendor).
5. **V-model lifecycle integration**:
   - **Left side** (decomposition): requirements → architecture → design → code
   - **Right side** (verification): unit test → integration test → system test → acceptance
   - **IV&V touchpoints** on left side: requirements analysis (V&V Task 5.4.2), architecture analysis (5.4.3), design analysis (5.4.4), code analysis (5.4.5)
   - **IV&V touchpoints** on right side: test plan review (5.4.6), test results analysis (5.4.7), operational test (5.4.8)
   - **Hazard tracing** — every catastrophic / hazardous requirement traced bidirectionally to test evidence; IV&V owns the trace integrity check.
6. **IV&V task tailoring** — start from IEEE 1012 minimum tasks for the chosen integrity level; tailor with PM concurrence:
   - **Always**: requirements traceability audit, hazard-to-test trace, anomaly tracking, V&V plan, V&V reports
   - **Class B/C / DAL A-B**: independent code analysis, independent test execution, requirements-based test coverage analysis (MC/DC for DAL A)
   - **Class A / DAL A**: formal methods review, model-based design verification, tool qualification of IV&V tools themselves (TQL-1 to TQL-5 in DO-178C)
7. **Independent test execution** — distinct from "different person runs the dev team's test":
   - IV&V designs requirements-based tests (separate from dev tests)
   - IV&V executes on a build IV&V controls (separate compiler config, separate target hardware in some cases)
   - For DAL A: structural coverage (MC/DC) analyzed by IV&V; gaps reported
8. **Anomaly tracking**:
   - IV&V anomaly database separate from dev defect tracker
   - Severity classification: Critical / High / Medium / Low
   - Resolution requires dev fix + IV&V re-verification
   - Closure evidence in safety case
9. **Safety case / certification artifact contribution**:
   - **PSAC / SAS / SCMP / SVP** (DO-178C: Plan for Software Aspects of Certification / Software Accomplishment Summary / Software Conf Mgmt Plan / Software Verification Plan) — IV&V contributes Verification side
   - **Software Safety Plan** (NASA NPR 7150.2)
   - **Hazard Analysis / FMEA / FTA** updates from IV&V findings
   - **Software Safety Case** (rail / defense narrative framework)
10. **IV&V cost / FTE planning**:
    - 5-10% of dev cost for embedded IV&V (Class C / DAL C-D)
    - 10-20% for modified IV&V (Class B / DAL B)
    - 20-30%+ for full IV&V (Class A / DAL A / nuclear safety)
    - Headcount: 1 IV&V eng per 5-10 dev eng typical
11. **Common IV&V program failure modes**:
    - **Independence erosion** — IV&V manager pressured by dev schedule; budget cuts late in program
    - **Findings ignored** — closed administratively rather than fixed
    - **Tool divergence** — IV&V uses same build artifacts as dev → no real independence
    - **Late engagement** — IV&V hired post-CDR (Critical Design Review); 80% of leverage lost
    - **Embedded-only** when domain demands modified or full
12. **Tool qualification (DO-178C Section 12.2)**:
    - **TQL-1 to TQL-5** depending on tool use (development vs verification) × criticality
    - IV&V analysis tools (static analyzers, coverage tools, requirements traceability) need qualification if their output is credited
    - NASA NPR 7150.2 has similar tool assessment requirements
13. **Government IV&V vs contracted IV&V**:
    - **Gov-furnished IV&V** — NASA IV&V Facility (Fairmont, WV) for NASA programs; FFRDC support (Aerospace Corp, MITRE, JPL) for defense
    - **Contracted IV&V** — separate prime; firm-fixed-price or T&M contract; selected via competitive procurement
    - **Customer-resident IV&V** — gov rep embedded; combines with DCMA contract oversight in defense

## Output
Write `docs/inception/ivv-<project>.md`:

```markdown
# IV&V Program Design — <project>
**Date:** <YYYY-MM-DD>
**Program Manager:** <name>
**IV&V Lead:** <TBD pre-selection>

## Domain + criticality
- Domain: <aviation / medical / nuclear / auto / space / rail / defense>
- Governing standard: <DO-178C / IEC 62304 / IEEE 7-4.3.2 / ISO 26262 / NPR 7150.2 / EN 50128 / MIL-STD-882E>
- Software level: <DAL A / Class B / SIL 3 / ASIL D> + rationale (hazard analysis ref)
- Hazardous functions: <list>

## IEEE 1012 integrity level + independence
- Integrity Level: **4** (catastrophic) / 3 (critical) / 2 (marginal) / 1 (negligible)
- Independence model: **Full IV&V-3** (technical + managerial + financial)
- Justification: <DAL A requires full per DO-178C 11.4 + customer mandate>

## IV&V agent selection
- Selection method: competitive RFP / sole source / gov-furnished (NASA IV&V Facility)
- Shortlist:
  | Agent | Pedigree | Cost basis | Independence | Decision |
  |---|---|---|---|---|
  | <vendor A> | DO-178C DAL A × 5 progs | T&M | clean | finalist |
  | <vendor B> | NPR 7150.2 Class B × 8 progs | FFP | clean | finalist |
  | <vendor C> | broad, no domain | T&M | clean | reject (no pedigree) |
- Selected: <TBD>
- Contract type: <FFP / T&M / hybrid>
- Reports to: <customer PM / gov AO> (NOT dev PM)

## V-model integration
| Phase | IEEE 1012 Task | IV&V activity | Evidence |
|---|---|---|---|
| Concept | 5.4.1 | concept review | concept analysis report |
| Requirements | 5.4.2 | reqs traceability + analysis | reqs V&V report |
| Architecture | 5.4.3 | arch analysis | arch V&V report |
| Design | 5.4.4 | design analysis | design V&V report |
| Code | 5.4.5 | independent code analysis (static + manual) | code V&V report |
| Unit test | 5.4.6a | test plan review | test plan analysis |
| Integration test | 5.4.6b | independent integration test | IV&V test report |
| System test | 5.4.7 | independent system test + structural coverage (MC/DC for DAL A) | system V&V report |
| Acceptance | 5.4.8 | acceptance verification | acceptance V&V letter |
| Operation | 5.4.9 | operational anomaly review | quarterly ops report |

## Hazard trace + safety case
- Trace tool: <DOORS / Polarion / Jama / custom>
- IV&V owns trace integrity audit
- Hazards in scope: <count Cat / Haz / Maj>
- Safety case framework: <GSN / SAS / PSAC>
- IV&V contribution to certification submission: <yes — Verification volume>

## Anomaly management
- Tracker: IV&V-owned (separate from dev)
- Severity: Critical / High / Medium / Low
- Closure: requires dev fix + IV&V re-verify
- Resolution SLA: Critical 5d / High 15d / Medium 30d
- Open-at-cert-time policy: zero Critical, zero High; documented Medium with disposition

## Tool qualification (DO-178C 12.2 / equivalent)
| Tool | Use | TQL | Qualification status |
|---|---|---|---|
| <static analyzer> | code analysis | TQL-5 | vendor cert |
| <coverage tool> | MC/DC | TQL-5 | vendor cert |
| <trace tool> | reqs trace | TQL-4 | tool ops manual + cert |

## Headcount + cost
- IV&V FTE plan: 8 (Y1) → 12 (Y2) → 8 (Y3 sustainment) → 4 (Y4-Y10 operation)
- Cost basis: ~$280k/FTE loaded × duration
- 5-yr IV&V: ~$15M for DAL A flight system, $3-5M for Class C medical
- % of dev cost: <17%>

## Critical engagement points
- Hired at: Concept phase (before SRR) — NOT post-CDR
- Major reviews IV&V attends: SRR / PDR / CDR / TRR / FRR
- Findings escalation: IV&V Lead → Customer AO; **dev PM cannot suppress**

## Failure mode prevention
- Independence audit: customer quarterly
- Budget firewall: separate funding line, customer-controlled
- IV&V Lead removal: requires customer concurrence (not dev PM)
- Findings disposition: IV&V owns close/reject; cannot be over-ridden by dev

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Late IV&V engagement | M | H | hired pre-SRR contractually |
| Independence erosion | M | H | quarterly customer audit |
| Budget cut mid-program | M | H | firewall + contract |
| Tool divergence | L | M | IV&V tool chain audit annually |
| Findings ignored | M | H | escalation to AO; cert risk |

## 90-day plan
1. Domain regulation + standard locked (week 1)
2. Hazard analysis classifies SW level (week 1-4)
3. IV&V RFP issued (week 2-6)
4. IV&V agent selected + contracted (week 6-12)
5. IV&V Plan (V&V Plan per IEEE 1012) drafted (week 8-12)
6. SRR scheduled with IV&V participating (week 10-14)
```

## Verification
- Domain standard explicit and SW level / DAL / Class / SIL set by hazard analysis.
- IEEE 1012 integrity level chosen with independence form (embedded / modified / full).
- IV&V agent selected with domain pedigree references checked.
- V-model lifecycle integration plan covers all 9 phases.
- Anomaly tracking separate from dev defects.
- Tool qualification plan addresses TQL for IV&V tools.
- Independence safeguards (budget firewall + customer-controlled removal) in place.
- IV&V engaged pre-SRR (not post-CDR).
