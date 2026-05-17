---
name: cross-domain-solution-design
description: Cross-Domain Solution (CDS) design for multi-classification data flows — NIPR ↔ SIPR ↔ JWICS, raise/lower one-way guards, UCDMO baseline selection, filter chain config, spillage IR. Outputs to `docs/inception/cds-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/security-clearance-mapping`, `/multi-classification-pipeline-design`. Use when user says "cross-domain", "CDS", "guard", "raise/lower", "NIPR SIPR JWICS", "high side low side", "spillage", "UCDMO", "NCDSMO", or "/cross-domain-solution-design".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /cross-domain-solution-design — CDS Architecture + Accreditation Pre-scope

## Why you'd care

Multi-classification programs (DoD / IC / coalition) move data between NIPR (unclassified), SIPR (Secret), and JWICS (TS-SCI). Without an accredited CDS, every transfer is either a manual sneakernet (slow + error-prone) or a spillage incident (career-ending, multi-month cleanup). The CDS *is* the program's nervous system between security domains.

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (architecture sketch, UCDMO baseline pick, vendor shortlist, filter-policy outline, spillage IR draft). Actual CDS accreditation by NCDSMO (National Cross Domain Strategy Management Office) is **18–36 months** including Lab-Based Security Assessment (LBSA), and per-deployment site accreditation. Vendor licensing + hardware + integration: **$500k–$5M**. Pre-scoping artifacts here are gates 1–3 of a 12-gate journey.

Invoke as `/cross-domain-solution-design`. L+ govtech/IC only.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/clearance-<project>.md` (`/security-clearance-mapping`).
3. Read `docs/inception/multi-classification-<project>.md` if exists.
4. Read program SCG (Security Classification Guide) if provided.

## Inputs
- Source + destination domains (NIPR / SIPR / JWICS / coalition rel-to / commercial).
- Data types crossing (structured records, video, chat, files, voice, sensor telemetry).
- Direction (raise / lower / bidirectional).
- Volume + latency budget (real-time C2 vs daily batch).
- Sponsor accreditor (DoD AO, IC AO, NSA NCDSMO).

## Process
1. **Pick the transfer pattern**:
   - **Raise One-Way (ROW)** — low → high (e.g., NIPR → SIPR). Cheaper, fewer filters; risk = high-side gets malware/poisoned content. Typical: data diodes (Owl, Fox-IT, Waterfall).
   - **Lower One-Way (LOW)** — high → low. Hard problem; risk = classified spillage. Requires content filters, dirty-word search, structured data validation, optical-character review (OCR for redacted PDFs).
   - **Bidirectional** — most complex; combines ROW + LOW with strict policy enforcement points (PEPs). Generally avoided when ROW+LOW pair will do.
2. **Consult the UCDMO Baseline List** — Unified Cross Domain Management Office (now NCDSMO) maintains the approved CDS product list. Pick from baseline; off-baseline solutions face 2-3× longer accreditation. Common entries:
   - **Forcepoint Trusted Thin Client / High-Speed Guard** — IC favorite for ROW/LOW
   - **Owl Cyber Defense DualDiode** — hardware diode, ROW
   - **Fox-IT DataDiode** — hardware diode, ROW
   - **Waterfall Security Unidirectional Gateway** — industrial / ICS ROW
   - **SafeNet ProtectV / Thales CipherTrust** — encrypted-channel guards
   - **Raytheon High-Speed Guard (HSG)** — bidirectional, multi-level
3. **Filter chain architecture** (LOW path is where you earn your pay):
   - **Schema validation** — strict typed-record check (XML/JSON schema, MIL-STD-2525 symbology for C2)
   - **Dirty-word / dirty-pattern** — regex + ML classifier scan for classified markers, code words, program names
   - **Format normalization** — strip metadata (EXIF, document properties, hidden Office revisions)
   - **Deep content inspection** — antivirus, file-type magic-byte validation, embedded-object stripping
   - **Human review queue** — anything above policy threshold parks in a release officer queue
   - **Cryptographic binding** — each release stamped with cleared release-officer key + timestamp for forensic chain
4. **Accreditation path** (NCDSMO):
   - **Concept of Operations (CONOPS)** brief — 30-60 days
   - **Lab-Based Security Assessment (LBSA)** at NSA/CSS NCDSMO lab — 6-12 months
   - **Site accreditation** by your AO (per-deployment, even for accredited product) — 3-6 months
   - **Renewal / re-accreditation** every 3 years or on substantive change
   - **TSABI** (Top Secret/SCI ABI) or **SABI** (Secret/Below Interoperability) review for IC and DoD respectively
5. **Risk Management Framework (RMF) integration** — CDS sits inside an authorized boundary. NIST SP 800-37 RMF steps 1-6 apply. CDS controls overlay (CNSSI 1253) adds CDS-specific control selection.
6. **Spillage incident response** (mandatory; this WILL happen):
   - **Detection** — DLP alerts, audit-log anomaly, release-officer flag, classified-content found on lower-side system
   - **Containment** — isolate affected system, freeze backups, kill replication
   - **Reporting** — within 1 hour to FSO, within 24 hours to AO + cognizant security authority (CSA)
   - **Sanitization** — NIST SP 800-88 media sanitization (clear / purge / destroy). For SSD/flash: physical destruction often only option.
   - **Damage assessment** — original-classification-authority (OCA) determines damage tier
   - **After-action** — formal report, control update, possible CDS reaccreditation trigger
7. **Two-person integrity (TPI) policy** — release officer cannot self-approve own request. Configured at the guard. Required for LOW path. Audit log immutable + WORM.
8. **Coalition / FVEY release** — REL-TO markings (REL FVEY, REL NATO, REL AUS, etc.). CDS must enforce sub-classification dissemination controls (NOFORN, ORCON, IMCON). MISP / STIX threat-intel sharing rides over commercial CDS in some configs.
9. **Vendor + integrator shortlist** — CDS isn't sold off the shelf. Integrators (ManTech, Leidos, Booz Allen, SAIC, Forcepoint Federal) handle accreditation and operate the CDS under contract. Expect $500k–$2M annual operating cost per deployment.
10. **Volume + latency planning** — hardware diodes hit 1-10 Gbps line-rate; content-filtered guards drop to 100-500 Mbps depending on filter depth. Real-time C2 (sub-second) needs purpose-built; batch ETL (5-min latency acceptable) is easier.
11. **Failure modes**:
    - **Fail-closed** for LOW (better to block legit traffic than spill)
    - **Fail-open with alert** sometimes acceptable for ROW (e.g., sensor telemetry to high-side analytics; missing data is loss but not breach)
    - **Backpressure** under filter saturation — queue + drop policy must be documented

## Output
Write `docs/inception/cds-<project>.md`:

```markdown
# Cross-Domain Solution Design — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <ISSO / FSO>
**Sponsor AO:** <agency / element>

## Mission context
- Program: <name + classification>
- Domains involved: NIPR ↔ SIPR ↔ JWICS (mark which)
- Coalition: FVEY release-to? NATO?
- Data crossing: <list types + classifications>

## Transfer pattern
- [ ] Raise One-Way (ROW): <flows>
- [ ] Lower One-Way (LOW): <flows>
- [ ] Bidirectional: <flows> — justification: <why ROW+LOW pair insufficient>

## CDS product selection
- Candidate: <e.g., Forcepoint High-Speed Guard>
- UCDMO baseline status: ON / OFF
- Vendor: <Forcepoint / Owl / Fox-IT / Waterfall / Raytheon>
- Integrator: <ManTech / Leidos / Booz / SAIC>
- Hardware diode vs software guard: <choice + rationale>

## Filter chain (LOW path detail)
| Stage | Filter | Tool | Action on hit |
|---|---|---|---|
| 1 | Schema validation | XSD/JSON Schema | drop + alert |
| 2 | Dirty-word | regex + ML | hold for review |
| 3 | Metadata strip | ExifTool / OOXML normalize | rewrite |
| 4 | AV scan | <vendor> | drop + alert |
| 5 | Embedded-object strip | <vendor> | rewrite |
| 6 | Release-officer queue | custom | manual TPI release |
| 7 | Crypto-sign + log | HSM | release |

## Accreditation roadmap
| Gate | Step | Owner | Duration | Status |
|---|---|---|---|---|
| 1 | CONOPS to AO | ISSO | 30-60d | not started |
| 2 | Product pick + UCDMO check | ISSO | 30d | |
| 3 | Vendor + integrator selection | PMO | 60d | |
| 4 | LBSA prep package | Integrator | 90d | |
| 5 | LBSA execution at NCDSMO lab | NCDSMO | 6-12mo | |
| 6 | Site accreditation by AO | AO | 3-6mo | |
| 7 | IATT / ATO | AO | 90d | |
| 8 | Operate | ISSO + Integrator | ongoing | |
| 9 | ConMon + annual review | ISSO | annual | |
| 10 | Re-accreditation | NCDSMO + AO | 3-yr cycle | |

## Operating model
- Release officers: <N> cleared, TPI enforced
- Audit retention: <N years> WORM
- Throughput target: <X Mbps>
- Latency budget: <N seconds end-to-end>
- Maintenance window: <cadence>

## Spillage IR plan
- **Detection sources:** DLP, audit anomaly, release officer, downstream report
- **Containment SLA:** <1 hour
- **Reporting SLA:** FSO <1hr; AO + CSA <24hr; OCA per program SCG
- **Sanitization standard:** NIST SP 800-88 (clear / purge / destroy)
- **Media destruction vendor:** <NSA-EPL approved>
- **After-action template:** <link>

## Cost + headcount (Y1–Y3)
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| CDS hardware + license | $400k | $50k | $50k |
| Integrator (accreditation) | $600k | $200k | $200k |
| LBSA + accreditation fees | $150k | $0 | $50k |
| Cleared FTEs (2 ISSO + 1 release officer × 3 shifts) | $1.2M | $1.3M | $1.3M |
| Annual ConMon | $0 | $300k | $300k |
| **Total** | **~$2.35M** | **~$1.85M** | **~$1.9M** |

## Risk if skipped
- No CDS → sneakernet (USB transfer) → human-error spillage near-certain over time
- Or → manual air-gap with no transfer → program operates blind across classifications
- Spillage incident → program suspension + clearance damage + potential contract loss

## 90-day plan
1. Confirm sponsor AO + program SCG (week 1-2)
2. CONOPS draft + AO concurrence (week 2-6)
3. UCDMO baseline review + vendor shortlist (week 4-8)
4. Integrator RFP issued (week 6-10)
5. LBSA package outline (week 10-12)
6. Initial spillage IR tabletop (week 12)
```

## Verification
- Transfer direction declared (ROW / LOW / bidirectional) with rationale.
- UCDMO baseline product chosen or off-baseline path justified.
- Filter chain documented stage-by-stage for LOW path.
- Accreditation gate map present with NCDSMO LBSA called out.
- Spillage IR plan covers detection / containment / reporting / sanitization.
- Cost + headcount realistic ($500k–$5M range for CDS programs).
- Two-person integrity enforced for LOW releases.
