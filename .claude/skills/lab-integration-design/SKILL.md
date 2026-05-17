---
name: lab-integration-design
description: Design clinical-lab integration with LabCorp, Quest Diagnostics, Helix, regional/hospital labs, and reference labs via HL7 v2.5.1 (ORM/ORU), FHIR R4 (DiagnosticReport/Observation/ServiceRequest), or C-CDA. Covers order entry, ELR result delivery, critical-value workflow, reflex tests, corrections (XO/XC), results inbox UX, orphan/error handling, LOINC mapping, units & reference ranges. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/design/lab-integration-<project>.md`. Trigger phrases "lab integration", "LabCorp", "Quest", "HL7", "FHIR DiagnosticReport", "ORU", "ORM", "ELR", "critical value", "lab results", "LOINC", "/lab-integration-design", or before serving any clinical workflow involving labs.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 12h
---

# /lab-integration-design — Lab Integration Design

## Why you'd care

Integrating with LabCorp/Quest without explicit HL7/FHIR mapping and a critical-value workflow risks dropped results, misrouted reports, and a patient-safety incident. The design spec is the only way to catch the edge cases before they hurt someone.

Invoke as `/lab-integration-design`. Run during design phase. Re-run per additional lab partner.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/hipaa-<project>.md` (lab data is PHI).
3. Read existing `docs/legal/baa-*-<project>.md` for lab BAA status.

## Inputs
- Lab partner(s): LabCorp, Quest, Helix, Sonora Quest, BioReference, Mayo/ARUP reference, regional hospital lab, in-house POC.
- Integration motion: order entry only, result delivery only, or both (CPOE round-trip).
- Patient population: routine outpatient vs. ED/STAT vs. genetics vs. pathology.
- Interface engine in use (Mirth/NextGen Connect, Rhapsody, Cloverleaf, Corepoint, Redox, Particle Health, Health Gorilla, 1upHealth, or in-house).
- Volume: orders/day, results/day, peak burst.
- Identity matching: MRN, demographics, payer.
- Critical-value escalation policy (clinical lead must define).
- Network mode: VPN/SFTP/MLLP/HTTPS/FHIR API.

## Process
1. **Pick interoperability protocol** per partner:
   - **HL7 v2.5.1**: still dominant (~70% of US lab interfaces in 2026). ORM-O01 (orders), ORU-R01 (results), ACK responses. MLLP over TCP/TLS or VPN. Pipe-delimited segments.
   - **FHIR R4**: rising. ServiceRequest (order), DiagnosticReport + Observation (result), Specimen, Practitioner, Patient. RESTful + Bulk Data (NDJSON). Growing among Quest (Quanum API), LabCorp (LabCorp Link), regional labs via 1upHealth/Particle.
   - **C-CDA**: document-shaped result delivery (Continuity of Care Document); used in some hospital integrations and TEFCA flows.
   - **Aggregator route**: Redox / Health Gorilla / Particle Health / 1upHealth normalize multi-lab access through one API. Trade dollars + abstraction for time-to-integrate.
2. **Pick integration motion**:
   - **Direct**: best price/volume, longest implementation (8–16 wk LabCorp/Quest), need interface engine.
   - **Aggregator (Redox/Particle/Health Gorilla)**: 4–8 wk integration; $2–10k/mo + per-transaction; abstracts HL7 ↔ FHIR.
   - **Hybrid**: aggregator for long tail; direct for top-2 lab partners.
3. **Order flow (ORM-O01 or ServiceRequest)**:
   - Build patient + ordering provider + diagnosis (ICD-10) + tests (LOINC + lab-specific compendium code) + specimen + priority + AOE (Ask-on-Order Entry) questions.
   - Generate Specimen ID + accession label (or use lab-provided).
   - Send → receive ACK → status updates (NW received, IP in-process, CM complete).
   - Cancellations: ORM with order control code "CA"; ServiceRequest status=revoked.
4. **Result flow (ORU-R01 or DiagnosticReport)**:
   - Receive ORU → parse OBR (battery), OBX (each result) with LOINC + value + units (UCUM) + reference range + abnormal flag (HH, LL, H, L, A, AA) + status (F final, P prelim, C corrected, X cancelled).
   - Match back to original order via Placer Order Number (ORC-2) or ServiceRequest.id.
   - Handle reflex tests (lab added tests we didn't order — must accept).
   - Handle corrected/amended results (status C/X) — supersede prior; do NOT delete; preserve audit.
   - Handle preliminary → final transitions; show both with clear UI markers.
5. **Critical-value workflow** (CLIA / CAP / Joint Commission requirement):
   - Critical (panic) values demand provider read-back within ≤30–60 min of release.
   - Direct provider contact (call); document who, when, read-back confirmed.
   - Escalation if unreached: secondary provider → on-call → covering practice.
   - Audit trail required for inspection.
6. **Results inbox UX**:
   - Per-provider queue: unsigned, abnormal-first sort, critical-first.
   - Bulk-sign with audit; force individual sign for criticals.
   - Annotate with patient comm note ("called pt", "rx adjusted").
   - Patient release (open notes / Cures Act — 21st Century Cures Act / ONC info-blocking rule): results visible to patient at release unless narrow exception. Tested results auto-release.
7. **Orphan + error handling**:
   - Orphan result: ORU arrives with no matching order (e.g., reflex without parent or wrong Placer ID). Quarantine queue; manual matching workflow.
   - Failed parse: dead-letter queue with raw message + parse error.
   - ACK timeout / NACK: retry with backoff; alert if persistent.
   - Specimen issues (QNS quantity-not-sufficient, hemolyzed): result with status I (in error) or N (not done) + comment; UI surfaces redraw needed.
8. **LOINC + UCUM mapping**:
   - LOINC for test codes (regulatory requirement for ELR to public health).
   - UCUM for units; reject results with non-UCUM units in pipeline or transform.
   - Maintain lab-specific compendium → LOINC mapping table; update quarterly.
   - Reference ranges: per lab, per age/sex; do NOT hardcode — pull from message.
9. **Public-health reporting (ELR)** — many results trigger mandatory reporting (notifiable diseases) to state public health via ELR; verify your lab partner handles it or you must (rare for SaaS, common for CLIA-waived in-house POC).
10. **Identity matching** — MPI strategy: deterministic on MRN if synced; probabilistic on last+DOB+gender+phone fuzzy if not. Reject low-confidence matches to manual review.
11. **Cost & timeline reality**:
    - LabCorp direct: $5k–$25k setup, $0.10–$0.50/result, 12–16 wk.
    - Quest direct (Quanum Order/Result): $5k–$30k setup, 8–14 wk.
    - Redox: $2–5k/mo platform + $1–3k per integration build, 4–8 wk.
    - Health Gorilla / Particle / 1upHealth: $1–5k/mo + per-transaction, 4–8 wk.
    - Interface engine (Mirth open source / Rhapsody $50–150k/yr / NextGen Connect): pick early.
12. **Compliance overlays**:
    - CLIA: order must be by authorized provider (LCSW/MD/DO/NP/PA per state).
    - CMS info-blocking (Cures Act, 2024 enforcement): no holding back results from patient without narrow exception.
    - 42 CFR Part 2 (SUD): substance-use treatment results have ADDITIONAL consent layer beyond HIPAA.
    - State sensitive-results laws (HIV, genetic testing, mental health) — counsel before release.

## Output
Write `docs/design/lab-integration-<project>.md`:

```markdown
# Lab Integration Design — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Clinical Lead + Eng Lead>

## Partners + motion
| Partner | Volume (results/mo) | Protocol | Motion | Status | Go-live |
|---|--:|---|---|---|---|
| LabCorp | 8,000 | HL7 v2.5.1 ORM+ORU over MLLP/VPN | Direct | contracted | wk 14 |
| Quest Diagnostics | 5,000 | FHIR R4 (Quanum) | Direct | LOI | wk 12 |
| Regional Hospital Lab | 1,200 | HL7 v2.5.1 over Mirth | Direct via Mirth | scoping | wk 16 |
| Helix (genetics) | 80 | FHIR DiagnosticReport | Direct | early | wk 20 |
| Mayo/ARUP reference | 50 | C-CDA over Direct (DirectTrust) | Through LabCorp send-out | live | n/a |
| Long-tail regional | 200 | aggregator | Redox | active | wk 6 |

## Interface engine + topology
- **Mirth Connect** OSS for LabCorp + Regional Hospital channels.
- **Redox** for long-tail + early Quest pilot.
- **App** holds canonical lab schema; engines normalize inbound; outbound goes through engine for ORM.
- Network: site-to-site VPN to LabCorp; MLLP over mTLS to engine; engine ↔ app over private VPC + mTLS.

## Order flow (ORM-O01)
```
App → ORM-O01 → Engine → MLLP/TLS → LabCorp
       ← ACK ←
```
Mandatory segments: MSH | PID | PV1 | ORC | OBR | DG1 (Dx) | OBX (AOE answers if any)
Order Control codes: NW (new), CA (cancel), DC (discontinue), XO (change order).

## Result flow (ORU-R01)
```
LabCorp → ORU-R01 → Engine → ACK
                    → normalize → POST /labs/result → App
```
Status codes (OBR-25 / OBX-11):
| Code | Meaning | App handling |
|---|---|---|
| P | Preliminary | display with "PRELIMINARY" badge |
| F | Final | display normal |
| C | Corrected | supersede prior; preserve old in audit; alert provider |
| X | Cancelled | remove from active; log |
| I | In error | show "in error"; do not act on value |
| N | Not done | flag; possibly redraw |

Abnormal flags (OBX-8): N normal | H high | L low | HH critical-high | LL critical-low | A abnormal | AA critical-abnormal.

## Critical-value workflow
- OBX-8 in (HH, LL, AA) → enqueue **CRITICAL** in inbox + page on-call provider (PagerDuty/SMS).
- Provider acknowledges in app; read-back captured (free-text confirmation of result + patient + plan).
- If no ack ≤30 min → escalate to back-up; ≤60 min → practice manager; ≤90 min → medical director.
- Audit log: result ID, value, sent-to, ack-by, ack-at, read-back text, escalation chain.

## Results inbox UX (per provider)
- Sort: critical → abnormal → normal; unsigned → signed.
- Filters: by patient, by test, by date, by lab.
- Per-result actions: sign, sign+note, defer (with reason), reassign, route to nurse.
- Bulk-sign normal-only; force individual sign for any abnormal or critical.
- Patient release: auto-release on sign per Cures Act, EXCEPT 42 CFR Part 2, HIV result, genetic, or provider-marked sensitive (with documented exception reason).

## Reflex + add-on tests
- Lab may add tests (reflex) per lab compendium rule; arrives as additional OBX/OBR with parent Placer Order Number.
- Display under same encounter; do not require re-order.
- Charge capture: pass through to billing.

## Corrections (status C)
- New ORU with status C supersedes prior.
- UI: shows current corrected value as primary; "previous value" expandable; banner "CORRECTED <date>".
- Provider must re-sign; if patient already saw old value, system flags for follow-up message.

## Orphan + error handling
| Scenario | Detection | Handling |
|---|---|---|
| Result without matching order | Placer Order Number not found | Quarantine queue → manual match by MRN+test+date |
| Parse failure | engine parse error | dead-letter; alert ops |
| ACK timeout | no ACK in 30s | retry 3× exponential; alert |
| Specimen QNS | OBR-25 = N + comment QNS | inbox flag "REDRAW NEEDED"; ping provider + patient |
| LOINC missing | OBX-3 has no LOINC | map via compendium table; flag for manual mapping if missing |
| Non-UCUM units | OBX-6 not UCUM | engine transforms; if fails, quarantine |

## LOINC + UCUM
- Maintain `data/lab_compendium_map.csv`: (lab_code, lab_name) → (loinc_code, ucum_unit, display_name).
- Quarterly review with each partner; LabCorp + Quest publish compendium updates.
- ELR submissions (notifiable diseases) require LOINC; verify partner handles state-public-health reporting.

## Identity matching (MPI)
- Primary: synced MRN if exists.
- Fallback: probabilistic (FellegiSunter or off-the-shelf NextGate/Verato).
- Threshold: auto-match ≥0.95 score; manual review 0.80–0.95; reject <0.80.
- Audit every match for inspection.

## Compliance overlays
- **Cures Act / ONC info-blocking**: default auto-release at sign; documented exception list narrow.
- **42 CFR Part 2 (SUD)**: results from SUD program require separate consent → block from default release; flag in patient record.
- **HIV / genetic / mental-health state laws**: state-by-state matrix; counsel before release; require provider review.
- **CLIA**: ordering provider must hold valid license in state of service; tie to `/state-medical-board-multi-licensure`.

## Cost + timeline
| Item | Cost | Time |
|---|--:|---|
| LabCorp setup | $15k | 14 wk |
| Quest setup | $20k | 12 wk |
| Regional hospital | $8k + interface engine staff | 16 wk |
| Helix (genetics) | $5k | 20 wk |
| Redox platform | $4k/mo | – |
| Redox per integration | $2k each | 4–8 wk each |
| Mirth engineer FTE | 0.5 FTE | ongoing |
| **Y1 estimated** | **$60k setup + $60k/yr ongoing** | – |

## Failure-mode summary (links `/failure-design`)
- Lab pipe down → degrade: queue ORMs, fail-fast STAT orders, fallback "call lab".
- Order conflicts → idempotent Placer Order Number (UUID); never reuse.
- Critical-value paging failure → secondary channel (Twilio+phone+email); auto-escalate.
- Engine queue backup → alert at 1k pending; chaos drill quarterly.

## Open decisions
- [ ] Build direct LabCorp now, or start via Redox and migrate at Q2?
- [ ] In-house Mirth vs. managed (NextGen Connect)?
- [ ] Patient release timing — instant vs. 4h delay for provider triage?
- [ ] Genetic-test consent UX — separate flow?

## Risk if skip
- Failed critical-value escalation → patient harm → med-mal exposure (avg $400k–$1M+).
- Cures Act info-blocking penalty: up to $1M per violation (ONC, effective 2024 disincentives rule).
- HHS OCR fines if PHI mishandled in lab pipe.
- Lab partner termination for repeated message-format errors.
```

## Verification
- Protocol picked per partner (HL7 v2 vs. FHIR vs. aggregator).
- Order + result flows have ACK and error paths.
- Critical-value workflow + escalation defined with audit.
- Results inbox UX covers sign, defer, abnormal, corrections.
- Reflex + corrections + orphan handling explicit.
- LOINC + UCUM mapping table sourced.
- Cures Act / 42 CFR Part 2 / state sensitive-results overlay documented.
- Cost + timeline realistic.
