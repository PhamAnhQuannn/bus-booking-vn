---
name: regulator-relations-trading
description: Trading-venue / broker-dealer regulator-relations playbook — SEC / CFTC / FINRA / state engagement, SRO registration (Form ATS / ATS-N / Form 1 / Form SEF / DCM §38.3), 15c3-5 market-access rule, CAT reporting, MiFID II algorithmic flagging, surveillance + monitoring obligations. Outputs to `docs/compliance/regulator-relations-trading-<project>.md`. Reads `/project-classify` to skip XS+S. Use when user says "SEC exam", "CFTC exam", "FINRA registration", "Form ATS", "ATS-N", "broker-dealer registration", "CAT", "15c3-5", "MiFID II algo flag", "/regulator-relations-trading", or before standing up trading venue / broker / market-access desk. Pairs with `/regulator-relations-fintech` (banking side), `/court-admissible-logging` (records), `/market-microstructure-design` (rulebook).
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 8h
---

# /regulator-relations-trading — SEC / CFTC / FINRA Engagement Playbook

Invoke as `/regulator-relations-trading`. This is the operating manual for living under continuous trading-market supervision: which regulator covers which conduct, what registration unlocks what activity, how exam cycles run, and how to survive a CAT data-quality letter or a 15c3-5 deficiency finding without losing the BD.

## Why you'd care
Securities and futures regulators do not warn — they examine and they file. One missed CAT batch + one bad 15c3-5 risk-check + one delayed STOR can turn into a $50M+ AWC and Heightened Supervision before the firm understands what happened. The 2017–2024 SEC + FINRA enforcement record under Rule 15c3-5 alone exceeds **$200M in fines** to firms that thought their pre-trade risk-checks "were good enough." Skip this and you find out what an OIP is the week before your CCO has to make a settle-or-litigate call.

## Effort caveat — multi-year regulatory engagement
- **Hours in this skill** = mapping + governance-cadence + filing-shell design.
- **Real-world calendar:** SEC Form 1 exchange application 18–36 months; Form ATS / ATS-N initial 30–120 days but typically 6–9 months with iteration; FINRA BD New Member Application (NMA) 180 days statutory + revisions; CFTC DCM application Part 38 ~12 months; SEF Form SEF ~9 months; CAT industry-test then go-live ~12 months; 15c3-5 control build pre-go-live 6–12 months.
- AWC remediation 6–18 months. Heightened Supervision 12–24 months. OIP + Settlement Order multi-year.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/compliance/regulatory-<project>.md` for activity posture (broker, dealer, exchange, ATS, market-access provider, SEF, DCM, swap dealer, FCM, IB).
3. Read `docs/design/market-microstructure-<project>.md` if venue.
4. Read `docs/compliance/court-admissible-logging-<project>.md` for records linkage.
5. Identify named officers: CEO, CCO (FINRA Rule 3130), AMLCO (Rule 3310), FINOP (Series 27), CFO, CTO/CISO (Reg SCI if exchange / ATS-volume threshold).

## Inputs
- Activity scope: market-making, agency execution, principal trading, prop, ATS operation, exchange, SEF, DCM, FCM, IB, swap dealer, MSP, capital introduction, custody.
- Membership posture: FINRA (BD), MSRB (muni), NFA (futures / swaps), CME / ICE / Cboe DRMC (clearing).
- State registrations + Blue Sky.
- Cross-border: FCA, BaFin, AMF, ESMA NCAs, MAS, HKMA, SFC, FINMA, JFSA, ASIC.
- Volume / asset thresholds triggering Reg SCI (≥5% TCA), CAT Industry Member (BD), CFTC Large Trader.

## Process

1. **Map your supervisory matrix** — who has authority over what:

   | Regulator | Authority | Cycle | Key vehicles |
   |---|---|---|---|
   | SEC Division of Examinations (EXAMS) | Investment Advisers + BDs + Exchanges + ATSs + SROs | Risk-based (BDs typically 3–5 yr) | Risk Alerts, Deficiency Letters, OIPs |
   | SEC Enforcement | Fed securities laws | Reactive | Wells Notices, OIPs, Settlement Orders |
   | CFTC Division of Market Oversight (DMO) | DCM, SEF, SDR | Annual rule enforcement reviews | RER, NoMs |
   | CFTC Division of Swap Dealer & Intermediary Oversight (DSIO) | SDs, FCMs, IBs | Risk-based | DSIO Letters |
   | CFTC Division of Enforcement (DOE) | CEA violations | Reactive | Enforcement Actions |
   | FINRA Examinations | BD members | Cycle 1–4 yr by risk | Cycle Exam, Cause Exam, Sweep Exam |
   | FINRA Enforcement | FINRA Rules | Reactive | AWC, Letter of Caution, Hearing |
   | MSRB | Muni rules (G-series) | Indirect (via FINRA) | MSRB Notices |
   | NFA | Futures intermediaries | 2 yr typical | NFA Examinations |
   | State securities (NASAA) | Blue Sky + state-BD | Reactive + cycle | State actions |
   | OCIE/EXAMS Office of Market Intermediary Oversight | larger BDs | risk-based | |
   | FCA (UK) | UK BDs + trading venues | Continuous SREP-style | FG, FS, Final Notice |
   | ESMA NCAs (BaFin, AMF, etc.) | MiFID II investment firms | Per-NCA | |

2. **Pick your registration path** — every activity = a Form:

   | Activity | Primary registration | Form | Statutory clock |
   |---|---|---|---|
   | Broker-dealer | SEC §15 + FINRA membership | Form BD + FINRA NMA | 45-day SEC + 180-day FINRA |
   | Investment Adviser >$110M | SEC Form ADV | ADV Part 1/2A/2B | 45-day default-effective |
   | Exchange | SEC §6 | Form 1 | no fixed clock; typically 18–36 months |
   | ATS | SEC Reg ATS Rule 301 | Form ATS (BD-only ATSs) | 20 days post-filing |
   | NMS Stock ATS | Reg ATS Rule 304 | Form ATS-N (public) | SEC reviews; effective on declaration |
   | SEF | CFTC Part 37 | Form SEF | ~9 months |
   | DCM | CFTC Part 38 | §38.3 application | ~12 months |
   | Swap Dealer | CFTC §4s | NFA Form 7-R + 8-R | rolling |
   | FCM | CFTC §4d | Form 1-FR-FCM + NFA | ~90 days |
   | Crypto exchange (state MTL path) | per-state MTL + FinCEN MSB | per state | 12–24 months full footprint |
   | EU MiFID II investment firm | NCA authorization | per NCA | 6–12 months |
   | UK FCA authorized firm | FCA Part 4A | VOP / new auth | 6–12 months |

3. **Reg NMS / Reg ATS / Reg SCI scope check**:
   - **Reg NMS Rule 611 (Order Protection)** — apply to NMS stocks.
   - **Reg NMS Rule 605 / 606** — execution-quality + order-routing disclosure (Rule 605 reporting expanded by 2024 amendments to include held NMS stock orders); Rule 606 Part I quarterly + Part II on customer request.
   - **Reg ATS Rule 301(b)(2)** — fair-access threshold (5% volume in any NMS stock for 4 of past 6 calendar months triggers fair-access obligation).
   - **Reg ATS-N Rule 304** — public disclosure of operations.
   - **Reg SCI Rules 1000–1007** — applies to SCI entities (exchanges, registered clearing agencies, certain ATSs ≥5% TCA, plan processors). Annual review, BC/DR, designated officer, written policies.
   - Document **why** Reg SCI / Reg ATS / 605 applies or does not.

4. **15c3-5 Market Access Rule — pre-trade risk checks**:
   - SEC Rule 15c3-5 requires every BD with market access to maintain pre-trade risk-management controls **owned and operated by the BD** (not the customer).
   - Mandatory checks:
     - **Capital threshold** (per-customer credit limit not exceeded)
     - **Credit threshold** (firm-wide credit limit not exceeded)
     - **Erroneous order** controls (price reasonableness vs NBBO, size limits, fat-finger)
     - **Duplicative order** controls
     - **Regulatory compliance** (Reg SHO, options position limits, etc.)
     - **Restricted-list** check
   - **Annual CEO certification** to FINRA / SEC of 15c3-5 controls.
   - Outsourcing risk-checks to a tech vendor is permitted, but **legal responsibility cannot be delegated** — BD remains liable.
   - 2014 amendments and 2024 risk alerts: ad-hoc "override" buttons must have audit trail and policies; "regulatory routing arrangements" disclose to customers; net-capital implications of latency-sensitive controls.

5. **CAT (Consolidated Audit Trail) reporting — Rule 613 / CAT NMS Plan**:
   - Every Industry Member (BD) reports order, route, modification, cancel, execution events to FINRA CAT LLC daily by 8:00 AM ET T+1.
   - Customer + Account Information (CAIS) — firm customer files synced into CAT.
   - **Error rate threshold**: rejections / repair >5% triggers data-quality concerns; SROs may impose disciplinary action.
   - Linkage: CAT events tie to OATS legacy data (now retired), FINRA TRACE for fixed income, OCC for options.
   - Reporter Portal access controls; CAIS submission cadence (monthly + on-demand).
   - 2024 SEC + SROs adopted exemption for Allocation Report and refined Customer ID standards; track future CAT NMS Plan amendments.

6. **FINRA Rule 3110 supervision — written supervisory procedures (WSPs)**:
   - WSPs required for every line of business, kept current, reviewed.
   - **Designated Supervisor** for each function; **Designated Principal** (Series 24 / 9 / 10) per branch / desk.
   - Heightened Supervision triggers: 1017 application, Statutory Disqualification, certain disciplinary history.
   - Annual Compliance Meeting (FINRA Rule 3110(a)(7)) for every registered rep.
   - Branch inspections cadence (Rule 3110(c)): Office of Supervisory Jurisdiction (OSJ) annual; non-OSJ branches 3-yr cycle; non-branch locations risk-based.

7. **FINRA Rule 3120 + 3130 (CEO / CCO certifications)**:
   - Annual report by CCO to senior management on supervisory system.
   - Annual certification by CEO that processes exist to establish, maintain, and review WSPs.
   - 3130 certification is personal — CEO signature.

8. **AML — FINRA Rule 3310 / BSA / FinCEN**:
   - AML Compliance Officer (AMLCO) named; independent testing annual (≥1× / 18 months if eligible exemption).
   - Customer Identification Program (CIP) — 31 CFR 1023.220.
   - Customer Due Diligence + Beneficial Ownership — 31 CFR 1010.230 (Beneficial Ownership Rule).
   - Suspicious Activity Reports (SARs) — 31 CFR 1023.320; 30-day filing window (60-day if no suspect).
   - Currency Transaction Reports (CTRs) — $10k+ cash.
   - OFAC sanctions screening per 50 USC §1701.

9. **Communications + recordkeeping — links to /court-admissible-logging**:
   - FINRA Rule 2210 (communications with public) — pre-use / pre-filing requirements by audience + content type.
   - FINRA Rule 4511 + 17a-3 / 17a-4 books and records.
   - The 2021–2024 off-channel-comms sweep (~$3B in fines) — capture or block.
   - Email + IM + collaboration archive: Smarsh / Global Relay / Theta Lake / Proofpoint.

10. **MiFID II / EU specific (if EU venue or branch)**:
    - **Algorithmic trading flagging** — Art 17 + RTS 6 + Art 48 venue rules; "algo" trader must register with NCA; venue tracks every algo strategy / DEA route.
    - **Direct Electronic Access (DEA)** — Art 17(5) + RTS 6 controls similar to 15c3-5.
    - **Transaction reporting** — RTS 22 to NCA via Approved Reporting Mechanism (ARM); T+1.
    - **Best execution** — Art 27 + RTS 27 (venue) / RTS 28 (firm) reports; UK FCA repealed RTS 27/28 from Dec 2024 — still mandatory in EU.
    - **MAR Art 16** — STORs to NCA on suspicious orders / transactions.
    - **Tick size regime** — RTS 11 mandatory grid.
    - **Pre-/post-trade transparency** — RTS 1 (equities) + RTS 2 (non-equities).

11. **Cycle-exam playbook** — what the year looks like:

    - **T-90d:** Initial Request List (FINRA) or Information Request (SEC). 80–250 line-items. Assign owners, set internal deadlines 14d earlier than examiner.
    - **T-60 to T-30d:** Document production via secure portal (FINRA WERCS / SEC EDGAR sometimes / vendor portals).
    - **T-0 (kickoff):** Examiner-in-Charge (EIC) opens. Set tone — cooperative, transparent, legal-team in room if scope justifies but not adversarial.
    - **On-site / hybrid 4–8 weeks:** Daily examiner asks; 24–48 hr SLA. Request log mandatory.
    - **Exit meeting:** verbal findings; don't argue at the table.
    - **Findings letter:** 60–120 days. Deficiency Letter (SEC) or Findings Letter (FINRA) details issues.
    - **Response letter:** 30–60 days. Acknowledge each finding, name remediation owner + dates.
    - **Closure or escalation:** Deficiency closed, or Wells Notice → AWC settlement → public OIP if not resolved.

12. **AWC / Wells / OIP escalation ladder**:
    - **Cautionary Action** / **Letter of Caution** — non-public, no admission, no fine; clean trick-up.
    - **AWC (Acceptance, Waiver, and Consent)** — FINRA settlement, public, fine + censure + sometimes suspension/bar.
    - **Wells Notice** — SEC Enforcement staff intends to recommend enforcement action; firm submits Wells Submission within 14–30 days.
    - **OIP (Order Instituting Proceedings)** — public administrative proceeding; settle (Offer of Settlement) or litigate (ALJ → Commission appeal).
    - **Cease and Desist / Civil Penalty / Bar / Suspension / Disgorgement** — possible relief.
    - **Heightened Supervision** — informal directive to elevate review of named individuals.

13. **State + Blue Sky engagement**:
    - State BD registration for retail-facing activity (Form BD doubles as state filing in NASAA jurisdictions).
    - State exam authority for state-registered firms (<$110M AUM IAs are state).
    - NY DFS BitLicense for NY crypto exposure (parallel to BD).

14. **Cross-border posture**:
    - FCA Part 4A authorization or temporary permissions regime (TPR) for UK.
    - EU passporting via Lead NCA + MiFID II authorization.
    - Singapore MAS Capital Markets Services license.
    - Hong Kong SFC Type 1–10 licenses.
    - FINMA for Switzerland-domiciled.
    - Japan FSA / JFSA Type II FIBO for retail trading.

15. **Cadence + governance discipline**:
    - **Daily**: surveillance alert triage; trade reporting reconciliation.
    - **Weekly**: CCO / CRO sync; new-issue / restricted-list update.
    - **Monthly**: Risk committee; supervisory log review; 605/606 prep; CAT error rate review.
    - **Quarterly**: Board / Audit committee compliance update; written supervisory log review.
    - **Annual**: 3130 certification by CEO; 3120 CCO report; AML independent test; 15c3-5 control review; WSP review; testing of business-continuity plan (Reg SCI BC/DR if applicable); annual MLRO + AMLCO report.

16. **Anti-patterns**:
    - "We outsourced 15c3-5 to a vendor so we're fine." — BD legal responsibility never transfers; vendor failure is BD failure.
    - "CAT errors are noisy; we'll fix it next week." — sustained >5% error rate triggers a Cause Exam.
    - "ATS but never filed Form ATS-N." — operating an NMS Stock ATS without ATS-N is a registration violation.
    - "We use WhatsApp on personal devices for client comms." — automatic 17a-4(b)(4) violation; sweep target.
    - "We argue every finding in the exit meeting." — lose goodwill; argue in the written response, not at the table.
    - "Compliance reports up to General Counsel only." — CCO independence is examined; reporting line to CEO + Board access required.
    - "Wells Submission is optional." — last opportunity to head off OIP; always submit.
    - "Our algorithm 'isn't really an algorithm' so MiFID II Art 17 doesn't apply." — NCAs interpret broadly; document why if you disagree.

## Output

Write `docs/compliance/regulator-relations-trading-<project>.md`:

```markdown
# Regulator Relations (Trading) — <project>
**Date:** <YYYY-MM-DD> | **CCO:** <name + CRD#> | **AMLCO:** <name>
**Designated Examining Authority (DEA):** <FINRA / NYSE / Nasdaq>

## Activity scope + registrations
| Activity | Registration | Status | Renewal |
|---|---|---|---|
| Broker-dealer (agency + principal) | SEC §15 + FINRA NMA | active <date> | n/a |
| NMS Stock ATS | Reg ATS Rule 304 — Form ATS-N | filed <date>, effective <date> | amend on material change |
| Market access (15c3-5) | parent BD obligation | controls live | annual CEO cert |
| CAT Industry Member | CAT NMS Plan | live <date> | continuous |
| FINRA membership | FINRA By-Laws Art III | active | n/a |
| MSRB (muni) | Form A-12 | not in scope | — |
| NFA (futures/swaps) | n/a | not in scope | — |
| State BDs | per-state (Blue Sky) | <list> | annual |
| UK FCA | n/a | not in scope | — |

## Supervisory map
| Body | Primary contact | Last touch | Next cycle |
|---|---|---|---|
| FINRA EIC | <name + email> | <date> | <date> |
| SEC EXAMS BDII assigned | <name + email> | <date> | risk-based |
| FinCEN | n/a (delegated) | — | — |
| State NY DFS (if NY crypto) | <name> | <date> | annual |
| OFAC | n/a (compliance program) | — | — |

## WSPs (Rule 3110)
- Manual location: <path> + versioned in compliance-mgmt system
- Last update: <date>
- Last review: <date>
- Designated Principal per desk: <table>

## Key annual certifications
- 3130 CEO certification: signed <date>, next <date>
- 3120 CCO report to senior mgmt: <date>
- 15c3-5 annual CEO certification: <date>
- AML independent test: <date> by <firm>
- BCP / Reg SCI (if applicable): <date>
- CAT data-quality attestation: continuous; last review <date>

## Pre-trade risk-controls inventory (15c3-5)
| Control | Owner | Latency | Override audit |
|---|---|---|---|
| Per-customer credit limit | Risk | <µs> | logged |
| Firm credit limit | Risk | <µs> | logged |
| Erroneous-price (vs NBBO ±X%) | Trading Tech | <µs> | logged + Slack |
| Erroneous-size (max-shares + max-notional) | Trading Tech | <µs> | logged |
| Duplicate-order (hash window) | Trading Tech | <µs> | logged |
| Reg SHO (locate + threshold list) | Compliance | T+0 | logged |
| Position-limit (options / futures) | Risk | T+0 | logged |
| Restricted list | Compliance | T+0 | logged |
| Override approver | CRO + CCO joint | n/a | logged |

## CAT reporting
- Reporter: FINRA CAT
- Submission cadence: every business day by 08:00 ET T+1
- CAIS: monthly + on-change
- Current error rate (rolling 30d): <%>
- Repair SLA: T+1 by 17:00 ET

## Communications capture
- Email / Slack / Teams: <vendor>
- Mobile SMS / WhatsApp: <vendor> + MDM (Intune)
- Bloomberg / Symphony / Refinitiv: native capture
- Annual RR off-channel attestation: <date>

## Exam-cycle calendar
| Stage | Date / planned | Owner |
|---|---|---|
| FINRA cycle exam (T+90 FDL) | <date> | CCO |
| SEC EXAMS sweep (CAT data quality) | <date> | CCO + CTO |
| Annual 3130/3120 | <date> | CEO + CCO |
| AML independent test | <date> | external |
| BCP test | <date> | COO |
| 605/606 quarterly | <quarterly> | Trading + Compliance |

## Cross-border posture
- UK FCA: not authorized (TPR n/a)
- EU MiFID II: not authorized (no EU branch)
- Singapore / Hong Kong / Japan: not in scope
- Note any reverse-solicitation / chaperoning arrangements

## Recent regulatory actions (firm)
| Action | Date | Status |
|---|---|---|
| <e.g. FINRA AWC No. 20XX-...> | <date> | settled / open |
| <e.g. SEC Deficiency Letter> | <date> | remediated |

## Escalation map
- Counsel-of-record: <firm + partner>
- Wells / OIP response counsel: <firm>
- Insurance — D&O + E&O carrier + policy ref: <ref>

## Open items + risk register entries
- <items linked to /risk-register>

## Cost band Y1
| Line | $ |
|---|--:|
| CCO + 2 compliance officers | $500k–800k |
| AMLCO + 2 analysts | $400k–650k |
| External counsel retainer | $100k–300k |
| AML independent test | $50k–100k |
| 15c3-5 controls (build + maintain) | $200k–600k |
| CAT reporter + CAIS | $80k–200k |
| Comms-capture vendor | $80k–250k |
| Surveillance vendor | $250k–800k |
| Annual financial + ops audit (FINRA-acceptable) | $150k–400k |
| **Y1 total** | **~$1.8M–4.1M** |

## 12-month plan
1. WSP refresh + 3130 cycle (Q1)
2. CAT data-quality remediation (continuous; Q1 baseline)
3. 15c3-5 annual review + tabletop fat-finger drill (Q2)
4. AML independent test (Q2)
5. FINRA cycle exam prep (depends on FDL date)
6. Off-channel-comms attestation refresh + MDM audit (Q3)
7. BCP / Reg SCI test (Q4 if Reg SCI entity)
8. 605 / 606 quarterly publication discipline
```

## Verification
- Every active line of business has a current WSP + named Designated Principal.
- Annual 3130 CEO certification and 3120 CCO report dates set and tracked.
- 15c3-5 controls enumerated, latency budgets documented, override workflow audited.
- CAT submission cadence on-track; error rate <5% over rolling 30d.
- AML independent test scheduled within last 18 months.
- Off-channel-communications attestation completed within last 12 months.
- Cycle-exam calendar populated with named EIC and document-production owner.
- Cross-border posture documented (even if "not in scope, here's why").
