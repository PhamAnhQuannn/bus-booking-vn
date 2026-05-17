---
name: kyc-aml-program-design
description: BSA/AML program governance — five-pillar program design (BSA officer, written program, training, independent testing, CDD/CIP), CIP procedures, EDD tier rules, SAR/CTR workflow, sanctions screening cadence, FinCEN BOI, OFAC, FATF. Outputs `docs/compliance/kyc-aml-program-<project>.md`. Use when user says "BSA program", "AML program", "BSA officer", "compliance program", "CIP", "five pillars", "/kyc-aml-program-design", before MSB/MTL/bank-charter filing, or when standing up an AML function from scratch. Distinct from `/aml-kyc-design` (regulatory-regime mapping) and `/sanctions-screen` (screening engine config) — this is the governance + org + workflow layer. Reads `/project-classify`; skip XS+S.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /kyc-aml-program-design — BSA/AML Program Governance

## Why you'd care

A BSA/AML program isn't optional for any product touching money movement — FinCEN penalties run six to eight figures and personal liability attaches to the BSA officer. The five-pillar design is the floor, not the ceiling.

> **Why you'd care:** No BSA officer = no charter, no MSB registration, no bank partnership. FinCEN $25k–$57k civil penalty per violation; willful AML failure is criminal (up to $1M + 30 yr personal liability for the MLRO). Bank de-risking happens silently — payment rails revoke with 30-d notice and you can't reopen. The program is non-optional from day one of regulated activity.

> **Effort caveat (regulatory):** Independent-test cycle is 12-mo minimum; BSA officer hire is 4-8 weeks; CIP rollout including doc-collection plus vendor integration is 6-10 weeks. Don't compress past these floors — examiners ask for evidence trails dated before launch.

Invoke as `/kyc-aml-program-design`. Required for: MSB registrants (FinCEN 107), money transmitters (state MTL), banks/credit unions, broker-dealers, RIA above $100M AUM, casinos, crypto VASPs, dealers in precious metals/jewels above $50k/yr.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (not regulated).
2. Read `docs/inception/aml-kyc-<project>.md` (regulatory regime map). If absent, run `/aml-kyc-design` first.
3. Read `docs/compliance/sanctions-screen-<project>.md` (screening engine config). This skill governs WHEN screening fires; the screen skill governs HOW.
4. Read `docs/inception/legal-entity-<project>.md` (entity structure — affects who signs the Board approval).
5. Identify designated BSA officer or external interim (Treliant, K2 Integrity, Promontory, Cornerstone Advisors typical — $250–$500/hr).

## Inputs
- Business type + product list (deposit, lending, transmission, crypto, securities, lending).
- Jurisdictions + license types in scope (FinCEN MSB, NY DFS BitLicense, state MTLs, EU CASP, MAS PSA, FCA crypto).
- Customer mix: retail % / SMB % / institutional % / cross-border %.
- Annual volume forecast (drives independent-test scope + CTR/SAR volume projection).
- Risk appetite: PEPs allowed? Cash-intensive businesses? High-risk geos (FATF grey/black)?
- Existing tooling (already-procured vendors from sanctions/transaction-monitoring stack).

## Process

1. **Five-pillar program inventory** (FinCEN required since 2018, plus CDD/Beneficial-Ownership as the 5th):
   - **Pillar 1 — Designated BSA Officer**: named individual, Board-approved, sufficient authority + independence + resources. Reports to Board or Board committee.
   - **Pillar 2 — Written Policies, Procedures, Internal Controls**: living document; reviewed annually; version-controlled.
   - **Pillar 3 — Ongoing Training**: role-based + annual refresher + new-hire (30-d); Board itself gets annual AML training.
   - **Pillar 4 — Independent Testing**: every 12-24 months (12 for high-risk, 18 default, up to 24 for low-risk small institutions); by qualified independent party.
   - **Pillar 5 — CDD + Beneficial Ownership**: Customer Identification Program (CIP), Customer Due Diligence (CDD), ongoing monitoring, beneficial-ownership collection (25% + control prong since CDD Final Rule 2018; expanded by Corporate Transparency Act / BOI Report 2024).

2. **BSA Officer role design**:
   - **Authority** — direct line to CEO + Board; can freeze accounts, halt onboarding, file SAR without business-line sign-off.
   - **Independence** — does not report to revenue/growth functions; compensation not tied to onboarded-customer count or transaction volume.
   - **Qualifications** — CAMS or CFCS certification (minimum); 5+ yr AML experience for >$1B regulated entity, 3+ yr for emerging.
   - **Backup officer** — designated; trained quarterly; can act during PTO/incapacitation.
   - **Whether internal or fractional** — interim BSA-officer-as-a-service runs $15k–$40k/mo (Treliant, AML RightSource, BSA/AML Solutions). FT hire $120k–$220k base + 15-25% bonus. Bank-grade hire $250k–$400k.

3. **Customer Identification Program (CIP) — 31 CFR 1020.220 (banks), 1022.220 (MSBs)**:
   - **Minimum data**: legal name, DOB (individuals) / date of formation (entities), residential or business address (no P.O. box), TIN (SSN/EIN/ITIN). Non-US persons: passport + country + alien ID number.
   - **Verification methods** — documentary OR non-documentary OR combined:
     - Documentary: unexpired government-issued photo ID (DL, passport, state ID); for entities: certified articles, partnership agreement, trust instrument.
     - Non-documentary: independent data source (credit bureau, public DB, financial-data aggregator); knowledge-based authentication (KBA); biometric matching.
     - Risk-based combined approach (default): doc + selfie + database hit.
   - **Timeline** — verify "within a reasonable time" after account opening; industry norm is pre-funding for new MSBs, within 30 d for banks. Crypto: pre-first-transaction.
   - **Discrepancy handling** — name/DOB/address/TIN mismatch → tiered EDD or rejection; documented decision trail.
   - **Lack-of-verification protocol** — written procedure: how long account remains open without verification, restrictions during pendency (typically: deposits only, no withdrawals, no third-party transfers), eventual closure trigger.
   - **CIP notice** — to customer at or before account open; standard language: "USA PATRIOT Act requires us to obtain, verify, and record info that identifies each person who opens an account…"

4. **Beneficial Ownership Rule (CDD Final Rule + BOI Report)**:
   - **CDD Final Rule (FinCEN)** — at account opening for legal entities, collect beneficial owners (≥25% equity, "ownership prong") + one control person (CEO/managing member, "control prong"). Form: FinCEN CDD certification or own equivalent.
   - **Corporate Transparency Act / BOI Report** — separate filing obligation BY the reporting company TO FinCEN BOI database since Jan 2024 (subject to ongoing litigation but applies to most domestic reporting companies). Updates within 30 d of any change.
   - **Trigger refresh** — material change in ownership, change in control, change in business model, change in risk-tier.
   - **Recordkeeping** — 5 yr after account closure.

5. **EDD tier rules** (decision tree):
   - **Auto-EDD triggers** (must EDD before activation):
     - PEP hit (self, immediate family, close associate; 12-mo cool-off post-leaving)
     - Country on FATF grey or black list
     - Country under comprehensive OFAC sanctions
     - Correspondent banking relationship (foreign FI account)
     - Private banking customer >$1M
     - Cash-intensive business (MRBs, ATM operators, check cashers, used-car dealers, jewelry, art dealers)
     - Money service business (downstream MSB customer)
     - Trust / shell / nominee-heavy entity
     - Politically exposed jurisdiction or sanctioned-counterparty proximity
   - **EDD content** — source of funds, source of wealth, expected activity baseline, site visit (for high-value), enhanced beneficial-ownership tracing, senior-manager + compliance sign-off, more frequent reviews (annual minimum, semi-annual for high-risk).
   - **Standard CDD** — name/DOB/address/TIN verify, purpose of account, expected use, ongoing monitoring vs baseline.
   - **Simplified CDD (SDD)** — only available in EU under 6th AMLD for explicitly low-risk customers (regulated FIs, listed companies on regulated exchange, public authorities). US doesn't have an SDD regime.

6. **Transaction monitoring program structure** (the engine spec lives in `/sanctions-screen` and `/aml-kyc-design`; here we define governance):
   - **Coverage** — every monetary movement: deposits, withdrawals, transfers, lending originations, card transactions, crypto deposits/withdrawals.
   - **Rule taxonomy** — structuring (multiple sub-threshold), velocity (count + amount over time window), geographic anomaly, peer-anomaly (vs customer baseline), pass-through accounts, layering patterns, dormancy-then-activity, ATM cycling, crypto-fiat round-trips.
   - **Rule lifecycle** — every rule has a documented hypothesis, threshold rationale (with empirical basis), tuning schedule (quarterly), false-positive target (<70% by month 6), Board-approved when threshold material changes.
   - **Investigation workflow** — alert → triage queue (4-hr SLA for high-priority, 24-hr standard) → case manager → 30-d investigation clock → file SAR / close-no-action / open EDD case.
   - **Investigator productivity benchmark** — 8-15 alerts/day/analyst typical; 4-6 if heavy EDD cases.

7. **SAR/CTR filing workflow**:
   - **SAR (Suspicious Activity Report)**:
     - **Trigger** — known/suspected violation of federal law, transaction ≥$5k (banks) or ≥$2k (MSBs) involving suspicious activity, or any transaction designed to evade BSA reporting.
     - **Timeline** — file via FinCEN BSA E-Filing within 30 calendar days of detection (60 d if no suspect identified at day 30).
     - **Continuing-activity SAR** — if same suspicious activity continues, file follow-up SAR every 90 d.
     - **30-d clock starts** — at the moment compliance has gathered enough facts to form a suspicion. Not when alert fires. Document the start date.
     - **Confidentiality** — tipping-off is a federal crime; never disclose SAR existence to customer (even via subpoena response without DOJ liaison).
     - **Quality red flags from FinCEN exam-feedback** — vague narratives, missing transaction details, missing subject identifiers, copy-paste reuse → leads to MRA.
     - **Quarterly Board reporting** — SAR count, themes, large-dollar SARs (>$1M), patterns by product/geo.
   - **CTR (Currency Transaction Report)**:
     - **Trigger** — cash transactions >$10k in a single day by/for/on-behalf-of one person (aggregated across the day across branches/teller/ATM).
     - **Timeline** — file within 15 d (paper) or 25 d (e-file) of transaction.
     - **CTR aggregation rules** — same person across multiple transactions same day; track via CTR-aggregation engine.
     - **Exemption process** — Phase I (banks, governments, listed cos) automatic; Phase II (regular cash customers $10k+ for 2+ months) require annual review + filing of Form 8300/DOEP.
   - **Form 8300** — non-financial trades/businesses reporting cash >$10k from one customer; jointly to FinCEN + IRS; 15-d clock.

8. **Recordkeeping discipline** (31 CFR 1010.430):
   - **5-yr retention minimum** for: CIP records, CDD docs, SAR/CTR copies + supporting docs, wire transfer records ≥$3k (Travel Rule data per 31 CFR 1010.410), monetary instrument logs ($3k–$10k cash purchases), exemption documentation.
   - **CIP records — 5 yr after account closure**.
   - **SAR supporting docs — 5 yr from filing**.
   - **Storage** — WORM-class storage for SAR + supporting docs (see `/chain-of-custody-financial` for hash-chain + S3 Object Lock).
   - **Audit trail** — every CDD/EDD decision, every alert disposition, every SAR/non-SAR decision must show who/what/when/why.

9. **Independent testing program** (Pillar 4):
   - **Frequency** — 12-18 mo default; FFIEC BSA/AML Exam Manual recommends every 12-24 months. Annual for high-risk products (crypto, correspondent, private banking).
   - **Scope** — risk assessment validation, policy/procedure currency, training adequacy, CIP/CDD effectiveness, transaction monitoring rule tuning, SAR quality, OFAC screening accuracy, recordkeeping completeness.
   - **Independence requirement** — not the BSA officer, not anyone reporting to BSA officer, not anyone in line of business reviewed. Internal audit (if SOX-grade) or external firm.
   - **External vendors** — Crowe, Forvis, Plante Moran, K2, Treliant, Capco, Promontory; expect $50k–$250k for mid-size MSB/community bank; $500k+ for large institution.
   - **Output** — formal written report to Board, with management response, remediation plan, owner, deadline; tracked through closure; next test verifies prior findings closed.
   - **Common findings** — outdated risk assessment, untuned rules, weak SAR narratives, training gaps in front-line, BSA officer over-stretched, beneficial-ownership data stale.

10. **Training program design** (Pillar 3):
    - **Audience-tiered**:
      - **All-employees** — annual 1-hr base AML/sanctions awareness; tipping-off; suspicion-reporting channel.
      - **Front-line (onboarding, support, account ops)** — 3-hr role-specific; red-flag scenarios; CIP procedures; escalation.
      - **Compliance team** — 16-40 hr/yr; CAMS continuing ed; rule-tuning workshops.
      - **Senior management** — 2-hr annually; supervisory expectations; personal liability briefing.
      - **Board** — 1-hr annually; FFIEC/regulator expectations; SAR overview; major risks.
    - **New-hire training** — within 30 d of start; certification required before customer-facing duties.
    - **Records** — completion dates, scores, refresher cycle; retain 5 yr.
    - **Vendors** — NICE Actimize, ComplyAdvantage Academy, ACAMS curriculum, internal LMS (Lessonly, 360Learning).

11. **OFAC sanctions program governance** (parallel to BSA; OFAC enforces):
    - **Five-pillar OFAC compliance framework (OFAC 2019 Framework)**: senior-mgmt commitment, risk assessment, internal controls, testing & audit, training.
    - **Real-time screening** at: onboarding, every transaction (originator + beneficiary + countries + intermediary banks), daily list-update batch re-screen of full customer base.
    - **Lists** — OFAC SDN, OFAC consolidated non-SDN (SSI, FSE, NS-PLC, etc.), 50% rule (entities ≥50% owned by SDN), Specially Designated Nationals, sectoral sanctions, country sanctions (comprehensive vs targeted).
    - **Hit handling** — every hit blocked pending L3 compliance review within 4 business hours; potential match → escalation; confirmed → OFAC Blocking Report within 10 business days; rejected transaction → Rejection Report within 10 business days; annual ODFI Annual Report by Sept 30.
    - **Voluntary self-disclosure** — if violation discovered, voluntary disclosure can reduce penalties up to 50%; outside-counsel-led.

12. **Enterprise-wide Risk Assessment (EWRA)** — cadence + governance:
    - **Annual** + **on material change** (new product, new geo, M&A, regulatory shift).
    - **Inputs** — customer risk distribution, product risk inherent score, geographic exposure, channel risk (web/API/mobile/branch), transaction velocity + composition, SAR/CTR trends, exam findings, peer benchmarking.
    - **Output** — residual-risk heat map per business line; rule-tuning roadmap; resource-need projection.
    - **Approval** — BSA officer drafts; Board AML committee reviews; Board approves.
    - **Storage** — alongside Board minutes; produced at every exam.

13. **Regulatory examination readiness** (cross-reference `/regulator-relations-fintech`):
    - **Exam cadence** — banks: 12-18 mo (FFIEC); MSBs: state-cycle varies + IRS BSA exam triennially; broker-dealers: FINRA Risk Monitoring continuous + targeted; crypto VASPs (NY DFS): annual + targeted.
    - **Exam request list** — full AML program, EWRA, BSA officer charter, training records, independent-test report + remediation, sample SAR/CTR, sample CIP/CDD files, exception logs, OFAC hit logs, Board minutes evidencing oversight.
    - **Common exam findings (FFIEC BSA Manual public 2025)** — outdated risk assessment, weak SAR narratives, OFAC false-positive handling, beneficial-ownership gaps, CTR aggregation errors, training gaps, lack of independence in testing.
    - **MRA/MRIA escalation** — see `/regulator-relations-fintech` for response playbook.

## Output
Write `docs/compliance/kyc-aml-program-<project>.md`:

```markdown
# BSA/AML Program — <project>
**Date:** <YYYY-MM-DD>
**BSA Officer:** <name>, <title>; backup <name>
**Board Approval:** <YYYY-MM-DD>, Minutes Ref §<n>
**Independent Test Cadence:** <12/18/24 months>
**Next Independent Test:** <date>

## 1. Program scope
- Business activities in scope: <MSB / MTL / lending / crypto VASP / securities BD>
- Regulators: FinCEN, <state>, OCC/FDIC/Fed, OFAC, <NY DFS>, <SEC/FINRA>, <foreign>
- Jurisdictions: <US states + foreign>
- Annual volume projection (Y1): $<n>M throughput, ~<n>k customers
- Risk appetite statement: <attached>

## 2. Five-pillar program

### Pillar 1 — Designated BSA Officer
- **Officer**: <name>, <title>, reports to <Board AML Committee chair>
- **Authority**: full freeze, halt-onboarding, SAR-file-without-business-signoff
- **Qualifications**: CAMS-certified, <n>-yr AML experience
- **Backup**: <name>; trained quarterly
- **Compensation**: not tied to growth metrics; independence policy attached
- **Resources**: $<n>k/yr program budget; <n> FTE compliance team

### Pillar 2 — Written Policies + Procedures
- Master AML Policy (this doc) — annual review
- Procedure manuals: CIP, CDD, EDD, Transaction Monitoring, SAR Filing, CTR, OFAC, Recordkeeping, Training
- Version control: <Confluence / Notion / Vanta-policy / GitHub>
- Annual review owner: BSA Officer; Board AML Committee approves

### Pillar 3 — Training
| Audience | Cadence | Duration | Provider |
|---|---|--:|---|
| All employees | annual | 1 hr | ACAMS / internal LMS |
| Front-line (onboarding, support) | annual + new-hire 30d | 3 hr | role-specific |
| Compliance team | annual | 16-40 hr | CAMS CE |
| Senior management | annual | 2 hr | external counsel |
| Board | annual | 1 hr | external counsel |

### Pillar 4 — Independent Testing
- **Cadence**: every 18 months
- **Next test**: <YYYY-MM-DD>
- **Provider**: <Crowe / Forvis / K2 Integrity / internal audit if SOX-grade>
- **Budget**: $<n>k
- **Scope**: full BSA/AML/OFAC; risk-assessment validation; rule tuning; SAR quality

### Pillar 5 — CDD + Beneficial Ownership
- CIP procedure (Section 3 below)
- CDD ongoing monitoring (Section 5)
- Beneficial Ownership Rule + BOI Report compliance (Section 4)
- 5-yr post-closure retention

## 3. Customer Identification Program (CIP)

### Minimum data collected
| Customer | Required | Verification method |
|---|---|---|
| Individual US | name, DOB, address, SSN/ITIN | passport/DL + selfie+liveness + KBA |
| Individual non-US | name, DOB, address, passport + country | passport scan + selfie + Address verification |
| Domestic entity | legal name, address, EIN, formation state | articles + EIN letter + Sec-of-State lookup |
| Foreign entity | legal name, address, foreign tax ID | apostilled formation docs + ownership chart |

### Verification timeline
- Individuals: pre-funding for MSB; within 30 d for bank accounts
- Entities: pre-funding; beneficial owners collected at same time

### Lack-of-verification protocol
- Account opened: deposits only, no withdrawals, no third-party transfers
- T+14: warning to customer
- T+30: account closed; funds returned via original method or escheated per state law

### CIP notice
- Provided at account open via <signup screen / welcome email / branch handout>
- Language: "USA PATRIOT Act requires us to obtain, verify, and record information that identifies each person who opens an account…"

## 4. Beneficial Ownership

### Threshold
- Ownership prong: ≥25% equity
- Control prong: one individual with significant control (CEO, MD, GP)
- Refresh trigger: material ownership change, M&A, control change, risk-tier change

### Collection mechanism
- FinCEN CDD certification form (or equivalent in our onboarding flow)
- Ownership chart for layered structures
- Senior-manager sign-off for >2 layers

### BOI Report (Corporate Transparency Act)
- Filing party: reporting company itself files with FinCEN BOI
- Initial: within 90 d of formation (30 d after Jan 1 2025)
- Updates: within 30 d of material change

### Recordkeeping
- 5 yr post-closure; WORM storage; produced for exam

## 5. CDD tier matrix

| Tier | Trigger | Verification | Monitoring frequency | Approval level |
|---|---|---|---|---|
| **SDD** (EU only) | regulated FI / listed co | reduced | annual review | analyst |
| **Standard** | retail consumer, baseline activity | doc + selfie + KBA | rule-based + quarterly review | analyst |
| **EDD** | PEP, high-risk geo, MRB, cash-intensive, >$15k/mo, MSB customer | + SoF + SoW + senior-mgmt sign-off | rule-based + semi-annual case review | senior compliance + BSA officer co-sign |
| **EDD-Plus** | private banking >$1M, correspondent FI | + on-site visit + UBO trace + ongoing-relationship review | monthly review + quarterly trend | BSA officer + Compliance Committee |
| **Decline** | sanctions hit, FATF black, prohibited business | n/a | n/a | BSA officer |

## 6. Transaction Monitoring governance

### Coverage statement
Every monetary movement is screened: account-funding, internal transfer, ACH out/in, wire out/in, card transaction, crypto deposit/withdrawal, lending origination.

### Rule lifecycle
| Stage | Owner | Cadence |
|---|---|---|
| Hypothesis + threshold proposal | Analyst | as needed |
| Threshold rationale review | BSA Officer | per rule |
| Pilot (shadow mode) | Compliance | 30 d |
| Production tuning | Compliance | quarterly |
| Annual rule review | BSA Officer + indep test | annually |
| Material threshold change | Board AML Committee | per change |

### Initial rule set
| Rule | Trigger | Disposition SLA |
|---|---|---|
| Structuring | 3+ sub-$10k same-day = $30k+ | 24 hr |
| Velocity | >10 transactions/hr | 4 hr |
| Geographic anomaly | first transfer to FATF-grey | 24 hr |
| Pass-through | deposit + immediate same-amount withdrawal | 24 hr |
| Round-trip crypto | crypto buy + withdraw to self-hosted | 4 hr |
| OFAC hit (post-onboard) | any | 4 hr |
| PEP elevation post-onboard | new PEP designation | 24 hr |
| Cash velocity | >$8k cash-equivalent/day | 24 hr |

### Investigator workload target
- 10-12 alerts/analyst/day standard
- 4-6 alerts/analyst/day if heavy EDD cases
- False-positive target <70% by month 6 of rule deployment

## 7. SAR + CTR workflow

### SAR
- **30-d clock starts** at: <documented start date in case>
- **File via**: FinCEN BSA E-Filing
- **Approver**: BSA Officer (with backup-officer designation for absences)
- **Quality checklist**: who/what/when/where/why narrative; subject identifiers complete; transaction details with dates/amounts/counterparties; supporting docs attached
- **Continuing-activity SAR**: every 90 d if pattern continues
- **Tipping-off discipline**: never disclose; subpoena response goes through outside counsel + DOJ liaison
- **Quarterly Board report**: SAR count, themes, large-dollar (>$1M), patterns

### CTR
- **Trigger**: cash >$10k single day, single customer, aggregated across teller/ATM/branch
- **Aggregation engine**: same-customer-same-day rollup
- **Timeline**: 15 d (paper) / 25 d (e-file)
- **Phase I exemptions**: banks, governments, listed cos
- **Phase II exemptions**: regular cash customers with annual review + DOEP filing

### Form 8300 (if applicable)
- Cash >$10k from one customer
- Jointly to FinCEN + IRS
- 15-d clock

## 8. OFAC program

### Screening cadence
| Stage | Lists | Frequency |
|---|---|---|
| Onboarding | SDN + consolidated + 50%-rule | real-time |
| Transaction | SDN + sectoral + country | per transaction |
| Daily batch re-screen | all lists | overnight |
| Employee/vendor | all lists | per hire + annual |
| Counterparty FI | SDN + sectoral | per relationship + annual |

### Hit handling
- L1 review: 4 business hours
- L2 review: 8 business hours
- L3 (BSA Officer): 24 business hours
- Confirmed hit → block + OFAC Blocking Report within 10 business days
- Rejected transaction → Rejection Report within 10 business days
- Annual ODFI Annual Report by Sept 30

### Voluntary self-disclosure
- If violation discovered, decision tree:
  1. Outside counsel engaged within 24 hr
  2. Privileged investigation
  3. Voluntary disclosure within OFAC guideline window if confirmed
  4. Up to 50% penalty mitigation

## 9. Recordkeeping schedule
| Record | Retention | Storage |
|---|---|---|
| CIP records | 5 yr post-closure | WORM (S3 Object Lock Compliance) |
| CDD/EDD files | 5 yr post-closure | WORM |
| SAR + supporting docs | 5 yr post-filing | WORM, separate access |
| CTR + supporting docs | 5 yr post-filing | WORM |
| Wire records ≥$3k | 5 yr | WORM |
| Monetary instrument logs | 5 yr | WORM |
| Training records | 5 yr | LMS export + WORM |
| Board minutes evidencing oversight | permanent | corporate records |
| OFAC hit logs | 5 yr | WORM |
| Independent-test reports | 5 yr | WORM |

## 10. Enterprise-wide Risk Assessment (EWRA)
- **Cadence**: annual + on material change
- **Next refresh**: <YYYY-MM-DD>
- **Approval**: Board AML Committee
- **Inputs**: customer risk distribution, product inherent risk, geographic exposure, channel risk, transaction trends, SAR/CTR volume, exam findings, peer benchmark
- **Output**: residual heat map; rule roadmap; resource projection

## 11. Budget — Y1
| Line | Cost |
|---|--:|
| BSA Officer (FT) | $180k |
| Compliance team (2 FTE) | $200k |
| Independent test | $120k |
| Training (LMS + CAMS) | $25k |
| Sanctions/PEP/AdverseMedia | $40k |
| Transaction monitoring engine | $60k |
| Case management | $35k |
| Outside counsel retainer | $50k |
| WORM storage | $5k |
| Travel Rule messaging (if crypto) | $30k |
| **Total Y1** | **~$745k** |

## 12. 90-day stand-up plan
| Week | Milestone |
|---|---|
| 1-2 | BSA Officer engaged (interim ok); Board AML Committee chartered; outside counsel retained |
| 2-4 | Draft policies + procedures (this doc + 8 procedure manuals) |
| 3-6 | EWRA v1 drafted; risk-tier matrix Board-approved |
| 4-7 | CIP + CDD vendor live (Persona/Onfido + ComplyAdvantage) |
| 5-8 | Transaction monitoring rules live (shadow mode) |
| 6-9 | Training v1 deployed; all-employee + front-line tracked |
| 7-10 | SAR workflow tabletop; FinCEN BSA E-Filing access |
| 8-11 | OFAC screening live + tested |
| 9-12 | Independent-test provider engaged; baseline assessment booked at month 12 |
| 10-12 | Board approves full program; production launch |

## 13. Risk if program insufficient
- FinCEN civil penalty: $25k–$57k per violation; structural-failure penalties unlimited
- Willful violation: criminal; up to $1M/violation + 30 yr imprisonment for officer
- License revocation (MSB registration, MTL, BitLicense, FCA, MAS)
- Consent order (12-36 mo) + monitor + lookback
- Bank de-risking: payment rails revoke; can't replace inside 6-12 mo
- Reputational + customer-class-action exposure

## 14. Sign-off
- BSA Officer: <name>, <signature>, <date>
- CEO / President: <name>, <signature>, <date>
- Board Chair (AML Committee): <name>, <signature>, <date>
- Outside Counsel review: <firm>, <date>
```

## Verification
- BSA Officer named with documented authority, independence, and qualifications.
- All five pillars individually addressed with owner + cadence.
- CIP procedure includes minimum data, verification method, lack-of-verification protocol, and CIP notice.
- EDD trigger list explicit; auto-EDD vs standard CDD criteria measurable.
- SAR + CTR + Form 8300 workflows have stated SLA + filing portal + approver.
- OFAC screening cadence covers onboarding + transactional + daily batch.
- Independent-test cadence is ≤24 months with named provider + budget.
- 5-yr retention schedule covers every BSA-required record class.
