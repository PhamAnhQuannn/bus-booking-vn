---
name: security-clearance-mapping
description: Security clearance + facility clearance mapping for govtech / defense — DoD personnel + facility tiers, FOCI, NATSEC. Outputs to `docs/inception/clearance-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "security clearance", "FCL", "FOCI", "secret", "top secret", "DoD", "NATSEC", "/security-clearance-mapping", or for govtech / defense pursuits.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /security-clearance-mapping — Personnel + Facility Clearance

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (clearance-tier map, FOCI exposure, FCL sponsor plan, NATSEC trigger list). Actual clearance timelines: **Personnel TS/SCI = 12–18 months**, **Facility Clearance (FCL) = 6–12 months**, **FOCI mitigation (if foreign ownership) = +6–12 months + $100k+**. The 8h figure is NOT total project effort — clearance lead-times dominate any govtech / IC roadmap.

Invoke as `/security-clearance-mapping`. US DoD/IC personnel + facility clearance scoping. Only relevant for govtech / defense / IC contracting.

## Why you'd care

Govtech pursuits without clearance mapping mean you find out, after spending a year on a proposal, that your team can't legally access the customer environment. Map it before you commit the BD effort.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (only L+ govtech)
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/fedramp-pre-scope-<project>.md` if FedRAMP-track.

## Inputs
- Customer (DoD branch, IC element, civilian agency, allies).
- Data classification handled (CUI / Confidential / Secret / TS / TS-SCI).
- US ownership status (FOCI applies to foreign-owned).
- Founder / staff citizenship.

## Process
1. **Personnel clearance levels** (US):
   - **Public Trust (PT)** — civilian agencies, no classified
   - **Confidential** — minor exposure
   - **Secret** — most defense work; requires NACLC + investigation
   - **Top Secret (TS)** — major defense / intel
   - **TS/SCI** — Sensitive Compartmented Information; polygraph likely
   - **TS/SCI + SAP** — Special Access Program; per-program approval
2. **Investigation tiers** (Trusted Workforce 2.0):
   - **Tier 1** — non-sensitive PT
   - **Tier 2** — moderate-risk PT
   - **Tier 3** — Confidential / Secret
   - **Tier 4** — high-risk PT
   - **Tier 5** — TS / TS-SCI
   - Reinvestigation: Continuous Vetting (real-time vs old 5/10-yr periodic)
3. **Facility clearance (FCL)**:
   - **Confidential FCL**, **Secret FCL**, **TS FCL**
   - Sponsorship by cleared customer required (chicken-and-egg)
   - Granted by DCSA (Defense Counterintelligence and Security Agency)
   - NISPOM (32 CFR Part 117) compliance
   - Facility Security Officer (FSO) appointed
4. **FOCI** (Foreign Ownership / Control / Influence):
   - Triggered by: foreign owner ≥5%, foreign board, foreign creditor
   - Mitigation methods (escalating):
     - **Board Resolution** (lightest)
     - **Security Control Agreement (SCA)**
     - **Special Security Agreement (SSA)** (foreign owner allowed; restricted)
     - **Proxy Agreement** (foreign owner full restriction)
     - **Voting Trust Agreement** (most restrictive)
   - Reviewed by DCSA + customer
5. **Citizenship requirements**:
   - **US citizens** for cleared roles
   - **LPR** (green card) for some PT
   - **Foreign nationals** export-control implications (deemed export)
   - Dual citizenship may require renunciation for high clearance
6. **Process timeline**:
   - **Sponsorship → eApp/SF-86 submission**: 2–4 wk applicant prep
   - **DCSA investigation**: 90–365 days (avg ~120d Secret, ~250d TS)
   - **Adjudication**: 30–90 days
   - **Total**: 6–18 months realistic
   - Interim Secret possible in 30–60 days
7. **Cleared facility setup**:
   - SCIF (Sensitive Compartmented Information Facility) for TS/SCI
   - ICD 705 standard (IC); DoD 5105.21-M (DoD)
   - Cost: $200k–$2M+ to build SCIF
   - Open Storage area for Secret material
   - Access logs, alarm, two-person integrity for TS+
8. **Information systems**:
   - **NIPRNet** unclassified
   - **SIPRNet** Secret
   - **JWICS** TS-SCI
   - Air-gap or accredited cross-domain
   - DAAPM / RMF accreditation per system
9. **Allied equivalents**:
   - **UK**: SC (Security Check), DV (Developed Vetting)
   - **NATO**: NATO Confidential / Secret / Cosmic TS
   - **AUS**: Baseline / NV1 / NV2 / PV
   - **CAN**: Reliability / Secret (II) / Top Secret (III)
   - Reciprocity agreements (e.g., Five Eyes) limited
10. **Adjacent regimes**:
    - **CMMC 2.0** (DoD contractor) — separate from clearance
    - **NIST SP 800-171** (CUI handling) — separate from clearance
    - **ITAR registration** (defense article export) — separate
    - **CFIUS** — investment review (not clearance but related)

## Output
Write `docs/inception/clearance-<project>.md`:

```markdown
# Security Clearance Mapping — <project>
**Date:** <YYYY-MM-DD>

## Pursuit
- Customer target: DoD Air Force + DARPA + IC element
- Data classification: starts CUI; potential Secret Y2; TS/SCI Y3
- Contract vehicle: SBIR Phase II → OTA → potential program of record
- Foreign ownership: 0% (all-US founders)
- FOCI status: clean

## Personnel clearance need (Y1–Y3)
| Role | Level | Holder | Sponsorship path |
|---|---|---|---|
| CTO | Secret | TBD | via Air Force SBIR |
| Lead engineer | Secret | TBD | same |
| FSO | Secret | TBD (one of above doubles) | DCSA appointment |
| Sales engineer (DoD) | Secret | TBD | customer sponsor |
| Y3 IC pursuit | TS/SCI | TBD | post-Y2 contract |

## FCL roadmap
| Stage | Quarter | Action |
|---|---|---|
| Pre-FCL | Q1 | secure sponsorship letter from Air Force PM |
| Submit DD-441 | Q2 | DCSA application |
| FSO appointed | Q2 | one of two cleared founders |
| Investigation | Q3–Q4 | personnel + facility |
| Granted (Secret FCL) | Y2 Q1 | enables classified contract perform |

## FOCI assessment
- Ownership: 100% US-citizen founders
- Investors (current + planned Series A): screened US-only or vetted allies
- Board: all-US planned
- Creditors: standard US bank + venture debt
- Mitigation needed: NONE (clean) — protect by clause in any term sheet

## Citizenship strategy
- All cleared roles: US citizens only
- Engineering broader team: allow LPR + foreign nationals (no classified access)
- Code segregation: classified work in cleared-only repo (SIPR-side)
- Deemed-export risk: tracked per `/export-control-screen`

## Facility roadmap
| Tier | Need | Spec | Cost est |
|---|---|---|--:|
| Open storage Secret | Y2 | NISPOM compliant safe + alarm room | $30k |
| SCIF for TS/SCI | Y3 | ICD 705, ~200 sqft | $400k–$800k |
| Cross-domain | Y3 | accredited guard | $100k+ |
| NIPR / SIPR / JWICS | per contract | per ATO | varies |

## Investigation timeline budget
- Secret (Tier 3): 4–8 mo realistic
- TS (Tier 5): 8–18 mo realistic
- Continuous Vetting (post-grant): real-time
- Plan hiring with 6-mo lead for Secret roles

## Adjacent compliance
| Regime | Required when | Status |
|---|---|---|
| CMMC 2.0 L2 | DoD contract handling CUI | scope started |
| NIST SP 800-171 | CUI handling | gap assessed |
| ITAR registration | defense article export | check Y2 |
| FedRAMP Mod | civilian agency cloud | tracked separately |
| CFIUS | foreign investment | monitor Series A |

## Effort + cost (Y1–Y3)
| Activity | Cost |
|---|--:|
| FSO training | $2k |
| FCL application + admin | $5k legal |
| Personnel investigations | $0 (gov-funded) |
| Open storage facility | $30k Y2 |
| SCIF (Y3 if TS path) | $500k Y3 |
| Cross-domain Y3 | $100k Y3 |
| Annual NISPOM compliance | $20k/yr |
| **Y1 total (pre-FCL)** | **~$10k** |
| **Y2 total (Secret FCL)** | **~$50k** |
| **Y3 total (TS/SCI)** | **~$650k** |

## Risk if skipped (govtech track)
- No sponsor → no clearance → no classified work → blocked from many programs
- FOCI mishandled → DCSA denial → reapply 1+ yr later
- Hiring foreign national in cleared role → criminal liability
- SCIF non-compliant → contract termination

## Critical path
1. Air Force SBIR Phase II award (sponsor source)
2. FSO designation + DCSA application
3. CTO + Lead Eng Secret investigations in flight
4. Open storage facility ready before Secret-level deliverable
5. Continuous Vetting enrollment post-grant

## Adjacency to allies
- UK / Five Eyes contracts: separate process; reciprocity limited; allow extra 6mo
- NATO contracts: Cosmic TS via DCSA process
- AUKUS-relevant (sub / quantum / hypersonics): heightened scrutiny

## 90-day plan
1. Confirm SBIR Phase II sponsorship letter (week 1–2)
2. FSO course + designation (week 2–6)
3. SF-86 prep for cleared founders (week 4–8)
4. DD-441 submission to DCSA (week 8)
5. NISPOM compliance audit (week 8–12)
6. Foreign-investor screening clause in term sheet (week 12)
```

## Verification
- Personnel + facility clearance need declared per role.
- FOCI status assessed.
- Citizenship policy explicit.
- FCL sponsorship path identified.
- Adjacent regimes (CMMC / 800-171 / ITAR) noted.
