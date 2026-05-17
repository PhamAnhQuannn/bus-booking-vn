---
name: multi-classification-pipeline-design
description: Multi-classification data pipeline design — DoD Cloud Computing SRG IL2/4/5/6 impact-level segregation, labeling discipline, transfer-control logging, AWS GovCloud / Azure Government / Azure Gov Secret / Top Secret region patterns. Outputs to `docs/inception/multi-classification-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/security-clearance-mapping`. Downstream: `/cross-domain-solution-design`. Use when user says "IL2", "IL4", "IL5", "IL6", "DoD SRG", "impact level", "GovCloud", "Azure Government", "Azure Gov Secret", "multi-classification", "data labeling", or "/multi-classification-pipeline-design".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /multi-classification-pipeline-design — IL2/4/5/6 Pipeline + Labeling

## Why you'd care

Mixing IL4 and IL5 data in the same pipeline without explicit segregation is a clearance-revoking event in DoD work. The design enforces the labeling + transfer-control discipline before any data flows.

> **Why you'd care:** DoD Cloud Computing SRG defines four Impact Levels (IL2/4/5/6) by data sensitivity. Mixing them is a contract-killing offense. Without a labeled-pipeline design from day one, you ship data into the wrong region/account/network and either commit a spillage or block your own deployment because GovCloud doesn't have feature X yet. This skill maps the segregation before code is written.

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (impact-level mapping per data flow, region/account topology, labeling schema, transfer-control logging design). Actual IL5/IL6 ATO is **12-24 months** and the IL6 regions (AWS Top Secret / Azure Government Secret + Top Secret) require sponsor-controlled access — you cannot self-onboard. Pre-scoping here is the architecture artifact that *gates* the ATO journey.

Invoke as `/multi-classification-pipeline-design`. L+ govtech/defense only.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/clearance-<project>.md`.
3. Read `docs/inception/fedramp-<project>.md` if civilian-agency parallel path.
4. Read program SCG if available.

## Inputs
- Data classes handled (PII, CUI, Secret, TS, TS-SCI, SAP).
- Customer mission owners (DoD branch, IC element, civilian agency).
- Source systems (on-prem, sensor, partner feeds, allied data).
- Required cloud provider (sponsor often dictates).
- Existing commercial deployment (do you fork from commercial?).

## Process
1. **DoD Cloud Computing SRG impact levels** (DoD SRG v1r4, 2023):
   - **IL2** — Public / non-CUI. Commercial cloud OK (AWS commercial, Azure commercial). FedRAMP Moderate equivalent.
   - **IL4** — CUI / non-public unclassified. Requires FedRAMP Moderate + DoD overlay. AWS GovCloud, Azure Government, Google Assured Workloads.
   - **IL5** — CUI + National Security System (NSS) / mission-critical / law-enforcement-sensitive. FedRAMP High + DoD IL5 overlay. AWS GovCloud (IL5 authorized partition), Azure Government IL5 enclave, Oracle Government.
   - **IL6** — Classified (Secret). FedRAMP High + IL6 overlay + classified network. AWS Secret Region (C2S successor / Top Secret region), Azure Government Secret, Microsoft Azure Top Secret region (for TS-SCI as IL7 in some readings, though formal IL7 deprecated in SRG v1r4).
   - **(Deprecated IL3)** — folded into IL4.
   - **(Informal IL7)** — TS-SCI; uses Intelligence Community ICITE / C2S-successor; effectively Azure Government Top Secret + AWS Top Secret region.
2. **Cloud region topology** (verified 2026):
   - **AWS Commercial** — IL2
   - **AWS GovCloud (US-East / US-West)** — IL2, IL4, IL5
   - **AWS Secret Region** — IL6 (sponsor onboarding only)
   - **AWS Top Secret Region** — TS-SCI (C2S successor; IC sponsor only)
   - **Azure Commercial** — IL2
   - **Azure Government (US Gov Virginia / Arizona / Texas)** — IL2, IL4, IL5
   - **Azure Government Secret** — IL6
   - **Azure Government Top Secret** — TS-SCI
   - **Google Assured Workloads / Google Public Sector** — IL2, IL4, some IL5
   - **Oracle Government Cloud** — IL2, IL4, IL5
3. **Feature parity gap** — commercial features lag GovCloud by 6-18 months; IL5 lags IL4 by 3-6 months; classified regions lag GovCloud by 12-24 months. Check vendor's "Services in scope" doc before promising features. Common gaps: Bedrock/generative-AI, newest Lambda runtimes, Aurora Serverless v2 features, S3 features.
4. **Account / subscription segregation**:
   - **Hard tenant boundary per impact level** — never co-host IL4 + IL5 in same account. Even if vendor lets you, AO won't accept.
   - **Separate AWS Organizations / Azure Management Groups** per impact level.
   - **Network non-routability** between impact levels except via accredited CDS (see `/cross-domain-solution-design`).
5. **Data labeling discipline**:
   - **CAPCO marking** (Controlled Access Program Coordination Office) for IC: portion-marked (U), (CUI), (S), (TS), (TS//SI//NF) per paragraph.
   - **DoD CUI marking** — banner line, portion marks, CUI category (CUI//SP-PRVCY, CUI//SP-CRIT).
   - **Schema-enforced labels** — every record carries classification field; database constraint rejects unlabeled inserts.
   - **Cell-level labeling** in databases for mixed-classification rows (Accumulo, Cassandra with attribute-based access, or rolled own).
   - **File / object labels** — S3 object tags + bucket-level constraint; ABAC policy denies cross-impact access.
6. **Transfer-control logging**:
   - Every cross-impact transfer → CDS audit log (see `/cross-domain-solution-design`).
   - Every intra-impact access → standard audit log (CloudTrail, Azure Activity Log) with 7-year retention for IL5+, 25-year for some IC.
   - Logs to WORM storage (S3 Object Lock compliance mode, Azure Immutable Blob).
   - SIEM ingestion: Splunk Enterprise Security, Elastic, Sentinel Gov.
7. **Identity** — IL5+ requires DoD CAC / PIV-A authentication for human users + FIPS 140-2/3 validated crypto for workload identity. No commercial SSO (Okta commercial, Auth0 commercial) at IL5+. Approved: Okta Federal, Microsoft Entra Gov, ICAM brokers.
8. **Crypto** — FIPS 140-2 (legacy) / FIPS 140-3 (current) validated modules. AWS KMS GovCloud uses FIPS 140-2 validated HSMs. NSA Commercial Solutions for Classified (CSfC) for some IL6 use cases (commercial product chained to meet classified requirement).
9. **Pipeline pattern picks**:
   - **Single-impact pipeline** — entire flow at IL4, no crossing. Simplest. Pick if mission permits.
   - **Tiered pipeline** — ingest low, process high; uses ROW (raise one-way). Common for sensor → analytics.
   - **Bidirectional with CDS** — last resort; requires CDS accreditation per `/cross-domain-solution-design`.
   - **Air-gapped batch** — manual media transfer; cheap accreditation, terrible operations.
10. **Personnel access matrix** — each impact level has citizenship + clearance + need-to-know requirements:
    - IL2/IL4: US persons + background investigation
    - IL5: Public Trust / Secret depending on data; US citizens only
    - IL6: Secret clearance + Need to Know
    - IL7 (informal): TS/SCI + program read-on
11. **Sponsor onboarding for classified regions** — AWS Secret Region and Azure Government Secret/TS regions are not self-service. Sponsor agency must onboard you; expect 60-180 days. C2 / ICITE sponsorship varies by IC element.

## Output
Write `docs/inception/multi-classification-<project>.md`:

```markdown
# Multi-Classification Pipeline Design — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <chief architect / ISSO>

## Mission data inventory
| Data type | Classification | Source | Destination | Volume | Latency |
|---|---|---|---|---|---|
| Sensor telemetry | CUI (IL4) | edge sensors | analytics | 10 TB/day | 5 min |
| Mission orders | Secret (IL6) | C2 system | tactical edge | 1 GB/day | sub-second |
| Personnel records | CUI//SP-PRVCY (IL4) | HR system | reporting | 100 MB/day | 1 hr |
| Threat intel | TS//SI//NF (IL7) | IC feed | analyst workstation | 5 GB/day | 10 min |

## Impact-level decomposition
- **IL2:** marketing site, public docs
- **IL4:** sensor analytics, HR, finance, most CUI
- **IL5:** mission planning, OPSEC-sensitive but unclassified
- **IL6:** classified C2, Secret intel products
- **IL7 (informal):** TS/SCI fusion

## Cloud region map
| Impact | Provider | Region | ATO status |
|---|---|---|---|
| IL2 | AWS Commercial | us-east-1 | self |
| IL4 | AWS GovCloud | us-gov-west-1 | Agency ATO Y2 |
| IL5 | AWS GovCloud | us-gov-east-1 (IL5 partition) | Agency ATO Y2 |
| IL6 | AWS Secret Region | <region code> | sponsor onboard Y3 |
| IL7 | Azure Gov Top Secret | <region code> | sponsor onboard Y4 |

## Account / subscription topology
- AWS Org: prod-commercial (IL2) | prod-gov (IL4) | prod-il5 | prod-secret
- Azure Mgmt Group: same partitioning
- Cross-account access: DENIED at SCP layer; CDS only via accredited guard

## Labeling schema
- Field: `classification` (enum: U / CUI / S / TS / TS-SCI / SAP)
- Field: `caveats` (string[], e.g., NOFORN, NF, REL-FVEY, ORCON, IMCON)
- Field: `cui_category` (CUI//SP-PRVCY, CUI//BASIC, etc.)
- Field: `dissemination` (banner, portion mark)
- Field: `origination_oca` (Original Classification Authority ID)
- DB constraint: NOT NULL on classification; CHECK on enum
- API guard: middleware rejects unlabeled writes
- ML pipeline: labels propagate through transforms (provenance graph)

## Cross-impact data flow
| Flow | Direction | Mechanism | Justification |
|---|---|---|---|
| sensor IL4 → analytics IL4 | intra | API + queue | mission |
| analytics IL4 → fusion IL6 | ROW raise | CDS diode | <ref> |
| C2 IL6 → after-action IL4 | LOW lower | CDS filtered guard | post-mission declass |
| HR IL4 → personnel security IL5 | ROW | CDS | clearance vetting |

## Transfer-control audit
- Every cross-impact transfer → CDS log + central SIEM
- Retention: 7yr IL4-5; 25yr IL6+ (or per program SCG)
- WORM: S3 Object Lock compliance mode; Azure Immutable Blob
- Quarterly inspector review

## Identity + crypto
- Human auth: PIV / CAC + FIDO2 at IL5+; commercial SSO at IL2/4
- Service auth: workload identity via STS / managed identity; FIPS 140-3 validated
- Key management: AWS KMS GovCloud (FIPS 140-2); Azure Key Vault Premium HSM (FIPS 140-2)
- Classified: CSfC components if commercial chain to TS

## Feature-parity risk register
| Feature | Commercial | IL4 | IL5 | IL6 | Risk if missing |
|---|---|---|---|---|---|
| Bedrock | yes | partial 2026 | no | no | AI feature blocked at classified tiers |
| Aurora Serverless v2 | yes | yes | partial | no | classified DB on provisioned |
| ALB latest | yes | yes | 3mo lag | 12mo lag | TLS 1.3 features lag |
| Latest Lambda runtimes | yes | 3mo | 6mo | 12mo | dep upgrades blocked |

## Sponsor + onboarding timeline
| Region | Sponsor | Onboarding | Y |
|---|---|---|---|
| AWS GovCloud IL4 | self | 30d | Y1 |
| AWS GovCloud IL5 | self + AO | 90d | Y2 |
| AWS Secret Region | <agency PMO> | 180d | Y3 |
| Azure Gov TS | <IC element> | 365d | Y4 |

## Personnel access matrix
| Region | Citizenship | Clearance | Background |
|---|---|---|---|
| IL2 | any | none | standard |
| IL4 | US person | PT | Tier 2 |
| IL5 | US citizen | PT/Secret | Tier 3 |
| IL6 | US citizen | Secret + NTK | Tier 3 |
| IL7 | US citizen | TS/SCI + read-on | Tier 5 + poly |

## Cost (Y1-Y3 rough)
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| GovCloud infra (IL4/5) | $400k | $700k | $900k |
| Classified region (IL6) | $0 | $0 | $1.2M |
| Cleared ops staff | $800k | $1.6M | $2.4M |
| ATO + 3PAO | $400k | $200k | $400k |
| CDS (see other skill) | $400k | $200k | $200k |
| **Total** | **~$2M** | **~$2.7M** | **~$5.1M** |

## Risk if skipped
- Wrong impact-level placement → contract termination + clearance damage
- Unlabeled data → spillage near-certain at first cross-impact attempt
- Commercial cloud for IL4+ data → criminal liability (improper handling CUI/classified)

## 90-day plan
1. Data inventory + impact-level tagging (week 1-4)
2. Region/account topology draft + AO review (week 4-8)
3. Labeling schema + CRUD constraint design (week 6-10)
4. Cross-impact flow design (week 8-12) — feeds CDS skill
5. Sponsor identification for classified regions (week 1-12, parallel)
```

## Verification
- Every data type has an impact level assigned (IL2/4/5/6) with rationale.
- Account / subscription / region map prevents cross-impact co-tenancy.
- Labeling schema enforced at storage + API layer.
- Cross-impact flows enumerated and ROW/LOW direction declared.
- Feature-parity risks tracked per impact level.
- Sponsor identified for any IL6+ region (you cannot self-onboard).
- Audit + retention windows match program SCG.
