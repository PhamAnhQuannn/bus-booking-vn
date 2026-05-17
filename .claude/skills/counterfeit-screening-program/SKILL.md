---
name: counterfeit-screening-program
description: Counterfeit-electronic-parts control program per SAE AS5553 Rev D + AS6081 — authorized chain enforcement, DLA QSLD, GIDEP reporting, visual/X-ray/decap inspection cadence, supplier risk tiers. Outputs to `docs/inception/counterfeit-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/commercial-grade-dedication`, `/supply-chain-risk-pre`. Downstream: `/firmware-attestation-design`, `/audit-log-design`. Use when user says "counterfeit parts", "AS5553", "AS6081", "GIDEP", "DLA QSLD", "OCM authorized", "DLA QTSL", "/counterfeit-screening-program".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /counterfeit-screening-program — SAE AS5553/AS6081 Counterfeit-Electronic-Parts Control

## Why you'd care

A single counterfeit relabeled FPGA in a flight-control LRU, missile guidance card, medical-device controller, or nuclear safety I/O module can cause loss of life and trigger criminal exposure for the prime. DLA, DoD primes (LM/RTX/NG/Boeing), and FAA require AS5553-compliant counterfeit-control plans as flow-down to every tier of the supply chain. Skip this and your parts get rejected at receiving — or worse, they pass and fail in service.

> **Effort caveat:** `XL: 8h` covers *program design only* (CCP charter, supplier tiering, inspection rubric, GIDEP reporting SOP, AS5553 audit-readiness skeleton). Actual program standup: **6–12 months** to qualify as AS5553-compliant; annual audit fees $20k–$80k; per-lot inspection costs $300–$8k depending on depth; lab capability buildout (X-ray + DPA) $200k–$2M. Multiply pre-scoping hours by ~40–80× for program execution.

Invoke as `/counterfeit-screening-program`. L+ only — safety-critical hardware / defense electronics / aerospace.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (industrial-grade COTS doesn't require AS5553)
2. Read `docs/inception/cgd-<project>.md` if nuclear / safety CGD scoped.
3. Read `docs/inception/supply-chain-risk-<project>.md` for SBOM / SLSA overlap.

## Inputs
- Industry (defense / aerospace / medical / nuclear / commercial-industrial).
- Part-type scope (active semiconductors, passives, electromech, hybrids).
- DFARS 252.246-7007/7008 applicability (DoD prime / sub).
- Annual electronic-component spend.
- Existing AS9100 or ISO 9001 program.

## Process

1. **Authoritative source stack**:
   - **SAE AS5553 Rev D (2022)** — Counterfeit Electronic Parts; Avoidance, Detection, Mitigation, and Disposition (prime / OEM / integrator scope).
   - **SAE AS6081 Rev A (2017, R2023)** — Counterfeit Electronic Parts; Avoidance, Detection, Mitigation, and Disposition – Distributors.
   - **SAE AS6171 Rev A (2022)** — Test Methods Standard; General Requirements for Suspect/Counterfeit Electrical, Electronic, and Electromechanical Parts (umbrella) + slash sheets:
     - **AS6171/1** External visual / dimensional / packaging
     - **AS6171/2** X-ray fluorescence (XRF)
     - **AS6171/3** Delid / decap / DPA
     - **AS6171/4** Radiological inspection (X-ray)
     - **AS6171/5** Acoustic microscopy (CSAM)
     - **AS6171/6** Electrical test
     - **AS6171/7** Raman spectroscopy
     - **AS6171/8** Fourier-transform infrared (FTIR)
     - **AS6171/9** Thermogravimetric analysis
     - **AS6171/10** Design recovery / reverse-engineering
     - **AS6171/11** Test evaluation
   - **DFARS 252.246-7007** — Contractor Counterfeit Electronic Part Detection and Avoidance System (mandatory for DoD CAS-covered contracts).
   - **DFARS 252.246-7008** — Sources of Electronic Parts (authorized-chain mandate).
   - **DLA QSLD** — Qualified Suppliers List of Distributors (counterfeit-mitigation distributor qual).
   - **DLA QTSL** — Qualified Testing Suppliers List (independent test labs).
   - **GIDEP** — Government-Industry Data Exchange Program (mandatory counterfeit-suspect reporting under DFARS).
   - **FAA AC 21-49 (2013)** — Unsalvageable Aircraft Parts (counterfeit guidance).
   - **NIST IR 8112** — Attribute Metadata: A Proposed Schema for Evaluating Federated Attributes (provenance context).

2. **Determine applicability** — mandatory triggers:
   - DoD prime/sub with covered contracts under DFARS Subpart 246.8 (most defense electronics).
   - FAA-regulated aviation electronics (Part 21 production + Part 145 repair).
   - Nuclear safety-related electronics (overlap with CGD).
   - Medical-device Class III electronics (overlap with FDA 820.50/.80).
   - Customer flow-down clauses requiring AS5553 / AS6081.

3. **Counterfeit Control Plan (CCP)** — the core deliverable per AS5553 §4:
   - Scope statement (part-types in scope, applications, contract overlay).
   - Risk assessment process (part-by-part criticality × source risk).
   - Source / supplier-management controls (authorized-chain enforcement).
   - Procurement processes (purchase-order language, COC requirements).
   - Material control (segregation of suspect/counterfeit, "Q-cage" lockup).
   - Verification methods (per AS6171 test slash sheets).
   - In-process / final-test detection (electrical fingerprint, anomaly trip).
   - Failure-analysis + reporting (GIDEP, ERAI).
   - Personnel training (annual, role-based).
   - Subcontractor flow-down (mandatory).
   - Continuous improvement + management review.

4. **Authorized-chain enforcement** (per DFARS 252.246-7008 + AS5553 §4.1.3):
   - **Tier-1 Authorized**: OCM (Original Component Manufacturer) direct, OCM-franchised distributor (Arrow, Avnet, Future, Mouser franchised lines, Digi-Key franchised). Lowest risk.
   - **Tier-2 Authorized Aftermarket**: Rochester Electronics, Lansdale (OCM-authorized aftermarket for obsoletes — manufacturing with original OCM masks/dies).
   - **Tier-3 Trusted Supplier**: DLA-QSLD distributors + customer-trusted-supplier-list. Risk-controlled but not OCM-franchised.
   - **Tier-4 Independent Distributor / broker**: gray market. Requires **full AS6171 test suite** before acceptance.
   - **PO clause requirement**: source identification, traceability (lot/date/sublot/wafer), COC, OCM warranty pass-through, AS5553/6081 flow-down, return rights, GIDEP report cooperation.

5. **Supplier tiering + risk-based inspection cadence**:
   - **Tier-1 (OCM direct / franchised)**: documentation review + visual sample only.
   - **Tier-2 (auth aftermarket)**: visual 100% + electrical 10% + XRF sample.
   - **Tier-3 (DLA-QSLD)**: visual 100% + XRF 100% + electrical 100% + X-ray sample + decap sample on critical.
   - **Tier-4 (independent / broker)**: full AS6171 suite — visual 100% + dimensional 100% + XRF 100% + X-ray 100% + electrical 100% + CSAM sample + decap sample + design-recovery on critical.
   - **Obsolete / EOL parts (especially BGAs, FPGAs)**: Tier-4 treatment regardless of source unless OCM-authorized aftermarket.

6. **Inspection methods** (per AS6171 slash sheets):
   - **External Visual (AS6171/1)** — magnification, surface markings, package, leads, top-mark permanence (acetone/heated solvent wipe), blacktopping detection.
   - **XRF (AS6171/2)** — elemental composition vs OCM spec; detects remarking, resurfacing.
   - **DPA / Decap (AS6171/3)** — die markings vs date code on package; mask revisions vs OCM history.
   - **X-Ray (AS6171/4)** — bond-wire pattern, lead-frame integrity, die size vs expected.
   - **CSAM (AS6171/5)** — package delamination, voids, recycled-IC moisture damage.
   - **Electrical (AS6171/6)** — curve trace, parametric, functional, fingerprint vs OCM golden unit.
   - **Raman / FTIR (AS6171/7-8)** — encapsulant identification, blacktopping resin chemistry.
   - **Reverse-engineering (AS6171/10)** — for highest-risk applications; expensive ($10k+ per part type).

7. **Chain of custody** — every part must be traceable lot/date-code → PO → receiving inspection → in-process → assembly serial → shipped FRU:
   - Barcode + ERP linkage at each handoff.
   - Quarantine area ("Q-cage") for suspect parts — physically segregated, dual-control access, ERP locked.
   - Witness signature at each handoff for Tier-3/Tier-4 lots.
   - Retention: **per contract life-of-product + warranty + customer-spec** (often 10–20 yr).

8. **GIDEP reporting** (DFARS 252.246-7007 mandatory):
   - Suspect counterfeit confirmed → GIDEP report within **60 days** of confirmation.
   - Categories: COUNTERFEIT, SUSPECT COUNTERFEIT, NONCONFORMING.
   - ERAI parallel reporting recommended (industry).
   - Internal investigation report + root cause + supplier action before GIDEP filing.
   - Search GIDEP before every Tier-3/Tier-4 purchase (mandatory part of inspection plan).

9. **Supplier audit cadence + DLA QSLD posture**:
   - Internal **supplier risk score**: source tier × part criticality × historical performance × geographic risk.
   - **Audit cadence**: Tier-1 every 36 mo (paper); Tier-2 every 24 mo (paper + site); Tier-3 every 12–18 mo on-site; Tier-4 every 12 mo on-site + quarterly performance review.
   - **DLA QSLD application** (if applicable to your distribution profile) — AS6081 third-party audit, ~$60k–$120k initial + $15k–$30k annual.
   - **Authorized-distributor agreement** preservation — review at each renewal; OCM ASR (Authorized Source Report) on file.

10. **Personnel training program** (AS5553 §4.10):
    - **All purchasing + receiving + engineering**: annual counterfeit-awareness 1–2 hr.
    - **QC inspectors**: AS6171 visual training 8–16 hr + annual refresh.
    - **Test lab**: AS6171 slash-sheet certification per technique.
    - **Failure-analysis lead**: SAE WIP-trained or equivalent; GIDEP submitter authorization.
    - **Records**: completion tracked in training LMS; auditor-accessible.

11. **Disposition of suspect/counterfeit parts** (AS5553 §4.7):
    - **Never** return to supplier for resale (federal anti-trafficking — they re-enter the chain).
    - **Never** scrap to general recycling.
    - **Required**: destroy via accredited facility with destruction certificate, OR retain for evidence (criminal investigation cooperation).
    - **DLA-affiliated**: notify DCMA + DLA Investigation Service for federal-procurement-relevant lots.
    - **DoJ / FBI**: notify if intentional fraud suspected (18 USC §2320 trafficking in counterfeit goods — criminal).

12. **AS5553 audit-readiness** — what auditors ask for:
    - Signed CCP within scope statement matching contracts.
    - Supplier tiering rationale with documented criteria.
    - PO-clause samples covering DFARS / authorized-chain.
    - Inspection records covering 12-mo lookback per tier.
    - GIDEP submissions + searches log.
    - Training records 12-mo lookback.
    - Q-cage access log + disposition records.
    - Management-review minutes (annual minimum).
    - Subcontractor flow-down evidence.

13. **Cost + headcount**:
    - **CCP author + program manager (0.5–1 FTE)**: $80k–$160k loaded.
    - **QC inspection capacity (1–3 FTE)** depending on lot volume: $250k–$600k.
    - **In-house test lab (XRF + X-ray + CSAM + electrical)**: $200k–$2M capex + $300k–$1M/yr opex.
    - **Outsourced lab option** (SMT Corp, Integra Technologies, Cobham, Process Sciences, ERAI) — $300–$8k/lot.
    - **GIDEP membership**: ~$1k/yr (free for govt; modest for industry).
    - **AS5553 audit (annual, accredited registrar)**: $20k–$80k.
    - **Annual program run-rate**: $400k–$2M depending on volume + tier mix.

14. **Failure modes that trigger findings or contract loss**:
    - Tier-4 buy without full AS6171 suite → suspect part installed → field failure → GIDEP-traceable.
    - Q-cage breach (suspect part re-released into stock).
    - GIDEP search not performed pre-purchase (DFARS finding).
    - GIDEP submission gap >60 days post-confirmation.
    - Counterfeit returned to supplier (anti-trafficking violation).
    - Subcontractor flow-down missing → cascading non-compliance.

## Output

Write `docs/inception/counterfeit-<project>.md`:

```markdown
# Counterfeit-Electronic-Parts Control Program — <project>
**Date:** <YYYY-MM-DD>
**Industry:** Defense aerospace (DoD prime sub) + commercial aviation FAA Part 21
**Annual electronic spend:** ~$8M
**Active part numbers:** ~1,200 (300 critical / 700 standard / 200 obsolete)
**CCP revision:** Rev <n> dated <date>

## 1. Authoritative source stack
| Standard | Cite | Applies to |
|---|---|---|
| AS5553 Rev D | SAE 2022 | Prime/OEM CCP |
| AS6081 Rev A | SAE 2017 R2023 | Distributor controls |
| AS6171 Rev A | SAE 2022 | Test methods (slash 1–11) |
| DFARS 252.246-7007 | DoD | Detection/avoidance system |
| DFARS 252.246-7008 | DoD | Authorized chain |
| FAA AC 21-49 | FAA | Aviation parts |

## 2. Counterfeit Control Plan scope
- Active semiconductors (FPGAs, MCUs, ASICs, op-amps, regulators)
- Memory (NAND/NOR/EEPROM/SRAM/DRAM)
- Passives (high-rel mil-spec only — capacitors >$50/part, resistors >$10/part)
- Electromechanical (relays, connectors safety-significant only)
- All parts on DoD CAS contracts + FAA Part 21 lines

## 3. Supplier tiering + qualification
| Tier | Definition | Suppliers (active) | Inspection cadence |
|---|---|--:|---|
| Tier-1 OCM direct + franchised | OCM or OCM-authorized franchise | 18 | Doc + visual sample |
| Tier-2 OCM-authorized aftermarket | Rochester, Lansdale | 3 | Visual 100% + electrical 10% + XRF sample |
| Tier-3 DLA-QSLD trusted | per DLA QSLD list | 7 | Visual + XRF + electrical 100% + X-ray sample + decap on critical |
| Tier-4 Independent / broker | gray market | 4 (emergency only) | Full AS6171 suite |

## 4. Risk-score formula
risk_score = source_tier_weight × part_criticality × geo_risk × supplier_history_modifier
- source_tier_weight: T1=1, T2=2, T3=5, T4=15
- part_criticality: A (safety) =3, B (function) =2, C (commercial) =1
- geo_risk: domestic / 5EYES =1, allies =1.5, others =3
- supplier_history_modifier: 0.5 (5yr clean) to 3 (recent finding)
Threshold for full AS6171 suite: score ≥30

## 5. Per-tier inspection plan
| Method | Tier-1 | Tier-2 | Tier-3 | Tier-4 |
|---|---|---|---|---|
| External visual (AS6171/1) | Sample | 100% | 100% | 100% |
| XRF (AS6171/2) | — | Sample | 100% | 100% |
| X-ray (AS6171/4) | — | — | Sample | 100% |
| Acoustic CSAM (AS6171/5) | — | — | Critical only | Sample |
| Electrical (AS6171/6) | — | 10% | 100% | 100% |
| Decap / DPA (AS6171/3) | — | — | Critical sample | Sample |
| Raman/FTIR (AS6171/7-8) | — | — | — | Suspect-driven |

## 6. PO-clause requirements (every PO)
- Authorized-source statement
- Lot/date/sublot/wafer traceability
- COC with OCM warranty pass-through
- AS5553 + AS6081 flow-down to subs
- DFARS 252.246-7007 + 7008 flow-down (DoD lines)
- GIDEP cooperation
- Right-of-return for suspect product
- Right-of-audit at supplier

## 7. Chain of custody
- Barcode at receiving → ERP lot record → segregated bin → kit pull → assembly serial → FRU shipment
- Q-cage: dual-control, ERP-locked, dual-witness disposition
- Retention: 20 yr (FAA Part 21) / contract-specified (DoD)

## 8. GIDEP integration
- Pre-purchase GIDEP search: required for Tier-3/Tier-4 (mandatory + logged)
- Suspect-confirmed submission SLA: 60 days from confirmation
- Internal investigation pre-submission: rooted-caused + supplier-action documented
- 12-mo submission count: <n> filed / <n> received-acted-upon

## 9. Disposition matrix
| Status | Action |
|---|---|
| Confirmed counterfeit | Destroy (accredited) + GIDEP + DCMA/DLA notify + DoJ/FBI if fraud |
| Suspect (unconfirmed) | Hold in Q-cage; submit to lab; GIDEP-suspect filing within 60d |
| Nonconforming (not counterfeit) | RTV with supplier-credit (NOT resale to others) |
| Pass (acceptable) | Release to stock |

## 10. Training program
| Audience | Topic | Frequency | Standard |
|---|---|---|---|
| All purchasing + receiving | Counterfeit awareness | Annual | 1–2 h |
| QC inspectors | AS6171 visual + dimensional | Initial + annual | 16 h |
| Test lab | AS6171 slash certification per technique | Initial + 24 mo | 40 h per slash |
| FA lead + GIDEP submitter | SAE WIP / GIDEP | Bi-annual | 8 h |

## 11. Lab capability
| Method | In-house? | If not, outsourced to |
|---|---|---|
| External visual / dim | Yes | — |
| XRF | Yes | — |
| X-ray | Yes | — |
| CSAM | No | SMT Corp / Integra |
| Electrical curve trace | Yes | — |
| Decap / DPA | No | Process Sciences / SMT Corp |
| Raman / FTIR | No | Cobham |
| Reverse engineering | No | ChipWorks / TechInsights |

## 12. Annual cost roll-up
| Item | Cost |
|---|--:|
| CCP program manager 0.75 FTE | $135k |
| QC inspection 2 FTE | $360k |
| In-house lab opex | $400k |
| Outsourced lab fees | $200k |
| AS5553 annual audit | $35k |
| GIDEP membership + training | $30k |
| Q-cage + chain-of-custody system | $50k |
| **Annual run-rate** | **~$1.21M** |

## 13. Audit-readiness binder (live)
- [ ] Signed + scoped CCP (current rev)
- [ ] Supplier tiering criteria + roster
- [ ] PO clauses sample (per tier)
- [ ] 12-mo inspection records
- [ ] GIDEP search log + submissions
- [ ] Training rosters
- [ ] Q-cage log + dispositions
- [ ] Annual management review minutes
- [ ] Subcontractor flow-down evidence

## 14. Risk + critical path
- Tier-4 buy without AS6171 → field-failure root-cause exposes supply-chain → contract default
- Q-cage breach → criminal liability under 18 USC §2320
- GIDEP submission gap → DCMA CPSR finding + contract negative-impact CPARS
- DLA QSLD lapse (if applicable) → distributor lines suspended

## 15. 90-day standup
1. CCP draft + scoping + management commitment (week 1–3)
2. Supplier tiering + DLA QSLD search + GIDEP-search SOP (week 2–6)
3. Q-cage physical + ERP segregation operationalized (week 4–8)
4. AS6171 visual training delivered to QC inspectors (week 4–10)
5. PO-clause rev rolled to suppliers (week 6–10)
6. First-article re-inspection on top-10 Tier-3/4 active part numbers (week 8–12)
7. AS5553 audit-readiness internal dry-run (week 10–12)
```

## Verification
- [ ] CCP scope covers all DFARS / FAA / customer flow-down requirements.
- [ ] Supplier tiering criteria documented + roster current.
- [ ] AS6171 test capability mapped (in-house vs outsourced) per technique.
- [ ] GIDEP pre-purchase search + submission SOPs in place.
- [ ] Q-cage + chain-of-custody mechanically + procedurally enforced.
- [ ] Training cadence + completion tracking operational.
- [ ] Disposition matrix forbids return-to-supplier-for-resale.
