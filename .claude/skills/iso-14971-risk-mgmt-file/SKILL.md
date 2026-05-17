---
name: iso-14971-risk-mgmt-file
description: Build the Risk Management File (RMF) per ISO 14971:2019 — Risk Management Plan, hazard analysis (top-down from intended use + side-by-side FMEA), risk estimation, risk-control hierarchy (inherently safe → protective → information), residual risk evaluation, benefit-risk analysis, and post-market surveillance integration. Use when user says "ISO 14971", "risk management file", "RMF", "hazard analysis", "risk control", "benefit-risk", "FMEA", "residual risk", "/iso-14971-risk-mgmt-file", or before any medical-device submission. Writes docs/medical/iso-14971-risk-mgmt-file-<project>.md.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 16h
---

# /iso-14971-risk-mgmt-file — Medical-Device Risk Management File

## Why you'd care

The Risk Management File is the spine of every medical-device submission. FDA, EU notified bodies, Health Canada, and TGA all pull it first; if the hazard analysis is thin or the residual-risk argument is weak, every other artifact gets read with suspicion. ISO 14971:2019 became the harmonized standard worldwide, and a poorly constructed RMF is the most common reason a 510(k) goes to Additional Information or an MDR Technical File gets a major nonconformity.

## Pre-flight

1. Read `docs/classify/<project>.md`. XS/S → SKIP (a meaningful RMF for medical-device-class software is M-minimum effort; lighter scopes are usually a sign the device claim itself needs re-scoping).
2. Read `docs/medical/fda-510k-pma-pathway-pick-<project>.md` if present — pathway shapes what the RMF must demonstrate at submission.
3. Read `docs/inception/intended-use-<project>.md` if present, otherwise gather the Intended Use, Indications for Use, intended user, intended use environment, and reasonably foreseeable misuse first. These five inputs anchor the entire hazard analysis (§5.2).
4. Confirm a Quality Management System exists or is being built (ISO 13485 / 21 CFR 820 / forthcoming QMSR). The RMF is a living QMS artifact, not a one-shot document.

## Inputs

- Intended Use, Indications for Use, intended user profile, intended use environment, reasonably foreseeable misuse.
- Device description: hardware, software, biologics, energy sources, materials, patient-contacting parts.
- Clinical context: condition being addressed, alternative treatments, baseline patient risk.
- Known hazards from predicate/similar devices (MAUDE adverse event database, EU EUDAMED, recall notices, literature).
- Standards in scope (IEC 60601-1, IEC 62304, IEC 62366-1, ISO 10993, IEC 81001-5-1, IEC 60601-1-2 EMC, etc.).
- Existing post-market data if a predecessor product or earlier release exists.
- Severity scale and probability scale to be used (organization-wide if available; otherwise define here).

## Process

1. **Establish Risk Management Plan** (§4.4) — Write the RMP first as a separate section of the RMF. The RMP states: scope (which device, which lifecycle phase), responsibilities (who owns each RMF activity), criteria for risk acceptability (qualitative or semi-quantitative matrix), verification activities, methods for review and approval, methods for production/post-production information collection. The RMP is signed by top management before hazard analysis begins.
2. **Define risk acceptability criteria** (§4.4, Annex C) — Build the severity scale (e.g., negligible / minor / serious / critical / catastrophic) and the probability scale (e.g., improbable / remote / occasional / probable / frequent), then the risk matrix mapping pairs to acceptable / ALARP region / unacceptable. ISO 14971:2019 *removed* the "ALARP" concept from the normative text but it is still allowed if the criteria are explicit; many manufacturers use a two-zone matrix (acceptable / unacceptable) with benefit-risk required for any unacceptable residual. Lock the matrix before estimating; do not tune it to make the analysis pass.
3. **Hazard identification — top-down from intended use** (§5.4) — For each combination of (use scenario × foreseeable sequence of events × hazardous situation × harm), document the hazard. Annex C lists 30+ hazard categories (energy, biological/chemical, operational, information-related, etc.) — walk the list against the device. For software, augment with IEC 62304 Annex B (software-related hazards). For ML/AI, add data-related hazards (training-data bias, distributional shift, adversarial input, hallucination, automation bias).
4. **Hazard identification — bottom-up FMEA** (complementary technique) — In parallel, run a Failure Modes and Effects Analysis at component, subsystem, and process levels (design FMEA + process FMEA + use FMEA). FMEA finds hazards the top-down scenario walk misses, especially for novel architectures. Capture each failure mode → effect on system → hazardous situation → harm. Cross-link FMEA rows to the top-down hazard table so duplicates merge.
5. **Risk estimation** (§5.5) — For each (hazard, hazardous situation, harm) tuple, estimate severity of harm and probability of occurrence of harm. Probability decomposes into P1 (probability of hazardous situation arising given the hazard) × P2 (probability the hazardous situation leads to the harm). For some hazards (energy, infection) P2 is well-characterized in literature; for software, P1 is often expressed qualitatively because failure rates are not directly measurable. Plot each on the risk matrix to get the **initial risk**.
6. **Risk control selection** (§7.1) — Apply controls in the standard's required hierarchy, in order:
   1. **Inherently safe design and manufacture** (eliminate the hazard or reduce severity). Example: design out a sharp edge, use a biocompatible polymer, choose a deterministic algorithm over an opaque ML model.
   2. **Protective measures in the device or manufacturing process** (reduce probability). Example: hardware interlocks, watchdog timers, double-confirm dialogs, signed updates.
   3. **Information for safety** (warnings, IFU labeling, training). Lowest in the hierarchy because it relies on the user — never the only control for serious hazards.
   For each control, document what it does, where it is implemented, how it is verified, and what new hazards it might introduce (controls themselves can fail or create new failure modes — re-enter the loop).
7. **Verification of risk-control implementation + effectiveness** (§7.2) — Each control needs two verifications: (a) it is implemented as specified (design verification), (b) it is effective in reducing risk (design validation, often by test, simulation, clinical study, or rationale linked to harmonized standard compliance). Trace each control to a test method and acceptance criterion.
8. **Residual risk evaluation** (§7.4, §8) — Re-estimate severity × probability **after** controls. Plot residual risk on the matrix. If residual is acceptable per RMP criteria, accept. If unacceptable, return to step 6 for further controls. If further controls are not practicable, escalate to benefit-risk analysis (§8): is the medical benefit greater than the residual risk to the patient? Document the analysis with clinical evidence; require senior/medical/risk-management sign-off. The overall residual risk evaluation (§8) aggregates across all hazards: even if each individual residual is acceptable, the *combined* residual risk for the device as a whole must also be acceptable.
9. **Risk management review + report** (§9) — Before commercial release, the responsible person reviews the RMF for completeness and signs the Risk Management Report concluding: (a) the risk management plan has been appropriately implemented, (b) the overall residual risk is acceptable, (c) appropriate methods are in place to obtain production and post-production information. The report is a discrete signed document inside the RMF, not just a section.
10. **Production and post-production information** (§10) — Define the post-market surveillance loop that feeds back into the RMF: complaint handling, MDR/vigilance reports, literature monitoring, registry data, security advisories for connected devices, customer feedback. Specify cadence (monthly trend review, annual PMS report, periodic safety update report for higher-class EU devices). Any new information that changes a risk estimate triggers an RMF revision and possibly a corrective action or field action.
11. **Integrate with downstream artifacts** — The RMF supplies hazards to IEC 62304 (§4.3 software class derivation), to IEC 62366-1 (use-error analysis), to clinical evaluation (CER under MDR / clinical study under FDA), to cybersecurity threat model (IEC 81001-5-1), and to labeling/IFU. Tag each linkage so a revision propagates correctly.

## Output Format — `docs/medical/iso-14971-risk-mgmt-file-<project>.md`

```markdown
# Risk Management File — <project>
**Date:** <YYYY-MM-DD>
**Standard:** ISO 14971:2019 (+ ISO/TR 24971:2020 guidance, AAMI CR34971 for ML AI)
**Owner:** <Risk Management Lead>
**Approver:** <Top Management signatory>
**Linked:** Pathway `docs/medical/fda-510k-pma-pathway-pick-<project>.md`; SW class `docs/medical/iec-62304-software-classification-<project>.md`

## 1. Risk Management Plan (RMP)
- **Scope:** <device name, model, configurations, lifecycle phases covered>
- **Responsibilities:**
  - Risk Management Lead: <name>
  - Top Management approver: <name/title>
  - Clinical input: <name>
  - Software input: <name>
  - QA: <name>
  - Post-market surveillance: <name>
- **Risk acceptability criteria:** (matrix below; documented in §2)
- **Verification activities:** design verification, design validation, software unit/integration/system test, usability summative, clinical evaluation.
- **Methods for review and approval:** RMF reviewed at design reviews (gate 1–4), before submission, before launch, annually post-launch.
- **Methods for production/post-production info:** §10 below.

## 2. Risk acceptability matrix
Severity scale:
| Level | Definition |
|---|---|
| 5 Catastrophic | death |
| 4 Critical | serious injury, permanent impairment |
| 3 Serious | injury requiring medical intervention |
| 2 Minor | temporary discomfort, no intervention |
| 1 Negligible | no clinical effect |

Probability scale:
| Level | Qualitative | Quantitative anchor (per use) |
|---|---|---|
| 5 Frequent | expected each use | >1e-2 |
| 4 Probable | likely in product life | 1e-3 to 1e-2 |
| 3 Occasional | could happen | 1e-4 to 1e-3 |
| 2 Remote | unlikely | 1e-5 to 1e-4 |
| 1 Improbable | very unlikely | <1e-5 |

Matrix (cell = acceptable A / unacceptable U):
| S\P | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 5 | U | U | U | U | U |
| 4 | A | U | U | U | U |
| 3 | A | A | U | U | U |
| 2 | A | A | A | U | U |
| 1 | A | A | A | A | A |

Unacceptable residual triggers benefit-risk analysis (§8).

## 3. Device description + intended use
- **Intended Use:** <one sentence>
- **Indications for Use:** <population, condition, setting>
- **Intended user:** <clinician role, training level>
- **Intended use environment:** <hospital, home, ambulance, etc.>
- **Reasonably foreseeable misuse:** <enumerated list>
- **Device components:** hardware <…>, software <…>, materials <…>, energy sources <…>, patient contact <…>

## 4. Hazard analysis (top-down)
| ID | Hazard category (Annex C) | Hazardous situation | Sequence of events | Harm | Use scenario |
|---|---|---|---|---|---|
| H001 | electrical energy | excess current to patient | mains surge during electrosurgery | burn injury | OR use |
| H002 | information/SaMD output | false-negative arrhythmia call | model misclassifies on out-of-distribution ECG | delayed treatment, possible death | ICU monitoring |
| H003 | biological | leachable from housing | long-term skin contact >30 d | sensitization | home wear |
| H004 | usability | wrong-patient reading | clinician misreads two-patient dashboard | wrong-patient treatment | ward |
| H005 | cybersecurity | spoofed firmware update | attacker pushes malicious model | wrong clinical output | networked device |
| H006 | ML — distributional shift | post-deployment data drifts | training pop ≠ deployment pop | systematic miscall in subgroup | clinical practice |

## 5. Hazard analysis (bottom-up FMEA excerpt)
| FMEA-ID | Component | Failure mode | Local effect | System effect | Hazardous situation | Maps to H-ID |
|---|---|---|---|---|---|---|
| F001 | inference engine | model load fails silently | UI shows stale result | clinician acts on outdated info | H002 |
| F002 | watchdog timer | misses heartbeat | no auto-reset | hung inference | H002 |
| F003 | TLS cert validation | accepts expired cert | update path open | malicious update | H005 |
| F004 | UI patient header | renders wrong patient context | screen mismatch | wrong-patient call | H004 |

## 6. Risk estimation (initial, pre-control)
| ID | Severity | P1 | P2 | Combined P | Initial risk | Region |
|---|---|---|---|---|---|---|
| H001 | 4 | 2 | 4 | 3 | (4,3) | Unacceptable |
| H002 | 5 | 3 | 3 | 3 | (5,3) | Unacceptable |
| H003 | 3 | 2 | 2 | 2 | (3,2) | Acceptable |
| H004 | 4 | 4 | 3 | 4 | (4,4) | Unacceptable |
| H005 | 5 | 3 | 3 | 3 | (5,3) | Unacceptable |
| H006 | 4 | 4 | 3 | 4 | (4,4) | Unacceptable |

## 7. Risk controls (in required hierarchy)
| ID | Hazard | Control type (1=inherent, 2=protective, 3=info) | Description | Verification | Validation | New hazards introduced? |
|---|---|---|---|---|---|---|
| C001 | H001 | 1 | isolation transformer in supply | electrical test per IEC 60601-1 §8 | n/a | none |
| C002 | H002 | 1 | conformal prediction wrapper rejects low-confidence outputs | unit + integration test | clinical study read-back rate | adds C004 (over-rejection) |
| C003 | H002 | 2 | watchdog + heartbeat reset on inference engine | unit test, fault injection | system test | none |
| C004 | over-rejection (C002) | 3 | IFU instructs clinician on "indeterminate" outputs | label review | usability summative | none |
| C005 | H004 | 1 | patient header is full-screen with photo + DOB | UI spec | usability summative | none |
| C006 | H004 | 2 | confirm-patient dialog before any action | unit test, usability | usability summative | adds workflow friction (acceptable) |
| C007 | H005 | 1 | signed firmware + secure boot | pen test, key mgmt audit | n/a | none |
| C008 | H005 | 2 | TLS pinning + cert revocation check | integration test | n/a | none |
| C009 | H006 | 2 | continuous monitoring of input distribution + drift alarms | monitor test | clinical surveillance | none |
| C010 | H006 | 1 | training data representative of deployment population | data audit | clinical performance subgroup analysis | none |

## 8. Residual risk + benefit-risk
| ID | Residual severity | Residual probability | Residual risk | Region | Benefit-risk needed? |
|---|---|---|---|---|---|
| H001 | 4 | 1 | (4,1) | Acceptable | no |
| H002 | 5 | 2 | (5,2) | Unacceptable per matrix | **yes** |
| H003 | 3 | 2 | (3,2) | Acceptable | no |
| H004 | 4 | 1 | (4,1) | Acceptable | no |
| H005 | 5 | 1 | (5,1) | Acceptable | no |
| H006 | 4 | 2 | (4,2) | Unacceptable per matrix | **yes** |

### Benefit-risk analysis (H002, H006)
- **Medical benefit:** clinical study shows 18-percentage-point sensitivity gain over standard-of-care for the target arrhythmia, enabling earlier intervention.
- **Residual risk:** 1-in-10,000 missed-call rate with confidence-gated output and clinician-in-the-loop.
- **Alternatives:** standard-of-care monitoring without device has higher miss rate; device-with-controls strictly improves on baseline.
- **Conclusion:** benefit outweighs residual risk for the indicated population.
- **Sign-off:** <Medical Director>, <Risk Mgmt Lead>, <Regulatory Lead>, dated.

### Overall residual risk evaluation (§8)
After aggregation across H001–H006, the combined residual risk is **acceptable** given the documented benefit-risk for H002 and H006. Justification rests on (a) confidence-gated output, (b) continuous drift monitoring with field-action triggers, (c) clinician-in-the-loop intended use.

## 9. Risk Management Report (§9 — signed pre-release)
- The Risk Management Plan has been implemented as specified.
- The overall residual risk is acceptable.
- Methods are in place to collect and review production and post-production information per §10.
- **Signed:** <Top Management>, <YYYY-MM-DD>.

## 10. Post-market surveillance integration (§10)
| Source | Cadence | Owner | Triggers RMF revision when… |
|---|---|---|---|
| Complaints | continuous; monthly trend review | PMS lead | new hazard, severity uptick, control failure |
| MDR / vigilance (FDA, EU EUDAMED) | per regulatory clock | RA | any reportable event |
| Literature monitoring | quarterly | clinical affairs | new hazard category in similar devices |
| Cyber advisories (CISA, vendor CVE feeds) | weekly | security | any high-CVSS on SOUP |
| ML drift monitor (C009) | continuous; weekly review | data ops | drift > threshold |
| Customer feedback | continuous | support | recurring use-error pattern |
| Annual PMS report (EU) | annual | RA | feed back into RMF revision |
| PSUR (EU MDR Class IIb/III) | annual / biennial | RA | feed back into RMF revision |

## 11. Cross-references
- IEC 62304 software class derivation: `docs/medical/iec-62304-software-classification-<project>.md` (hazards H002, H005, H006 drive Class C designation for inference engine).
- IEC 62366-1 use error analysis: `docs/medical/iec-62366-use-error-<project>.md` (H004, C005, C006 traceable to summative usability).
- Cybersecurity threat model (IEC 81001-5-1): `docs/design/threat-model-<project>.md` (H005, C007, C008).
- Clinical evaluation: <CER / clinical study report reference> (benefit basis for H002/H006).
- AAMI CR34971 ML-AI extension applied to H006 (data representativeness, drift, subgroup performance).

## 12. Decision log
| Date | Decision | Reasoning | Decider |
|---|---|---|---|
| <YYYY-MM-DD> | Two-zone matrix (no ALARP) | clearer audit story; benefit-risk handled explicitly | Risk Lead |
| <YYYY-MM-DD> | Conformal prediction wrapper as C002 | strongest available control short of removing ML | SW Lead + Clinical |
| <YYYY-MM-DD> | Accept H002 residual after benefit-risk | clinical study shows net benefit | Top Mgmt |
```

## Boundaries

- This skill produces the RMF — the controlling artifact. It does not produce the clinical evaluation report (CER), the usability engineering file (IEC 62366-1), the software lifecycle deliverables (IEC 62304 — see `iec-62304-software-classification`), or the cybersecurity threat model (IEC 81001-5-1 — partially covered by `threat-model`). The RMF references those files; it does not contain them.
- ISO 14971:2019 is the harmonized standard for medical devices. IVD-specific risk activities use the same standard with IVD-specific guidance (ISO/TR 24971 §A.2.2.3).
- AI/ML-specific risk activities are layered via AAMI CR34971; this skill names where they integrate but does not fully expand the ML-specific hazard taxonomy (a future `ml-medical-device-risk` skill could deepen that).
- Process FMEA for manufacturing is in scope (§5.4 hazards from manufacturing) but the operational process map itself is a QMS artifact handled by `qms-iso-13485` (NOT YET BUILT).
- Regulator-specific submission packaging (Annex II.4 MDR, FDA Risk Management section in 510(k)/PMA) is downstream in `regulator-relations-fda` (NOT YET BUILT) and equivalent EU notified-body interaction.

## Re-run Behavior

The RMF is a living document; re-run as a delta, not a rewrite. Trigger conditions: (a) intended use, indications for use, or intended user changes; (b) new hazard surfaced from post-market data (complaint, MDR, literature, drift alarm, CVE); (c) design change that alters a control's effectiveness or introduces a new failure mode; (d) ML retraining whose impact is not pre-authorized by an existing PCCP; (e) new harmonized standard amendment (e.g., 14971 Amendment, AAMI CR34971 update); (f) regulator feedback at Q-Sub or AI request. Each re-run appends to the Decision log and bumps the RMF revision; the Risk Management Report is re-signed if overall residual risk changes.

## Auto-chain

- Upstream: `project-classify`, intended-use capture (manual or `regulatory-preflight`).
- Sibling (must coordinate): `iec-62304-software-classification` (software class derives from RMF hazards), `iec-62366-usability` (NOT YET BUILT — use-error feeds H004-type hazards), `threat-model` (cyber overlay feeds H005-type hazards).
- Downstream: `fda-510k-pma-pathway-pick` (RMF is a required submission element across pathways), `safety-case-design` (evidence aggregation), `qms-iso-13485` (NOT YET BUILT — QMS contains the RMP procedure), `regulator-relations-fda` (NOT YET BUILT — submission packaging), `phi-minimization` (if SaMD processes PHI, treat privacy harms as hazards), `ai-bias-audit-design` (feeds H006-type hazards for ML systems).

## Verification

- Risk Management Plan is signed by top management before hazard analysis begins.
- Risk acceptability matrix locked before risk estimation; not retro-fitted.
- Hazard analysis combines top-down (intended use × Annex C) and bottom-up (FMEA), with cross-links.
- Each hazard has a documented (severity, probability) estimate with rationale.
- Every risk control names its hierarchy level (1/2/3); controls of type 3 alone are not used for serious/critical hazards.
- Every control has both verification (implemented?) and validation (effective?) evidence pointers.
- Residual risk evaluated per hazard and overall (§8).
- Benefit-risk analysis attached for any unacceptable residual.
- Risk Management Report (§9) is a signed standalone artifact.
- Post-market surveillance feedback loop (§10) defined with cadence and owners.
- Cross-references to IEC 62304, IEC 62366-1, IEC 81001-5-1, AAMI CR34971 (if ML), clinical evaluation are present and bidirectional.
- Decision log captures the reasoning for matrix choice, control selection, and benefit-risk conclusions.

## Example Trigger

User: "We need a risk file for our wearable ECG with on-device arrhythmia detection — what's the structure?"

Run `/iso-14971-risk-mgmt-file`. Expected outcome: RMP signed by top management; intended use locked; hazard analysis combining top-down (energy, biocompatibility, ECG-specific misread, ML output) and bottom-up FMEA on sensor, firmware, inference engine, app; risk estimates plotted on a 5×5 matrix; risk controls in the inherent → protective → information hierarchy with C-002-style confidence-gated output for ML hazards; residual risks evaluated; benefit-risk analysis for any unacceptable residual citing the clinical study; signed Risk Management Report; post-market loop with continuous drift monitoring, monthly complaint trend review, and feedback into RMF revisions. Cross-linked to IEC 62304 Class C derivation for the inference engine and to AAMI CR34971 for ML-specific hazards.
