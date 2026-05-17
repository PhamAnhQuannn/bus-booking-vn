---
name: scif-buildout-spec
description: SCIF (Sensitive Compartmented Information Facility) buildout spec — ICD 705 construction, TEMPEST RF shielding, two-person integrity, IDS/ESS/CCTV, AO accreditation. Outputs to `docs/inception/scif-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/security-clearance-mapping`, `/multi-classification-pipeline-design`. Use when user says "SCIF", "ICD 705", "TEMPEST", "open storage", "closed area", "SCIF accreditation", "AO inspection", "RF shielded", or "/scif-buildout-spec".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /scif-buildout-spec — SCIF Construction + Accreditation Spec

> **Why you'd care:** TS/SCI work cannot happen outside an accredited SCIF. Building or leasing one wrong delays TS-level contract performance by 6-18 months and burns $200k-$2M in rework. This skill captures the ICD 705 construction standard, TEMPEST shielding tier, and AO accreditation path *before* the GC signs a build contract that won't pass inspection.

> **Effort estimate caveat:** `XL: 8h` covers *pre-build spec authoring* — ICD 705 tier pick, RF/TEMPEST tier, alarm/access design, AO engagement plan. Actual SCIF construction is **6-18 months** ($200k for ~200 sqft retrofit to $2M+ for purpose-built secure compound). Annual operating cost $20k-$200k (inspection, alarm monitoring, escort, cleared janitorial). Co-use SCIF (leased space) typical first step at $5k-$30k/seat/year.

Invoke as `/scif-buildout-spec`. L+ only.

## Why you'd care

A SCIF buildout without ICD 705 grounding is a months-long re-inspection cycle and an AO who won't accredit. Spec it right the first time — the construction lead time alone won't forgive a second pass.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/clearance-<project>.md`.
3. Read `docs/inception/multi-classification-<project>.md` if IL6+ data.
4. Read sponsor program's SCIF use-case (CONOPS — does work occur here, or store here, or both?).

## Inputs
- Classification handled: Secret / TS / TS-SCI / SAP.
- Use case: open storage / closed area / discussion area / operational SCIF.
- Footprint: seats, hardware racks, comms hub, vault.
- Building shell: existing tenant fit-out vs new construction vs converted shell.
- Geographic location (urban, suburban — affects threat environment).
- Sponsor AO: DoD AO / IC AO / specific agency.
- Budget cap.

## Process
1. **Pick the standard that governs**:
   - **ICD 705** (Intelligence Community Directive 705) — applies to all SCIFs for IC work. Companion: **ICS 705-1** Tech Spec for Construction; **ICS 705-2** Standards for Accreditation; **TSG (Technical Specification Guide) 2010-05** physical security; **JAFAN 6/9** (DoD SAP) for SAP-specific.
   - **DoD M-5105.21-V1/V2/V3** (DoDM 5105.21) — DoD SCIF supplement.
   - **NIST SP 800-53 PE family** — overlay for IT-system controls inside the SCIF.
   - For Secret-not-SCI: **NISPOM 32 CFR 117** Open Storage / Closed Area; ICD 705 not required (but often used as gold standard).
2. **SCIF construction tiers**:
   - **Closed area** — for Secret without SCI; locked + alarmed; simpler. Sometimes called "Secret Open Storage."
   - **Standard SCIF** — TS/SCI; ICD 705 base spec.
   - **Vault** — for highest-sensitivity material storage (typically SAP); GSA Class 5 or 6 vault door; reinforced concrete shell.
   - **Tactical SCIF (T-SCIF)** — deployed (containerized, expeditionary); ICD 705 Tactical Annex.
   - **Tempest SCIF** — hardened against electromagnetic emanation interception (above standard).
3. **ICD 705 construction requirements** (paraphrased; consult Tech Spec directly):
   - **Walls** — slab-to-slab; 5/8" gypsum either side of metal stud; expanded metal sound deadening in cavity; or block/concrete depending on threat.
   - **Sound attenuation** — STC 45 (Standard) / STC 50 (Discussion area) — measured.
   - **Doors** — Class 5 vault door (for vaults) or SCIF-approved door (3-hinge solid core with peephole, automatic door closer, X-09 GSA-approved combo lock or DKL).
   - **Acoustic** — pink noise generator in plenum if needed; doors with acoustic seals.
   - **HVAC** — no through-ducts that bypass intrusion detection; if ducts cross boundary, install Man Bars / IDS-monitored grills below 96 sq inches.
   - **Plumbing** — minimize; if present, no exterior penetrations; pipes don't bypass IDS.
   - **Penetrations** — every cable / conduit / pipe through the SCIF envelope logged and inspected; RF gaskets where applicable.
   - **Windows** — generally none; if existing, opaque + acoustic + RF film or replaced with secured panels.
   - **Floor / ceiling** — slab-to-slab containment; raised floor + drop ceiling not allowed to leave SCIF envelope.
4. **TEMPEST / RF shielding tiers**:
   - **Standard SCIF** — Inspectable Space (IS) calculation; if outside IS distance, no shielding required.
   - **TEMPEST Zone determination** by Certified TEMPEST Technical Authority (CTTA) — Zone A (highest threat) / B / C.
   - **TEMPEST Level I / II / III** facility shielding — RF gasket all penetrations; copper mesh wall; double-door RF entry vestibule with shielded conduit transitions.
   - **NSA TEMPEST Endorsement Program (TEP)** for products inside; certified equipment lists.
   - Shielding cost: $50-200/sqft adder; full RF cage 2-5× standard SCIF cost.
5. **Alarm / access / monitoring (ESS — Electronic Security System)**:
   - **IDS (Intrusion Detection System)** — UL 2050 listed; balanced magnetic switches on every door + window, motion/PIR in interior, dual technology (PIR + microwave) sensors. Reports to central monitoring station UL-2050-certified.
   - **Access Control System (ACS)** — PIV/CAC reader at every SCIF entry; PIN + biometric for TS/SCI. Logs retained per ICD 705-2 (typically 90 days minimum, longer per program).
   - **CCTV** — recording 30+ days; covers SCIF entries + perimeter; not inside the SCIF discussion areas.
   - **Sound masking** — pink noise generators if STC borderline.
   - **Continuous monitoring** — 24/7 or per program; alarm response SLA <15 min by cleared responder.
6. **Two-Person Integrity (TPI) requirements**:
   - **TS-SCI material handling** — TPI for storage opening, transport, certain destruction operations.
   - **Configured at safe door / vault door** — two combos held by different people, neither can open alone.
   - **For SAP** — even stricter; per-program.
7. **Power + comms**:
   - **Power** — dedicated panel; UPS sized for graceful shutdown; backup generator if mission-critical; RF filters on incoming AC if shielded SCIF.
   - **Network** — fiber preferred (no copper RF leakage); accredited NIPR / SIPR / JWICS drops via accredited cabling and CDS.
   - **Phone** — no external POTS line inside discussion area; STE / VoSIP / SIPR voice.
   - **Cell phones** — prohibited; **personal electronic device (PED) lockers** at entry; signal jamming generally NOT allowed (FCC) — physical denial instead.
8. **Accreditation path (AO inspection)**:
   - **Concept Approval** — sponsor AO concurs SCIF needed; CONOPS approved.
   - **Construction Security Plan (CSP)** — submitted to AO; covers personnel cleared on construction, material handling, GC vetting.
   - **Pre-construction inspection** — AO walks shell; signs off plan.
   - **Cleared construction crew** — for TS+; uncleared OK for shell but cleared escort + cleared crew for final TS-sensitive build phases.
   - **TSCM sweep** (Technical Surveillance Countermeasures) — pre-occupancy bug sweep by accredited TSCM provider.
   - **Final inspection** — AO accredits; SCIF "Accredited" status; written approval letter.
   - **Co-use / Joint-use agreement** if multiple programs share.
   - **Re-accreditation** — typically 5-year cycle or on substantive change.
9. **Operating model**:
   - **SSO (Special Security Officer)** appointed; coordinates with FSO.
   - **Cleared janitorial / maintenance** — vetted + escorted or fully cleared.
   - **Visitor procedures** — visit request system (DISS for DoD, Scattered Castles for IC); escort by cleared host.
   - **Daily open/close procedures** — opener/closer log; alarm activation/deactivation logged.
   - **Annual self-inspection** + AO periodic re-inspection.
10. **Build vs lease vs co-use**:
    - **Build (own)** — control + long-term cheap; $500k-$2M+ capex; 6-18 mo timeline.
    - **Lease + fit-out** — common; landlord lease accommodating ICD 705 (e.g., Tysons Corner, Crystal City, Reston, San Antonio, Huntsville buildings purpose-marketed).
    - **Co-use** — operate inside another company's SCIF under co-use MOA; cheapest startup option; $5-30k/seat/year; programmatic limits.
    - **WeWork-equivalent classified spaces** — emerging (e.g., Clearwater Compliance Spaces, defense-startup incubators with shared SCIFs). Limited capacity.
11. **Cost ranges (2024-2026 market)**:
    - Shell-and-core retrofit, no TEMPEST, 200 sqft: $200-400k + $20k/yr ops
    - Shell-and-core, light shielding, 500 sqft: $500-800k + $50k/yr
    - Purpose-built standalone SCIF, 2000 sqft, TEMPEST Level II: $1.5-2.5M + $150k/yr
    - Full TEMPEST + RF cage, 1000 sqft: $1.5-3M + $200k/yr
    - Co-use seat: $5-30k/seat/yr
12. **Risk + failure modes**:
    - **GC builds non-compliant** — AO rejects; rework 30-50% of cost
    - **TSCM finds emanation issue** — rework + delay
    - **Personnel uncleared during sensitive phase** — restart construction security plan
    - **HVAC penetration discovered post-build** — cut + re-seal
    - **Adjacent space change** (new tenant) — Inspectable Space recalculation may force shielding upgrade

## Output
Write `docs/inception/scif-<project>.md`:

```markdown
# SCIF Buildout Spec — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <SSO + Facilities Lead>
**Sponsor AO:** <agency / program office>

## Use case
- Classification handled: TS/SCI
- Function: discussion + open storage + ops floor + dev/test bay
- Headcount in SCIF: 12 desks (cleared eng + analysts)
- Hardware: 1 SIPR rack + 1 JWICS rack + 2 cleared dev racks
- Hours: 24/7 ops Y2; daytime only Y1
- Compartments: <program names / SAP yes-no>

## Standard + tier
- Governing: ICD 705 (IC sponsor) + ICS 705-1 Tech Spec
- DoD overlay: DoDM 5105.21 (if DoD program)
- Tier: Standard SCIF (not Tactical, not Vault)
- TEMPEST: Level II (per CTTA Inspectable Space analysis)

## Footprint + shell decision
- Option A: lease + fit-out (Tysons Corner Class A building, 1800 sqft) — preferred
- Option B: own build (no — capex too heavy Y1)
- Option C: co-use at <partner facility> — Y0 bridge, 4 seats only

## Construction spec (ICD 705 highlights)
- Walls: slab-to-slab, 5/8" GWB both sides of 3-5/8" metal stud, exp metal mesh in cavity
- STC target: 50 (discussion area)
- Doors: SCIF-approved 3-hinge, X-09 lock, automatic closer, acoustic seal, peep
- HVAC: ducts < 96 sq in OR Man Bars + IDS
- Penetrations: all RF-gasketed, logged in penetration matrix
- Plumbing: minimized; restroom outside SCIF
- Floor/ceiling: slab-to-slab; no plenum bypass

## RF / TEMPEST
- CTTA assessment: completed <date>
- Inspectable Space: <ft>
- Shielding: copper mesh both walls + door RF gasket; entry vestibule shielded
- Filters: AC line + comms line per NSA TEMPEST guidance
- TSCM sweep schedule: pre-occupancy + annual

## ESS (Electronic Security System)
| Element | Spec | Vendor | UL? |
|---|---|---|---|
| IDS panel | UL 2050 monitored | <vendor> | UL2050 |
| Door sensors | balanced magnetic, every door | <vendor> | UL |
| Motion sensors | dual-tech (PIR + microwave), all spaces | <vendor> | UL |
| Glass-break | n/a (no glass) | — | — |
| ACS | PIV/CAC + PIN; biometric overlay TS-SCI | <vendor> | FIPS 201 |
| CCTV | 30-day retention, all entries + perimeter | <vendor> | — |
| Sound masking | pink noise plenum-mounted | <vendor> | — |
| Monitoring station | <UL2050 station, 24/7> | <vendor> | UL2050 |

## TPI configuration
- Vault door: dual X-09 combos (CISO + SSO)
- SAP material safe: dual combo
- Crypto fill device: dual control
- Audit log: dual sign-in to closet

## Power + comms
- Dedicated 200A panel + UPS (30 min hold) + generator (8 hr Y2)
- Network: dedicated fiber drops, accredited cabling for SIPR + JWICS
- Voice: STE on SIPR; VoSIP on JWICS; no commercial POTS in discussion
- PEDs: locker bank at entry; no cell/laptop inside; physical denial (no jamming)

## Accreditation path
| Step | Owner | Duration | Status |
|---|---|---|---|
| Concept Approval (sponsor AO) | SSO | 60d | |
| CSP (Construction Security Plan) | SSO + GC | 90d | |
| Pre-construction inspection | AO | 30d | |
| GC + sub-vetting | FSO | 60d | |
| Construction | GC | 4-6mo | |
| Cleared phase (final 25%) | cleared crew | 30-60d | |
| TSCM sweep | TSCM vendor | 1-2 weeks | |
| Final AO inspection | AO | 30d | |
| Accreditation letter | AO | 15d | |
| **Total** | | **9-12 mo** | |

## Operating model
- SSO: <name>, also FSO
- Janitorial: cleared (Secret) escorted; weekly
- Maintenance: cleared escort policy documented
- Visitor mgmt: DISS + Scattered Castles; pre-arrival 5 days
- Open/close logs: paper + electronic, retained 7yr
- Self-inspection: annual; AO re-inspection 5yr cycle

## Cost (capex + opex)
| Item | Cost |
|---|--:|
| Architect + ICD 705 designer | $150k |
| GC construction (1800 sqft, TEMPEST II) | $1.4M |
| ESS install (IDS + ACS + CCTV) | $200k |
| TEMPEST shielding adder | $400k |
| Furniture + cleared destruction equipment | $80k |
| TSCM sweep | $30k |
| Accreditation admin | $40k |
| **Capex total** | **~$2.3M** |
| Annual: UL monitoring | $30k |
| Annual: cleared janitorial | $25k |
| Annual: SSO 0.5 FTE | $100k |
| Annual: maintenance + recerts | $35k |
| **Opex total** | **~$190k/yr** |

## Co-use bridge (Y0)
- Partner: <DEFCO Inc.> co-use MOA
- Seats: 4
- Cost: $25k/seat/yr × 4 = $100k/yr
- Limit: pre-development phase only; ops moves to own SCIF Y1 Q4

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GC non-compliance | M | H | ICD-experienced GC (Hensel Phelps, Whiting-Turner, Skanska gov practice) |
| TSCM finds emanation | M | M | CTTA pre-design + light shielding margin |
| Adjacent tenant change | L | M | landlord clause restricting adjacent fit-out |
| Sponsor AO turnover | M | H | quarterly relationship; secondary AO contact |
| Cleared crew unavailable | M | M | book 12mo in advance; reserve 2 vendors |

## 90-day plan
1. Sponsor AO concept approval briefing (week 1-4)
2. ICD 705-experienced architect engaged (week 1-6)
3. Shell selection — lease term sheet (week 4-8)
4. CTTA assessment + TEMPEST tier decision (week 4-10)
5. GC RFP issued (week 6-12)
6. Co-use bridge MOA executed (week 1-4)
7. CSP draft (week 8-12)
```

## Verification
- Governing standard declared (ICD 705 / DoDM 5105.21 / NISPOM Closed Area).
- TEMPEST tier set by CTTA, not guess.
- ESS UL 2050 monitored.
- TPI configured for safes + vault door.
- Cleared construction crew planned for final phase.
- TSCM sweep scheduled pre-occupancy.
- AO accreditation path mapped with sponsor approval gates.
- Cost realistic ($200k-$3M range; co-use bridge offered if Y0 budget limited).
