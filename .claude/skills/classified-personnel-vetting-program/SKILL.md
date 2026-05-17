---
name: classified-personnel-vetting-program
description: Classified-personnel vetting program design — Trusted Workforce 2.0 Continuous Vetting, insider-threat program per 32 CFR 117.7, SEAD-4 adjudicative guidelines, reciprocal clearance handling across DoD/IC/civilian, foreign-contact reporting. Outputs to `docs/inception/personnel-vetting-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/security-clearance-mapping`, `/foci-cfis-screening`. Downstream: `/scif-buildout-spec`, `/audit-log-design`. Use when user says "continuous vetting", "insider threat", "TW 2.0", "CV", "SEAD-4", "reciprocal clearance", "foreign contact", "32 CFR 117.7", "NISPOM ITP", "/classified-personnel-vetting-program".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /classified-personnel-vetting-program — Continuous Vetting + Insider Threat Program

## Why you'd care

A cleared facility (FCL) without a NISPOM-compliant Insider Threat Program (ITP) and active Continuous Vetting (CV) enrollment is non-compliant the moment FCL is granted. DCSA security vulnerability assessments cite ITP gaps as the #1 finding, and lapses can trigger FCL suspension within 30 days. Skip this and you have a clearance you cannot actually use.

> **Effort caveat:** `XL: 8h` covers *program design only* (ITP charter, CV enrollment plan, SEAD-4 self-report SOP, reciprocity matrix, FOCO reporting cadence). Actual program standup: **6–12 months** for ITP designation + training + senior official appointment; **CV enrollment** is automatic upon clearance grant but tuning the alert-response process takes 12+ months. ITP audit prep: $50k–$150k/yr for cleared-facility compliance staff. Multiply pre-scoping hours by ~40–60× for full program operationalization.

Invoke as `/classified-personnel-vetting-program`. L+ only — cleared-facility operations.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (FCL prerequisite)
2. Read `docs/inception/clearance-<project>.md` (from `/security-clearance-mapping`).
3. Read `docs/inception/foci-<project>.md` if foreign-investor exposure exists.
4. Read `docs/inception/fedramp-<project>.md` if cleared-cloud overlap.

## Inputs
- FCL level pursued (Confidential / Secret / TS / TS-SCI).
- Cleared headcount projection (Y1 / Y2 / Y3).
- Customer agencies (DoD branch / IC element / DOE / civilian).
- Foreign-contact exposure (founder travel, family, business).
- Operating contracts (NISP-only vs SAP vs SCI compartments).

## Process

1. **Authoritative source stack** (cite by number in program docs):
   - **DoDM 5200.02** — Procedures for the DoD Personnel Security Program (PSP), Apr 2017.
   - **32 CFR Part 117 (NISPOM Rule)** — National Industrial Security Program Operating Manual, effective 24-Feb-2021 (replaced DoD 5220.22-M).
     - §117.7 — Insider Threat Program (mandatory for all cleared contractors).
     - §117.8 — Security training and briefings.
     - §117.10 — Reporting requirements.
     - §117.11 — Foreign Ownership, Control, or Influence (FOCI).
   - **SEAD 3** — Reporting Requirements for Personnel with Access to Classified Information or in Sensitive Positions (foreign contacts, foreign travel, financial issues).
   - **SEAD 4** — National Security Adjudicative Guidelines (13 guidelines A–M).
   - **SEAD 6** — Continuous Evaluation (operationalized into Trusted Workforce 2.0 CV).
   - **EO 13467 / 13764 / 13869** — Reform of suitability + security clearance + credentialing.
   - **ICD 704** — IC personnel security (TS/SCI).
   - **ICPG 704.2** — Personal Conduct standards for IC clearance.

2. **Trusted Workforce 2.0 / Continuous Vetting (CV)** — design enrollment + alert response:
   - CV replaces 5-yr (Secret) / 10-yr (TS) periodic reinvestigation with **real-time automated record checks** across 7+ data categories.
     - **Tier 1** — non-sensitive PT (basic CV).
     - **Tier 2** — moderate-risk PT.
     - **Tier 3** — Confidential / Secret (T3R reinvestigation replaced by T3 CV).
     - **Tier 4** — high-risk PT.
     - **Tier 5** — TS / TS-SCI (T5R replaced by T5 CV).
   - **DCSA CV data sources**: criminal (FBI/NCIC), credit (Equifax/Experian/TransUnion), terrorism (TIDE), foreign travel (CBP), public records (LexisNexis), social-media (limited per ODNI guidance), suspicious financial (FinCEN).
   - **Alert categories**: criminal arrest, credit delinquency >$10k, bankruptcy, foreign travel >7d unreported, foreign contact unreported, financial windfall, suspicious activity report.
   - **Response SLA**: FSO must triage within **5 business days**; submit incident report to DCSA via NBIS within **30 days** for adverse info; subject interview within 90 days.

3. **Insider Threat Program (ITP)** per 32 CFR 117.7 — mandatory components:
   - **Senior Official designation** — corporate officer (typically CEO or CSO) signs ITP charter, has personal liability for program effectiveness. Names go to DCSA via DD-441s package.
   - **ITP Senior Official + ITP working group** — multi-functional (FSO, HR, IT, Legal, Counterintelligence, ethics).
   - **Mandatory program elements (NISPOM minimum standards)**:
     - (a) Designate Senior Official for ITP.
     - (b) Establish ITP capable of gathering, integrating, reporting.
     - (c) Provide insider-threat awareness training initial + annual.
     - (d) Monitor classified network user activity (UAM).
     - (e) Coordinate with FSO, HR, security, IT, legal, CI.
     - (f) Report insider-threat info to DCSA, FBI per 32 CFR 117.8.
   - **Self-inspection** annual per 32 CFR 117.7(e); written report to DCSA.
   - **DCSA SVA** (Security Vulnerability Assessment) every 12–18 months audits ITP.

4. **SEAD-4 Adjudicative Guidelines** — train staff on the 13 disqualifying conditions:
   - **A** — Allegiance to the United States.
   - **B** — Foreign Influence.
   - **C** — Foreign Preference.
   - **D** — Sexual Behavior.
   - **E** — Personal Conduct.
   - **F** — Financial Considerations (#1 disqualifier — 40%+ of denials).
   - **G** — Alcohol Consumption.
   - **H** — Drug Involvement (marijuana state-legal still disqualifying federally).
   - **I** — Psychological Conditions.
   - **J** — Criminal Conduct.
   - **K** — Handling Protected Information.
   - **L** — Outside Activities.
   - **M** — Use of Information Technology Systems.
   - Per-guideline **Mitigating Conditions** (e.g., F.20.a "behavior happened so long ago...") trained for self-report drafts.

5. **Self-reporting program (SEAD-3 + NISPOM §117.10)** — establish reporting SOP:
   - **Before** event reportable: foreign travel >24h (any country, even Canada), foreign contact (continuing/close), foreign business interest >$10k.
   - **Within 5 days**: marriage, cohabitation, change in citizenship/name.
   - **Immediate**: arrest, garnishment, bankruptcy, lost classified material, suspected espionage approach (CI awareness — DCSA Form 1879).
   - Build secure intake form (encrypted email or NBIS portal) + FSO acknowledgment SLA.
   - Annual **Counterintelligence Awareness Briefing** per 32 CFR 117.12.

6. **Reciprocity matrix** — Executive Order 13467 mandates clearance reciprocity but practice varies:
   - **DoD ↔ DoD** — automatic via JPAS/DISS (now NBIS).
   - **DoD ↔ IC (CIA/NSA/DIA/NRO/NGA/ODNI)** — TS reciprocal in principle; SCI compartments require **read-on** per program; polygraph not always reciprocal (CIA full-scope vs NSA CI-only).
   - **DoD ↔ DOE Q/L** — DOE Q ≈ TS; reciprocity slow (60–120 days crossover).
   - **DoD ↔ civilian (DHS, DOJ, State)** — Tier 3/5 reciprocal; civilian PT often non-reciprocal.
   - Build per-cleared-employee **clearance crosswalk** in DISS/NBIS showing eligibility vs accesses granted.

7. **Foreign-contact + foreign-travel reporting cadence**:
   - **Pre-travel**: minimum **30 days prior** for SCI; **immediate** for non-SCI cleared.
   - **Post-travel debrief**: within 5 days for SCI; CI debrief if travel to CI threat country (China, Russia, Iran, North Korea, Cuba — DCSA threat list).
   - **Foreign contact register** maintained in NBIS — name, citizenship, nature, frequency, employment.
   - **Family members** with foreign citizenship reported via SF-86 + updates.

8. **Insider-threat training program** — annual mandatory + role-based:
   - **Initial briefing** (within 30 days of clearance grant): 1–2 hr — NISPOM, SEAD-3, ITP, self-report.
   - **Annual refresher**: 1 hr — CDSE eLearning *INT101.16* free, or commercial vendor.
   - **Specialized**: derivative classifier (DCSA 2-hr), OPSEC (1 hr), CI awareness (1 hr annual).
   - **Departure briefing**: NDA recital + classified return + post-employment restrictions.
   - Track in NBIS or commercial Learning Management System (e.g., Visual Compliance, NC4).

9. **User Activity Monitoring (UAM)** on classified systems (NISPOM §117.7(d)):
   - **Required scope**: every user, every classified system (NIPR-CUI / SIPRNet / JWICS).
   - **Capture minimum**: keystroke, screen, file access, copy/print/USB, email, instant message.
   - **Approved tools**: Forcepoint Insider Threat, ObserveIT, Proofpoint ITM (post-acquisition), CMU CERT-IT (govt internal).
   - **Privacy boundary**: Privacy Act notice + cleared-employee consent; banner on every login.
   - **Retention**: minimum **5 years** per ITP charter; some IC programs require 7+ years.
   - **Review cadence**: anomaly-based + monthly random sample (5% of users).

10. **Cleared-staff hiring + offboarding lifecycle**:
    - **Pre-hire**: e-QIP/SF-86 prep, drug test, polygraph (if SCI), foreign-contact disclosure, prior-clearance verification via DISS.
    - **Onboard**: SF-312 NDA signed, initial briefing, NBIS enrollment, CV opt-in, badge/PKI cert.
    - **In-service**: annual refresher, self-reports, periodic interviews if alerts.
    - **Offboard**: SF-312 reaffirmation, classified-material inventory + return, debrief, NBIS access termination, **2-yr post-employment classified-handling agreement**, **PSP record retention 25 years**.

11. **Continuous Vetting alert workflow** — design a runbook:
    - Alert ingestion (NBIS push) → FSO triage (5 BD) → fact-gather → subject interview (if warranted) → DCSA incident report (DD-441-1) → adjudicative recommendation → DCSA CAS adjudication → outcome (continue / suspend / revoke).
    - Maintain **chain of custody** on all evidence (DCSA SVA will spot-check).
    - **Suspension** is administrative (no due process) — revocation requires SOR + reply + ALJ hearing under SEAD 4.

12. **Cost + headcount**:
    - **FSO (1 FTE)**: $100k–$160k loaded; required for any FCL.
    - **ITP Senior Official**: typically existing C-suite — 0.1–0.25 FTE allocation.
    - **CI / ITP analyst (1 FTE @ 25+ cleared headcount)**: $120k–$180k.
    - **UAM tool**: $50k–$200k/yr depending on seat count.
    - **CV cost**: $0 to contractor (DCSA absorbs); investigation backlog is the constraint.
    - **Annual training (CDSE free + tracking)**: $5k–$20k SaaS.
    - **DCSA SVA prep + remediation**: $25k–$100k/yr.
    - **Total Y1 ITP standup**: **$250k–$600k loaded**; Y2+ ongoing **$200k–$500k**.

13. **Failure modes that trigger FCL suspension**:
    - Missing or stale ITP charter / Senior Official.
    - No annual self-inspection report on file.
    - UAM not deployed on classified network.
    - Initial briefings missed > 30 days post-grant.
    - Self-reports not escalated within SLA (DCSA test case).
    - Foreign-contact register incomplete.
    - Reciprocity transfer botched (employee performing classified work without read-on).

14. **DCSA SVA prep** (every 12–18 mo) — pre-built evidence binder:
    - ITP charter signed by Senior Official.
    - Annual ITP self-inspection (12-mo lookback).
    - Training rosters (initial + annual + specialized).
    - Self-report log (chronological, redacted as needed).
    - CV alert log + dispositions.
    - UAM coverage report + sample anomaly investigations.
    - DD-441s + FCL grant + KMP list current.

## Output

Write `docs/inception/personnel-vetting-<project>.md`:

```markdown
# Classified-Personnel Vetting Program — <project>
**Date:** <YYYY-MM-DD>
**FCL level pursued:** Secret (Y2) → TS/SCI (Y3)
**Cleared headcount Y3:** 18 (Secret 14 / TS-SCI 4)

## 1. Authoritative source stack
| Reg | Cite | Applies to |
|---|---|---|
| NISPOM Rule | 32 CFR 117.7 | ITP (mandatory) |
| NISPOM Rule | 32 CFR 117.10 | Reporting |
| SEAD 3 | ODNI 2017 | Self-report |
| SEAD 4 | ODNI 2017 | Adjudicative guidelines |
| SEAD 6 | ODNI 2018 | CV / TW 2.0 |
| DoDM 5200.02 | DoD 2017 | PSP procedures |
| ICD 704 | ODNI 2008 | IC TS/SCI |

## 2. Insider Threat Program charter
- **Senior Official:** <CEO name> (designated <date>) — personal liability ack signed
- **ITP working group:** FSO + HR Director + CISO + General Counsel + CI Officer
- **Meeting cadence:** monthly + ad-hoc on alert
- **Annual self-inspection due:** <Q4>
- **DCSA SVA window:** <next expected: Y2 Q2>

## 3. Continuous Vetting enrollment
| Tier | Headcount Y1 | Headcount Y2 | Headcount Y3 |
|---|--:|--:|--:|
| Tier 3 (Secret) | 4 | 10 | 14 |
| Tier 5 (TS/SCI) | 0 | 0 | 4 |
| **Total CV enrolled** | **4** | **10** | **18** |

## 4. CV alert response runbook
1. NBIS push → FSO inbox (auto-routed)
2. FSO triage within **5 business days**
3. If adverse info confirmed → fact-gather (≤14d) → subject interview (≤30d)
4. DD-441-1 to DCSA within **30 days** for credible adverse
5. Track in incident log; chain of custody preserved
6. Adjudication outcome logged + access adjusted (DISS/NBIS)

## 5. SEAD-4 disqualifier rates (planning)
| Guideline | Industry denial rate | Our screening posture |
|---|--:|---|
| F (Financial) | 40% | pre-hire credit pull + counseling resource |
| H (Drugs) | 18% | drug test + state-legal-marijuana brief |
| B (Foreign Influence) | 12% | foreign-contact register day 1 |
| E (Personal Conduct) | 10% | candid SF-86 prep coaching |
| Others | 20% | standard |

## 6. Self-report SOP
| Trigger | Window | Channel | Receiver |
|---|---|---|---|
| Foreign travel (cleared) | Pre-travel 30d (SCI) / immediate (Secret) | NBIS portal | FSO |
| Foreign contact (close/continuing) | Within 5d | encrypted email + NBIS | FSO + CI |
| Arrest / criminal | Immediate | direct call FSO | FSO |
| Garnishment / bankruptcy | Within 5d | NBIS | FSO |
| Marriage / cohabitation | Within 5d | SF-86 update | FSO |
| Lost classified | Immediate | DCSA Form 311 | FSO + DCSA |
| Suspected CI approach | Immediate | DCSA Form 1879 | FSO + FBI |

## 7. Reciprocity matrix
| Source clearance | Target | Reciprocal? | Lead time |
|---|---|---|---|
| DoD Secret | DoD Secret | Yes (auto via DISS) | 0–5 d |
| DoD TS | IC TS | Yes in principle | 30–60 d |
| DoD TS | IC SCI compartment | No (read-on required) | per program |
| DoE Q | DoD TS | Conditional | 60–120 d |
| DoD Secret | DHS Tier 3 | Yes | 30 d |
| Civilian Tier 1 PT | DoD Secret | No (new investigation) | 4–8 mo |

## 8. Insider-threat training plan
| Audience | Topic | Frequency | Provider | Duration |
|---|---|---|---|---|
| All cleared | Initial briefing | Once, ≤30d post-grant | FSO + CDSE | 2h |
| All cleared | Annual refresher | Annual | CDSE INT101.16 | 1h |
| All cleared | CI awareness | Annual | CDSE CI112.16 | 1h |
| Derivative classifiers | OCA training | Annual | CDSE IF103.16 | 2h |
| FSO / ITP staff | Program management | Bi-annual | CDSE FSO orientation | 8h |
| Departing | Debrief | At separation | FSO | 30m |

## 9. UAM deployment plan
- **Tool:** Forcepoint Insider Threat (Secret network) + ObserveIT (CUI network)
- **Coverage:** 100% cleared users on SIPRNet + NIPR-CUI
- **Capture:** keystroke + screen + file + copy/print/USB + email
- **Retention:** 5 years (NISPOM) / 7 years (IC programs)
- **Review:** anomaly-triggered + 5% monthly random sample
- **Privacy notice:** banner + SF-312 + Privacy Act notice signed at onboarding

## 10. Cost roll-up
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| FSO loaded | $140k | $145k | $150k |
| ITP Senior Official allocation | $30k | $35k | $40k |
| CI / ITP analyst | — | $150k | $160k |
| UAM (Forcepoint + ObserveIT) | $80k | $120k | $180k |
| Training stack | $10k | $15k | $20k |
| DCSA SVA remediation | $30k | $50k | $75k |
| **Annual total** | **$290k** | **$515k** | **$625k** |

## 11. Onboarding lifecycle checklist
- [ ] e-QIP/SF-86 reviewed by FSO before submit
- [ ] SF-312 NDA signed + filed
- [ ] Initial briefing completed within 30 days of grant
- [ ] NBIS enrollment + DISS access
- [ ] CV automatic enrollment confirmed
- [ ] PKI cert + SIPR/JWICS badge issued
- [ ] UAM consent banner acknowledged
- [ ] CI awareness briefing completed

## 12. Offboarding lifecycle checklist
- [ ] Classified-material inventory + return confirmed
- [ ] SF-312 reaffirmation signed
- [ ] Debrief completed (FSO)
- [ ] NBIS access terminated within 24h
- [ ] DISS clearance status update
- [ ] Post-employment classified-handling agreement signed (2 yr)
- [ ] PSP record retention scheduled (25 yr)

## 13. DCSA SVA evidence binder (live folder)
- [ ] ITP charter signed
- [ ] 12-month ITP self-inspection report
- [ ] Training rosters (initial + annual + specialized)
- [ ] Self-report log (12-mo lookback)
- [ ] CV alert log + dispositions
- [ ] UAM coverage report + anomaly sample
- [ ] KMP list current per DD-441s
- [ ] FCL maintenance correspondence

## 14. Risk + critical path
- Without ITP: FCL suspension within 30 days of grant
- Without UAM: §117.7(d) finding at next SVA — FCL conditional
- Without CV enrollment: cannot transition off periodic — out of compliance by 2027
- Without reciprocity matrix: cleared employee performs work without read-on → contract breach + criminal exposure

## 15. 90-day standup plan
1. ITP Senior Official designation memo signed (week 1)
2. ITP working group convened + charter drafted (week 2–4)
3. UAM vendor selected + POC running on SIPR (week 4–10)
4. Initial-briefing curriculum built (CDSE-aligned) (week 4–8)
5. Self-report SOP + intake form live (week 6–10)
6. First self-inspection dry run (week 10–12)
7. NBIS / DISS workflows tested with FSO (week 8–12)
```

## Verification
- [ ] ITP Senior Official designated and memo signed.
- [ ] CV enrollment plan covers 100% of cleared headcount.
- [ ] SEAD-3 + SEAD-4 trained content scheduled annually.
- [ ] Reciprocity matrix covers all customer agencies in pipeline.
- [ ] UAM coverage on every classified system in scope.
- [ ] Self-report SOP + intake channel live before first hire.
- [ ] DCSA SVA evidence binder skeleton populated.
