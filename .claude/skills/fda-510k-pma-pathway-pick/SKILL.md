---
name: fda-510k-pma-pathway-pick
description: Pick the right FDA pre-market pathway for a medical device — Class I/II/III classification, 510(k) substantial-equivalence vs De Novo vs PMA vs HDE decision tree, SaMD-specific guidance (FDA AI/ML Action Plan, Predetermined Change Control Plan), and predicate-selection rules. Use when user says "510k", "PMA", "De Novo", "FDA pathway", "substantial equivalence", "predicate device", "SaMD", "PCCP", "/fda-510k-pma-pathway-pick", or before any medical-device or SaMD pre-market submission. Writes docs/medical/fda-510k-pma-pathway-pick-<project>.md.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /fda-510k-pma-pathway-pick — FDA Pre-market Pathway Selection

## Why you'd care

Picking the wrong FDA pathway costs years and millions — filing a 510(k) for a device that actually needs a PMA wastes 6–12 months before FDA refuses to accept, while over-shooting a Class I device into a 510(k) burns engineering time on data the agency never asked for. The pathway choice locks the evidence burden, the timeline, and the post-market obligations for the life of the product.

## Pre-flight

1. Read `docs/classify/<project>.md`. XS/S → SKIP (medical-device work below M is rarely defensible — a wearable that returns clinical conclusions, an algorithm that triages, or anything claiming diagnosis/treatment is M minimum).
2. Read `docs/inception/regulatory-<project>.md` if present (jurisdiction scope — US-only vs US+EU+UK overlap changes which dossier is the long pole).
3. Read `docs/inception/intended-use-<project>.md` if present, otherwise gather Intended Use + Indications for Use statements before starting.
4. Confirm device is in scope of FDA jurisdiction (FD&C Act §201(h)): article intended for use in diagnosis, cure, mitigation, treatment, or prevention of disease, or to affect structure/function of the body.

## Inputs

- Intended Use statement (what the device does, in clinical terms).
- Indications for Use (which patient population, which condition, which clinical setting).
- Mechanism of action (physical, chemical, software algorithm, biologic).
- Risk to patient if device fails (no harm / non-serious harm / serious harm / death).
- Whether a legally marketed predicate device exists with the same intended use and similar technological characteristics.
- Software component scope (no software / firmware only / SaMD / SiMD with hardware).
- AI/ML component (locked algorithm vs adaptive / continuous learning).
- Patient population size (relevant for HDE — under 8,000 US patients/year).
- Combination product status (drug-device, biologic-device).

## Process

1. **Establish jurisdiction and classification** — Search FDA Product Classification Database for the generic device type and procode. The procode maps to a regulation number (21 CFR 8xx.xxxx) and a device class (I, II, or III). If no procode matches, the device is automatically Class III by default under §513(f)(1) until reclassified — this triggers either PMA or the De Novo request route.
2. **Apply the risk-based class definitions** — Class I (general controls only, low risk, most exempt from 510(k); e.g., bandages, tongue depressors), Class II (general + special controls, moderate risk, typically 510(k); e.g., infusion pumps, most SaMD diagnostics), Class III (general + PMA, high risk or life-sustaining; e.g., implantable pacemakers, novel AI for cancer diagnosis without predicate). Class is set by the regulation, not by self-assessment.
3. **Run the pathway decision tree**:
   - Class I exempt → register/list + general controls + Quality System (21 CFR 820, transitioning to QMSR alignment with ISO 13485 by Feb 2026). No pre-market submission.
   - Class II with predicate → **510(k)** demonstrating substantial equivalence (SE).
   - Class II without predicate but low-to-moderate risk → **De Novo** request under §513(f)(2). FDA establishes a new classification regulation.
   - Class III → **PMA** (Premarket Approval Application) with valid scientific evidence including clinical data.
   - Rare disease (<8,000 US/year affected) → **HDE** (Humanitarian Device Exemption) under §520(m); demonstrates probable benefit, not effectiveness.
   - Investigational use only → **IDE** (Investigational Device Exemption) under §812 for clinical study enabling.
4. **Predicate selection for 510(k)** — Find a legally marketed device (cleared 510(k), pre-amendments device per 1976 cutoff, De Novo–classified device, or reclassified down from PMA). Same intended use is mandatory. Technological characteristics can differ, but differences must not raise different questions of safety and effectiveness. Document predicate K-number, 510(k) summary, and Indications for Use side-by-side. Multiple predicates allowed (split predicates not allowed since 2014 guidance — primary predicate must share intended use; reference devices supplement technological characteristics).
5. **SaMD-specific routing** — IMDRF SaMD risk categorization (I/II/III/IV across "significance of information" × "state of healthcare situation") informs but does not override FDA classification. FDA Pre-Cert pilot (2017–2022) ended without rulemaking; do not rely on it. For AI/ML SaMD, follow the FDA AI/ML SaMD Action Plan (Jan 2021) + Good Machine Learning Practice (GMLP) ten guiding principles (Oct 2021). If the algorithm will change post-market, include a **Predetermined Change Control Plan (PCCP)** per the Final Guidance (Dec 2024) — defines pre-authorized modifications, modification protocol, and impact assessment, avoiding a new 510(k) per model retrain.
6. **Substantial Equivalence reasoning chain** (for 510(k)) — Build the SE argument: (a) same intended use as predicate, (b) same technological characteristics OR different technological characteristics that do not raise different questions of safety/effectiveness, (c) performance data demonstrates the device is as safe and effective as the predicate. If any leg fails, the device is **Not Substantially Equivalent (NSE)** and pivots to De Novo (if low-to-moderate risk) or PMA.
7. **PMA evidence map** — For Class III, scope the required studies: bench testing, biocompatibility (ISO 10993), animal studies if applicable, and a pivotal clinical investigation under an IDE. Expect 1–3 year clinical study, 180-day FDA review clock (often extended), advisory panel possible, $441,547 standard PMA user fee (FY2025; small business reduced). Plan for post-approval studies (Condition of Approval) and PMA Supplements for any change.
8. **HDE eligibility check** — Confirm Humanitarian Use Device designation from FDA Office of Orphan Products Development, demonstrate probable benefit outweighs risk, IRB oversight at each using facility, profit cap (with exceptions for pediatric/rare disease). HDE is faster but commercially constrained.
9. **Pre-submission strategy (Q-Sub)** — Before committing, file a Pre-Submission meeting request to align with FDA on classification, predicate choice, testing plan, and PCCP scope. Free, non-binding, but written feedback shapes the dossier. Typical lead time 60–75 days; budget for it.
10. **Lock the pathway decision** — Document the chosen pathway, justification, fallback if the agency disagrees at Q-Sub, and the downstream artifacts each pathway demands (510(k) Summary, Indications for Use Statement, Performance Testing Reports, Clinical Data if Class II diagnostic, PMA modules, etc.).

## Output Format — `docs/medical/fda-510k-pma-pathway-pick-<project>.md`

```markdown
# FDA Pathway Decision — <project>
**Date:** <YYYY-MM-DD>
**Author:** <regulatory lead>
**Status:** DRAFT / Q-SUB-FILED / LOCKED

## Device summary
- **Trade name:** <name>
- **Common name:** <generic>
- **Intended Use:** <single sentence>
- **Indications for Use:** <population, condition, setting>
- **Mechanism:** <hardware / firmware / SaMD / SiMD / combination>
- **AI/ML:** <none / locked / adaptive — see PCCP below>

## Classification
| Field | Value |
|---|---|
| Product Code | <e.g., QIH> |
| Regulation Number | <21 CFR 8xx.xxxx> |
| Device Class | <I / II / III> |
| Review Panel | <Radiology / Cardiovascular / Neurology / etc> |
| GMP/QSR exempt? | <yes / no> |
| 510(k) exempt? | <yes / no — cite §xxx if yes> |

## Pathway decision tree result
- **Chosen pathway:** <510(k) / De Novo / PMA / HDE / Class I exempt / IDE>
- **Rationale:** <2–4 sentences citing classification, predicate availability, risk>
- **Alternate considered:** <e.g., considered PMA; chose De Novo because…>
- **Q-Sub planned:** <date / N/A>

## 510(k) predicate analysis (if applicable)
| Field | Subject Device | Primary Predicate | Reference Device(s) |
|---|---|---|---|
| K-number | (this submission) | K######## | K######## |
| Trade name | <name> | <name> | <name> |
| Intended Use | <statement> | <statement> | <statement> |
| Indications | <statement> | <statement> | <statement> |
| Technology | <description> | <description> | <description> |
| Performance specs | <key metrics> | <key metrics> | <key metrics> |
| **SE conclusion** | — | <same IU + same/different tech + no new safety questions> | <supporting only> |

## SaMD classification (if applicable)
- IMDRF SaMD category: <I / II / III / IV>
  - Significance of information: <inform / drive / diagnose-treat>
  - State of healthcare situation: <non-serious / serious / critical>
- FDA mapping: <Class II 510(k) / De Novo / PMA>
- GMLP principles applied: <list of the 10 principles addressed in dossier>

## Predetermined Change Control Plan (PCCP) (if AI/ML adaptive)
- **Modification description:** <what kinds of changes are pre-authorized — e.g., periodic retrain on new data, threshold tuning>
- **Modification protocol:** <data management, retraining method, performance evaluation, update procedures>
- **Impact assessment:** <safety/effectiveness analysis for each modification class>
- **Triggers for new 510(k):** <changes outside PCCP scope — new indication, new patient population, architecture change>

## Evidence plan
| Evidence | Required for chosen pathway? | Status |
|---|---|---|
| Bench testing | yes | planned Q3 |
| Biocompatibility (ISO 10993) | <yes/no — only if patient contact> | n/a |
| Software documentation (IEC 62304) | yes (SaMD) | in progress — see `iec-62304-software-classification-<project>.md` |
| Risk management file (ISO 14971) | yes | in progress — see `iso-14971-risk-mgmt-file-<project>.md` |
| Cybersecurity (FDA pre-market guidance Sep 2023) | yes (if cyber device) | SBOM + threat model planned |
| Human factors / usability (IEC 62366-1) | yes (most Class II) | summative evaluation planned |
| Clinical performance testing | <yes — diagnostic SaMD typically requires> | pivotal study Q4 |
| Animal study | <no — software-only> | n/a |
| Pivotal clinical trial under IDE | <PMA only> | n/a |

## Submission logistics
- **User fee (FY2025):** $24,335 (510(k)) / $145,068 (De Novo) / $441,547 (PMA) / $0 (HDE). Small business reduced fees if qualified.
- **Review clock:** 90 d FDA review days (510(k)) / 150 d (De Novo) / 180 d (PMA) — clock pauses on Additional Information requests.
- **Expected total calendar time:** <3–9 mo 510(k) / 6–12 mo De Novo / 18–36 mo PMA>
- **eSTAR:** mandatory for 510(k) submissions (Oct 2023+).
- **Refuse to Accept (RTA) checklist:** pre-flight against FDA RTA guidance.

## Post-market obligations (locked by pathway)
- MDR (Medical Device Reporting, 21 CFR 803): adverse event reports within 30 d (most), 5 d (serious threats).
- Annual report (PMA) / no annual report (510(k)).
- PCCP modification reports per protocol (if applicable).
- Recall/correction reporting (21 CFR 806).
- UDI (Unique Device Identifier) labeling + GUDID submission.
- Establishment registration + device listing annually.

## Risks of misclassification
- 510(k) filed for a device needing De Novo → Refuse to Accept after 60 d; 4–6 month restart.
- 510(k) filed for a device needing PMA → NSE letter; restart as PMA, lose 6–12 months.
- Marketing without clearance → FDA Warning Letter, seizure, injunction, criminal referral, recall.
- Misclassification surfacing at inspection → 483 observation, Warning Letter, Consent Decree.

## Decision log
| Date | Decision | Reasoning | Decider |
|---|---|---|---|
| <YYYY-MM-DD> | Chose 510(k) over De Novo | Predicate K###### shares intended use and tech | <RA head> |
```

## Boundaries

- This skill picks the pathway; it does not assemble the submission. 510(k) summary drafting, eSTAR completion, and dossier QC happen downstream in `qms-iso-13485` (NOT YET BUILT — placeholder) and `regulator-relations-fda` (NOT YET BUILT — placeholder).
- US FDA only. EU MDR/IVDR routing is a separate exercise (notified body + technical documentation under Annexes II/III).
- Combination products (drug+device, biologic+device) go through the Office of Combination Products (OCP) Request for Designation (RFD) process before this skill applies.
- IVDs (in vitro diagnostics) follow the same Class I/II/III + 510(k)/De Novo/PMA structure but with CLIA + CDRH IVD-specific guidance; this skill covers the pathway decision but defers IVD-specific assay validation to a future skill.

## Re-run Behavior

Re-run when (a) Intended Use or Indications for Use change in any material way, (b) a new predicate is cleared that changes the SE landscape, (c) FDA Q-Sub feedback contradicts the initial pathway choice, (d) the AI/ML model architecture or learning approach changes such that the PCCP scope no longer covers it, (e) the device adds a new patient population (pediatric, neonatal). Append a new entry to the Decision log; do not overwrite history.

## Auto-chain

- Upstream: `project-classify`, `regulatory-preflight` (if present), `intended-use` (if present).
- Sibling (run in parallel): `iec-62304-software-classification` (software safety class informs the dossier deliverables), `iso-14971-risk-mgmt-file` (risk file feeds both the 510(k)/De Novo/PMA submission and IEC 62304 process).
- Downstream: `qms-iso-13485` (NOT YET BUILT — quality system enabling the submission), `regulator-relations-fda` (NOT YET BUILT — Q-Sub + interactive review management), `safety-case-design` (evidence aggregation), `phi-minimization` (if SaMD processes PHI), `threat-model` + FDA pre-market cybersecurity guidance (if cyber device).

## Verification

- Product code + regulation number + class identified from FDA Product Classification Database (not guessed).
- Pathway chosen with explicit rationale tied to predicate availability and risk class.
- For 510(k): predicate K-number, Indications for Use side-by-side, and SE leg-by-leg argument present.
- For SaMD: IMDRF category + FDA mapping + GMLP principle coverage + PCCP scope (if adaptive AI/ML).
- Evidence plan lists every dossier artifact required for the chosen pathway.
- User fee, review clock, and post-market obligations stated.
- Q-Sub planned before committing engineering resources to dossier-specific testing.

## Example Trigger

User: "We're building an AI tool that flags suspected pulmonary embolism on CT scans for radiologist review. Which FDA pathway?"

Run `/fda-510k-pma-pathway-pick`. Expected outcome: Class II SaMD, procode QIH (radiological computer-assisted triage/notification), 510(k) pathway with predicate among existing cleared CADt devices (e.g., Aidoc, Viz.ai PE), PCCP scoped for periodic retraining on new imaging data, GMLP principles 1–10 mapped in dossier, Q-Sub recommended to align on PCCP scope before pivotal performance study.
