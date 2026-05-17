---
name: regulator-relations-fintech
description: Bank/fintech regulator-relations playbook — OCC/FDIC/Fed/state-DFS exam cadence, MRA/MRIA response, supervisory letter handling, ongoing dialogue cadence. Outputs to `docs/compliance/regulator-relations-<project>.md`. Reads `/project-classify`; skip XS+S. Use when user says "regulator relations", "OCC exam", "FDIC exam", "MRA", "MRIA", "supervisory letter", "matters requiring attention", "/regulator-relations-fintech", or before chartering / before first exam cycle.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /regulator-relations-fintech — Bank/Fintech Regulator Relations Playbook

Invoke as `/regulator-relations-fintech`. This is the operating manual for living under continuous bank supervision: who your examiner is, what cadence they show up on, how you survive an MRA without losing the charter.

## Why you'd care
Bank examiners are the only stakeholder who can revoke your right to operate via a single letter. Skip this and you find out what an MRIA is the week before your CEO has to sign a Consent Order — which costs ~$5–50M in remediation and 24 months of capped growth.

## Effort caveat — multi-year real timeline
- **Hours in this skill** are doc-prep + governance-cadence design.
- **Real-world calendar:** exam cycle 12–18 months. MRA remediation 6–12 months. MRIA remediation 12–24 months. Consent Order remediation 2–5 years. Charter application 18–36 months. Plan accordingly — this doc is the scaffold, the work is multi-year.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/regulatory-<project>.md` for charter posture (bank / BaaS sponsor / MTL).
3. Read `docs/compliance/aml-kyc-<project>.md` if AML is in your supervisory scope.
4. Identify primary federal regulator + every state DFS where you hold a license.
5. Have BSA Officer / Chief Compliance Officer / Chief Risk Officer named.

## Inputs
- Charter type: national bank (OCC), state member (Fed), state non-member (FDIC + state DFS), thrift (OCC), trust company (OCC/state), BaaS sponsor relationship, MSB + state MTLs, OCC Special Purpose Fintech Charter (limited).
- Asset size band: <$10B (CFPB exempt for exam, in scope for rules) / $10–100B / $100B+ (LISCC, CCAR).
- Activities: lending (CRA scope), deposits (FDIC Part 370 records), payments (Reg E/Z/CC), BSA/AML, third-party (TPRM under FRB/OCC/FDIC 2023 IA Guidance), model risk (SR 11-7).
- Last exam date + any open MRAs/MRIAs/Consent Orders.

## Process

1. **Map your supervisory matrix** — who has authority over what:

   | Regulator | Scope | Cycle | Key issuances |
   |---|---|---|---|
   | OCC | National banks, federal thrifts | 12-mo full-scope (18-mo if <$3B + 1/2 CAMELS) | Comptroller's Handbook, OCC Bulletins |
   | FRB | State member banks, BHCs, IHCs | Continuous for LFIs; tailored otherwise | SR letters, Reg YY |
   | FDIC | State non-member banks, all insured | 12-mo (18-mo small + healthy) | FIL letters, Part 364 |
   | CFPB | Consumer compliance >$10B | Continuous | Supervisory Highlights, Circulars |
   | State DFS (NY/CA/TX/etc.) | State-chartered, MTLs, BitLicense | 12–24 mo | State-specific |
   | FinCEN | BSA enforcement (delegated examiners) | Joint with primary | FinCEN advisories |

2. **Examiner cadence** — what a 12-month cycle looks like:

   - **T-90d:** First Day Letter (FDL) arrives. Information request: 80–200 line-items. Get in front of it — assign owners day-1, set internal due dates 14 days earlier than examiner deadlines.
   - **T-60 to T-30d:** Pre-exam document production via secure portal (OCC: BankNet / FDIC: ViSION / state: varies). PDFs only, OCR-clean, named per FDL line-item.
   - **T-0 (kickoff meeting):** Examiner-in-Charge (EIC) opens. Set tone — cooperative, transparent, lawyer-light unless escalated.
   - **On-site / hybrid (4–8 weeks):** Daily examiner asks. SLA: 24–48h response on additional asks. Track every ask in a request log.
   - **Exit meeting:** Verbal findings. Don't argue facts at the table — note, ask clarifying questions, push back later in writing.
   - **Report of Examination (ROE):** 60–90 days post-exit. Contains CAMELS rating (1–5; 1–2 well-managed, 3 needs improvement, 4–5 enforcement-ready) and any MRA/MRIA.
   - **Response letter:** Required within 30–60 days. Acknowledge each finding, commit remediation plan + due dates.

3. **MRA vs MRIA vs Consent Order vs Cease & Desist** — escalation ladder:

   | Level | Trigger | Cure window | Typical scope |
   |---|---|---|---|
   | Supervisory recommendation | Improvement opportunity | informal | best practice |
   | **MRA** (Matter Requiring Attention) | Practice that needs correction; not yet a violation | 6–12 mo | named practice, board-aware |
   | **MRIA** (Matter Requiring Immediate Attention) | Significant deficiency / violation / risk to safety+soundness | 30–180 days for plan; 6–24 mo execution | Board-resolution required, regulator monitors quarterly |
   | **Informal action** (MOU, Board Resolution) | Repeated MRA non-cure or 3-rated institution | 12–24 mo | non-public, asset growth may be capped |
   | **Formal action** (Consent Order, C&D, Civil Money Penalty) | 4–5 CAMELS, BSA violation, repeat MOU breach | 2–5 years | public, growth caps, executive removal possible |
   | Charter revocation / receivership | Critically undercapitalized + uncured | weeks | terminal |

4. **MRA/MRIA response playbook** — exact response template per finding:

   ```
   Finding [#]: [verbatim from ROE]
   Root cause: [process / people / system / governance gap]
   Corrective action plan:
     1. [action], owner [name], due [date]
     2. ...
   Validation: [how cure is proven — internal audit, third-party review, regulator re-test]
   Sustainability: [BAU control replacing the project — policy, KRI, committee]
   Board reporting cadence: [monthly until cure + quarterly post-cure]
   Target closure: [date]
   ```

   Common pitfall: corrective action stops at "we wrote a policy." Examiners want evidence the policy is operating — 3–6 months of clean control testing. Plan validation as 2x policy build time.

5. **Continuous dialogue cadence** — between exams:

   | Touchpoint | Frequency | Owner |
   |---|---|---|
   | EIC check-in call | Quarterly | CRO + CCO |
   | Regional ADC / portfolio manager | Semi-annual | CEO + CRO |
   | Targeted reviews (BSA, IT, credit) | As scheduled by regulator | Function head |
   | Material event notification | Within 1–5 business days | General Counsel |
   | New-product memo | 30–60 days pre-launch | CCO |
   | Annual risk-appetite + strategic plan | Annual | CEO + Board |
   | Third-party-risk material engagements | Per OCC/FRB/FDIC June-2023 Interagency Guidance | Vendor Risk |

6. **Material events that trigger pre-notification or "no-objection"** (varies by regulator):
   - New product / business line (especially crypto, BaaS, instant payments, BNPL)
   - Material third-party engagement (core processor, cloud, BaaS partner)
   - Change-in-control / director / senior officer
   - Branch / charter expansion
   - Dividend if >earnings or below well-capitalized
   - Capital action (subordinated debt, capital injection)
   - Cyber incident — OCC/FRB/FDIC 36-hour Computer-Security Incident Notification rule (effective May 2022)
   - Going-concern / material misstatement

7. **Exam preparation checklist** — start T-180d:
   - Update all policies (annual review evidenced by Board minutes)
   - Internal audit completed all in-scope areas in past 12 mo
   - Issues log: every prior MRA/MRIA tracked, validated, closed-by-audit
   - Risk-assessment refresh: BSA, IT, credit, compliance, model
   - Committee minutes complete + reviewed; charters current
   - Vendor risk inventory current, critical vendors monitored
   - KRI dashboards: 12-month trend with thresholds + breaches addressed
   - Loss data + complaint logs reconcile to GL
   - Training: BSA, fair-lending, code-of-conduct — 100% completion

8. **Document hygiene** — what examiners actually read:
   - **Single source of truth per policy** — version-controlled, dated, approved-by + date stamped
   - **Reconciliation evidence** — system-of-record extract → independent recount → variance explanation
   - **"Show me" packets** — for every committee, paper trail of: agenda → pre-read → minutes → action items → closure
   - **Issue tracker** — examiner asks for it Day 1. If yours is in someone's email, you already failed
   - **Three lines of defense map** — business owns the risk (1st), risk + compliance challenge (2nd), audit validates (3rd) — examiners draw this on a whiteboard and ask you to fill it in

9. **Internal escalation triggers** — when to loop in counsel + Board:
   - Any MRIA or formal action — Board + outside counsel same day
   - Subpoena, civil investigative demand (CID) — counsel before responding
   - Regulator request for closed-session Board meeting — counsel attendance
   - "Off-the-record" examiner conversation — there is no off-the-record; document
   - Whistleblower / Section 21A referral — counsel + Audit Committee
   - Loss event ≥X% of capital — Board + ALCO + regulator pre-notification

10. **Anti-patterns** (real enforcement triggers):
    - Adversarial tone with EIC — exam goes longer, ratings go lower
    - Promising remediation dates you'll miss — re-MRIA territory
    - Patching a finding without root-cause — examiner reissues at next exam
    - Hiding losses / complaints / known issues — discovery of concealment = formal action
    - "BSA officer is the COO too" — independence finding
    - No Board-level risk discussion in minutes — governance MRA
    - Letting examiner discover something internal audit should have — audit MRA + business MRA

11. **De-risk the relationship over time**:
    - Self-identify issues + bring remediation plan before examiner finds it (most credit-positive thing you can do)
    - Pre-meet on novel products with a written memo + risk analysis
    - Invest in regulator-facing talent (ex-OCC/FDIC examiners as compliance hires)
    - Annual offsite with Board + senior regulator — relationship continuity across rotations
    - Track every examiner-named "best practice" peer — apply within 6 months

## Output

Write `docs/compliance/regulator-relations-<project>.md`:

```markdown
# Regulator Relations Program — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <CRO + CCO> | **Board approval:** <date>

## Supervisory matrix
| Regulator | Scope | EIC | Cycle | Last exam | Next exam |
|---|---|---|---|---|---|
| OCC | National bank charter | <name> | 12mo | YYYY-MM | YYYY-MM |
| State DFS — NY | BitLicense, money transmission | <name> | 24mo | YYYY-MM | YYYY-MM |
| FinCEN | BSA delegated | (joint with OCC) | — | — | — |
| CFPB | (out of scope; <$10B) | — | — | — | — |

## Open findings tracker
| ID | Issued | Regulator | Level | Finding | Owner | Plan due | Cure due | Status | Validation |
|---|---|---|---|---|---|---|---|---|---|
| MRA-2025-01 | 2025-Q3 | OCC | MRA | TPRM critical-vendor monitoring | CRO | 2025-10-15 | 2026-04-30 | in-flight | IA Q2-26 |

## Cadence calendar
- Quarterly EIC call — last Thursday of quarter
- Semi-annual ADC meeting — March + September
- Annual strategic plan submission — November
- 36-hr cyber incident playbook — runbook ref [link]
- New product memos — submit 45 days pre-launch
- Material events log — General Counsel maintains

## Exam playbook
- **T-90d:** FDL response project kickoff; PMO assigned
- **T-60d:** Doc production lockdown; QC by Compliance + IA
- **T-0:** Kickoff prep — CEO + CRO + CCO + BSA Officer present
- **On-site:** Daily war-room 0800; request log on shared portal
- **Exit:** Listen-mode; written rebuttal within 30d
- **Post-ROE:** Response letter within 30d; cure plan with owners + dates

## Material event protocol
| Trigger | Notify | Window | Channel |
|---|---|---|---|
| Cyber incident meeting "material" | Primary federal regulator | 36 hours | Phone + follow-up letter |
| New product (crypto, BaaS, etc.) | Primary regulator + state | 45 days pre-launch | Written memo |
| Senior officer change | Primary regulator | 30 days pre/post | Form (FRY-6, etc.) |
| Loss >X% of Tier 1 | Primary regulator + Board | Same day | Phone |

## Document discipline
- Policy library — version-controlled, annual Board approval, named owner
- Committee minutes — pre-read + minutes + actions + closure
- Issue tracker — single SoR (GRC tool: Workiva / OneTrust / LogicGate)
- KRI dashboard — monthly Board pack, breach commentary

## Pre-exam checklist (T-180d)
- [ ] Policies current + Board-approved
- [ ] IA universe complete past 12mo
- [ ] All prior MRA/MRIA closed-by-IA
- [ ] BSA + IT + credit + compliance + MRM risk assessments refreshed
- [ ] Committee minutes complete
- [ ] Vendor inventory + critical-vendor monitoring evidence
- [ ] KRI 12-mo trend pack
- [ ] Training 100%
- [ ] Loss + complaint reconciliation
- [ ] Three-lines-of-defense map

## Anti-patterns (avoid)
- Adversarial tone with EIC
- Patching findings without root-cause
- Hiding losses / complaints
- BSA Officer not independent
- Letting examiner discover what IA should have

## Escalation
- MRIA / formal action → Board + outside counsel same day
- Subpoena / CID → counsel before responding
- Material loss → ALCO + regulator pre-notify

## Year-1 milestones
- Q1: Hire ex-examiner senior advisor; refresh policy library
- Q2: GRC tool live; issue tracker single SoR
- Q3: First quarterly EIC call; new-product memo template
- Q4: Pre-exam mock with external counsel
```

## Verification
- Primary federal + every state regulator named with EIC.
- Open findings tracked with owner + dates + validation path.
- Quarterly EIC call calendar set.
- Cyber 36-hr notification runbook linked.
- New-product memo template exists.
- BSA Officer / CCO / CRO independence documented.
- Board-level reporting cadence named (monthly until MRA cure, quarterly steady-state).
